import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantContextService } from '../../common/context/tenant-context.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { MovementsQueryDto } from './dto/movements-query.dto.js';

/** Los insumos se mueven con 3 decimales (`Decimal(12,3)`). */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

export interface ConsumptionResult {
  /** `false` si la orden ya se había consumido o no tenía receta. */
  aplicado: boolean;
  /** Insumos con movimiento de salida. */
  insumos: number;
  /** Líneas de la comanda (platos) consideradas. */
  lineas: number;
  /** Platos de la comanda sin escandallo: no descuentan nada. */
  sinReceta: string[];
}

/**
 * Kardex automático por escandallo (AYCDS-11).
 *
 * Cuando la comanda pasa a `ENTREGADO` se descuentan los insumos de su receta:
 * por cada plato, `cantidad × escandallos_recetas.cantidad_por_plato`. Un combo
 * se expande a sus platos (`combos_platos.cantidad`) antes de explotar.
 *
 * Reglas:
 *  - **Idempotente**: si la orden ya tiene `SALIDA` en el kardex, no descuenta
 *    otra vez. El estado `ENTREGADO` no se repite, pero un reintento del
 *    cliente sí podría llegar.
 *  - **No bloquea por recetas faltantes**: un plato sin escandallo se omite y
 *    se reporta en `sinReceta`; la cocina no deja de servir por eso.
 *  - **El stock no baja de cero**: la base tiene un `CHECK` que lo prohíbe, así
 *    que el faltante queda como 0 y el movimiento registra lo consumido. El
 *    semáforo (AYCDS-13) lo muestra agotado.
 *  - **Sin transacción propia**: corre dentro de la transacción del request
 *    (AYCDS-22), así que si el descuento falla la entrega tampoco se confirma.
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async consumeOrder(
    ordenId: string,
    actorId?: string | null,
  ): Promise<ConsumptionResult> {
    const orden = await this.prisma.scoped.ordenes.findFirst({
      where: { id: ordenId },
      select: {
        id: true,
        numero_orden: true,
        empresa_id: true,
        sucursal_id: true,
        detalles_orden: {
          select: { tipo: true, plato_id: true, combo_id: true, cantidad: true },
        },
      },
    });
    if (!orden) throw new NotFoundException('Orden no encontrada');

    const yaConsumida = await this.prisma.scoped.movimientos_inventario.count({
      where: { orden_id: orden.id, tipo: 'SALIDA' },
    });
    if (yaConsumida > 0) {
      return { aplicado: false, insumos: 0, lineas: 0, sinReceta: [] };
    }

    const platos = await this.expandirAPlatos(orden.detalles_orden);
    if (platos.size === 0) {
      return { aplicado: false, insumos: 0, lineas: 0, sinReceta: [] };
    }

    const recetas = await this.prisma.scoped.escandallos_recetas.findMany({
      where: { plato_id: { in: [...platos.keys()] } },
      select: { plato_id: true, insumo_id: true, cantidad_por_plato: true },
    });

    const porInsumo = new Map<string, number>();
    const conReceta = new Set<string>();
    for (const receta of recetas) {
      conReceta.add(receta.plato_id);
      const cantidad =
        (platos.get(receta.plato_id) ?? 0) * Number(receta.cantidad_por_plato);
      porInsumo.set(
        receta.insumo_id,
        round3((porInsumo.get(receta.insumo_id) ?? 0) + cantidad),
      );
    }

    const sinReceta = [...platos.keys()].filter((plato) => !conReceta.has(plato));
    if (porInsumo.size === 0) {
      this.logger.warn(
        `Comanda ${orden.numero_orden} sin escandallo: ${sinReceta.length} plato(s) sin receta`,
      );
      return { aplicado: false, insumos: 0, lineas: platos.size, sinReceta };
    }

    for (const [insumoId, cantidad] of porInsumo) {
      const stockResultante = await this.descontarStock(
        orden.empresa_id,
        orden.sucursal_id,
        insumoId,
        cantidad,
      );

      await this.prisma.scoped.movimientos_inventario.create({
        data: {
          empresa_id: orden.empresa_id,
          sucursal_id: orden.sucursal_id,
          insumo_id: insumoId,
          tipo: 'SALIDA',
          cantidad,
          stock_resultante: stockResultante,
          motivo: `Consumo ${orden.numero_orden}`,
          orden_id: orden.id,
          actor_id: actorId ?? this.tenantContext.get()?.userId ?? null,
        },
      });
    }

    await this.audit.record({
      empresaId: orden.empresa_id,
      sucursalId: orden.sucursal_id,
      usuarioId: actorId ?? this.tenantContext.get()?.userId ?? null,
      accion: 'kardex.consumo',
      entidad: 'ordenes',
      entidadId: orden.id,
      detalle: {
        numeroOrden: orden.numero_orden,
        insumos: porInsumo.size,
        lineas: platos.size,
        sinReceta,
      },
    });

    return {
      aplicado: true,
      insumos: porInsumo.size,
      lineas: platos.size,
      sinReceta,
    };
  }

  /**
   * Descuenta del stock sin bajar de cero.
   *
   * La base tiene un `CHECK` que prohíbe cantidades negativas, así que el
   * faltante se refleja como stock 0 y queda igualmente en el movimiento (la
   * diferencia se ve al reponer). Se usa **concurrencia optimista**: el
   * `updateMany` exige la cantidad leída, así que si otra comanda descontó en
   * medio se reintenta con el valor nuevo en vez de pisarlo.
   */
  private async descontarStock(
    empresaId: string,
    sucursalId: string,
    insumoId: string,
    cantidad: number,
  ): Promise<number> {
    for (let intento = 0; intento < 3; intento += 1) {
      const actual = await this.prisma.scoped.stocks_sucursal.findFirst({
        where: { sucursal_id: sucursalId, insumo_id: insumoId },
        select: { cantidad: true },
      });

      if (!actual) {
        // Primera vez que la sucursal mueve este insumo: nace en 0.
        try {
          await this.prisma.scoped.stocks_sucursal.create({
            data: {
              empresa_id: empresaId,
              sucursal_id: sucursalId,
              insumo_id: insumoId,
              cantidad: 0,
            },
          });
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
          continue;
        }
        return 0;
      }

      const stockActual = Number(actual.cantidad);
      const nuevo = Math.max(0, round3(stockActual - cantidad));

      const { count } = await this.prisma.scoped.stocks_sucursal.updateMany({
        where: { sucursal_id: sucursalId, insumo_id: insumoId, cantidad: stockActual },
        data: { cantidad: nuevo, updated_at: new Date() },
      });
      if (count > 0) return nuevo;
    }

    throw new Error(
      `No se pudo descontar el stock del insumo ${insumoId}: reintentos agotados`,
    );
  }

  /**
   * Explota la comanda a cantidades por plato. Un combo aporta la cantidad de
   * cada componente (`combos_platos.cantidad`) multiplicada por las unidades
   * pedidas.
   */
  private async expandirAPlatos(
    lineas: { tipo: string; plato_id: string | null; combo_id: string | null; cantidad: number }[],
  ): Promise<Map<string, number>> {
    const porPlato = new Map<string, number>();

    const comboIds = [
      ...new Set(
        lineas
          .filter((linea) => linea.tipo === 'COMBO' && linea.combo_id)
          .map((linea) => linea.combo_id as string),
      ),
    ];
    const componentes =
      comboIds.length > 0
        ? await this.prisma.scoped.combos_platos.findMany({
            where: { combo_id: { in: comboIds } },
            select: { combo_id: true, plato_id: true, cantidad: true },
          })
        : [];

    const porCombo = new Map<string, { plato_id: string; cantidad: number }[]>();
    for (const componente of componentes) {
      const lista = porCombo.get(componente.combo_id) ?? [];
      lista.push({ plato_id: componente.plato_id, cantidad: componente.cantidad });
      porCombo.set(componente.combo_id, lista);
    }

    for (const linea of lineas) {
      if (linea.tipo === 'PLATO' && linea.plato_id) {
        porPlato.set(
          linea.plato_id,
          (porPlato.get(linea.plato_id) ?? 0) + linea.cantidad,
        );
        continue;
      }
      if (linea.tipo === 'COMBO' && linea.combo_id) {
        for (const componente of porCombo.get(linea.combo_id) ?? []) {
          porPlato.set(
            componente.plato_id,
            (porPlato.get(componente.plato_id) ?? 0) +
              componente.cantidad * linea.cantidad,
          );
        }
      }
    }

    return porPlato;
  }

  /* --------------------------------- kardex -------------------------------- */

  /**
   * Kardex de la sucursal (AYCDS-24): movimientos con el insumo y el folio de la
   * comanda que los originó. Solo lectura.
   *
   * - Un rol con sucursal consulta la suya; `ADMIN_GLOBAL` la indica o ve todas.
   * - La ventana de fechas es opcional, pero el `limit` (máx. 500) siempre acota:
   *   sin él, un kardex viejo devolvería miles de filas.
   */
  async listMovements(query: MovementsQueryDto) {
    const sucursalId = this.sucursalDelAlcance(query.sucursalId);
    const limite = query.limit ?? 100;

    const where: Record<string, unknown> = {
      ...(sucursalId ? { sucursal_id: sucursalId } : {}),
      ...(query.insumoId ? { insumo_id: query.insumoId } : {}),
      ...(query.tipo ? { tipo: query.tipo } : {}),
    };
    if (query.desde || query.hasta) {
      const rango: Record<string, Date> = {};
      if (query.desde) rango.gte = new Date(`${query.desde}T00:00:00-05:00`);
      if (query.hasta) {
        const fin = new Date(`${query.hasta}T00:00:00-05:00`);
        rango.lt = new Date(fin.getTime() + 24 * 60 * 60 * 1000);
      }
      where.created_at = rango;
    }

    const filas = await this.prisma.scoped.movimientos_inventario.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limite,
      include: {
        insumos: { select: { id: true, nombre: true, unidad: true } },
        ordenes: { select: { numero_orden: true } },
      },
    });

    return {
      sucursalId,
      items: filas.map((fila) => ({
        id: fila.id,
        fecha: fila.created_at.toISOString(),
        tipo: fila.tipo,
        insumoId: fila.insumo_id,
        insumo: fila.insumos?.nombre ?? '',
        unidad: fila.insumos?.unidad ?? '',
        cantidad: Number(fila.cantidad ?? 0),
        stockResultante:
          fila.stock_resultante === null ? null : Number(fila.stock_resultante),
        motivo: fila.motivo,
        orden: fila.ordenes?.numero_orden ?? null,
      })),
    };
  }

  /** Rol con sucursal: solo la suya. Admin: la indicada o todas. */
  private sucursalDelAlcance(solicitada?: string): string | null {
    const delToken = this.tenantContext.get()?.sucursalId ?? null;
    if (delToken) {
      if (solicitada && solicitada !== delToken) {
        throw new BadRequestException(
          'El token está atado a otra sucursal: no se puede indicar sucursalId',
        );
      }
      return delToken;
    }
    return solicitada ?? null;
  }
}
