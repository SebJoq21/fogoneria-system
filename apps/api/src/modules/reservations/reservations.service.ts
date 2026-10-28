import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantContextService } from '../../common/context/tenant-context.service.js';
import { SequencesService } from '../../common/sequences/sequences.service.js';
import { paginationOf } from '../../common/dto/pagination.dto.js';
import { limaDayRange } from '../../common/utils/lima-day.js';
import {
  ACTIVE_RESERVATION_STATES,
  OPEN_ORDER_STATES,
} from '../../common/constants/estados.js';
import type { estado_reserva } from '../../generated/prisma/enums.js';
import type {
  CreateReservationDto,
  ListReservationsQueryDto,
  UpdateReservationDto,
} from './dto/reservation.dto.js';

/** Dos reservas de la misma mesa deben separarse al menos esta ventana. */
export const RESERVATION_WINDOW_MINUTES = 90;
const WINDOW_MS = RESERVATION_WINDOW_MINUTES * 60 * 1000;

/** Transiciones válidas de una reserva; los estados terminales no se reabren. */
export const RESERVATION_TRANSITIONS: Record<estado_reserva, estado_reserva[]> = {
  POR_CONFIRMAR: ['CONFIRMADA', 'CANCELADA'],
  CONFIRMADA: ['EJECUTADA', 'CANCELADA', 'NO_SHOW'],
  EJECUTADA: [],
  CANCELADA: [],
  NO_SHOW: [],
};

/**
 * Reservas por sucursal (AYCDS-16).
 *
 * Reglas duras:
 * - una reserva nunca excede la capacidad de la mesa (409);
 * - dos reservas de la misma mesa no se solapan dentro de ±90 min (409);
 * - la mesa queda `RESERVADA` al reservar y vuelve a `LIBRE` al cancelar,
 *   salvo que queden otras reservas activas u órdenes abiertas.
 */
