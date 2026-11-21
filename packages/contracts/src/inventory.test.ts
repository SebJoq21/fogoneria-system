import { describe, expect, it } from 'vitest';
import {
  esEstadoStock,
  esTipoMovimientoInventario,
  etiquetaEstadoStock,
  etiquetaTipoMovimiento,
  movimientoCantidadLabel,
  resumenStock,
} from './inventory';

describe('guardas de inventario', () => {
  it('reconoce estados de stock y tipos de movimiento', () => {
    expect(esEstadoStock('AGOTADO')).toBe(true);
    expect(esEstadoStock('BAJO')).toBe(true);
    expect(esEstadoStock('OPTIMO')).toBe(true);
    expect(esEstadoStock('agotado')).toBe(false);
    for (const tipo of ['ENTRADA', 'SALIDA', 'AJUSTE', 'MERMA']) {
      expect(esTipoMovimientoInventario(tipo)).toBe(true);
    }
    expect(esTipoMovimientoInventario('TRASPASO')).toBe(false);
  });
});

describe('etiquetas de inventario', () => {
  it('traduce el semáforo', () => {
    expect(etiquetaEstadoStock('AGOTADO')).toBe('Agotado');
    expect(etiquetaEstadoStock('BAJO')).toBe('Bajo');
    expect(etiquetaEstadoStock('OPTIMO')).toBe('Óptimo');
  });

  it('traduce el kardex', () => {
    expect(etiquetaTipoMovimiento('ENTRADA')).toBe('Entrada');
    expect(etiquetaTipoMovimiento('SALIDA')).toBe('Salida');
    expect(etiquetaTipoMovimiento('AJUSTE')).toBe('Ajuste');
    expect(etiquetaTipoMovimiento('MERMA')).toBe('Merma');
    expect(etiquetaTipoMovimiento('OTRO')).toBe('Ajuste');
  });

  it('muestra signo y unidad según el tipo', () => {
    expect(movimientoCantidadLabel({ tipo: 'ENTRADA', cantidad: 4, unidad: 'kg' })).toBe('+4 kg');
    expect(movimientoCantidadLabel({ tipo: 'SALIDA', cantidad: 2.5, unidad: 'kg' })).toBe('-2.5 kg');
    expect(movimientoCantidadLabel({ tipo: 'MERMA', cantidad: 1, unidad: 'unidad' })).toBe(
      '-1 unidad',
    );
    expect(movimientoCantidadLabel({ tipo: 'AJUSTE', cantidad: 0.5, unidad: 'kg' })).toBe('0.5 kg');
  });
});

describe('resumenStock', () => {
  it('cuenta el semáforo desde los insumos', () => {
    const items = [
      { estado: 'AGOTADO' },
      { estado: 'AGOTADO' },
      { estado: 'BAJO' },
      { estado: 'OPTIMO' },
      { estado: 'OPTIMO' },
      { estado: 'OPTIMO' },
    ] as const;
    expect(resumenStock(items)).toEqual({ total: 6, agotados: 2, bajos: 1, optimos: 3 });
    expect(resumenStock([])).toEqual({ total: 0, agotados: 0, bajos: 0, optimos: 0 });
  });
});
