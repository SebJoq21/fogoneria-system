import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReservationsService } from './reservations.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { SequencesService } from '../../common/sequences/sequences.service.js';

const context = {
  userId: 'u1',
  empresaId: 'e1',
  sucursalId: 's1',
  rol: 'MESERO' as const,
  bypass: false,
};

const MESA = {
  id: 'm1',
  sucursal_id: 's1',
  numero: '4',
  capacidad: 4,
  estado: 'LIBRE' as const,
  deleted_at: null,
};

function buildPrisma() {
  return {
    scoped: {
      mesas: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
      },
      reservas: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
      },
      ordenes: { findFirst: vi.fn().mockResolvedValue(null) },
    },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const sequences = {
    nextCodigoReserva: vi.fn().mockResolvedValue('RSV-20261027-0001'),
  };
  const service = new ReservationsService(
    prisma as unknown as PrismaService,
    { get: () => context } as unknown as TenantContextService,
    sequences as unknown as SequencesService,
  );
  return { service, sequences };
}

const baseDto = {
  mesaId: 'm1',
  clienteNombre: 'Familia Rojas',
  nroComensales: 4,
  fechaHora: '2026-10-27T20:00:00-05:00',
};

describe('ReservationsService', () => {
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    vi.clearAllMocks();
    prisma.scoped.ordenes.findFirst.mockResolvedValue(null);
    prisma.scoped.mesas.findFirst.mockResolvedValue({ ...MESA });
  });

  it('crea la reserva con folio de la secuencia y bloquea la mesa', async () => {
    prisma.scoped.reservas.create.mockResolvedValue({ id: 'r1', codigo: 'RSV-20261027-0001' });
    const { service } = buildService(prisma);

    const reserva = await service.create(baseDto);

    expect(reserva).toMatchObject({ codigo: 'RSV-20261027-0001' });
    expect(prisma.scoped.reservas.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          empresa_id: 'e1',
          sucursal_id: 's1',
          mesa_id: 'm1',
          nro_comensales: 4,
          estado: 'POR_CONFIRMAR',
          creada_por: 'u1',
        }),
      }),
    );
    expect(prisma.scoped.mesas.updateMany).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { estado: 'RESERVADA' },
    });
  });

  it('rechaza la reserva si supera la capacidad de la mesa', async () => {
    const { service } = buildService(prisma);

    await expect(
      service.create({ ...baseDto, nroComensales: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.scoped.reservas.create).not.toHaveBeenCalled();
  });

  it('rechaza el solapamiento dentro de la ventana de 90 minutos', async () => {
    prisma.scoped.reservas.findFirst.mockResolvedValue({
      id: 'r0',
      codigo: 'RSV-20261027-0000',
      fecha_hora: new Date('2026-10-28T00:30:00Z'),
    });
    const { service } = buildService(prisma);

    await expect(service.create(baseDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.scoped.reservas.create).not.toHaveBeenCalled();
  });

  it('no reserva una mesa ocupada', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue({ ...MESA, estado: 'OCUPADA' });
    const { service } = buildService(prisma);

    await expect(service.create(baseDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('devuelve 404 si la mesa no existe en el tenant', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(service.create(baseDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza transiciones inválidas', async () => {
    prisma.scoped.reservas.findFirst.mockResolvedValue({
      id: 'r1',
      estado: 'CANCELADA',
      mesa_id: 'm1',
    });
    const { service } = buildService(prisma);

    await expect(service.updateStatus('r1', 'CONFIRMADA')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('al cancelar libera la mesa si no queda actividad', async () => {
    prisma.scoped.reservas.findFirst
      .mockResolvedValueOnce({ id: 'r1', estado: 'POR_CONFIRMAR', mesa_id: 'm1' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'r1', estado: 'CANCELADA', mesa_id: 'm1' });
    prisma.scoped.reservas.updateMany.mockResolvedValue({ count: 1 });
    const { service } = buildService(prisma);

    await service.updateStatus('r1', 'CANCELADA');

    expect(prisma.scoped.mesas.updateMany).toHaveBeenCalledWith({
      where: { id: 'm1', estado: 'RESERVADA' },
      data: { estado: 'LIBRE' },
    });
  });

  it('al cancelar no libera la mesa si hay una orden abierta', async () => {
    prisma.scoped.reservas.findFirst
      .mockResolvedValueOnce({ id: 'r1', estado: 'CONFIRMADA', mesa_id: 'm1' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'r1', estado: 'CANCELADA', mesa_id: 'm1' });
    prisma.scoped.ordenes.findFirst.mockResolvedValue({ id: 'o1' });
    prisma.scoped.reservas.updateMany.mockResolvedValue({ count: 1 });
    const { service } = buildService(prisma);

    await service.updateStatus('r1', 'CANCELADA');

    expect(prisma.scoped.mesas.updateMany).not.toHaveBeenCalled();
  });

  it('no confirma una reserva sobre una mesa ocupada', async () => {
    prisma.scoped.reservas.findFirst.mockResolvedValue({
      id: 'r1',
      estado: 'POR_CONFIRMAR',
      mesa_id: 'm1',
    });
    prisma.scoped.mesas.findFirst.mockResolvedValue({ ...MESA, estado: 'OCUPADA' });
    const { service } = buildService(prisma);

    await expect(service.updateStatus('r1', 'CONFIRMADA')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('solo permite editar reservas por confirmar', async () => {
    prisma.scoped.reservas.findFirst.mockResolvedValue({
      id: 'r1',
      estado: 'CONFIRMADA',
      mesa_id: 'm1',
    });
    const { service } = buildService(prisma);

    await expect(
      service.update('r1', { nroComensales: 2 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('filtra el día con el rango de Lima (UTC-05:00)', async () => {
    prisma.scoped.reservas.findMany.mockResolvedValue([]);
    prisma.scoped.reservas.count.mockResolvedValue(0);
    const { service } = buildService(prisma);

    await service.list({ page: 1, limit: 20, fecha: '2026-10-27' });

    const where = prisma.scoped.reservas.findMany.mock.calls[0][0].where;
    expect(where.fecha_hora.gte.toISOString()).toBe('2026-10-27T05:00:00.000Z');
    expect(where.fecha_hora.lt.toISOString()).toBe('2026-10-28T05:00:00.000Z');
  });
});
