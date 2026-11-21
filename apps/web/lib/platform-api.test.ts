import { beforeEach, describe, expect, it, vi } from 'vitest';

const cliente = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  request: vi.fn(),
}));

vi.mock('@fogoneria/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fogoneria/sdk')>();
  return { ...actual, createClient: () => cliente };
});

import { plataformaApi } from './platform-api';

const empresaApi = {
  id: 'e-1',
  nombre_legal: 'Parrilla El Fuego S.A.C.',
  nombre_comercial: 'El Fuego',
  ruc: '20123456786',
  estado: 'TRIAL',
  plan_actual: 'BASICO',
  limite_sucursales: 3,
  trial_fin: null,
  mrr_monto: '149.90',
  totalSucursales: 2,
  totalUsuarios: 7,
};

beforeEach(() => {
  for (const fn of Object.values(cliente)) fn.mockReset();
});

describe('plataformaApi.onboarding', () => {
  it('publica el alta y traduce el resultado', async () => {
    cliente.post.mockResolvedValue({
      id: 'e-1',
      nombreLegal: 'El Fuego',
      nombreComercial: null,
      ruc: '20123456786',
      logoUrl: null,
      estado: 'TRIAL',
      plan: 'TRIAL',
      trialFin: null,
      sucursalMatriz: { id: 's-1', nombre: 'Matriz' },
      admin: { id: 'u-1', nombre: 'Ana', email: 'ana@elfuego.pe' },
    });

    const resultado = await plataformaApi.onboarding({
      nombreLegal: 'El Fuego',
      ruc: '20123456786',
      nombreAdmin: 'Ana',
      emailAdmin: 'ana@elfuego.pe',
      password: 'secreta123',
    });

    expect(cliente.post).toHaveBeenCalledWith('/onboarding', {
      nombreLegal: 'El Fuego',
      ruc: '20123456786',
      nombreAdmin: 'Ana',
      emailAdmin: 'ana@elfuego.pe',
      password: 'secreta123',
    });
    expect(resultado).toMatchObject({ id: 'e-1', estado: 'TRIAL', plan: 'TRIAL' });
  });
});

describe('plataformaApi consola SaaS', () => {
  it('lista empresas con el tope de la consola', async () => {
    cliente.get.mockResolvedValue({
      items: [
        {
          id: 'e-1',
          nombre_legal: 'El Fuego',
          nombre_comercial: null,
          ruc: '20123456786',
          estado: 'ACTIVE',
          plan_actual: 'PROFESIONAL',
          mrr_monto: 299,
          _count: { sucursales: 2, usuarios: 5 },
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
    });

    const lista = await plataformaApi.empresas();

    expect(cliente.get).toHaveBeenCalledWith('/saas/tenants?limit=50', { signal: undefined });
    expect(lista.items[0]).toMatchObject({ id: 'e-1', estado: 'ACTIVE', sucursales: 2 });
  });

  it('tolera una respuesta sin items', async () => {
    cliente.get.mockResolvedValue({ total: 0, page: 1, limit: 50 });
    await expect(plataformaApi.empresas()).resolves.toMatchObject({ items: [] });
  });

  it('lee y normaliza las métricas', async () => {
    cliente.get.mockResolvedValue({
      empresas: { total: 5, trial: 2, active: 2, suspended: 1, expired: 0 },
      mrr: '480.50',
    });
    const metricas = await plataformaApi.metricas();
    expect(cliente.get).toHaveBeenCalledWith('/saas/metrics', { signal: undefined });
    expect(metricas).toMatchObject({ mrr: 480.5, empresas: { total: 5 } });
  });

  it('suspende y reactiva con su motivo', async () => {
    cliente.post.mockResolvedValue({
      id: 'e-1',
      nombre_legal: 'El Fuego',
      nombre_comercial: null,
      ruc: '20123456786',
      estado: 'SUSPENDED',
      plan_actual: 'BASICO',
      mrr_monto: 149.9,
      _count: { sucursales: 1, usuarios: 2 },
    });

    const suspendida = await plataformaApi.suspender('e-1', 'Falta de pago');
    expect(cliente.post).toHaveBeenCalledWith('/saas/tenants/e-1/suspend', {
      motivo: 'Falta de pago',
    });
    expect(suspendida.estado).toBe('SUSPENDED');

    cliente.post.mockResolvedValue({
      id: 'e-1',
      nombre_legal: 'El Fuego',
      nombre_comercial: null,
      ruc: '20123456786',
      estado: 'ACTIVE',
      plan_actual: 'BASICO',
      mrr_monto: 149.9,
      _count: { sucursales: 1, usuarios: 2 },
    });
    const activa = await plataformaApi.reactivar('e-1', 'Pago regularizado');
    expect(cliente.post).toHaveBeenLastCalledWith('/saas/tenants/e-1/reactivate', {
      motivo: 'Pago regularizado',
    });
    expect(activa.estado).toBe('ACTIVE');
  });
});

describe('plataformaApi tenant', () => {
  it('lee la empresa del token', async () => {
    cliente.get.mockResolvedValue(empresaApi);
    const empresa = await plataformaApi.empresa();
    expect(cliente.get).toHaveBeenCalledWith('/tenant', { signal: undefined });
    expect(empresa).toMatchObject({ id: 'e-1', plan: 'BASICO', mrr: 149.9 });
  });

  it('lee las sucursales y normaliza las opcionales', async () => {
    cliente.get.mockResolvedValue([
      {
        id: 's-1',
        nombre: 'Miraflores',
        nombre_corto: 'Mira',
        direccion: 'Av. Larco 123',
        telefono: null,
        aforo: 40,
        es_matriz: true,
        estado: 'ABIERTA',
      },
      {
        id: 's-2',
        nombre: 'San Isidro',
        nombre_corto: null,
        direccion: null,
        telefono: '',
        aforo: null,
        es_matriz: false,
        estado: 'CERRADA',
      },
    ]);

    const sucursales = await plataformaApi.sucursales();

    expect(cliente.get).toHaveBeenCalledWith('/tenant/branches', { signal: undefined });
    expect(sucursales[0]).toMatchObject({ id: 's-1', nombreCorto: 'Mira' });
    expect(sucursales[1]).toMatchObject({
      id: 's-2',
      nombreCorto: 'San Isidro',
      direccion: '',
      telefono: '',
      estado: 'CERRADA',
    });
  });
});
