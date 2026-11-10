import { createHmac } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Prisma } from '../../generated/prisma/client.js';
import { TenantContextService } from '../../common/context/tenant-context.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { StockStatusQueryDto } from './dto/stock-alerts.dto.js';

const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]*$/;

type Cliente = Pick<
  Prisma.TransactionClient,
  '$queryRawUnsafe' | 'alertas_stock' | 'empresas'
>;

interface StockBajo {
  empresa_id: string;
  sucursal_id: string;
  insumo_id: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  stock_minimo: number;
  estado: 'AGOTADO' | 'BAJO';
}

export interface AlertaResumen {
  /** Insumos por debajo del mínimo en el alcance consultado. */
  evaluados: number;
  /** Alertas nuevas o que empeoraron y se notificaron. */
  nuevas: number;
  /** Alertas que dejaron de aplicar porque el stock se repuso. */
  resueltas: number;
  /** `true` si el webhook aceptó el lote. */
  enviado: boolean;
}

/**
 * Semáforo de stock y alertas con webhook (AYCDS-13).
 *
 * Reglas:
 *  - **Semáforo**: `AGOTADO` si la cantidad es 0 o menos, `BAJO` si está en el
 *    mínimo, `OPTIMO` si lo supera. Sale de la vista `v_stock_bajo`, que ya
 *    calcula el estado en la base.
 *  - **Una alerta vigente por insumo y sucursal**: la tabla `alertas_stock`
 *    guarda el estado notificado. Mientras siga igual no se vuelve a avisar
 *    (si no, n8n recibiría el mismo mensaje cada 10 minutos).
 *  - **Al reponerse, la alerta se borra**: si el insumo vuelve a caer, es un
 *    cambio de estado nuevo y se notifica otra vez.
 *  - **Sin `STOCK_WEBHOOK_URL` no se envía**: se registra en auditoría y la
 *    alerta queda pendiente (`notificado_at = null`). Desarrollo y CI no
 *    dependen de n8n.
 *  - **Firma HMAC-SHA256** del cuerpo en `X-Fogoneria-Signature` para que n8n
 *    pueda descartar llamadas ajenas.
 */
