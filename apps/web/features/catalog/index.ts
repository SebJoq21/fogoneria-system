export { ProductsView } from './ProductsView';
export { CategoriesView } from './CategoriesView';
export { ModifiersView } from './ModifiersView';
export { CartaVirtualView } from './CartaVirtualView';
export { useCatalogo } from './hooks';
export {
  catalogApi,
  catalogClient,
  toCategoria,
  toGrupoModificador,
  toPlato,
  IMAGEN_PLATO_POR_DEFECTO,
} from './api';
export type {
  Categoria,
  Catalogo,
  GrupoModificador,
  Plato,
} from '@fogoneria/contracts/catalog';
