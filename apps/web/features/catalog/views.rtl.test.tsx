// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const catalogo = vi.hoisted(() => ({
  platos: [
    { id: 'p-1', sku: 'LOM', nombre: 'Lomo', descripcion: '', categoriaId: 'c-1', imagen: '', estado: 'Activo', grupoIds: ['g-1'] },
  ],
  categorias: [{ id: 'c-1', nombre: 'Fondos', posicion: 1 }],
  grupos: [{ id: 'g-1', nombre: 'Término', obligatorio: true, multiple: false, opciones: [{ id: 'o-1', nombre: 'Medio', extra: 0 }] }],
  listaActiva: null as unknown,
  resumenCarta: { kpis: [{ label: 'Platos activos', value: '1', hint: '' }], bars: [] },
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
}));

vi.mock('./hooks', () => ({ useCatalogo: () => catalogo }));

import { CategoriesView } from './CategoriesView';
import { ModifiersView } from './ModifiersView';
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
    catalogo.notificar,
  ]) {
    fn.mockReset();
  }
  catalogo.guardarPlato.mockResolvedValue(undefined);
  catalogo.guardarCategoria.mockResolvedValue(undefined);
  catalogo.borrarCategoria.mockResolvedValue(undefined);
  catalogo.crearGrupo.mockResolvedValue(undefined);
  catalogo.error = null;
  catalogo.cargando = false;
  catalogo.platos = [
    { id: 'p-1', sku: 'LOM', nombre: 'Lomo', descripcion: '', categoriaId: 'c-1', imagen: '', estado: 'Activo', grupoIds: ['g-1'] },
  ];
});

afterEach(cleanup);

describe('CategoriesView', () => {
  it('crea y renombra categorías', () => {
    render(<CategoriesView />);
    fireEvent.click(screen.getByText(/Nueva categor/));
    fireEvent.change(screen.getByPlaceholderText('Ej. Postres'), { target: { value: 'Postres' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(catalogo.guardarCategoria).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Postres' }),
    );
  });

  it('elimina una categoría vacía tras confirmar', () => {
    catalogo.platos = [];
    render(<CategoriesView />);
    fireEvent.click(screen.getByText('Eliminar'));
    fireEvent.click(screen.getAllByText('Eliminar').at(-1)!);
    expect(catalogo.borrarCategoria).toHaveBeenCalledWith('c-1');
  });
});

describe('ModifiersView', () => {
  it('crea un grupo y añade una opción', () => {
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

  it('alterna obligatorio/múltiple y quita opciones o el grupo', () => {
    render(<ModifiersView />);
    fireEvent.click(screen.getByRole('switch', { name: 'Obligatorio' }));
    expect(catalogo.actualizarGrupo).toHaveBeenCalledWith('g-1', { obligatorio: false });
    fireEvent.click(screen.getByRole('switch', { name: 'Selección múltiple' }));
    expect(catalogo.actualizarGrupo).toHaveBeenLastCalledWith('g-1', { multiple: true });

    fireEvent.click(screen.getByLabelText('Quitar Medio'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar' }).at(-1)!);
    expect(catalogo.actualizarGrupo).toHaveBeenLastCalledWith('g-1', { opciones: [] });

    fireEvent.click(screen.getByText('Quitar'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Desactivar' }).at(-1)!);
    expect(catalogo.borrarGrupo).toHaveBeenCalledWith('g-1');
  });

  it('avisa si falla el guardado del grupo', async () => {
    catalogo.actualizarGrupo.mockRejectedValue(new Error('sin permiso'));
    render(<ModifiersView />);
    fireEvent.click(screen.getByRole('switch', { name: 'Obligatorio' }));
    await Promise.resolve();
    expect(catalogo.notificar).toHaveBeenCalledWith('No se pudo actualizar el grupo', 'sin permiso');
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
      expect.objectContaining({ nombre: 'Ceviche' }),
      32,
    );
  });

  it('edita y desactiva un plato', () => {
    render(<ProductsView />);
    fireEvent.click(screen.getByText('Editar'));
    fireEvent.change(screen.getByDisplayValue('Lomo'), { target: { value: 'Lomo fino' } });
    fireEvent.click(screen.getByText('Guardar plato'));
    expect(catalogo.guardarPlato).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p-1', nombre: 'Lomo fino' }),
      24.9,
    );

    fireEvent.click(screen.getByText('Desactivar'));
    fireEvent.click(screen.getAllByText('Desactivar').at(-1)!);
    expect(catalogo.activarPlato).toHaveBeenCalledWith('p-1', false);
  });

  it('muestra error, carga y platos sin modificadores', () => {
    catalogo.error = 'Catálogo caído';
    catalogo.platos = [
      { id: 'p-2', sku: 'CHI', nombre: 'Chicha', descripcion: '', categoriaId: 'c-1', imagen: '', estado: 'Inactivo', grupoIds: [] },
    ];
    render(<ProductsView />);
    expect(screen.getByRole('alert').textContent).toBe('Catálogo caído');
    expect(screen.getByText('—')).toBeTruthy();

    cleanup();
    catalogo.error = null;
    catalogo.platos = [];
    catalogo.cargando = true;
    render(<ProductsView />);
    expect(screen.getByText('Cargando catálogo…')).toBeTruthy();
    catalogo.cargando = false;
  });

  it('activa un plato inactivo y avisa del error al guardar', async () => {
    catalogo.platos = [
      { id: 'p-2', sku: 'CHI', nombre: 'Chicha', descripcion: '', categoriaId: 'c-1', imagen: '', estado: 'Inactivo', grupoIds: [] },
    ];
    catalogo.guardarPlato.mockRejectedValue(new Error('SKU duplicado'));
    render(<ProductsView />);
    fireEvent.click(screen.getByText('Activar'));
    fireEvent.click(screen.getAllByText('Activar').at(-1)!);
    expect(catalogo.activarPlato).toHaveBeenCalledWith('p-2', true);

    fireEvent.click(screen.getByText('Editar'));
    fireEvent.click(screen.getByText('Guardar plato'));
    await Promise.resolve();
    expect(catalogo.notificar).toHaveBeenCalledWith('No se pudo guardar el plato', 'SKU duplicado');
  });
});
