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
  listaActiva: null,
  resumenCarta: { kpis: [{ label: 'Platos activos', value: '1', hint: 'de 1 en maestro' }], bars: [] },
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
}));

vi.mock('./hooks', () => ({ useCatalogo: () => catalogo }));

import { CategoriesView } from './CategoriesView';
import { ModifiersView } from './ModifiersView';

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
