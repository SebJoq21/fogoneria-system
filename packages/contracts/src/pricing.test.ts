import { describe, expect, it } from 'vitest';
import { formatearPrecio, precioEnListaActiva, validarPrecio } from './pricing';
import type { ListaPrecio } from './pricing';

const listaActiva: ListaPrecio = {
  id: 'lista-1',
  nombre: 'Carta',
  activa: true,
  vigenciaDesde: '2026-01-01',
  vigenciaHasta: '',
  precios: { 'plato-1': 24.9 },
};

const listaInactiva: ListaPrecio = {
  ...listaActiva,
  id: 'lista-2',
  activa: false,
  precios: { 'plato-1': 30 },
};

describe('validarPrecio', () => {
  it('acepta decimales no negativos', () => {
    expect(validarPrecio(0)).toBeNull();
    expect(validarPrecio(24.9)).toBeNull();
  });

  it('rechaza negativos y valores no finitos', () => {
    expect(validarPrecio(-0.01)).toBe('El precio no puede ser negativo');
    expect(validarPrecio(Number.NaN)).toBe('Precio inválido');
    expect(validarPrecio(Number.POSITIVE_INFINITY)).toBe('Precio inválido');
  });
});

describe('presentación de precios', () => {
  it('formatea el precio con dos decimales', () => {
    expect(formatearPrecio(24.9)).toBe('$24.90');
    expect(formatearPrecio(0)).toBe('$0.00');
  });

  it('toma el precio de la lista activa (o de la primera si no hay activa)', () => {
    expect(precioEnListaActiva([listaInactiva, listaActiva], 'plato-1')).toBe(24.9);
    expect(precioEnListaActiva([listaInactiva], 'plato-1')).toBe(30);
    expect(precioEnListaActiva([listaActiva], 'plato-2')).toBe(0);
    expect(precioEnListaActiva([], 'plato-1')).toBe(0);
  });
});
