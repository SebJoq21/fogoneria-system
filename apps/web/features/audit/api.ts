/**
 * Cliente de lectura de auditoría. La API expone `GET /audit` solo para
 * `ADMIN_GLOBAL`; el BFF adjunta el Bearer desde la cookie HttpOnly.
 */
import { createClient } from '@fogoneria/sdk';
import type { EventoAuditoria, ListaAuditoria } from '@fogoneria/contracts/audit';

export type { EventoAuditoria } from '@fogoneria/contracts/audit';

export const auditClient = createClient({ baseUrl: '/api/backend' });

type ApiEvento = {
  id: string;
  empresa_id: string | null;
  sucursal_id: string | null;
  usuario_id: string | null;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  detalle: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
};

export function toEvento(raw: ApiEvento): EventoAuditoria {
  return {
    id: raw.id,
    empresaId: raw.empresa_id,
    sucursalId: raw.sucursal_id,
    usuarioId: raw.usuario_id,
    accion: raw.accion,
    entidad: raw.entidad,
    entidadId: raw.entidad_id,
    detalle: raw.detalle ?? {},
    ip: raw.ip,
    createdAt: raw.created_at,
  };
}

export const auditApi = {
  async list({ limit = 50, signal }: { limit?: number; signal?: AbortSignal } = {}): Promise<ListaAuditoria> {
    const raw = await auditClient.get<{ items: ApiEvento[] }>(`/audit?limit=${limit}`, { signal });
    return { items: (raw.items ?? []).map(toEvento) };
  },
};
