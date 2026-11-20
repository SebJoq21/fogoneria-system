import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const catalogo = vi.hoisted(() => ({
  platos: [
    {
      id: 'p-1',
      sku: 'LOM-001',
      nombre: 'Lomo saltado',
      descripcion: 'Con papas',
      categoriaId: 'c-1',
      imagen: '',
      estado: 'Activo',
      grupoIds: [],
    },
  ],
  categorias: [{ id: 'c-1', nombre: 'Fondos', posicion: 1 }],
  grupos: [],
  listaActiva: { id: 'l-1', nombre: 'Carta', activa: true, vigenciaDesde: '', vigenciaHasta: '', precios: { 'p-1': 24.9 } },
  resumenCarta: {
    kpis: [
      { label: 'Platos activos', value: '1', hint: 'de 1 en maestro' },
      { label: 'Categorías', value: '1', hint: 'en carta' },
      { label: 'Precio prom.', value: '$24.90', hint: 'lista activa' },
      { label: 'Inactivos', value: '0', hint: 'ocultos' },
    ],
    bars: [{ name: 'Fondos', v: 1 }],
  },
  notificar: () => {},
  cargando: false,
  error: null as string | null,
  precioDe: () => 24.9,
  nombreDeCategoria: () => 'Fondos',
  guardarPlato: () => {},
  activarPlato: () => {},
}));

vi.mock('./hooks', () => ({ useCatalogo: () => catalogo }));

import { ProductsView } from './ProductsView';

describe('ProductsView', () => {
  it('pinta el maestro de platos con su resumen', () => {
    const markup = renderToStaticMarkup(<ProductsView />);
    expect(markup).toContain('Lomo saltado');
    expect(markup).toContain('Maestro por categoría');
    expect(markup).toContain('Fondos');
  });

  it('con startCreating abre el formulario de alta', () => {
    const markup = renderToStaticMarkup(<ProductsView startCreating />);
    expect(markup).toContain('Nuevo plato');
  });

  it('un error de carga se muestra en pantalla', () => {
    catalogo.error = 'No se pudo cargar el catálogo';
    const markup = renderToStaticMarkup(<ProductsView />);
    expect(markup).toContain('No se pudo cargar el catálogo');
    catalogo.error = null;
  });
});
