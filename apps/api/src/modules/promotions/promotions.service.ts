import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantContextService } from '../../common/context/tenant-context.service.js';
import { AuditService } from '../audit/audit.service.js';
import { paginationOf } from '../../common/dto/pagination.dto.js';
import {
  descuentoDe,
  reglaAplica,
  validarCupon,
} from './promotions.rules.js';
import type {
  ComboPlateDto,
  CreateComboDto,
  CreateCouponDto,
  ListCouponsQueryDto,
  UpdateComboDto,
  UpdateCouponDto,
} from './dto/promotions.dto.js';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

export interface CuponResuelto {
  id: string;
  codigo: string;
  descuento: number;
  usosActuales: number;
  limiteUsos: number;
}

/**
 * Combos y promociones (AYCDS-19).
 *
 * Dos reglas duras:
 *  1. **Anti-inflación**: el `precio_fijo` de un combo no puede superar la suma
 *     de sus platos a la lista activa. Sin esto un combo "de oferta" podría
 *     costar más que pedir las partes por separado.
 *  2. **El descuento lo calcula el servidor**: el cliente manda un código, no
 *     un importe. El límite de usos se incrementa con actualización
 *     condicional para que dos cajas no gasten el último cupón a la vez.
 */
@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  /* ------------------------------- combos ------------------------------- */

  async listCombos() {
    const combos = await this.prisma.scoped.combos.findMany({
      where: { deleted_at: null },
      orderBy: { nombre: 'asc' },
      include: {
        combos_platos: {
          include: { platos: { select: { id: true, nombre: true } } },
        },
      },
    });

    const referencia = await this.preciosReferencia(
      combos.map((combo) => ({
        id: combo.id,
        platos: combo.combos_platos.map((plato) => ({
          platoId: plato.plato_id,
          cantidad: plato.cantidad,
        })),
      })),
    );

    return combos.map((combo) => {
      const suma = referencia.get(combo.id) ?? null;
      const precio = Number(combo.precio_fijo);
      return {
        ...combo,
        precioReferencia: suma,
        ahorro: suma === null ? null : round2(suma - precio),
      };
    });
  }

  async createCombo(dto: CreateComboDto) {
    const { empresaId, userId } = this.tenant();
    await this.requirePlatos(dto.platos);
    await this.validarAntiInflacion(dto.precioFijo, dto.platos);

    let combo;
    try {
      combo = await this.prisma.scoped.combos.create({
        data: {
          empresa_id: empresaId,
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          precio_fijo: dto.precioFijo,
          combos_platos: {
            create: dto.platos.map((plato) => ({
              plato_id: plato.platoId,
              cantidad: plato.cantidad,
            })),
          },
        },
        include: { combos_platos: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un combo con ese nombre');
      }
      throw error;
    }

    await this.audit.record({
      empresaId,
      usuarioId: userId,
      accion: 'combo.creado',
      entidad: 'combos',
      entidadId: combo.id,
      detalle: { nombre: dto.nombre, precioFijo: dto.precioFijo },
    });

    return combo;
  }

  async updateCombo(id: string, dto: UpdateComboDto) {
    const { empresaId, userId } = this.tenant();
    const combo = await this.prisma.scoped.combos.findFirst({
      where: { id, deleted_at: null },
      include: { combos_platos: true },
    });
    if (!combo) throw new NotFoundException('Combo no encontrado');

    const platos: ComboPlateDto[] =
      dto.platos ??
      combo.combos_platos.map((plato) => ({
        platoId: plato.plato_id,
        cantidad: plato.cantidad,
      }));
    const precio = dto.precioFijo ?? Number(combo.precio_fijo);

    if (dto.platos) await this.requirePlatos(dto.platos);
    if (dto.platos || dto.precioFijo !== undefined) {
      await this.validarAntiInflacion(precio, platos);
    }

    const actualizado = await this.prisma.scoped.combos.update({
      where: { id },
      data: {
        ...(dto.nombre ? { nombre: dto.nombre } : {}),
        ...(dto.descripcion !== undefined ? { descripcion: dto.descripcion } : {}),
        ...(dto.precioFijo !== undefined ? { precio_fijo: dto.precioFijo } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        ...(dto.platos
          ? {
              combos_platos: {
                deleteMany: {},
                create: dto.platos.map((plato) => ({
                  plato_id: plato.platoId,
                  cantidad: plato.cantidad,
                })),
              },
            }
          : {}),
      },
      include: { combos_platos: true },
    });

    await this.audit.record({
      empresaId,
      usuarioId: userId,
      accion: 'combo.actualizado',
      entidad: 'combos',
      entidadId: id,
      detalle: { nombre: actualizado.nombre, precioFijo: Number(actualizado.precio_fijo) },
    });

    return actualizado;
  }

  async removeCombo(id: string) {
    const { empresaId, userId } = this.tenant();
    const { count } = await this.prisma.scoped.combos.updateMany({
      where: { id, deleted_at: null },
      data: { deleted_at: new Date(), deleted_by: userId, activo: false },
    });
    if (count === 0) throw new NotFoundException('Combo no encontrado');

    await this.audit.record({
      empresaId,
      usuarioId: userId,
      accion: 'combo.baja',
      entidad: 'combos',
      entidadId: id,
      detalle: {},
    });

    return { id, eliminado: true };
  }

  /* ------------------------------- cupones ------------------------------ */

  async listCoupons(query: ListCouponsQueryDto) {
    const { skip, take } = paginationOf(query);
    const where = query.activo === undefined ? { deleted_at: null } : { deleted_at: null, activo: query.activo };

    const [items, total] = await Promise.all([
      this.prisma.scoped.cupones.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.scoped.cupones.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async createCoupon(dto: CreateCouponDto) {
    const { empresaId, userId } = this.tenant();
    if (dto.tipoDescuento === 'PORCENTAJE' && Number(dto.valor) > 100) {
      throw new BadRequestException('Un descuento porcentual no puede superar 100');
    }

    let cupon;
    try {
      cupon = await this.prisma.scoped.cupones.create({
        data: {
          empresa_id: empresaId,
          codigo: dto.codigo.toUpperCase(),
          tipo_descuento: dto.tipoDescuento,
          valor: dto.valor,
          limite_usos: dto.limiteUsos,
          vencimiento: new Date(`${dto.vencimiento}T00:00:00-05:00`),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un cupón con ese código');
      }
      throw error;
    }

    await this.audit.record({
      empresaId,
      usuarioId: userId,
      accion: 'cupon.creado',
      entidad: 'cupones',
      entidadId: cupon.id,
      detalle: {
        codigo: cupon.codigo,
        tipo: cupon.tipo_descuento,
        valor: Number(cupon.valor),
        limiteUsos: cupon.limite_usos,
      },
    });

    return cupon;
  }

  async updateCoupon(id: string, dto: UpdateCouponDto) {
    const { empresaId, userId } = this.tenant();
    const cupon = await this.prisma.scoped.cupones.findFirst({
      where: { id, deleted_at: null },
    });
    if (!cupon) throw new NotFoundException('Cupón no encontrado');

    const actualizado = await this.prisma.scoped.cupones.update({
      where: { id },
      data: {
        ...(dto.valor !== undefined ? { valor: dto.valor } : {}),
        ...(dto.limiteUsos !== undefined ? { limite_usos: dto.limiteUsos } : {}),
        ...(dto.vencimiento
          ? { vencimiento: new Date(`${dto.vencimiento}T00:00:00-05:00`) }
          : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });

    await this.audit.record({
      empresaId,
      usuarioId: userId,
      accion: 'cupon.actualizado',
      entidad: 'cupones',
      entidadId: id,
      detalle: { codigo: cupon.codigo },
    });

    return actualizado;
  }

  async removeCoupon(id: string) {
    const { empresaId, userId } = this.tenant();
    const { count } = await this.prisma.scoped.cupones.updateMany({
      where: { id, deleted_at: null },
      data: { deleted_at: new Date(), deleted_by: userId, activo: false },
    });
    if (count === 0) throw new NotFoundException('Cupón no encontrado');

    await this.audit.record({
      empresaId,
      usuarioId: userId,
      accion: 'cupon.baja',
      entidad: 'cupones',
      entidadId: id,
      detalle: {},
    });

    return { id, eliminado: true };
  }

  /**
   * Valida un código contra un subtotal sin consumirlo. Es lo que usa la UI
   * para mostrar el descuento antes de cobrar.
   */
  async validateCoupon(codigo: string, subtotal: number) {
    const cupon = await this.prisma.scoped.cupones.findFirst({
      where: { codigo: codigo.trim().toUpperCase(), deleted_at: null },
    });
    if (!cupon) {
      return { valido: false, motivo: 'El cupón no existe', descuento: 0 };
    }

    const estado = validarCupon(cupon);
    if (!estado.valido) {
      return { valido: false, motivo: estado.motivo, descuento: 0 };
    }

    return {
      valido: true,
      motivo: null,
      descuento: descuentoDe(cupon.tipo_descuento, Number(cupon.valor), subtotal),
      cupon: {
        codigo: cupon.codigo,
        tipo: cupon.tipo_descuento,
        valor: Number(cupon.valor),
        usosRestantes: cupon.limite_usos - cupon.usos_actuales,
        vencimiento: cupon.vencimiento,
      },
    };
  }

  /**
   * Resuelve el cupón de una comanda y **consume** un uso.
   *
   * El incremento es condicional (`usos_actuales = valor leído`) para que dos
   * comandas simultáneas no gasten el último uso: la segunda se queda sin cupón
   * y se le avisa.
   */
  async resolverCupon(codigo: string, subtotal: number): Promise<CuponResuelto> {
    const cupon = await this.prisma.scoped.cupones.findFirst({
      where: { codigo: codigo.trim().toUpperCase(), deleted_at: null },
    });
    if (!cupon) throw new BadRequestException('El cupón no existe');

    const estado = validarCupon(cupon);
    if (!estado.valido) throw new BadRequestException(estado.motivo);

    const descuento = descuentoDe(
      cupon.tipo_descuento,
      Number(cupon.valor),
      subtotal,
    );
    if (descuento <= 0) {
      throw new BadRequestException('El cupón no aplica un descuento sobre esta comanda');
    }

    const { count } = await this.prisma.scoped.cupones.updateMany({
      where: { id: cupon.id, usos_actuales: cupon.usos_actuales },
      data: { usos_actuales: { increment: 1 } },
    });
    if (count === 0) {
      throw new ConflictException(
        'El cupón se agotó mientras se registraba la comanda: vuelve a intentar',
      );
    }

    return {
      id: cupon.id,
      codigo: cupon.codigo,
      descuento,
      usosActuales: cupon.usos_actuales + 1,
      limiteUsos: cupon.limite_usos,
    };
  }

  /** Registra el canje de un cupón en una comanda ya creada. */
  async registrarCanje(
    cupon: CuponResuelto,
    orden: { id: string; empresaId: string; sucursalId: string },
    usuarioId: string | null,
  ) {
    await this.prisma.scoped.canjes_cupones.create({
      data: {
        cupon_id: cupon.id,
        orden_id: orden.id,
        empresa_id: orden.empresaId,
        sucursal_id: orden.sucursalId,
        monto_descontado: cupon.descuento,
        aplicado_por: usuarioId,
      },
    });
  }

  /** Reglas horarias activas y si cubren el momento actual. */
  async schedule() {
    const reglas = await this.prisma.scoped.reglas_horarias_promos.findMany({
      where: { activa: true, deleted_at: null },
      orderBy: { nombre: 'asc' },
    });
    const now = new Date();

    return reglas.map((regla) => ({
      ...regla,
      aplicaAhora: reglaAplica(
        {
          dias_semana: regla.dias_semana,
          hora_inicio: regla.hora_inicio,
          hora_fin: regla.hora_fin,
        },
        now,
      ),
    }));
  }

  /* ------------------------------ internos ------------------------------ */

  private async requirePlatos(platos: ComboPlateDto[]): Promise<void> {
    const ids = [...new Set(platos.map((plato) => plato.platoId))];
    const encontrados = await this.prisma.scoped.platos.count({
      where: { id: { in: ids }, deleted_at: null },
    });
    if (encontrados !== ids.length) {
      throw new NotFoundException('Algún plato del combo no existe en el catálogo');
    }
  }

  /**
   * Bloqueo anti-inflación: el combo no puede costar más que sus partes a la
   * lista activa. Si la lista no tiene precio para algún plato se omite la
   * comprobación (no se puede afirmar nada con datos incompletos).
   */
  private async validarAntiInflacion(
    precioFijo: number,
    platos: ComboPlateDto[],
  ): Promise<void> {
    const referencia = await this.preciosReferencia([
      { id: 'nuevo', platos },
    ]);
    const suma = referencia.get('nuevo');
    if (suma === null || suma === undefined) return;

    if (round2(precioFijo) > round2(suma)) {
      throw new BadRequestException(
        `El precio del combo (${precioFijo.toFixed(2)}) supera la suma de sus platos ` +
          `a la lista activa (${suma.toFixed(2)}): pide los platos por separado y sale más barato`,
      );
    }
  }

  /** Suma de los platos a la lista activa, por combo. `null` si falta algún precio. */
  private async preciosReferencia(
    combos: { id: string; platos: ComboPlateDto[] }[],
  ): Promise<Map<string, number | null>> {
    const resultado = new Map<string, number | null>();
    const platoIds = [
      ...new Set(combos.flatMap((combo) => combo.platos.map((p) => p.platoId))),
    ];
    if (platoIds.length === 0) return resultado;

    const lista = await this.prisma.scoped.listas_precios.findFirst({
      where: { activa: true, deleted_at: null },
      select: { id: true },
    });
    if (!lista) {
      for (const combo of combos) resultado.set(combo.id, null);
      return resultado;
    }

    const precios = await this.prisma.scoped.precios_platos.findMany({
      where: { lista_id: lista.id, plato_id: { in: platoIds } },
      select: { plato_id: true, precio: true },
    });
    const porPlato = new Map(
      precios.map((precio) => [precio.plato_id, Number(precio.precio)]),
    );

    for (const combo of combos) {
      let suma = 0;
      let completo = true;
      for (const plato of combo.platos) {
        const precio = porPlato.get(plato.platoId);
        if (precio === undefined) {
          completo = false;
          break;
        }
        suma += precio * plato.cantidad;
      }
      resultado.set(combo.id, completo ? round2(suma) : null);
    }

    return resultado;
  }

  private tenant(): { empresaId: string; userId: string | null } {
    const context = this.tenantContext.get();
    if (!context?.empresaId) {
      throw new BadRequestException('La operación requiere empresa en el token');
    }
    return { empresaId: context.empresaId, userId: context.userId ?? null };
  }
}
