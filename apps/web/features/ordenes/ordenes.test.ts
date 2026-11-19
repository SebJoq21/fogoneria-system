import { describe, expect, it } from 'vitest';
import {
  COLUMNAS_KDS,
  canalDeOrigen,
  esOrdenAbierta,
  estadoKdsDeApi,
  etiquetaEstadoKds,
  isEstadoOrden,
  slaBaseDe,
  type TableroOrdenes,
} from '@fogoneria/contracts/ordenes';
import { tableroDesdeApi } from './api';

const tableroApi: TableroOrdenes = {
  generadoAt: '2026-11-06T12:00:00.000Z',
  slaMinutos: 20,
  ventanaDias: 7,
  limite: 200,
  truncado: false,
  columnas: [
    {
      estado: 'POR_CONFIRMAR',
      total: 1,
      ordenes: [
        {
          id: 'orden-1',
          numeroOrden: 'ORD-000010',
          estado: 'POR_CONFIRMAR',
          origen: 'MESA',
          sucursalId: 'suc-1',
          mesaId: 'mesa-1',
          mesa: { id: 'mesa-1', numero: '12' },
          mesero: 'Ana',
          total: 44.9,
          items: 2,
          ingresoAt: '2026-11-06T11:50:00.000Z',
          confirmacionAt: null,
          listoAt: null,
          minutos: 10,
          alertaSla: false,
          excedidoPor: null,
        },
      ],
    },
    { estado: 'EN_COCINA', total: 0, ordenes: [] },
    { estado: 'LISTO', total: 0, ordenes: [] },
    { estado: 'ENTREGADO', total: 0, ordenes: [] },
  ],
  metricas: {
    abiertas: 1,
    fueraDeSla: 0,
    promedioEsperaMin: 4,
    promedioPreparacionMin: null,
  },
};

describe('estados de orden', () => {
  it('traduce los 7 estados de la API a columnas del KDS', () => {
    expect(estadoKdsDeApi('POR_CONFIRMAR')).toBe('pendiente');
    expect(estadoKdsDeApi('EN_COCINA')).toBe('cocina');
    expect(estadoKdsDeApi('LISTO')).toBe('listo');
    expect(estadoKdsDeApi('ENTREGADO')).toBe('entregado');
    expect(estadoKdsDeApi('PAGADA')).toBe('entregado');
    expect(estadoKdsDeApi('CERRADA')).toBe('entregado');
    expect(estadoKdsDeApi('ANULADA')).toBe('anulado');
  });

  it('reconoce solo estados válidos', () => {
    expect(isEstadoOrden('EN_COCINA')).toBe(true);
    expect(isEstadoOrden('VOLTEADA')).toBe(false);
  });

  it('capitaliza el canal según el origen', () => {
    expect(canalDeOrigen('MESA')).toBe('Mesa');
    expect(canalDeOrigen('BARRA')).toBe('Llevar');
    expect(canalDeOrigen('MOSTRADOR')).toBe('Llevar');
    expect(canalDeOrigen('WEB')).toBe('Web');
    expect(canalDeOrigen('DELIVERY')).toBe('Web');
  });

  it('usa la confirmación como base del SLA y cierra en estados terminales', () => {
    const base = { ingresoAt: '2026-11-06T11:50:00.000Z' };
    expect(slaBaseDe(base)).toBe('2026-11-06T11:50:00.000Z');
    expect(slaBaseDe({ ...base, confirmacionAt: '2026-11-06T11:55:00.000Z' })).toBe(
      '2026-11-06T11:55:00.000Z',
    );
    expect(esOrdenAbierta('EN_COCINA')).toBe(true);
    expect(esOrdenAbierta('PAGADA')).toBe(false);
    expect(esOrdenAbierta('ANULADA')).toBe(false);
  });
});

describe('tablero del KDS', () => {
  it('respeta el orden de columnas y no inventa comandas', () => {
    const tablero = tableroDesdeApi(tableroApi);
    expect(tablero.columns.map((columna) => columna.status)).toEqual([
      'pendiente',
      'cocina',
      'listo',
      'entregado',
    ]);
    expect(tablero.columns[1]?.orders).toEqual([]);
    expect(tablero.slaMinutos).toBe(20);
    expect(tablero.metricas.abiertas).toBe(1);
  });

  it('mapea la comanda al modelo de presentación', () => {
    const [comanda] = tableroDesdeApi(tableroApi).columns[0]!.orders;
    expect(comanda).toMatchObject({
      id: 'ORD-000010',
      apiId: 'orden-1',
      status: 'pendiente',
      customer: 'Mesa 12',
      channel: 'Mesa',
      amount: 44.9,
      items: 2,
      alertaSla: false,
    });
  });

  it('etiqueta cada columna del KDS', () => {
    expect(COLUMNAS_KDS.map((columna) => columna.status)).toEqual([
      'pendiente',
      'cocina',
      'listo',
      'entregado',
    ]);
    expect(etiquetaEstadoKds('cocina')).toBe('En cocina');
    expect(etiquetaEstadoKds('anulado')).toBe('Anulada');
  });
});
