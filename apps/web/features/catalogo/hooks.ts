'use client';

/**
 * Fachada del catálogo sobre `CatalogoProvider` (Fase 4 etapa 3).
 *
 * El ERP completo (carta, mesero, caja, combos) comparte un único estado de
 * catálogo, así que la feature no lo duplica: traduce el contrato del módulo
 * (`@fogoneria/contracts/catalogo`) al estado del provider y sus acciones.
 * `ModulesProvider` lo reexpone por compatibilidad para las vistas que todavía
 * usan `useModules()`.
 */

import { useMemo } from 'react';
import { useCatalogoState } from '@/components/dashboard/providers/catalog';
import { useNotifications } from '@/components/dashboard/providers/notifications';
import {
  cartaSummary,
  priceListsSummary,
} from '@/components/dashboard/summaries/summary-selectors';
import type {
  Categoria,
  CategoriaInput,
  GrupoModificador,
  GrupoModificadorInput,
  GrupoModificadorUpdate,
  ListaPrecio,
  Plato,
  PlatoInput,
  PrecioInput,
} from '@fogoneria/contracts/catalogo';

export function useCatalogo() {
  const {
    products,
    categories,
    modifierGroups,
    priceLists,
    catalogLoading,
    catalogError,
    priceOf,
    categoryNameOf,
    saveProduct,
    setProductActive,
    saveCategory,
    deleteCategory,
    createModifierGroup,
    updateModifierGroup,
    deleteModifierGroup,
    createPriceList,
    activatePriceList,
    setPrice,
  } = useCatalogoState();
  const { notify } = useNotifications();

  const categorias: Categoria[] = useMemo(
    () => categories.map((c) => ({ id: c.id, nombre: c.name, posicion: c.position })),
    [categories],
  );

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

  const grupos: GrupoModificador[] = useMemo(
    () =>
      modifierGroups.map((g) => ({
        id: g.id,
        nombre: g.name,
        obligatorio: g.required,
        multiple: g.multi,
        opciones: g.options.map((o) => ({ id: o.id, nombre: o.name, extra: o.extra })),
      })),
    [modifierGroups],
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

  const listaActiva = listas.find((l) => l.activa) ?? listas[0];

  // Los selectores de resumen hablan el tipo del ERP (`Product`/`PriceList`),
  // por eso se calculan aquí y no en las vistas: la feature solo ve contratos.
  const resumenCarta = useMemo(
    () => cartaSummary(products, categories, priceOf),
    [products, categories, priceOf],
  );

  const resumenListas = useMemo(
    () => priceListsSummary(priceLists, products),
    [priceLists, products],
  );

  return {
    // estado
    categorias,
    platos,
    grupos,
    listas,
    listaActiva,
    resumenCarta,
    resumenListas,
    cargando: catalogLoading,
    error: catalogError,
    precioDe: priceOf,
    nombreDeCategoria: categoryNameOf,
    notificar: notify,

    // acciones (delegan en el proveedor para no romper el resto del ERP)
    guardarPlato: (input: PlatoInput) =>
      saveProduct({
        id: input.id,
        name: input.nombre,
        description: input.descripcion,
        categoryId: input.categoriaId,
        image: input.imagen,
        status: input.activo ? 'Activo' : 'Inactivo',
        modifierGroupIds: input.grupoIds,
        price: input.precio,
      }),

    activarPlato: (id: string, activo: boolean) => setProductActive(id, activo),

    guardarCategoria: (input: CategoriaInput) =>
      saveCategory({ id: input.id, name: input.nombre, position: input.posicion }),

    borrarCategoria: (id: string) => deleteCategory(id),

    crearGrupo: (input: GrupoModificadorInput) =>
      createModifierGroup({
        name: input.nombre,
        required: input.obligatorio,
        multi: input.multiple,
      }),

    actualizarGrupo: (id: string, input: GrupoModificadorUpdate) =>
      updateModifierGroup(id, {
        ...(input.nombre !== undefined ? { name: input.nombre } : {}),
        ...(input.obligatorio !== undefined ? { required: input.obligatorio } : {}),
        ...(input.multiple !== undefined ? { multi: input.multiple } : {}),
        // El id viaja: la API sincroniza por id y borra lo que no llegue.
        ...(input.opciones
          ? { options: input.opciones.map((o) => ({ id: o.id, name: o.nombre, extra: o.extra })) }
          : {}),
      }),

    borrarGrupo: (id: string) => deleteModifierGroup(id),

    crearLista: (nombre: string, desdeListaId?: string) => createPriceList(nombre, desdeListaId),

    activarLista: (id: string) => activatePriceList(id),

    fijarPrecio: (input: PrecioInput) => setPrice(input.listaId, input.platoId, input.precio),
  };
}
