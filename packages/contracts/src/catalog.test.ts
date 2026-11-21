import { describe, expect, it } from 'vitest';
import {
  estadoPlato,
  nombreDeCategoria,
  validarCategoria,
  validarGrupoModificador,
  validarPlato,
} from './catalog';
import type { Categoria } from './catalog';

const categoria: Categoria = { id: 'cat-1', nombre: 'Fondos', posicion: 1 };

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

describe('presentación del catálogo', () => {
  it('etiqueta el estado del plato', () => {
    expect(estadoPlato(true)).toBe('Activo');
    expect(estadoPlato(false)).toBe('Inactivo');
  });

  it('resuelve el nombre de la categoría con guion si no existe', () => {
    expect(nombreDeCategoria([categoria], 'cat-1')).toBe('Fondos');
    expect(nombreDeCategoria([categoria], 'cat-9')).toBe('—');
    expect(nombreDeCategoria([], 'cat-1')).toBe('—');
  });
});
