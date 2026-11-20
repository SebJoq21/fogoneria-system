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

import { crmApi } from './api';

const clienteApi = {
  id: 'c-1',
  nombre: 'Rosa Pérez',
  telefono: '987654321',
  segmento: 'VIP',
  visitas: 21,
  puntos: 1240,
  ultima_visita: '2026-11-18T20:30:00.000Z',
  created_at: '2026-01-05T10:00:00.000Z',
};

beforeEach(() => {
  for (const fn of Object.values(cliente)) fn.mockReset();
});

describe('crmApi.listar', () => {
  it('arma la query, traduce los clientes y conserva la paginación', async () => {
    cliente.get.mockResolvedValue({
      items: [clienteApi],
      total: 1,
      page: 2,
      limit: 10,
    });

    const lista = await crmApi.listar({ q: 'rosa', segmento: 'VIP', page: 2, limit: 10 });

    expect(cliente.get).toHaveBeenCalledWith(
      '/crm/customers?q=rosa&segmento=VIP&page=2&limit=10',
      { signal: undefined },
    );
    expect(lista).toMatchObject({ total: 1, page: 2, limit: 10 });
    expect(lista.items[0]).toMatchObject({ id: 'c-1', segmento: 'VIP', puntos: 1240 });
  });

  it('sin filtros no agrega query', async () => {
    cliente.get.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    await crmApi.listar();
    expect(cliente.get).toHaveBeenCalledWith('/crm/customers', { signal: undefined });
  });
});

describe('crmApi.ficha y crear', () => {
  it('traduce la ficha con sus movimientos', async () => {
    cliente.get.mockResolvedValue({
      ...clienteApi,
      movimientos_puntos: [
        {
          id: 'm-1',
          tipo: 'CANJE',
          puntos: 10,
          motivo: null,
          created_at: '2026-11-19T10:00:00.000Z',
          orden_id: null,
        },
      ],
    });
    const ficha = await crmApi.ficha('c-1');
    expect(cliente.get).toHaveBeenCalledWith('/crm/customers/c-1', { signal: undefined });
    expect(ficha.movimientos).toEqual([
      {
        id: 'm-1',
        tipo: 'CANJE',
        puntos: 10,
        motivo: null,
        createdAt: '2026-11-19T10:00:00.000Z',
        ordenId: null,
      },
    ]);
  });

  it('crea el cliente con el contrato camelCase', async () => {
    cliente.post.mockResolvedValue({ ...clienteApi, id: 'c-2' });
    const creado = await crmApi.crear({ nombre: 'Rosa Pérez', telefono: '987654321' });
    expect(cliente.post).toHaveBeenCalledWith('/crm/customers', {
      nombre: 'Rosa Pérez',
      telefono: '987654321',
    });
    expect(creado.id).toBe('c-2');
  });
});

describe('crmApi.ajustarPuntos', () => {
  it('envía solo los campos presentes', async () => {
    cliente.post.mockResolvedValue(clienteApi);
    await crmApi.ajustarPuntos('c-1', { tipo: 'GANANCIA', puntos: 5 });
    expect(cliente.post).toHaveBeenCalledWith('/crm/customers/c-1/points', {
      tipo: 'GANANCIA',
      puntos: 5,
    });
  });

  it('incluye motivo y sucursal cuando llegan', async () => {
    cliente.post.mockResolvedValue(clienteApi);
    await crmApi.ajustarPuntos('c-1', {
      tipo: 'CANJE',
      puntos: 3,
      motivo: 'Cortesía',
      sucursalId: 's-1',
    });
    expect(cliente.post).toHaveBeenCalledWith('/crm/customers/c-1/points', {
      tipo: 'CANJE',
      puntos: 3,
      motivo: 'Cortesía',
      sucursalId: 's-1',
    });
  });
});

describe('crmApi configuración y consumos', () => {
  it('lee la configuración de lealtad', async () => {
    cliente.get.mockResolvedValue({
      puntos_por_moneda: '1.50',
      caducidad_meses: 12,
      umbral_frecuente: 5,
      umbral_vip: 20,
    });
    const config = await crmApi.config();
    expect(cliente.get).toHaveBeenCalledWith('/crm/config', { signal: undefined });
    expect(config).toEqual({
      puntosPorMoneda: 1.5,
      caducidadMeses: 12,
      umbralFrecuente: 5,
      umbralVip: 20,
    });
  });

  it('actualiza solo los campos enviados', async () => {
    cliente.patch.mockResolvedValue({
      puntos_por_moneda: 2,
      caducidad_meses: 12,
      umbral_frecuente: 5,
      umbral_vip: 20,
    });
    const config = await crmApi.actualizarConfig({ puntosPorMoneda: 2, umbralVip: 30 });
    expect(cliente.patch).toHaveBeenCalledWith('/crm/config', {
      puntosPorMoneda: 2,
      umbralVip: 30,
    });
    expect(config.puntosPorMoneda).toBe(2);
  });

  it('actualizar sin cambios manda un body vacío', async () => {
    cliente.patch.mockResolvedValue({
      puntos_por_moneda: 1,
      caducidad_meses: 1,
      umbral_frecuente: 1,
      umbral_vip: 2,
    });
    await crmApi.actualizarConfig({});
    expect(cliente.patch).toHaveBeenCalledWith('/crm/config', {});
  });

  it('reprocesa los consumos en el endpoint del worker', async () => {
    cliente.post.mockResolvedValue({ puntos: 36, clientes: 1 });
    await expect(crmApi.procesarConsumos()).resolves.toEqual({ puntos: 36, clientes: 1 });
    expect(cliente.post).toHaveBeenCalledWith('/crm/process', {});
  });
});
