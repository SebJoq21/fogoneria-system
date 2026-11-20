import { describe, expect, it } from 'vitest';
import {
  estadoPlato,
  formatearPrecio,
  nombreDeCategoria,
  precioEnListaActiva,
  validarCategoria,
  validarGrupoModificador,
  validarPlato,
  validarPrecio,
} from './catalogo';
import type { Categoria, ListaPrecio } from './catalogo';

const categoria: Categoria = { id: 'cat-1', nombre: 'Fondos', posicion: 1 };

const listaActiva: ListaPrecio = {
  id: 'lista-1',
  nombre: 'Carta',
  activa: true,
  vigenciaDesde: '2026-01-01',
  vigenciaHasta: '',
  precios: { 'plato-1': 24.9 },
};

const listaInactiva: ListaPrecio = { ...listaActiva, id: 'lista-2', activa: false, precios: { 'plato-1': 30 } };

describe('validarPlato', () => {
  it('acepta nombre y categoría', () => {
    expect(validarPlato({ nombre: 'Lomo saltado', categoriaId: 'cat-1' })).toBeNull();
  });

  it('rechaza nombre o categoría vacíos', () => {
    expect(validarPlato({})).toBe('Falta el nombre del plato');
    expect(validarPlato({ nombre: '  ' })).toBe('Falta el nombre del plato');
    expect(validarPlato({ nombre: 'Lomo' })).toBe('Elige una categoría');
    expect(validarPlato({ nombre: 'Lomo', categoriaId: '   ' })).toBe('Elige una categoría');
  });
});

describe('validarCategoria y validarGrupoModificador', () => {
  it('exigen nombre no vacío', () => {
    expect(validarCategoria({ nombre: 'Bebidas' })).toBeNull();
    expect(validarCategoria({})).toBe('Falta el nombre de la categoría');
    expect(validarCategoria({ nombre: ' ' })).toBe('Falta el nombre de la categoría');
    expect(validarGrupoModificador({ nombre: 'Término' })).toBeNull();
    expect(validarGrupoModificador({})).toBe('Falta el nombre del grupo');
    expect(validarGrupoModificador({ nombre: '' })).toBe('Falta el nombre del grupo');
  });
});

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

describe('presentación del catálogo', () => {
  it('etiqueta el estado del plato', () => {
    expect(estadoPlato(true)).toBe('Activo');
    expect(estadoPlato(false)).toBe('Inactivo');
  });

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

  it('resuelve el nombre de la categoría con guion si no existe', () => {
    expect(nombreDeCategoria([categoria], 'cat-1')).toBe('Fondos');
    expect(nombreDeCategoria([categoria], 'cat-9')).toBe('—');
    expect(nombreDeCategoria([], 'cat-1')).toBe('—');
  });
});
