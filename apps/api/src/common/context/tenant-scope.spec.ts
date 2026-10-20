import { describe, expect, it } from 'vitest';
import {
  injectTenantData,
  mergeTenantWhere,
  tenantWhere,
} from './tenant-scope.js';
import type { TenantContext } from './tenant-context.service.js';

const context: TenantContext = {
  userId: 'u1',
  empresaId: 'e1',
  sucursalId: 's1',
  rol: 'ADMIN_GLOBAL',
  bypass: false,
};

describe('tenant-scope', () => {
  it('filtra por empresa y sucursal cuando el modelo tiene ambas', () => {
    expect(tenantWhere({ empresa: true, sucursal: true }, context)).toEqual({
      empresa_id: 'e1',
      sucursal_id: 's1',
    });
  });

  it('no filtra si el contexto no tiene empresa', () => {
    expect(
      tenantWhere(
        { empresa: true, sucursal: true },
        { ...context, empresaId: null, sucursalId: null },
      ),
    ).toBeNull();
  });

  it('combina el where del caller con AND, nunca OR', () => {
    expect(
      mergeTenantWhere({ empresa: true, sucursal: false }, context, {
        activa: true,
      }),
    ).toEqual({ AND: [{ activa: true }, { empresa_id: 'e1' }] });
  });

  it('inyecta empresa y sucursal en creates sin sobrescribir valores', () => {
    expect(
      injectTenantData({ empresa: true, sucursal: true }, context, {
        nombre: 'Mesa 1',
      }),
    ).toEqual({ nombre: 'Mesa 1', empresa_id: 'e1', sucursal_id: 's1' });

    expect(
      injectTenantData({ empresa: true, sucursal: false }, context, {
        empresa_id: 'otra',
      }),
    ).toEqual({ empresa_id: 'otra' });
  });
});
