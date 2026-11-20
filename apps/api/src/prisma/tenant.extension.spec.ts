import { describe, expect, it, vi } from 'vitest';
import { withTenantScope } from './tenant.extension.js';
import type { TenantContextService } from '../common/context/tenant-context.service.js';

type Handler = (params: {
  model?: string;
  operation: string;
  args: Record<string, unknown>;
  query: (args: Record<string, unknown>) => Promise<unknown>;
}) => Promise<unknown>;

function build(context: unknown) {
  const client = { $extends: vi.fn((extension: unknown) => extension) };
  const tenantContext = { get: () => context };
  withTenantScope(
    client as never,
    tenantContext as unknown as TenantContextService,
  );
  const extension = client.$extends.mock.calls[0][0] as {
    query: { $allModels: { $allOperations: Handler } };
  };
  return extension.query.$allModels.$allOperations;
}

const contexto = {
  userId: 'u-1',
  empresaId: 'e-1',
  sucursalId: 's-1',
  rol: 'MESERO' as const,
  bypass: false,
};

describe('withTenantScope', () => {
  it('sin contexto no filtra y ejecuta la query original', async () => {
    const handler = build(undefined);
    const query = vi.fn().mockResolvedValue('ok');
    await expect(
      handler({ model: 'ordenes', operation: 'findMany', args: { where: { estado: 'X' } }, query }),
    ).resolves.toBe('ok');
    expect(query).toHaveBeenCalledWith({ where: { estado: 'X' } });
  });

  it('SUPERADMIN (bypass) no filtra', async () => {
    const handler = build({ ...contexto, bypass: true });
    const query = vi.fn().mockResolvedValue('ok');
    await handler({ model: 'ordenes', operation: 'findMany', args: {}, query });
    expect(query).toHaveBeenCalledWith({});
  });

  it('sin modelo o con modelo no scoped no filtra', async () => {
    const handler = build(contexto);
    const query = vi.fn().mockResolvedValue('ok');
    await handler({ operation: 'findMany', args: {}, query });
    await handler({ model: 'empresas', operation: 'findMany', args: {}, query });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('inyecta empresa y sucursal en operaciones de lectura', async () => {
    const handler = build(contexto);
    const query = vi.fn().mockResolvedValue('ok');
    await handler({
      model: 'ordenes',
      operation: 'findMany',
      args: { where: { estado: 'EN_COCINA' } },
      query,
    });
    expect(query).toHaveBeenCalledWith({
      where: { AND: [{ estado: 'EN_COCINA' }, { empresa_id: 'e-1', sucursal_id: 's-1' }] },
    });
  });

  it('sin where del caller usa solo el filtro de tenant', async () => {
    const handler = build(contexto);
    const query = vi.fn().mockResolvedValue('ok');
    await handler({ model: 'platos', operation: 'count', args: {}, query });
    expect(query).toHaveBeenCalledWith({ where: { empresa_id: 'e-1' } });
  });

  it('inyecta el tenant en create', async () => {
    const handler = build(contexto);
    const query = vi.fn().mockResolvedValue('ok');
    await handler({
      model: 'ordenes',
      operation: 'create',
      args: { data: { numero_orden: 'ORD-1' } },
      query,
    });
    expect(query).toHaveBeenCalledWith({
      data: { numero_orden: 'ORD-1', empresa_id: 'e-1', sucursal_id: 's-1' },
    });
  });

  it('inyecta el tenant en cada fila de createMany', async () => {
    const handler = build(contexto);
    const query = vi.fn().mockResolvedValue('ok');
    await handler({
      model: 'mesas',
      operation: 'createMany',
      args: { data: [{ numero: '1' }, { numero: '2', empresa_id: 'otra' }] },
      query,
    });
    expect(query).toHaveBeenCalledWith({
      data: [
        { numero: '1', empresa_id: 'e-1', sucursal_id: 's-1' },
        { numero: '2', empresa_id: 'otra', sucursal_id: 's-1' },
      ],
    });
  });

  it('createMany con un solo objeto también inyecta', async () => {
    const handler = build(contexto);
    const query = vi.fn().mockResolvedValue('ok');
    await handler({
      model: 'mesas',
      operation: 'createMany',
      args: { data: { numero: '1' } },
      query,
    });
    expect(query).toHaveBeenCalledWith({
      data: [{ numero: '1', empresa_id: 'e-1', sucursal_id: 's-1' }],
    });
  });

  it('findUnique no se toca (clave única)', async () => {
    const handler = build(contexto);
    const query = vi.fn().mockResolvedValue('ok');
    await handler({
      model: 'ordenes',
      operation: 'findUnique',
      args: { where: { id: 'o-1' } },
      query,
    });
    expect(query).toHaveBeenCalledWith({ where: { id: 'o-1' } });
  });

  it('si hay transacción RLS usa el delegate de esa transacción', async () => {
    const delegate = { findMany: vi.fn().mockResolvedValue('tx') };
    const handler = build({ ...contexto, tx: { ordenes: delegate } });
    const query = vi.fn();
    await expect(
      handler({ model: 'ordenes', operation: 'findMany', args: {}, query }),
    ).resolves.toBe('tx');
    expect(delegate.findMany).toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('sin delegate en la transacción cae a la query original', async () => {
    const handler = build({ ...contexto, tx: {} });
    const query = vi.fn().mockResolvedValue('ok');
    await handler({ model: 'ordenes', operation: 'findMany', args: {}, query });
    expect(query).toHaveBeenCalled();
  });
});
