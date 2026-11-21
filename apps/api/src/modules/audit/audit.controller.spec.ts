import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuditController } from './audit.controller.js';
import type { AuditService } from './audit.service.js';

const user = {
  sub: 'u-1',
  email: 'admin@fuego.pe',
  nombre: 'Admin',
  rol: 'ADMIN_GLOBAL' as const,
  empresaId: 'e-1',
  sucursalId: null,
};

function build() {
  const audit = { list: vi.fn().mockResolvedValue([{ id: 'a-1' }]) };
  return {
    controller: new AuditController(audit as unknown as AuditService),
    audit,
  };
}

describe('AuditController', () => {
  it('lista los eventos de la empresa del token con el límite pedido', async () => {
    const { controller, audit } = build();
    await expect(controller.list(user, { limit: 10 })).resolves.toEqual({
      items: [{ id: 'a-1' }],
    });
    expect(audit.list).toHaveBeenCalledWith('e-1', 10);
  });

  it('usa 50 eventos por defecto', async () => {
    const { controller, audit } = build();
    await controller.list(user, {});
    expect(audit.list).toHaveBeenCalledWith('e-1', 50);
  });

  it('rechaza un usuario sin empresa', async () => {
    const { controller } = build();
    await expect(controller.list({ ...user, empresaId: null }, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
