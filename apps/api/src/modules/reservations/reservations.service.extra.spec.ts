import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
const RESERVA = '11111111-1111-4111-8111-111111111111';
const MESA = '22222222-2222-4222-8222-222222222222';
const MESA_B = '33333333-3333-4333-8333-333333333333';

function buildPrisma() {
  return {
    scoped: {
      reservas: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      mesas: { findFirst: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      ordenes: { findFirst: vi.fn().mockResolvedValue(null) },
    },
  };
}

describe('ReservationsService (ramas restantes)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let service: ReservationsService;

  function buildService(tenant: Record<string, unknown> = context) {
    return new ReservationsService(
      prisma as unknown as PrismaService,
      { get: () => tenant } as unknown as TenantContextService,
      { nextReservaCodigo: vi.fn().mockResolvedValue('RSV-1') } as unknown as SequencesService,
    );
  }

  beforeEach(() => {
    prisma = buildPrisma();
    service = buildService();
    prisma.scoped.mesas.findFirst.mockResolvedValue({
      id: MESA,
      capacidad: 4,
      estado: 'LIBRE',
      sucursal_id: 's1',
    });
  });

  it('rechaza una fecha de filtro inválida', async () => {
    await expect(service.list({ fecha: '20/11/2026' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('lista por día de Lima con estado y mesa', async () => {
    prisma.scoped.reservas.findMany.mockResolvedValue([{ id: RESERVA }]);
    prisma.scoped.reservas.count.mockResolvedValue(1);
    const lista = await service.list({
      fecha: '2026-11-20',
      estado: 'CONFIRMADA',
      mesaId: MESA,
      page: 1,
      limit: 20,
    } as never);
    expect(lista).toMatchObject({ total: 1 });
    expect(prisma.scoped.reservas.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fecha_hora: { gte: expect.any(Date), lt: expect.any(Date) },
          estado: 'CONFIRMADA',
          mesa_id: MESA,
        }),
      }),
    );
  });

  it('update 404 y estados terminales bloqueados', async () => {
    prisma.scoped.reservas.findFirst.mockResolvedValue(null);
    await expect(service.update(RESERVA, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.reservas.findFirst.mockResolvedValue({
      id: RESERVA,
      estado: 'CANCELADA',
      mesa_id: MESA,
    });
    await expect(service.update(RESERVA, {})).rejects.toBeInstanceOf(ConflictException);
  });

  it('update rechaza fecha inválida, mesa ocupada y aforo', async () => {
    prisma.scoped.reservas.findFirst.mockResolvedValue({
      id: RESERVA,
      estado: 'POR_CONFIRMAR',
      mesa_id: MESA,
      nro_comensales: 2,
      fecha_hora: new Date('2026-11-20T20:00:00.000Z'),
    });
    await expect(
      service.update(RESERVA, { fechaHora: 'no-fecha' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.scoped.mesas.findFirst.mockResolvedValue({
      id: MESA_B,
      capacidad: 4,
      estado: 'OCUPADA',
      sucursal_id: 's1',
    });
    await expect(
      service.update(RESERVA, { mesaId: MESA_B } as never),
    ).rejects.toBeInstanceOf(ConflictException);

    prisma.scoped.mesas.findFirst.mockResolvedValue({
      id: MESA,
      capacidad: 2,
      estado: 'LIBRE',
      sucursal_id: 's1',
    });
    await expect(
      service.update(RESERVA, { nroComensales: 4 } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('update cambia de mesa y libera la anterior', async () => {
    prisma.scoped.reservas.findFirst
      .mockResolvedValueOnce({
        id: RESERVA,
        estado: 'POR_CONFIRMAR',
        mesa_id: MESA,
        nro_comensales: 2,
        fecha_hora: new Date('2026-11-20T20:00:00.000Z'),
      })
      .mockResolvedValueOnce(null);
    prisma.scoped.mesas.findFirst.mockResolvedValue({
      id: MESA_B,
      capacidad: 6,
      estado: 'LIBRE',
      sucursal_id: 's1',
    });
    prisma.scoped.reservas.update.mockResolvedValue({ id: RESERVA, mesa_id: MESA_B });

    await expect(
      service.update(RESERVA, { mesaId: MESA_B, telefono: '  ', notas: ' ' } as never),
    ).resolves.toMatchObject({ mesa_id: MESA_B });
    expect(prisma.scoped.reservas.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mesa_id: MESA_B, telefono: null, notas: null }),
      }),
    );
  });

  it('updateStatus rechaza transiciones inválidas', async () => {
    prisma.scoped.reservas.findFirst.mockResolvedValue({
      id: RESERVA,
      estado: 'CANCELADA',
      mesa_id: MESA,
    });
    await expect(service.updateStatus(RESERVA, 'CONFIRMADA')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('updateStatus confirma reservando la mesa y ejecuta ocupándola', async () => {
    prisma.scoped.reservas.findFirst.mockResolvedValue({
      id: RESERVA,
      estado: 'POR_CONFIRMAR',
      mesa_id: MESA,
    });
    await service.updateStatus(RESERVA, 'CONFIRMADA');
    expect(prisma.scoped.mesas.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { estado: 'RESERVADA' } }),
    );

    prisma.scoped.reservas.findFirst.mockResolvedValue({
      id: RESERVA,
      estado: 'CONFIRMADA',
      mesa_id: MESA,
    });
    await service.updateStatus(RESERVA, 'EJECUTADA');
    expect(prisma.scoped.mesas.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { estado: 'OCUPADA' } }),
    );
  });

  it('updateStatus no confirma si la mesa está ocupada', async () => {
    prisma.scoped.reservas.findFirst.mockResolvedValue({
      id: RESERVA,
      estado: 'POR_CONFIRMAR',
      mesa_id: MESA,
    });
    prisma.scoped.mesas.findFirst.mockResolvedValue({
      id: MESA,
      capacidad: 4,
      estado: 'OCUPADA',
      sucursal_id: 's1',
    });
    await expect(service.updateStatus(RESERVA, 'CONFIRMADA')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('exige empresa en el token', async () => {
    await expect(
      buildService({ userId: 'u1' }).create({
        mesaId: MESA,
        clienteNombre: 'Ana',
        nroComensales: 2,
        fechaHora: '2026-11-20T20:00:00-05:00',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
