import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const tablero = vi.hoisted(() => ({
  board: {
    columns: [
      {
        status: 'pendiente',
        label: 'Por confirmar',
        orders: [
          {
            id: 'ORD-000001',
            apiId: 'o-1',
            status: 'pendiente',
            customer: 'Mesa 4',
            channel: 'Mesa',
            waiter: 'Luis',
            amount: 44.9,
            items: 2,
            createdAt: '2026-11-20T11:00:00.000Z',
            slaBaseAt: '2026-11-20T11:00:00.000Z',
            alertaSla: false,
            excedidoPor: null,
            mesa: { id: 'm-1', numero: '4' },
          },
        ],
      },
      { status: 'cocina', label: 'En cocina', orders: [] },
      { status: 'listo', label: 'Listo', orders: [] },
      { status: 'entregado', label: 'Entregado', orders: [] },
    ],
    slaMinutos: 20,
    truncado: false,
    generadoAt: '2026-11-20T12:00:00.000Z',
    metricas: { abiertas: 1, fueraDeSla: 0, promedioEsperaMin: 3, promedioPreparacionMin: null },
  },
  loading: false,
  error: null as string | null,
  refresh: () => {},
}));

vi.mock('./hooks', () => ({
  useTableroOrdenes: () => tablero,
  useOrdersRealtime: () => ({ status: 'online', lastEvent: null }),
}));

const estado = vi.hoisted(() => ({
  orders: [],
  advanceOrder: () => {},
  ordersLoading: false,
  ordersError: null,
  refreshOrders: () => {},
  activeBranch: { id: 's-1', name: 'Miraflores' },
  isGeneral: false,
  branchOf: () => ({ name: 'Miraflores' }),
  currentUser: { id: 'u-1', role: 'cocina', empresaId: 'e-1', branchId: 's-1' },
  notify: () => {},
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { OrdersBoardPage } from './OrdersBoardPage';

describe('OrdersBoardPage', () => {
  it('pinta las cuatro columnas del KDS con la comanda', () => {
    const markup = renderToStaticMarkup(<OrdersBoardPage />);
    expect(markup).toContain('Por confirmar');
    expect(markup).toContain('En cocina');
    expect(markup).toContain('ORD-000001');
    expect(markup).toContain('Mesa 4');
  });

  it('el modo cocina muestra sus acciones', () => {
    const markup = renderToStaticMarkup(<OrdersBoardPage mode="cocina" />);
    expect(markup).toContain('En cocina');
  });

  it('un error del tablero se pinta', () => {
    tablero.error = 'No se pudo cargar el tablero';
    const markup = renderToStaticMarkup(<OrdersBoardPage />);
    expect(markup).toContain('No se pudo cargar el tablero');
    tablero.error = null;
  });
});
