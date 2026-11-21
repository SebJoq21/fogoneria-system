'use client';

/**
 * Fachada de precios sobre `CatalogoProvider`.
 *
 * El ERP comparte una sola foto de catálogo y precios; esta feature no duplica
 * el estado: expone las listas, el precio por plato y las acciones que ya viven
 * en el provider (`lib/catalog-api.ts`).
 */

import { useMemo } from 'react';
import { useCatalogoState } from '@/components/dashboard/providers/catalog';
import { useNotifications } from '@/components/dashboard/providers/notifications';
import { priceListsSummary } from '@/components/dashboard/summaries/summary-selectors';
import type { Plato } from '@fogoneria/contracts/catalog';
import type { ListaPrecio, PrecioInput } from '@fogoneria/contracts/pricing';

export function usePricing() {
  const {
    products,
    priceLists,
    catalogLoading,
    catalogError,
    categoryNameOf,
    createPriceList,
    activatePriceList,
    setPrice,
  } = useCatalogoState();
  const { notify } = useNotifications();

  const platos: Plato[] = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        sku: p.sku,
        nombre: p.name,
        descripcion: p.description,
        categoriaId: p.categoryId,
        imagen: p.image,
        estado: p.status,
        grupoIds: p.modifierGroupIds,
      })),
    [products],
  );

  const listas: ListaPrecio[] = useMemo(
    () =>
      priceLists.map((l) => ({
        id: l.id,
        nombre: l.name,
        activa: l.active,
        vigenciaDesde: l.validFrom,
        vigenciaHasta: l.validTo,
        precios: l.prices,
      })),
    [priceLists],
  );

  const resumenListas = useMemo(
    () => priceListsSummary(priceLists, products),
    [priceLists, products],
  );

  return {
    listas,
    platos,
    resumenListas,
    nombreDeCategoria: categoryNameOf,
    notificar: notify,
    cargando: catalogLoading,
    error: catalogError,

    crearLista: (nombre: string, desdeListaId?: string) => createPriceList(nombre, desdeListaId),
    activarLista: (id: string) => activatePriceList(id),
    fijarPrecio: (input: PrecioInput) => setPrice(input.listaId, input.platoId, input.precio),
  };
}
