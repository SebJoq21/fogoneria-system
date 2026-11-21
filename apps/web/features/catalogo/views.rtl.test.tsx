// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const catalogo = vi.hoisted(() => ({
  platos: [
    { id: 'p-1', sku: 'LOM', nombre: 'Lomo', descripcion: '', categoriaId: 'c-1', imagen: '', estado: 'Activo', grupoIds: ['g-1'] },
  ],
  categorias: [{ id: 'c-1', nombre: 'Fondos', posicion: 1 }],
  grupos: [{ id: 'g-1', nombre: 'TÃ©rmino', obligatorio: true, multiple: false, opciones: [{ id: 'o-1', nombre: 'Medio', extra: 0 }] }],
  listas: [
    { id: 'l-1', nombre: 'Carta', activa: true, vigenciaDesde: '', vigenciaHasta: '', precios: { 'p-1': 24.9 } },
    { id: 'l-2', nombre: 'Delivery', activa: false, vigenciaDesde: '', vigenciaHasta: '', precios: {} },
  ],
  listaActiva: null as unknown,
  resumenCarta: { kpis: [{ label: 'Platos activos', value: '1', hint: '' }], bars: [] },
  resumenListas: { kpis: [{ label: 'Listas', value: '2', hint: '' }], bars: [] },
  notificar: vi.fn(),
  cargando: false,
  error: null as string | null,
  precioDe: vi.fn(() => 24.9),
  nombreDeCategoria: vi.fn(() => 'Fondos'),
  guardarPlato: vi.fn(),
  activarPlato: vi.fn(),
  guardarCategoria: vi.fn(),
  borrarCategoria: vi.fn(),
  crearGrupo: vi.fn(),
  actualizarGrupo: vi.fn(),
  borrarGrupo: vi.fn(),
  crearLista: vi.fn(),
  activarLista: vi.fn(),
  fijarPrecio: vi.fn(),
}));

vi.mock('./hooks', () => ({ useCatalogo: () => catalogo }));

import { CategoriesView } from './CategoriesView';
import { ModifiersView } from './ModifiersView';
import { PriceListsView } from './PriceListsView';
import { ProductsView } from './ProductsView';

beforeEach(() => {
  for (const fn of [
    catalogo.guardarPlato,
    catalogo.activarPlato,
    catalogo.guardarCategoria,
    catalogo.borrarCategoria,
    catalogo.crearGrupo,
    catalogo.actualizarGrupo,
    catalogo.borrarGrupo,
    catalogo.crearLista,
    catalogo.activarLista,
    catalogo.fijarPrecio,
    catalogo.notificar,
  ]) {
    fn.mockReset();
  }
  catalogo.guardarPlato.mockResolvedValue(undefined);
  catalogo.guardarCategoria.mockResolvedValue(undefined);
  catalogo.borrarCategoria.mockResolvedValue(undefined);
  catalogo.crearGrupo.mockResolvedValue(undefined);
  catalogo.crearLista.mockResolvedValue(undefined);
  catalogo.fijarPrecio.mockResolvedValue(undefined);
  catalogo.platos = [
    { id: 'p-1', sku: 'LOM', nombre: 'Lomo', descripcion: '', categoriaId: 'c-1', imagen: '', estado: 'Activo', grupoIds: ['g-1'] },
  ];
});

afterEach(cleanup);

describe('CategoriesView', () => {
  it('crea y renombra categorÃ­as', () => {
    render(<CategoriesView />);
    fireEvent.click(screen.getByText(/Nueva categor/));
    fireEvent.change(screen.getByPlaceholderText('Ej. Postres'), { target: { value: 'Postres' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(catalogo.guardarCategoria).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Postres' }),
    );

  });

  it('elimina una categorÃ­a vacÃ­a tras confirmar', () => {
    catalogo.platos = [];
    render(<CategoriesView />);
    fireEvent.click(screen.getByText('Eliminar'));
    fireEvent.click(screen.getAllByText('Eliminar').at(-1)!);
    expect(catalogo.borrarCategoria).toHaveBeenCalledWith('c-1');
  });
});

describe('ModifiersView', () => {
  it('crea un grupo y aÃ±ade una opciÃ³n', () => {
    render(<ModifiersView />);
    fireEvent.click(screen.getByText('+ Nuevo grupo'));
    fireEvent.change(screen.getByPlaceholderText(/Salsas/), {
      target: { value: 'Salsas' },
    });
    fireEvent.click(screen.getByText('Crear grupo'));
    expect(catalogo.crearGrupo).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Salsas' }),
    );

    fireEvent.change(screen.getByPlaceholderText(/Nueva opci/), { target: { value: 'BBQ' } });
    fireEvent.change(screen.getByPlaceholderText('+$'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByText(/adir/));
    expect(catalogo.actualizarGrupo).toHaveBeenCalled();
  });
});

describe('PriceListsView', () => {
  it('crea una lista copiando la seleccionada', () => {
    render(<PriceListsView />);
    fireEvent.click(screen.getByText('+ Nueva lista'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Fin de semana'), { target: { value: 'Feriados' } });
    fireEvent.click(screen.getByText('Crear lista'));
    expect(catalogo.crearLista).toHaveBeenCalledWith('Feriados', 'l-1');
  });

  it('cambia de lista y guarda un precio', () => {
    render(<PriceListsView />);
    fireEvent.click(screen.getByText('Delivery'));
    const precio = screen.getByLabelText('Precio de Lomo en Delivery');
    fireEvent.change(precio, { target: { value: '30' } });
    fireEvent.blur(precio);
    expect(catalogo.fijarPrecio).toHaveBeenCalledWith(
      expect.objectContaining({ listaId: 'l-2', platoId: 'p-1', precio: 30 }),
    );
  });
});

describe('ProductsView', () => {
  it('crea un plato desde el modal', () => {
    render(<ProductsView />);
    fireEvent.click(screen.getByText('+ Nuevo plato'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Lomo Saltado'), { target: { value: 'Ceviche' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '32' } });
    fireEvent.click(screen.getByText('Guardar plato'));
    expect(catalogo.guardarPlato).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Ceviche', precio: 32 }),
    );
  });

  it('edita y desactiva un plato', () => {
    render(<ProductsView />);
    fireEvent.click(screen.getByText('Editar'));
    fireEvent.change(screen.getByDisplayValue('Lomo'), { target: { value: 'Lomo fino' } });
    fireEvent.click(screen.getByText('Guardar plato'));
    expect(catalogo.guardarPlato).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p-1', nombre: 'Lomo fino' }),
    );

    fireEvent.click(screen.getByText('Desactivar'));
    fireEvent.click(screen.getAllByText('Desactivar').at(-1)!);
    expect(catalogo.activarPlato).toHaveBeenCalledWith('p-1', false);
  });
});


