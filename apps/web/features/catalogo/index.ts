export { ProductsView } from './ProductsView';
export { CategoriesView } from './CategoriesView';
export { ModifiersView } from './ModifiersView';
export { PriceListsView } from './PriceListsView';
export { useCatalogo } from './hooks';
export {
  catalogoApi,
  toCategoria,
  toGrupoModificador,
  toListaPrecio,
  toPlato,
  toPrecioPlato,
} from './api';
export type {
  Categoria,
  Catalogo,
  GrupoModificador,
  ListaPrecio,
  Plato,
  PrecioPlato,
} from '@fogoneria/contracts/catalogo';
