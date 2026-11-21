/**
 * Contrato de auditoría (lectura). El alta de eventos es interna: la API
 * registra cada operación sensible en la tabla `auditoria`.
 */

export type EventoAuditoria = {
  id: string;
  empresaId: string | null;
  sucursalId: string | null;
  usuarioId: string | null;
  accion: string;
  entidad: string;
  entidadId: string | null;
  detalle: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
};

export type ListaAuditoria = {
  items: EventoAuditoria[];
};

/** Tope de eventos que devuelve `GET /audit`. */
export const AUDIT_LIMIT_MAX = 200;
export const AUDIT_LIMIT_DEFAULT = 50;
