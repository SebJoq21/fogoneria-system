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
} from '@fogoneria/contracts/catalogo';
import {
  IMAGEN_PLATO_POR_DEFECTO,
  toCategoria,
  toGrupoModificador,
  toListaPrecio,
  toPlato,
  toPrecioPlato,
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

  it('valida el precio del servidor', () => {
    expect(validarPrecio(0)).toBeNull();
    expect(validarPrecio(24.9)).toBeNull();
    expect(validarPrecio(-1)).toMatch(/negativo/i);
    expect(validarPrecio(Number.NaN)).toMatch(/inválido/i);
  });

  it('etiqueta estado y formatea importes', () => {
    expect(estadoPlato(true)).toBe('Activo');
    expect(estadoPlato(false)).toBe('Inactivo');
    expect(formatearPrecio(24.9)).toBe('$24.90');
    expect(formatearPrecio(0)).toBe('$0.00');
  });

  it('resuelve precio y nombre con la lista activa', () => {
    const listas = [
      {
        id: 'l1',
        nombre: 'Carta',
        activa: false,
        vigenciaDesde: '',
        vigenciaHasta: '',
        precios: { p1: 10 },
      },
      {
        id: 'l2',
        nombre: 'Delivery',
        activa: true,
        vigenciaDesde: '',
        vigenciaHasta: '',
        precios: { p1: 12 },
      },
    ];
    expect(precioEnListaActiva(listas, 'p1')).toBe(12);
    expect(precioEnListaActiva(listas, 'p2')).toBe(0);
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

  it('normaliza la lista de precios con vigencia corta', () => {
    const lista = toListaPrecio(
      {
        id: 'l1',
        nombre: 'Carta',
        activa: true,
        vigencia_desde: '2026-01-01T00:00:00.000Z',
        vigencia_hasta: null,
      },
      { p1: 24.9 },
    );

    expect(lista).toEqual({
      id: 'l1',
      nombre: 'Carta',
      activa: true,
      vigenciaDesde: '2026-01-01',
      vigenciaHasta: '',
      precios: { p1: 24.9 },
    });
  });

  it('normaliza una fila de precio', () => {
    expect(toPrecioPlato({ lista_id: 'l1', plato_id: 'p1', precio: '24.90' })).toEqual({
      listaId: 'l1',
      platoId: 'p1',
      precio: 24.9,
    });
  });
});
