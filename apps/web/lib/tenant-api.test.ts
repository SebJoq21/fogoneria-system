import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchBranches, fetchTenant } from './tenant-api';

const fetchMock = vi.fn();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchTenant', () => {
  it('traduce la empresa snake_case y convierte el MRR', async () => {
    fetchMock.mockResolvedValue(
      json({
        id: 'e-1',
        nombre_legal: 'Parrilla El Fuego S.A.C.',
        nombre_comercial: null,
        ruc: '20123456786',
        estado: 'TRIAL',
        plan_actual: 'BASICO',
        limite_sucursales: 3,
        trial_fin: '2026-12-01T00:00:00.000Z',
        mrr_monto: '149.90',
        totalSucursales: 2,
        totalUsuarios: 7,
      }),
    );

    const tenant = await fetchTenant();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/backend/tenant',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(tenant).toEqual({
      id: 'e-1',
      legalName: 'Parrilla El Fuego S.A.C.',
      tradeName: null,
      ruc: '20123456786',
      status: 'TRIAL',
      plan: 'BASICO',
      branchLimit: 3,
      trialEnd: '2026-12-01T00:00:00.000Z',
      mrr: 149.9,
      totalBranches: 2,
      totalUsers: 7,
    });
  });

  it('normaliza un MRR no numérico a cero', async () => {
    fetchMock.mockResolvedValue(
      json({
        id: 'e-1',
        nombre_legal: 'X',
        nombre_comercial: 'X',
        ruc: '20123456786',
        estado: 'ACTIVE',
        plan_actual: 'TRIAL',
        limite_sucursales: 1,
        trial_fin: null,
        mrr_monto: null,
        totalSucursales: 1,
        totalUsuarios: 1,
      }),
    );
    await expect(fetchTenant()).resolves.toMatchObject({ mrr: 0 });
  });
});

describe('fetchBranches', () => {
  it('traduce las sucursales con sus opcionales', async () => {
    fetchMock.mockResolvedValue(
      json([
        {
          id: 's-1',
          nombre: 'Miraflores',
          nombre_corto: null,
          direccion: null,
          telefono: null,
          aforo: 40,
          es_matriz: true,
          estado: 'ABIERTA',
        },
        {
          id: 's-2',
          nombre: 'San Isidro',
          nombre_corto: 'San Isidro',
          direccion: 'Av. X',
          telefono: '999',
          aforo: null,
          es_matriz: false,
          estado: 'CERRADA',
        },
      ]),
    );

    const branches = await fetchBranches();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/backend/tenant/branches',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(branches[0]).toEqual({
      id: 's-1',
      name: 'Miraflores',
      short: 'Miraflores',
      address: '',
      phone: '',
      isMain: true,
      status: 'Abierta',
    });
    expect(branches[1]).toMatchObject({ status: 'Cerrada', short: 'San Isidro' });
  });

  it('propaga el error del BFF', async () => {
    fetchMock.mockResolvedValue(json({ message: 'No autorizado' }, 403));
    await expect(fetchBranches()).rejects.toThrow('No autorizado');
  });
});
