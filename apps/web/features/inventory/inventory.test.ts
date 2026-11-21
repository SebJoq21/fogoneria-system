import { describe, expect, it } from 'vitest';
import {
  etiquetaEstadoStock,
  etiquetaTipoMovimiento,
  movimientoCantidadLabel,
  resumenStock,
  type MovimientoInventario,
} from '@fogoneria/contracts/inventory';
import { kardexRowFromApi, semaforoDeStock } from './api';

const MOVIMIENTO: MovimientoInventario = {
  id: 'm-1',
  fecha: '2026-11-06T18:00:00.000Z',
  tipo: 'SALIDA',
  insumoId: 'i-1',
  insumo: 'Papa amarilla',
  unidad: 'kg',
  cantidad: 2.5,
  stockResultante: 7.5,
  motivo: null,
  orden: 'ORD-000123',
};

describe('semáforo de stock', () => {
  it('cuenta agotados, bajos y óptimos desde los insumos', () => {
    expect(
      resumenStock([
        { estado: 'AGOTADO' },
        { estado: 'BAJO' },
        { estado: 'BAJO' },
        { estado: 'OPTIMO' },
      ]),
    ).toEqual({ total: 4, agotados: 1, bajos: 2, optimos: 1 });
  });

  it('prefiere el resumen del servidor y lo recalcula si falta', () => {
    const items = [{ estado: 'AGOTADO' as const }];
    expect(
      semaforoDeStock({ items, resumen: { total: 1, agotados: 1, bajos: 0, optimos: 0 } }),
    ).toMatchObject({ agotados: 1 });
    expect(semaforoDeStock({ items })).toMatchObject({ agotados: 1, optimos: 0 });
  });

  it('etiqueta los tres estados del semáforo', () => {
    expect(etiquetaEstadoStock('AGOTADO')).toBe('Agotado');
    expect(etiquetaEstadoStock('BAJO')).toBe('Bajo');
    expect(etiquetaEstadoStock('OPTIMO')).toBe('Óptimo');
  });
});

describe('kardex de inventario', () => {
  it('mapea el movimiento de la API a la fila de la tabla', () => {
    const row = kardexRowFromApi(MOVIMIENTO, 0);
    expect(row).toMatchObject({
      id: 1,
      type: 'Salida',
      ingredient: 'Papa amarilla',
      qty: '-2.5 kg',
      reason: 'Comanda ORD-000123',
    });
    expect(row.datetime.length).toBeGreaterThan(0);
  });

  it('muestra la merma como ajuste y respeta el motivo', () => {
    const row = kardexRowFromApi(
      { ...MOVIMIENTO, tipo: 'MERMA', motivo: 'Merma de cocina', orden: null },
      4,
    );
    expect(row).toMatchObject({ id: 5, type: 'Ajuste', reason: 'Merma de cocina' });
  });

  it('cae a "Sin motivo" cuando no hay motivo ni comanda', () => {
    expect(
      kardexRowFromApi({ ...MOVIMIENTO, motivo: null, orden: null }, 0).reason,
    ).toBe('Sin motivo');
  });

  it('etiqueta los cuatro tipos y desconoce lo raro como ajuste', () => {
    expect(etiquetaTipoMovimiento('ENTRADA')).toBe('Entrada');
    expect(etiquetaTipoMovimiento('SALIDA')).toBe('Salida');
    expect(etiquetaTipoMovimiento('AJUSTE')).toBe('Ajuste');
    expect(etiquetaTipoMovimiento('MERMA')).toBe('Merma');
    expect(etiquetaTipoMovimiento('VOLADOR')).toBe('Ajuste');
  });

  it('pone signo a la cantidad según el tipo y no deja espacio de más', () => {
    expect(movimientoCantidadLabel(MOVIMIENTO)).toBe('-2.5 kg');
    expect(movimientoCantidadLabel({ ...MOVIMIENTO, tipo: 'ENTRADA', cantidad: 4 })).toBe('+4 kg');
    expect(movimientoCantidadLabel({ ...MOVIMIENTO, tipo: 'AJUSTE', cantidad: 0.5 })).toBe('0.5 kg');
    expect(movimientoCantidadLabel({ ...MOVIMIENTO, tipo: 'MERMA', unidad: '' })).toBe('-2.5');
  });
});