@Injectable()
export class StockAlertsService {
  private readonly logger = new Logger(StockAlertsService.name);
  private readonly schema: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    const schema = config.get<string>('DATABASE_SCHEMA') ?? 'fogoneria';
    if (!SCHEMA_PATTERN.test(schema)) {
      throw new Error(`DATABASE_SCHEMA inválido: ${schema}`);
    }
    this.schema = schema;
  }

  /* ------------------------------- semáforo ------------------------------- */

  async status(query: StockStatusQueryDto) {
    const sucursalId = this.sucursalDelAlcance(query.sucursalId);
    const cliente = this.cliente();

    const filas = await cliente.$queryRawUnsafe<
      {
        sucursal_id: string;
        insumo_id: string;
        nombre: string;
        unidad: string;
        cantidad: unknown;
        stock_minimo: unknown;
        estado: string;
      }[]
    >(
      `SELECT sucursal_id, insumo_id, nombre, unidad, cantidad, stock_minimo, estado
       FROM ${this.schema}.v_stock_bajo
       WHERE ($1::uuid IS NULL OR sucursal_id = $1::uuid)
         AND ($2::text IS NULL OR estado = $2::text)
       ORDER BY CASE estado WHEN 'AGOTADO' THEN 0 WHEN 'BAJO' THEN 1 ELSE 2 END, nombre`,
      sucursalId,
      query.estado ?? null,
    );

    const items = filas.map((fila) => ({
      sucursalId: fila.sucursal_id,
      insumoId: fila.insumo_id,
      nombre: fila.nombre,
      unidad: fila.unidad,
      cantidad: Number(fila.cantidad ?? 0),
      stockMinimo: Number(fila.stock_minimo ?? 0),
      estado: fila.estado,
    }));

    return {
      sucursalId,
      resumen: {
        total: items.length,
        agotados: items.filter((item) => item.estado === 'AGOTADO').length,
        bajos: items.filter((item) => item.estado === 'BAJO').length,
        optimos: items.filter((item) => item.estado === 'OPTIMO').length,
      },
      items,
    };
  }

  /* -------------------------------- alertas ------------------------------- */

  /** Reconcilia y notifica el alcance del usuario autenticado. */
  async checkAlerts(query: StockStatusQueryDto): Promise<AlertaResumen> {
    const { empresaId } = this.tenant();
    const sucursalId = this.sucursalDelAlcance(query.sucursalId);
    return this.reconcile(this.cliente(), empresaId, sucursalId);
  }

  /**
   * Barrido de todas las empresas activas. Corre fuera de un request, así que
   * usa el cliente de plataforma y filtra por empresa explícitamente: sin
   * contexto de sesión, RLS no alcanza.
   */
  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'stock-alertas' })
  async checkAllTenants(): Promise<void> {
    let empresas: { id: string }[] = [];
    try {
      empresas = await this.prisma.raw.empresas.findMany({
        where: { deleted_at: null, estado: { in: ['ACTIVE', 'TRIAL'] } },
        select: { id: true },
      });
    } catch (error) {
      this.logger.error(`No se pudieron listar las empresas: ${this.mensaje(error)}`);
      return;
    }

    for (const empresa of empresas) {
      try {
        const resumen = await this.reconcile(this.prisma.raw, empresa.id, null);
        if (resumen.nuevas > 0 || resumen.resueltas > 0) {
          this.logger.log(
            `Alertas ${empresa.id}: ${resumen.nuevas} nuevas, ${resumen.resueltas} resueltas`,
          );
        }
      } catch (error) {
        this.logger.error(`Alertas de ${empresa.id}: ${this.mensaje(error)}`);
      }
    }
  }

  /**
   * Compara el stock bajo contra las alertas vigentes y deja una fila por
   * insumo. Devuelve el resumen para el endpoint manual.
   */
  private async reconcile(
    cliente: Cliente,
    empresaId: string,
    sucursalId: string | null,
  ): Promise<AlertaResumen> {
    const bajos = await cliente.$queryRawUnsafe<StockBajo[]>(
      `SELECT s.empresa_id, s.sucursal_id, s.insumo_id, i.nombre, i.unidad,
              s.cantidad::float8 AS cantidad, s.stock_minimo::float8 AS stock_minimo,
              CASE WHEN s.cantidad <= 0 THEN 'AGOTADO' ELSE 'BAJO' END AS estado
       FROM ${this.schema}.stocks_sucursal s
       JOIN ${this.schema}.insumos i ON i.id = s.insumo_id
       WHERE s.cantidad <= s.stock_minimo
         AND s.empresa_id = $1::uuid
         AND ($2::uuid IS NULL OR s.sucursal_id = $2::uuid)`,
      empresaId,
      sucursalId,
    );

    const vigentes = await cliente.alertas_stock.findMany({
      where: {
        empresa_id: empresaId,
        ...(sucursalId ? { sucursal_id: sucursalId } : {}),
      },
      select: { id: true, sucursal_id: true, insumo_id: true, estado: true },
    });
    const porClave = new Map(
      vigentes.map((alerta) => [`${alerta.sucursal_id}:${alerta.insumo_id}`, alerta]),
    );

    const nuevas: StockBajo[] = [];
    for (const bajo of bajos) {
      const vigente = porClave.get(`${bajo.sucursal_id}:${bajo.insumo_id}`);
      if (vigente?.estado === bajo.estado) continue;
      nuevas.push(bajo);
      await cliente.alertas_stock.upsert({
        where: {
          sucursal_id_insumo_id: {
            sucursal_id: bajo.sucursal_id,
            insumo_id: bajo.insumo_id,
          },
        },
        create: {
          empresa_id: empresaId,
          sucursal_id: bajo.sucursal_id,
          insumo_id: bajo.insumo_id,
          estado: bajo.estado,
          cantidad: bajo.cantidad,
          stock_minimo: bajo.stock_minimo,
        },
        update: {
          estado: bajo.estado,
          cantidad: bajo.cantidad,
          stock_minimo: bajo.stock_minimo,
          // Cambió la gravedad: se vuelve a notificar.
          notificado_at: null,
          updated_at: new Date(),
        },
      });
    }

    const clavesBajas = new Set(bajos.map((bajo) => `${bajo.sucursal_id}:${bajo.insumo_id}`));
    const resueltas = vigentes.filter(
      (alerta) => !clavesBajas.has(`${alerta.sucursal_id}:${alerta.insumo_id}`),
    );
    if (resueltas.length > 0) {
      await cliente.alertas_stock.deleteMany({
        where: { id: { in: resueltas.map((alerta) => alerta.id) } },
      });
    }

    let enviado = false;
    if (nuevas.length > 0) {
      enviado = await this.notificar(empresaId, nuevas);
      if (enviado) {
        await cliente.alertas_stock.updateMany({
          where: {
            empresa_id: empresaId,
            OR: nuevas.map((bajo) => ({
              sucursal_id: bajo.sucursal_id,
              insumo_id: bajo.insumo_id,
            })),
          },
          data: { notificado_at: new Date() },
        });
      }
    }

    await this.audit.record({
      empresaId,
      sucursalId: sucursalId ?? undefined,
      usuarioId: this.tenantContext.get()?.userId ?? null,
      accion: 'stock.alertas',
      entidad: 'alertas_stock',
      entidadId: empresaId,
      detalle: {
        evaluados: bajos.length,
        nuevas: nuevas.length,
        resueltas: resueltas.length,
        enviado,
      },
    });

    return {
      evaluados: bajos.length,
      nuevas: nuevas.length,
      resueltas: resueltas.length,
      enviado,
    };
  }

  /**
   * Envía el lote firmado. Un fallo de red no rompe el barrido: la alerta queda
   * sin `notificado_at` y el siguiente ciclo reintenta.
   */
  private async notificar(empresaId: string, alertas: StockBajo[]): Promise<boolean> {
    const url = process.env.STOCK_WEBHOOK_URL ?? '';
    if (!url) {
      this.logger.warn(
        `Stock bajo sin STOCK_WEBHOOK_URL: ${alertas.length} alerta(s) registradas`,
      );
      return false;
    }

    const cuerpo = JSON.stringify({
      event: 'stock.alert',
      at: new Date().toISOString(),
      empresaId,
      alertas: alertas.map((alerta) => ({
        sucursalId: alerta.sucursal_id,
        insumoId: alerta.insumo_id,
        nombre: alerta.nombre,
        unidad: alerta.unidad,
        cantidad: alerta.cantidad,
        stockMinimo: alerta.stock_minimo,
        estado: alerta.estado,
      })),
    });

    const secreto = process.env.STOCK_WEBHOOK_SECRET ?? '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Fogoneria-Event': 'stock.alert',
    };
    if (secreto) {
      headers['X-Fogoneria-Signature'] = `sha256=${createHmac('sha256', secreto)
        .update(cuerpo)
        .digest('hex')}`;
    }

    try {
      const respuesta = await fetch(url, { method: 'POST', headers, body: cuerpo });
      if (!respuesta.ok) {
        this.logger.warn(`Webhook de stock respondió ${respuesta.status}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`Webhook de stock inalcanzable: ${this.mensaje(error)}`);
      return false;
    }
  }

  /* -------------------------------- internos ------------------------------ */

  private cliente(): Cliente {
    const tx = this.tenantContext.get()?.tx;
    return (tx ?? this.prisma.rls) as Cliente;
  }

  private tenant(): { empresaId: string } {
    const context = this.tenantContext.get();
    if (!context?.empresaId) {
      throw new BadRequestException('La operación requiere empresa en el token');
    }
    return { empresaId: context.empresaId };
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

  private mensaje(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
