'use client';

/**
 * Fachada del catálogo sobre `CatalogoProvider` (Fase 4 etapa 3).
 *
 * El ERP completo (carta, mesero, caja, combos) comparte un único estado de
 * catálogo y precios, así que la feature no lo duplica: traduce el contrato del
 * módulo (`@fogoneria/contracts/catalog`) al estado del provider y sus acciones.
 * La lista activa se lee solo para mostrar el precio del plato; editarla es
 * responsabilidad de `features/pricing`.
 */

import { useMemo } from 'react';
import { useCatalogoState } from '@/components/dashboard/providers/catalog';
import { useNotifications } from '@/components/dashboard/providers/notifications';
import { cartaSummary } from '@/components/dashboard/summaries/summary-selectors';
import type {
  Categoria,
  CategoriaInput,
  GrupoModificador,
  GrupoModificadorInput,
  GrupoModificadorUpdate,
  Plato,
  PlatoInput,
} from '@fogoneria/contracts/catalog';

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

  const activeList = priceLists.find((l) => l.active) ?? priceLists[0];
  const listaActiva = activeList ? { id: activeList.id, nombre: activeList.name } : undefined;

  // Los selectores de resumen hablan el tipo del ERP (`Product`), por eso se
  // calculan aquí y no en las vistas: la feature solo ve contratos.
  const resumenCarta = useMemo(
    () => cartaSummary(products, categories, priceOf),
    [products, categories, priceOf],
  );

  return {
    // estado
    categorias,
    platos,
    grupos,
    listaActiva,
    resumenCarta,
    cargando: catalogLoading,
    error: catalogError,
    precioDe: priceOf,
    nombreDeCategoria: categoryNameOf,
    notificar: notify,

    // acciones (delegan en el proveedor para no romper el resto del ERP)
    guardarPlato: (input: PlatoInput, precio: number) =>
      saveProduct({
        id: input.id,
        name: input.nombre,
        description: input.descripcion,
        categoryId: input.categoriaId,
        image: input.imagen,
        status: input.activo ? 'Activo' : 'Inactivo',
        modifierGroupIds: input.grupoIds,
        price: precio,
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
  };
}
