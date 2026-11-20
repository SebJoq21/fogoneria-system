import { describe, expect, it, vi } from 'vitest';
import { TenantController } from './tenant.controller.js';
import type { TenantService } from './tenant.service.js';

function build() {
  const tenant = {
    context: vi.fn().mockResolvedValue({ empresaId: 'e-1' }),
    currentTenant: vi.fn().mockResolvedValue({ id: 'e-1' }),
    listBranches: vi.fn().mockResolvedValue([]),
  };
  return { controller: new TenantController(tenant as unknown as TenantService), tenant };
}

const user = { userId: 'u-1', empresaId: 'e-1' } as never;

describe('TenantController', () => {
  it('delega el contexto y la empresa del token', async () => {
    const { controller, tenant } = build();
    await controller.context(user);
    expect(tenant.context).toHaveBeenCalledWith(user);
    await controller.current(user);
    expect(tenant.currentTenant).toHaveBeenCalledWith(user);
  });

  it('delega las sucursales visibles', async () => {
    const { controller, tenant } = build();
    await expect(controller.branches()).resolves.toEqual([]);
    expect(tenant.listBranches).toHaveBeenCalledWith();
  });
});
