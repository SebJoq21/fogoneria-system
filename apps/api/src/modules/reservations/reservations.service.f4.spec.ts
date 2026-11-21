import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReservationsService } from './reservations.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { SequencesService } from '../../common/sequences/sequences.service.js';

const context = {
  userId: 'u1' as string | null,
  empresaId: 'e1',
  sucursalId: 's1',
  rol: 'ADMIN_GLOBAL' as const,
  bypass: false,
};
const RESERVA = '11111111-1111-4111-8111-111111111111';
const MESA_A = '22222222-2222-4222-8222-222222222222';
const MESA_B = '33333333-3333-4333-8333-333333333333';

function buildPrisma() {
  return {
    scoped: {
      reservas: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      mesas: {
        findFirst: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      ordenes: { findFirst: vi.fn().mockResolvedValue(null) },
    },
  };
}

describe('ReservationsService (f4: fechas y edición parcial)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let service: ReservationsService;

  beforeEach(() => {
    prisma = buildPrisma();
    service = new ReservationsService(
      prisma as unknown as PrismaService,
      { get: () => context } as unknown as TenantContextService,
      { nextCodigoReserva: vi.fn().mockResolvedValue('RSV-1') } as unknown as SequencesService,
    );
  });

  it('lista con fecha, estado y mesa; rechaza fecha inválida', async () => {
    await service.list({ fecha: '2026-11-20', estado: 'CONFIRMADA', mesaId: MESA_A } as never);
    expect(prisma.scoped.reservas.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fecha_hora: { gte: expect.any(Date), lt: expect.any(Date) },
          estado: 'CONFIRMADA',
          mesa_id: MESA_A,
        }),
      }),
    );

    await expect(service.list({ fecha: '2026-13-40' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('findOne 404', async () => {
    prisma.scoped.reservas.findFirst.mockResolvedValue(null);
    await expect(service.findOne(RESERVA)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('crea con defaults y sin usuario en el token', async () => {
    const sinUsuario = new ReservationsService(
      prisma as unknown as PrismaService,
      { get: () => ({ ...context, userId: null }) } as unknown as TenantContextService,
      { nextCodigoReserva: vi.fn().mockResolvedValue('RSV-1') } as unknown as SequencesService,
    );
    prisma.scoped.mesas.findFirst.mockResolvedValue({
      id: MESA_A,
      numero: '1',
      capacidad: 4,
      estado: 'LIBRE',
      sucursal_id: 's1',
    });
    prisma.scoped.reservas.create.mockResolvedValue({ id: RESERVA });

    await sinUsuario.create({
      mesaId: MESA_A,
      clienteNombre: ' Camila ',
      nroComensales: 2,
      fechaHora: '2026-11-20T20:00:00-05:00',
    } as never);

    expect(prisma.scoped.reservas.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cliente_nombre: 'Camila',
        telefono: null,
        canal: 'Presencial',
        notas: null,
        creada_por: null,
      }),
      include: expect.any(Object),
    });
  });

  it('edita solo un campo y mueve la reserva de mesa', async () => {
    prisma.scoped.reservas.findFirst
      .mockResolvedValueOnce({
        id: RESERVA,
        estado: 'POR_CONFIRMAR',
        mesa_id: MESA_A,
        fecha_hora: new Date('2026-11-20T20:00:00-05:00'),
        nro_comensales: 2,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.scoped.mesas.findFirst.mockResolvedValue({
      id: MESA_B,
      numero: '2',
      capacidad: 6,
      estado: 'LIBRE',
      sucursal_id: 's1',
    });
    prisma.scoped.reservas.update.mockResolvedValue({ id: RESERVA });

    await service.update(RESERVA, {
      mesaId: MESA_B,
      telefono: ' ',
      notas: ' ',
      canal: ' Web ',
    } as never);

    expect(prisma.scoped.reservas.update).toHaveBeenCalledWith({
      where: { id: RESERVA },
      data: {
        mesa_id: MESA_B,
        fecha_hora: new Date('2026-11-20T20:00:00-05:00'),
        telefono: null,
        canal: 'Web',
        notas: null,
      },
      include: expect.any(Object),
    });
    expect(prisma.scoped.mesas.updateMany).toHaveBeenCalled();
  });

  it('exige empresa en el token', async () => {
    const sinEmpresa = new ReservationsService(
      prisma as unknown as PrismaService,
      { get: () => ({}) } as unknown as TenantContextService,
      { nextCodigoReserva: vi.fn() } as unknown as SequencesService,
    );
    await expect(
      sinEmpresa.create({ mesaId: MESA_A, clienteNombre: 'X', nroComensales: 1, fechaHora: '2026-11-20T20:00:00-05:00' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
