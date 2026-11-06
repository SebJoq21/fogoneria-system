import type { PrismaClient } from '../generated/prisma/client.js';
import type {
  TenantContext,
  TenantContextService,
} from '../common/context/tenant-context.service.js';
import {
  TENANT_SCOPED_MODELS,
  TENANT_SCOPE_OPERATIONS,
  injectTenantData,
  mergeTenantWhere,
} from '../common/context/tenant-scope.js';

interface OperationParams {
  model?: string;
  operation: string;
  args: Record<string, any>;
  query: (args: Record<string, any>) => Promise<unknown>;
}

/**
 * Si el request abrió una transacción RLS, ejecuta la operación en esa misma
 * transacción. Así el `SET LOCAL app.*` y las queries comparten conexión.
 */
function runInContext(
  params: OperationParams,
  context: TenantContext | undefined,
  args: Record<string, any> = params.args,
): Promise<unknown> {
  const delegate = context?.tx
    ? (context.tx as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>)[
        params.model ?? ''
      ]
    : undefined;
  const operation = delegate?.[params.operation];
  if (typeof operation === 'function') return operation.call(delegate, args);
  return params.query(args);
}

/**
 * Extensión de Prisma Client que inyecta empresa_id/sucursal_id en lectura y escritura.
 * - SUPERADMIN (bypass) y queries sin contexto (login) no se filtran.
 * - findUnique/update/delete/upsert no se tocan: su where exige claves únicas.
 *   En esos casos el servicio debe usar findFirst/updateMany/deleteMany o validar pertenencia.
 */
export function withTenantScope(client: PrismaClient, tenantContext: TenantContextService) {
  return client.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations(params: OperationParams) {
          const context = tenantContext.get();
          const model = params.model;
          if (!context || context.bypass || !model) {
            return runInContext(params, context);
          }

          const scope = TENANT_SCOPED_MODELS[model];
          if (!scope) return runInContext(params, context);

          const args = { ...params.args };

          if (TENANT_SCOPE_OPERATIONS.has(params.operation)) {
            args.where = mergeTenantWhere(
              scope,
              context,
              args.where as Record<string, unknown> | undefined,
            );
          } else if (params.operation === 'create') {
            args.data = injectTenantData(
              scope,
              context,
              args.data as Record<string, unknown> | undefined,
            );
          } else if (params.operation === 'createMany') {
            const rows = Array.isArray(args.data) ? args.data : [args.data];
            args.data = rows.map((row) =>
              injectTenantData(scope, context, row as Record<string, unknown>),
            );
          }

          return runInContext(params, context, args);
        },
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof withTenantScope>;
