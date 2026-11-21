import { describe, expect, it } from 'vitest';
import {
  COLUMNAS_KDS,
  ESTADOS_ORDEN,
  canalDeOrigen,
  esOrdenAbierta,
  estadoKdsDeApi,
  etiquetaEstadoKds,
  isEstadoOrden,
  slaBaseDe,
  validarOrden,
} from './orders';
import type { OrdenInput } from './orders';

const itemPlato = { tipo: 'PLATO', platoId: 'p-1', cantidad: 2 } as const;

describe('validarOrden', () => {
  it('acepta una orden con mesa o sucursal y al menos un ítem', () => {
    expect(validarOrden({ mesaId: 'm-1', items: [itemPlato] })).toBeNull();
    expect(validarOrden({ sucursalId: 's-1', items: [itemPlato] })).toBeNull();
  });

  it('exige mesa o sucursal', () => {
    expect(validarOrden({ items: [itemPlato] })).toBe('La orden requiere mesa o sucursal');
  });

  it('exige al menos un ítem', () => {
    expect(validarOrden({ mesaId: 'm-1', items: [] })).toBe(
      'La orden requiere al menos un ítem',
    );
    expect(
      validarOrden({ mesaId: 'm-1', items: undefined as unknown as OrdenInput['items'] }),
    ).toBe('La orden requiere al menos un ítem');
  });

  it('valida la coherencia de cada ítem', () => {
    expect(
      validarOrden({ mesaId: 'm-1', items: [{ tipo: 'PLATO', cantidad: 1 }] }),
    ).toBe('Un ítem PLATO requiere platoId');
    expect(
      validarOrden({ mesaId: 'm-1', items: [{ tipo: 'COMBO', cantidad: 1 }] }),
    ).toBe('Un ítem COMBO requiere comboId');
    expect(
      validarOrden({ mesaId: 'm-1', items: [{ tipo: 'COMBO', comboId: 'c-1', cantidad: 1 }] }),
    ).toBeNull();
    for (const cantidad of [0, -1, Number.NaN]) {
      expect(
        validarOrden({ mesaId: 'm-1', items: [{ ...itemPlato, cantidad }] }),
      ).toBe('La cantidad debe ser al menos 1');
    }
  });
});

describe('estados y columnas', () => {
  it('reconoce los estados de la API', () => {
    for (const estado of ESTADOS_ORDEN) expect(isEstadoOrden(estado)).toBe(true);
    expect(isEstadoOrden('OTRO')).toBe(false);
  });

  it('mapea cada estado a su columna del KDS', () => {
    expect(estadoKdsDeApi('POR_CONFIRMAR')).toBe('pendiente');
    expect(estadoKdsDeApi('EN_COCINA')).toBe('cocina');
    expect(estadoKdsDeApi('LISTO')).toBe('listo');
    expect(estadoKdsDeApi('ENTREGADO')).toBe('entregado');
    expect(estadoKdsDeApi('PAGADA')).toBe('entregado');
    expect(estadoKdsDeApi('CERRADA')).toBe('entregado');
    expect(estadoKdsDeApi('ANULADA')).toBe('anulado');
  });

  it('etiqueta la columna con su nombre visible', () => {
    expect(etiquetaEstadoKds('pendiente')).toBe('Por confirmar');
    expect(etiquetaEstadoKds('cocina')).toBe('En cocina');
    expect(etiquetaEstadoKds('listo')).toBe('Listo');
    expect(etiquetaEstadoKds('entregado')).toBe('Entregado');
    expect(etiquetaEstadoKds('anulado')).toBe('Anulada');
    expect(etiquetaEstadoKds('otro' as never)).toBe('Por confirmar');
  });

  it('pinta cuatro columnas operativas', () => {
    expect(COLUMNAS_KDS.map((columna) => columna.status)).toEqual([
      'pendiente',
      'cocina',
      'listo',
      'entregado',
    ]);
  });
});

describe('presentación de la comanda', () => {
  it('traduce el origen al canal visible', () => {
    expect(canalDeOrigen('MESA')).toBe('Mesa');
    expect(canalDeOrigen('BARRA')).toBe('Llevar');
    expect(canalDeOrigen('MOSTRADOR')).toBe('Llevar');
    expect(canalDeOrigen('DELIVERY')).toBe('Web');
    expect(canalDeOrigen('WEB')).toBe('Web');
    expect(canalDeOrigen('OTRO')).toBe('Web');
  });

  it('usa la confirmación como base del SLA y el ingreso si no existe', () => {
    expect(slaBaseDe({ confirmacionAt: '2026-11-20T10:00:00Z', ingresoAt: '2026-11-20T09:59:00Z' }))
      .toBe('2026-11-20T10:00:00Z');
    expect(slaBaseDe({ confirmacionAt: null, ingresoAt: '2026-11-20T09:59:00Z' })).toBe(
      '2026-11-20T09:59:00Z',
    );
    expect(slaBaseDe({ ingresoAt: '2026-11-20T09:59:00Z' })).toBe('2026-11-20T09:59:00Z');
  });

  it('considera abierta toda comanda que no es terminal', () => {
    expect(esOrdenAbierta('POR_CONFIRMAR')).toBe(true);
    expect(esOrdenAbierta('EN_COCINA')).toBe(true);
    expect(esOrdenAbierta('LISTO')).toBe(true);
    expect(esOrdenAbierta('ENTREGADO')).toBe(true);
    expect(esOrdenAbierta('PAGADA')).toBe(false);
    expect(esOrdenAbierta('CERRADA')).toBe(false);
    expect(esOrdenAbierta('ANULADA')).toBe(false);
  });
});
