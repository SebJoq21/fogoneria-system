import { describe, expect, it, vi } from 'vitest';

const cliente = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@fogoneria/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fogoneria/sdk')>();
  return { ...actual, createClient: () => cliente };
});

import { auditApi, toEvento } from './api';

const apiEvento = {
  id: 'a-1',
  empresa_id: 'e-1',
  sucursal_id: null,
  usuario_id: 'u-1',
  accion: 'CREATE',
  entidad: 'orden',
  entidad_id: 'o-1',
  detalle: { total: 24.9 },
  ip: null,
  created_at: '2026-11-21T10:00:00.000Z',
};

describe('auditApi', () => {
  it('traduce el evento snake_case al contrato', () => {
    expect(toEvento(apiEvento)).toMatchObject({
      id: 'a-1',
      empresaId: 'e-1',
      usuarioId: 'u-1',
      accion: 'CREATE',
      entidad: 'orden',
      entidadId: 'o-1',
      detalle: { total: 24.9 },
    });
  });

  it('lista los últimos eventos con el tope pedido', async () => {
    cliente.get.mockResolvedValue({ items: [apiEvento] });
    const lista = await auditApi.list({ limit: 100 });
    expect(cliente.get).toHaveBeenCalledWith('/audit?limit=100', { signal: undefined });
    expect(lista.items).toHaveLength(1);
  });

  it('tolera una respuesta sin items y detalle nulo', async () => {
    cliente.get.mockResolvedValue({});
    await expect(auditApi.list()).resolves.toEqual({ items: [] });
    expect(toEvento({ ...apiEvento, detalle: null }).detalle).toEqual({});
  });
});
