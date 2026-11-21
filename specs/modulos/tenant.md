# tenant — especificación

**Estado:** API real · **Última revisión:** 2026-11-19

## 1. Propósito

Resolver la **empresa** y sus **sucursales** desde el JWT y exponerlas al shell web. Es la fuente del contexto multitenant que consumen RLS y la extensión de Prisma.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/tenant/` + `src/common/context/` | real |
| Web | `features/tenant/BranchSwitcher.tsx` + `components/dashboard/providers/tenant.tsx` + `lib/tenant-api.ts` | real |
| Contrato | `packages/contracts/src/tenant.ts` (`Empresa`, `Sucursal`) | sí |
| Datos | `empresas`, `sucursales` | RLS por empresa |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/api/v1/tenant/context` | autenticado | Contexto resuelto del token (`empresaId`, `sucursalId`, rol) |
| `GET` | `/api/v1/tenant` | autenticado | Empresa actual con conteo de sucursales y usuarios |
| `GET` | `/api/v1/tenant/branches` | autenticado | Sucursales visibles para el tenant |

Reglas:
- `TenantContextService` (AsyncLocalStorage) + `TenantContextInterceptor` fijan `app.empresa_id`, `app.sucursal_id`, `app.usuario_id` y `app.bypass` con `set_config(..., true)` dentro de la transacción del request.
- La extensión `prisma.scoped` inyecta `empresa_id`/`sucursal_id` en las queries de negocio; `findUnique/update/delete/upsert` se validan en el servicio.
- `SUPERADMIN` opera con bypass (consola SaaS).

## 4. Datos

- `empresas`: RUC único global, estado, plan, `logo_url`.
- `sucursales`: nombre, dirección, estado (`ABIERTA`/`CERRADA`), `empresa_id`.
- Soft-delete en ambas; `empresas.ruc` **no** se reutiliza tras la baja.

## 5. UI

- `TenantProvider` hidrata `/tenant` + `/tenant/branches` con `Promise.all` + `AbortController`, **una vez por `empresaId`**.
- Persiste `fogoneria:branch:<empresaId>`; rechaza ids fuera de `branchIds`.
- Sin sesión usa `DEMO_COMPANY`/`ALL_BRANCHES`; con sesión nunca demo (si la API falla, `tenant: null` y vista general).
- Anti-flash: no se pinta demo hasta `ready && !hasSession`; el rol operativo conserva su sucursal mientras hidrata.
- Selector de sucursal solo para `admin` (`canSwitchBranch`); `isGeneral` = vista agregada de lectura.

## 6. Pruebas

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

| Suite | Archivo |
|---|---|
| Unit | `src/common/context/tenant-scope.spec.ts` |
| DB | `test/db/rls.db-spec.ts` |
| Web | `lib/tenant-scope.test.ts` |

## 7. Deuda conocida

- `tenant` no tiene unit test propio ni e2e dedicado (observación 9 de `docs/PLAN-MODULOS-Y-PROPIEDAD.md`).
- Durante la hidratación, una llamada con `sucursalId` puede salir sin filtro (vista agregada) y repetirse al resolverse la sucursal; es un request extra, no un cambio visual.
- `TenantProvider` reexpone por `ModulesProvider`; las features nuevas deben usar `useTenant` directamente.

## 8. Trazabilidad

- Jira: AYCDS-44 (contexto), AYCDS-53 (aislamiento), Fase 4 etapa 2.
- PRs: #2, #70 (`TenantProvider`).
- Docs: [rls-modelo](../../docs/rls-modelo.md), [arquitectura](../../docs/arquitectura.md).

## 9. Próximos pasos

1. Añadir e2e de `/tenant` con dos empresas.
2. Mover el consumo de tenant de `ModulesProvider` a las features (Fase 4, etapa 3).
