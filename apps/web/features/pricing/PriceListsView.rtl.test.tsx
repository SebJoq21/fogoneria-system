// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const precios = vi.hoisted(() => ({
  listas: [
    { id: 'l-1', nombre: 'Carta', activa: true, vigenciaDesde: '', vigenciaHasta: '', precios: { 'p-1': 24.9 } },
    { id: 'l-2', nombre: 'Delivery', activa: false, vigenciaDesde: '', vigenciaHasta: '', precios: {} },
  ],
  platos: [
    { id: 'p-1', sku: 'LOM', nombre: 'Lomo', descripcion: '', categoriaId: 'c-1', imagen: '', estado: 'Activo', grupoIds: [] },
  ],
  resumenListas: { kpis: [{ label: 'Listas', value: '2', hint: '' }], bars: [] },
  notificar: vi.fn(),
  cargando: false,
  error: null as string | null,
  nombreDeCategoria: vi.fn(() => 'Fondos'),
  crearLista: vi.fn(),
  activarLista: vi.fn(),
  fijarPrecio: vi.fn(),
}));

vi.mock('./hooks', () => ({ usePricing: () => precios }));

import { PriceListsView } from './PriceListsView';

beforeEach(() => {
  for (const fn of [precios.crearLista, precios.activarLista, precios.fijarPrecio, precios.notificar]) {
    fn.mockReset();
  }
  precios.crearLista.mockResolvedValue(undefined);
  precios.activarLista.mockResolvedValue(undefined);
  precios.fijarPrecio.mockResolvedValue(undefined);
  precios.error = null;
  precios.cargando = false;
});

afterEach(cleanup);

describe('PriceListsView', () => {
  it('activa una lista desde la carta y avisa si falla', async () => {
    render(<PriceListsView />);
    fireEvent.click(screen.getByText('Delivery'));
    fireEvent.click(screen.getByText('Activar en carta'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Activar' }).at(-1)!);
    expect(precios.activarLista).toHaveBeenCalledWith('l-2');

    precios.activarLista.mockRejectedValue(new Error('otra activa'));
    fireEvent.click(screen.getByText('Carta'));
    fireEvent.click(screen.getByText('Delivery'));
    fireEvent.click(screen.getByText('Activar en carta'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Activar' }).at(-1)!);
    await Promise.resolve();
    expect(precios.notificar).toHaveBeenCalledWith('No se pudo activar la lista', 'otra activa');
  });

  it('crea una lista copiando la seleccionada', () => {
    render(<PriceListsView />);
    fireEvent.click(screen.getByText('+ Nueva lista'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Fin de semana'), { target: { value: 'Feriados' } });
    fireEvent.click(screen.getByText('Crear lista'));
    expect(precios.crearLista).toHaveBeenCalledWith('Feriados', 'l-1');
  });

  it('cambia de lista y guarda un precio', () => {
    render(<PriceListsView />);
    fireEvent.click(screen.getByText('Delivery'));
    const precio = screen.getByLabelText('Precio de Lomo en Delivery');
    fireEvent.change(precio, { target: { value: '30' } });
    fireEvent.blur(precio);
    expect(precios.fijarPrecio).toHaveBeenCalledWith(
      expect.objectContaining({ listaId: 'l-2', platoId: 'p-1', precio: 30 }),
    );
  });
});
