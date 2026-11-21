import { describe, expect, it } from 'vitest';
import {
  estadoPlato,
  nombreDeCategoria,
  validarCategoria,
  validarGrupoModificador,
  validarPlato,
} from '@fogoneria/contracts/catalog';
import {
  IMAGEN_PLATO_POR_DEFECTO,
  toCategoria,
  toGrupoModificador,
  toPlato,
} from './api';

describe('contratos de catálogo', () => {
  it('valida el plato (nombre y categoría)', () => {
    expect(validarPlato({ nombre: 'Lomo Saltado', categoriaId: 'c1' })).toBeNull();
    expect(validarPlato({ nombre: '  ', categoriaId: 'c1' })).toMatch(/nombre/i);
    expect(validarPlato({ nombre: 'Lomo Saltado' })).toMatch(/categor/i);
  });

  it('valida categoría y grupo de modificadores', () => {
    expect(validarCategoria({ nombre: 'Postres' })).toBeNull();
    expect(validarCategoria({ nombre: '' })).toMatch(/categor/i);
    expect(validarGrupoModificador({ nombre: 'Término' })).toBeNull();
    expect(validarGrupoModificador({ nombre: ' ' })).toMatch(/grupo/i);
  });

  it('etiqueta el estado y resuelve el nombre de categoría', () => {
    expect(estadoPlato(true)).toBe('Activo');
    expect(estadoPlato(false)).toBe('Inactivo');
    expect(nombreDeCategoria([{ id: 'c1', nombre: 'Fondos', posicion: 1 }], 'c1')).toBe('Fondos');
    expect(nombreDeCategoria([], 'c9')).toBe('—');
  });
});

describe('mapeo API → contrato', () => {
  it('normaliza la categoría', () => {
    expect(toCategoria({ id: 'c1', nombre: 'Entradas', posicion: 2 })).toEqual({
      id: 'c1',
      nombre: 'Entradas',
      posicion: 2,
    });
  });

  it('normaliza el plato con imagen por defecto y grupos', () => {
    const plato = toPlato({
      id: 'p1',
      categoria_id: 'c1',
      sku: 'PL-001',
      nombre: 'Lomo Saltado',
      descripcion: null,
      foto_url: null,
      activo: true,
      platos_grupos_modificadores: [{ grupo_id: 'g1' }, { grupo_id: 'g2' }],
    });

    expect(plato).toMatchObject({
      id: 'p1',
      categoriaId: 'c1',
      nombre: 'Lomo Saltado',
      descripcion: '',
      imagen: IMAGEN_PLATO_POR_DEFECTO,
      estado: 'Activo',
      grupoIds: ['g1', 'g2'],
    });
  });

  it('convierte precio_extra (Decimal) a número', () => {
    const grupo = toGrupoModificador({
      id: 'g1',
      nombre: 'Extras',
      obligatorio: false,
      permite_multiple: true,
      opciones_modificadores: [{ id: 'o1', nombre: 'Queso', precio_extra: '2.50' }],
    });

    expect(grupo).toMatchObject({ id: 'g1', obligatorio: false, multiple: true });
    expect(grupo.opciones).toEqual([{ id: 'o1', nombre: 'Queso', extra: 2.5 }]);
  });
});
