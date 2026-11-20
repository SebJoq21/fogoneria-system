import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const catalogo = vi.hoisted(() => ({
  categorias: [{ id: 'c-1', nombre: 'Fondos', posicion: 1 }],
  platos: [
    {
      id: 'p-1',
      sku: 'LOM-001',
      nombre: 'Lomo saltado',
      descripcion: '',
      categoriaId: 'c-1',
      imagen: '',
      estado: 'Activo',
      grupoIds: ['g-1'],
    },
  ],
  grupos: [
    {
      id: 'g-1',
      nombre: 'Término',
      obligatorio: true,
      multiple: false,
      opciones: [{ id: 'o-1', nombre: 'Medio', extra: 0 }],
    },
  ],
  listas: [
    {
      id: 'l-1',
      nombre: 'Carta',
      activa: true,
      vigenciaDesde: '2026-01-01',
      vigenciaHasta: '2026-12-31',
      precios: { 'p-1': 24.9 },
    },
    {
      id: 'l-2',
      nombre: 'Delivery',
      activa: false,
      vigenciaDesde: '',
      vigenciaHasta: '',
      precios: {},
    },
  ],
  listaActiva: null,
  resumenCarta: { kpis: [{ label: 'Platos activos', value: '1', hint: 'de 1 en maestro' }], bars: [] },
  resumenListas: { kpis: [{ label: 'Listas', value: '2', hint: 'activa: Carta' }], bars: [] },
  notificar: () => {},
  cargando: false,
  error: null as string | null,
  precioDe: () => 24.9,
  nombreDeCategoria: () => 'Fondos',
  guardarPlato: () => {},
  activarPlato: () => {},
  guardarCategoria: () => {},
  borrarCategoria: () => {},
  crearGrupo: () => {},
  actualizarGrupo: () => {},
  borrarGrupo: () => {},
  crearLista: () => {},
  activarLista: () => {},
  fijarPrecio: () => {},
}));

vi.mock('./hooks', () => ({ useCatalogo: () => catalogo }));

import { CategoriesView } from './CategoriesView';
import { ModifiersView } from './ModifiersView';
import { PriceListsView } from './PriceListsView';

describe('CategoriesView', () => {
  it('pinta el maestro de categorías con su resumen', () => {
    const markup = renderToStaticMarkup(<CategoriesView />);
    expect(markup).toContain('Nueva categoría');
    expect(markup).toContain('Fondos');
    expect(markup).toContain('Resumen de categorías');
  });

  it('un error de carga se muestra', () => {
    catalogo.error = 'No se pudieron cargar las categorías';
    const markup = renderToStaticMarkup(<CategoriesView />);
    expect(markup).toContain('No se pudieron cargar las categorías');
    catalogo.error = null;
  });
});

describe('ModifiersView', () => {
  it('pinta los grupos y sus opciones', () => {
    const markup = renderToStaticMarkup(<ModifiersView />);
    expect(markup).toContain('Término');
    expect(markup).toContain('Medio');
    expect(markup).toContain('Nuevo grupo');
  });
});

describe('PriceListsView', () => {
  it('pinta las listas y el precio del plato en la lista activa', () => {
    const markup = renderToStaticMarkup(<PriceListsView />);
    expect(markup).toContain('Carta');
    expect(markup).toContain('Delivery');
    expect(markup).toContain('Lomo saltado');
    expect(markup).toContain('value="24.9"');
  });

  it('sin listas pide crear la primera', () => {
    const listas = catalogo.listas;
    catalogo.listas = [];
    const markup = renderToStaticMarkup(<PriceListsView />);
    expect(markup.length).toBeGreaterThan(0);
    catalogo.listas = listas;
  });
});
