import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

function build() {
  const prisma = {
    raw: {
      auditoria: { create: vi.fn(), findMany: vi.fn() },
    },
  };
  return { service: new AuditService(prisma as unknown as PrismaService), prisma };
}

describe('AuditService', () => {
  it('registra el evento con los valores por defecto', async () => {
    const { service, prisma } = build();
    prisma.raw.auditoria.create.mockResolvedValue({ id: 'a-1' });

    await service.record({ accion: 'CREATE', entidad: 'orden' });

    expect(prisma.raw.auditoria.create).toHaveBeenCalledWith({
      data: {
        empresa_id: null,
        sucursal_id: null,
        usuario_id: null,
        accion: 'CREATE',
        entidad: 'orden',
        entidad_id: null,
        detalle: {},
        ip: null,
      },
    });
  });

  it('conserva los datos completos del evento', async () => {
    const { service, prisma } = build();
    prisma.raw.auditoria.create.mockResolvedValue({ id: 'a-1' });

    await service.record({
      empresaId: 'e-1',
      sucursalId: 's-1',
      usuarioId: 'u-1',
      accion: 'VOID',
      entidad: 'comprobante',
      entidadId: 'c-1',
      detalle: { motivo: 'Duplicado' },
      ip: '1.1.1.1',
    });

    expect(prisma.raw.auditoria.create).toHaveBeenCalledWith({
      data: {
        empresa_id: 'e-1',
        sucursal_id: 's-1',
        usuario_id: 'u-1',
        accion: 'VOID',
        entidad: 'comprobante',
        entidad_id: 'c-1',
        detalle: { motivo: 'Duplicado' },
        ip: '1.1.1.1',
      },
    });
  });

  it('un fallo de auditoría no tumba la operación', async () => {
    const { service, prisma } = build();
    prisma.raw.auditoria.create.mockRejectedValue(new Error('db caída'));
    await expect(
      service.record({ accion: 'CREATE', entidad: 'orden' }),
    ).resolves.toBeUndefined();
  });

  it('lista la auditoría de una empresa con el tope indicado', async () => {
    const { service, prisma } = build();
    prisma.raw.auditoria.findMany.mockResolvedValue([{ id: 'a-1' }]);

    await expect(service.list('e-1', 10)).resolves.toEqual([{ id: 'a-1' }]);
    expect(prisma.raw.auditoria.findMany).toHaveBeenCalledWith({
      where: { empresa_id: 'e-1' },
      orderBy: { created_at: 'desc' },
      take: 10,
    });
  });

  it('usa 50 eventos por defecto', async () => {
    const { service, prisma } = build();
    prisma.raw.auditoria.findMany.mockResolvedValue([]);
    await service.list('e-1');
    expect(prisma.raw.auditoria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });
});
