/**
 * Cliente del módulo Precios (listas y precio por plato).
 *
 * Habla con el BFF (`/api/backend`) a través del SDK compartido. La escritura
 * vive en `CatalogoProvider` (`lib/catalog-api.ts`) porque el ERP comparte una
 * sola foto de catálogo y precios; este cliente solo lee.
 *
 * La API responde snake_case; aquí se traduce al contrato
 * (`@fogoneria/contracts/pricing`).
 */

import { createClient } from '@fogoneria/sdk';
import type { ListaPrecio, PrecioPlato } from '@fogoneria/contracts/pricing';

export const pricingClient = createClient({ baseUrl: '/api/backend' });

/** Los decimales de Prisma llegan como string. */
const numero = (valor: string | number | null | undefined): number => Number(valor ?? 0) || 0;

type ApiListaPrecio = {
  id: string;
  nombre: string;
  activa: boolean;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
};

type ApiPrecio = {
  lista_id: string;
  plato_id: string;
  precio: string | number;
};

export function toListaPrecio(raw: ApiListaPrecio, precios: Record<string, number>): ListaPrecio {
  return {
    id: raw.id,
    nombre: raw.nombre,
    activa: raw.activa,
    vigenciaDesde: raw.vigencia_desde?.slice(0, 10) ?? '',
    vigenciaHasta: raw.vigencia_hasta?.slice(0, 10) ?? '',
    precios,
  };
}

export function toPrecioPlato(raw: ApiPrecio): PrecioPlato {
  return { listaId: raw.lista_id, platoId: raw.plato_id, precio: numero(raw.precio) };
}

export const pricingApi = {
  async listPrecios(
    listaId: string,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<PrecioPlato[]> {
    const raw = await pricingClient.get<ApiPrecio[]>(
      `/pricing/price-lists/${listaId}/prices`,
      { signal },
    );
    return raw.map(toPrecioPlato);
  },
};
