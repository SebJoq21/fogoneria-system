import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const sesion = vi.hoisted(() => ({
  currentUser: null as null | { empresaId: string | null },
}));

vi.mock('./session', () => ({ useSession: () => sesion }));

import { CatalogoProvider, useCatalogoState } from './catalog';

function Sonda() {
  const {
    products,
    categories,
    priceLists,
    catalogLoading,
    catalogError,
    catalogVersion,
    priceOf,
    categoryNameOf,
    refreshCatalog,
    saveProduct,
  } = useCatalogoState();
  return (
    <span>
      {products.length}|{categories.length}|{priceLists.length}|{String(catalogLoading)}|
      {String(catalogError)}|{catalogVersion}|{priceOf('p-1')}|{categoryNameOf('c-1')}|
      {typeof refreshCatalog}|{typeof saveProduct}
    </span>
  );
}

describe('CatalogoProvider', () => {
  it('arranca vacío y cargando, sin sesión', () => {
    sesion.currentUser = null;
    const markup = renderToStaticMarkup(
      <CatalogoProvider>
        <Sonda />
      </CatalogoProvider>,
    );
    expect(markup).toContain('0|0|0|false|null|0|0|—|function|function');
  });

  it('con sesión sigue vacío hasta que el efecto cargue el snapshot', () => {
    sesion.currentUser = { empresaId: 'e-1' };
    const markup = renderToStaticMarkup(
      <CatalogoProvider>
        <Sonda />
      </CatalogoProvider>,
    );
    expect(markup).toContain('0|0|0|false|');
  });
});
