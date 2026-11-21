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

import { ordenesApi } from './api';

beforeEach(() => {
  for (const fn of Object.values(cliente)) fn.mockReset();
});

const tablero = {
  generadoAt: '2026-11-20T12:00:00.000Z',
  slaMinutos: 20,
  ventanaDias: 7,
  limite: 200,
  truncado: false,
  columnas: [
    {
      estado: 'EN_COCINA' as const,
      total: 1,
      ordenes: [
        {
          id: 'o-1',
          numeroOrden: 'ORD-000010',
          estado: 'EN_COCINA' as const,
          origen: 'MESA',
          sucursalId: 's-1',
          mesaId: 'm-1',
          mesa: { id: 'm-1', numero: '12' },
          mesero: 'Ana',
          total: 44.9,
          items: 2,
          ingresoAt: '2026-11-20T11:50:00.000Z',
          confirmacionAt: '2026-11-20T11:52:00.000Z',
          listoAt: null,
          minutos: 8,
          alertaSla: false,
          excedidoPor: null,
        },
      ],
    },
  ],
  metricas: { abiertas: 1, fueraDeSla: 0, promedioEsperaMin: 8, promedioPreparacionMin: null },
};

describe('ordenesApi.getTablero', () => {
  it('pide el tablero con los filtros y lo traduce a columnas', async () => {
    cliente.get.mockResolvedValue(tablero);
    const resultado = await ordenesApi.getTablero({
      sucursalId: 's-1',
      dias: 7,
      limite: 200,
    });

    expect(cliente.get).toHaveBeenCalledWith(
      '/orders/board?sucursalId=s-1&dias=7&limite=200',
      { signal: undefined },
    );
    expect(resultado.columns.map((columna) => columna.status)).toEqual([
      'pendiente',
      'cocina',
      'listo',
      'entregado',
    ]);
    expect(resultado.columns[1]!.orders[0]).toMatchObject({
      id: 'ORD-000010',
      apiId: 'o-1',
      status: 'cocina',
      customer: 'Mesa 12',
    });
  });

  it('sin filtros consulta la ventana por defecto', async () => {
    cliente.get.mockResolvedValue(tablero);
    await ordenesApi.getTablero();
    expect(cliente.get).toHaveBeenCalledWith('/orders/board', { signal: undefined });
  });
});
