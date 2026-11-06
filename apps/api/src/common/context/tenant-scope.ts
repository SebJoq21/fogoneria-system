import type { TenantContext } from './tenant-context.service.js';

export interface TenantModelScope {
  empresa: boolean;
  sucursal: boolean;
}

/**
 * Modelos con columnas directas de tenant.
 * Los modelos hijos (detalles_orden, opciones_modificadores, precios_platos, etc.)
 * heredan el aislamiento a través de su padre.
 */
export const TENANT_SCOPED_MODELS: Record<string, TenantModelScope> = {
  asistencias: { empresa: true, sucursal: true },
  auditoria: { empresa: true, sucursal: true },
  canjes_cupones: { empresa: true, sucursal: true },
  categorias: { empresa: true, sucursal: false },
  clientes: { empresa: true, sucursal: false },
  combos: { empresa: true, sucursal: false },
  comprobantes: { empresa: true, sucursal: true },
  config_lealtad: { empresa: true, sucursal: false },
  cupones: { empresa: true, sucursal: false },
  empleados: { empresa: true, sucursal: true },
  gastos: { empresa: true, sucursal: true },
  grupos_modificadores: { empresa: true, sucursal: false },
  insumos: { empresa: true, sucursal: false },
  listas_precios: { empresa: true, sucursal: false },
  mesas: { empresa: true, sucursal: true },
  movimientos_caja: { empresa: true, sucursal: false },
  movimientos_inventario: { empresa: true, sucursal: true },
  movimientos_puntos: { empresa: true, sucursal: true },
  ordenes: { empresa: true, sucursal: true },
  platos: { empresa: true, sucursal: false },
  pozos_propinas: { empresa: true, sucursal: true },
  proveedores: { empresa: true, sucursal: false },
  reglas_horarias_promos: { empresa: true, sucursal: false },
  reservas: { empresa: true, sucursal: true },
  roles_empresa: { empresa: true, sucursal: false },
  stocks_sucursal: { empresa: true, sucursal: true },
  sucursales: { empresa: true, sucursal: false },
  suscripciones_eventos: { empresa: true, sucursal: false },
  turnos_caja: { empresa: true, sucursal: true },
  turnos_plan: { empresa: true, sucursal: true },
  usuarios: { empresa: true, sucursal: true },
};

export const TENANT_SCOPE_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

export function tenantWhere(
  scope: TenantModelScope | undefined,
  context: TenantContext,
): Record<string, string> | null {
  if (!scope) return null;
  const where: Record<string, string> = {};
  if (scope.empresa && context.empresaId) where.empresa_id = context.empresaId;
  if (scope.sucursal && context.sucursalId) where.sucursal_id = context.sucursalId;
  return Object.keys(where).length > 0 ? where : null;
}

/** Combina el where del caller con el filtro de tenant (AND, nunca OR). */
export function mergeTenantWhere(
  scope: TenantModelScope | undefined,
  context: TenantContext,
  where?: Record<string, unknown>,
): Record<string, unknown> {
  const tenant = tenantWhere(scope, context);
  if (!tenant) return where ?? {};
  if (!where || Object.keys(where).length === 0) return tenant;
  return { AND: [where, tenant] };
}

/** Inyecta empresa_id/sucursal_id en un create cuando no vienen del cliente. */
export function injectTenantData(
  scope: TenantModelScope | undefined,
  context: TenantContext,
  data?: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...data };
  if (!scope) return next;
  if (scope.empresa && context.empresaId && next.empresa_id == null) {
    next.empresa_id = context.empresaId;
  }
  if (scope.sucursal && context.sucursalId && next.sucursal_id == null) {
    next.sucursal_id = context.sucursalId;
  }
  return next;
}