@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly sequences: SequencesService,
  ) {}

  async list(query: ListReservationsQueryDto) {
    const { skip, take } = paginationOf(query);
    const range = query.fecha ? limaDayRange(query.fecha) : null;
    if (query.fecha && !range) {
      throw new BadRequestException('fecha inválida');
    }

    const where = {
      ...(range ? { fecha_hora: { gte: range.start, lt: range.end } } : {}),
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.mesaId ? { mesa_id: query.mesaId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.scoped.reservas.findMany({
        where,
        skip,
        take,
        orderBy: { fecha_hora: 'asc' },
        include: { mesas: { select: { id: true, numero: true, zona: true } } },
      }),
      this.prisma.scoped.reservas.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async findOne(id: string) {
    const reserva = await this.prisma.scoped.reservas.findFirst({
      where: { id },
      include: { mesas: { select: { id: true, numero: true, zona: true } } },
    });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    return reserva;
  }

  async create(dto: CreateReservationDto) {
    const { empresaId, userId } = this.tenant();
    const mesa = await this.requireTable(dto.mesaId);
    const fecha = this.parseDate(dto.fechaHora);

    if (mesa.estado === 'OCUPADA') {
      throw new ConflictException('La mesa está ocupada en este momento');
    }
    this.assertCapacity(mesa, dto.nroComensales);
    await this.assertNoOverlap(mesa.id, fecha);

    const codigo = await this.sequences.nextCodigoReserva(empresaId, fecha);
    const reserva = await this.prisma.scoped.reservas.create({
      data: {
        empresa_id: empresaId,
        sucursal_id: mesa.sucursal_id,
        mesa_id: mesa.id,
        codigo,
        cliente_nombre: dto.clienteNombre.trim(),
        telefono: dto.telefono?.trim() || null,
        nro_comensales: dto.nroComensales,
        fecha_hora: fecha,
        estado: 'POR_CONFIRMAR',
        canal: dto.canal?.trim() || 'Presencial',
        notas: dto.notas?.trim() || null,
        creada_por: userId ?? null,
      },
      include: { mesas: { select: { id: true, numero: true, zona: true } } },
    });

    await this.setTableState(mesa.id, 'RESERVADA');
    return reserva;
  }

  async update(id: string, dto: UpdateReservationDto) {
    const reserva = await this.requireReservation(id);
    if (reserva.estado !== 'POR_CONFIRMAR') {
      throw new ConflictException(
        `Solo se edita una reserva por confirmar (estado actual: ${reserva.estado})`,
      );
    }

    const mesa = await this.requireTable(dto.mesaId ?? reserva.mesa_id);
    const fecha = dto.fechaHora
      ? this.parseDate(dto.fechaHora)
      : reserva.fecha_hora;
    const comensales = dto.nroComensales ?? reserva.nro_comensales;

    if (mesa.estado === 'OCUPADA' && mesa.id !== reserva.mesa_id) {
      throw new ConflictException('La mesa destino está ocupada');
    }
    this.assertCapacity(mesa, comensales);
    await this.assertNoOverlap(mesa.id, fecha, id);

    const actualizada = await this.prisma.scoped.reservas.update({
      where: { id },
      data: {
        mesa_id: mesa.id,
        fecha_hora: fecha,
        ...(dto.clienteNombre !== undefined
          ? { cliente_nombre: dto.clienteNombre.trim() }
          : {}),
        ...(dto.telefono !== undefined
          ? { telefono: dto.telefono.trim() || null }
          : {}),
        ...(dto.nroComensales !== undefined
          ? { nro_comensales: dto.nroComensales }
          : {}),
        ...(dto.canal !== undefined ? { canal: dto.canal.trim() } : {}),
        ...(dto.notas !== undefined
          ? { notas: dto.notas.trim() || null }
          : {}),
      },
      include: { mesas: { select: { id: true, numero: true, zona: true } } },
    });

    if (mesa.id !== reserva.mesa_id) {
      await this.releaseTable(reserva.mesa_id, id);
      await this.setTableState(mesa.id, 'RESERVADA');
    }
    return actualizada;
  }

  async updateStatus(id: string, estado: estado_reserva) {
    const reserva = await this.requireReservation(id);
    const allowed = RESERVATION_TRANSITIONS[reserva.estado];
    if (!allowed.includes(estado)) {
      throw new BadRequestException(
        `Transición inválida: ${reserva.estado} → ${estado}`,
      );
    }

    if (estado === 'CONFIRMADA') {
      const mesa = await this.requireTable(reserva.mesa_id);
      if (mesa.estado === 'OCUPADA') {
        throw new ConflictException(
          'La mesa está ocupada: no se puede confirmar la reserva',
        );
      }
      await this.setTableState(mesa.id, 'RESERVADA');
    }
    if (estado === 'EJECUTADA') {
      await this.setTableState(reserva.mesa_id, 'OCUPADA');
    }
    if (estado === 'CANCELADA' || estado === 'NO_SHOW') {
      await this.releaseTable(reserva.mesa_id, reserva.id);
    }

    await this.prisma.scoped.reservas.updateMany({
      where: { id },
      data: { estado },
    });
    return this.findOne(id);
  }

  /** Libera la mesa solo si no quedan reservas activas ni órdenes abiertas. */
  private async releaseTable(mesaId: string, exceptoReservaId: string) {
    const [otraReserva, orden] = await Promise.all([
      this.prisma.scoped.reservas.findFirst({
        where: {
          mesa_id: mesaId,
          id: { not: exceptoReservaId },
          estado: { in: [...ACTIVE_RESERVATION_STATES] },
        },
        select: { id: true },
      }),
      this.prisma.scoped.ordenes.findFirst({
        where: { mesa_id: mesaId, estado: { in: [...OPEN_ORDER_STATES] } },
        select: { id: true },
      }),
    ]);
    if (otraReserva || orden) return;

    await this.prisma.scoped.mesas.updateMany({
      where: { id: mesaId, estado: 'RESERVADA' },
      data: { estado: 'LIBRE' },
    });
  }

  private async setTableState(
    mesaId: string,
    estado: 'LIBRE' | 'OCUPADA' | 'RESERVADA',
  ) {
    await this.prisma.scoped.mesas.updateMany({
      where: { id: mesaId },
      data: { estado },
    });
  }

  private assertCapacity(
    mesa: { numero: string; capacidad: number },
    comensales: number,
  ) {
    if (comensales > mesa.capacidad) {
      throw new ConflictException(
        `La mesa ${mesa.numero} admite ${mesa.capacidad} comensales y la reserva pide ${comensales}`,
      );
    }
  }

  private async assertNoOverlap(
    mesaId: string,
    fecha: Date,
    exceptoId?: string,
  ) {
    const desde = new Date(fecha.getTime() - WINDOW_MS);
    const hasta = new Date(fecha.getTime() + WINDOW_MS);
    const conflicto = await this.prisma.scoped.reservas.findFirst({
      where: {
        mesa_id: mesaId,
        estado: { in: [...ACTIVE_RESERVATION_STATES] },
        fecha_hora: { gt: desde, lt: hasta },
        ...(exceptoId ? { id: { not: exceptoId } } : {}),
      },
      select: { id: true, codigo: true, fecha_hora: true },
    });
    if (conflicto) {
      throw new ConflictException(
        `La mesa ya tiene la reserva ${conflicto.codigo} a las ${conflicto.fecha_hora.toISOString()} (ventana ±${RESERVATION_WINDOW_MINUTES} min)`,
      );
    }
  }

  private parseDate(value: string): Date {
    const fecha = new Date(value);
    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException('fechaHora inválida');
    }
    return fecha;
  }

  private async requireTable(id: string) {
    const mesa = await this.prisma.scoped.mesas.findFirst({
      where: { id, deleted_at: null },
    });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');
    return mesa;
  }

  private async requireReservation(id: string) {
    const reserva = await this.prisma.scoped.reservas.findFirst({ where: { id } });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    return reserva;
  }

  private tenant(): { empresaId: string; userId: string | null } {
    const context = this.tenantContext.get();
    if (!context?.empresaId) {
      throw new BadRequestException('La operación requiere empresa en el token');
    }
    return { empresaId: context.empresaId, userId: context.userId ?? null };
  }
}
