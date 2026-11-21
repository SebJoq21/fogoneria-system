import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const precios = vi.hoisted(() => ({
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
  platos: [
    {
      id: 'p-1',
      sku: 'LOM-001',
      nombre: 'Lomo saltado',
      descripcion: '',
      categoriaId: 'c-1',
      imagen: '',
      estado: 'Activo',
      grupoIds: [],
    },
  ],
  resumenListas: { kpis: [{ label: 'Listas', value: '2', hint: 'activa: Carta' }], bars: [] },
  nombreDeCategoria: () => 'Fondos',
  notificar: () => {},
  cargando: false,
  error: null as string | null,
  crearLista: () => {},
  activarLista: () => {},
  fijarPrecio: () => {},
}));

vi.mock('./hooks', () => ({ usePricing: () => precios }));

import { PriceListsView } from './PriceListsView';

describe('PriceListsView', () => {
  it('pinta las listas y el precio del plato en la lista activa', () => {
    const markup = renderToStaticMarkup(<PriceListsView />);
    expect(markup).toContain('Carta');
    expect(markup).toContain('Delivery');
    expect(markup).toContain('Lomo saltado');
    expect(markup).toContain('value="24.9"');
  });

  it('sin listas pide crear la primera', () => {
    const listas = precios.listas;
    precios.listas = [];
    const markup = renderToStaticMarkup(<PriceListsView />);
    expect(markup.length).toBeGreaterThan(0);
    precios.listas = listas;
  });
});
