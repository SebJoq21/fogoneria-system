# saas — especificación

**Estado:** API real · **Última revisión:** 2026-11-19

## 1. Propósito

Consola del superadmin: listar empresas, ver su suscripción, suspender/reactivar, cambiar de plan y calcular MRR. Es la puerta de administración del SaaS, separada del ERP.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/saas/` | real |
| Web | `apps/web/features/saas/SaasPage.tsx` (facturación en `features/billing`) | real |
| Contrato | `packages/contracts/src/saas.ts` (`EmpresaSaas`, `MetricasSaas`) | sí |
| Datos | `empresas`, `suscripciones_eventos`, `auditoria` | `20261019000000_init` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `POST` | `/api/v1/saas/tenants` | `SUPERADMIN` | Alta autenticada de tenant |
| `GET` | `/api/v1/saas/tenants` | `SUPERADMIN` | Listado de empresas |
| `GET` | `/api/v1/saas/tenants/:id` | `SUPERADMIN` | Detalle de suscripción |
| `POST` | `/api/v1/saas/tenants/:id/suspend` | `SUPERADMIN` | Suspende (login 403) |
| `POST` | `/api/v1/saas/tenants/:id/reactivate` | `SUPERADMIN` | Reactiva |
| `PATCH` | `/api/v1/saas/tenants/:id/plan` | `SUPERADMIN` | Cambia de plan |
| `GET` | `/api/v1/saas/tenants/:id/history` | `SUPERADMIN` | Historial de eventos |
| `GET` | `/api/v1/saas/metrics` | `SUPERADMIN` | MRR y conteos |

Reglas:
- Usa `prisma.raw` (bypass RLS): es una operación de plataforma, no de negocio.
- Cada transición escribe `suscripciones_eventos` y `auditoria`.
- El login de un tenant suspendido responde 403 hasta reactivarlo.

## 4. Datos

- `empresas`: `estado`, `plan_actual`, `mrr_monto`, `trial_fin`.
- `suscripciones_eventos`: historial (`de`, `a`, actor, fecha).
- `leads_cotizaciones`: alta pública.

## 5. UI y rutas

- `/saas` standalone (sin `DashboardShell`), solo `superadmin`; `proxy.ts` redirige a cualquier otro rol.
- KPIs reales, grilla de empresas con estado, `ConfirmDialog` en suspender/reactivar y feedback visible.
- `lib/platform-api.ts` concentra el cliente de onboarding/SaaS/tenant; las features `auth`, `tenant`, `onboarding`, `saas` y `billing` exponen APIs delgadas.

## 6. Pruebas

- Cobertura p4 (2026-11-20): ramas de datos, errores 400/404/409, filtros y transiciones con Prisma mockeado; sin cambios de comportamiento.

- Cobertura p3 (2026-11-20): tests de ramas de error de órdenes/SaaS/reservas/mesas y variantes de sesión en caja, comprobantes, clientes e inventario; sin cambios de comportamiento.

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

| Suite | Archivo |
|---|---|
| Unit | `src/modules/saas/saas.service.spec.ts` |
| Web | `lib/platform-api.test.ts`, `lib/platform-mappers.test.ts` |
| e2e | pendiente de verificar (no hay `saas.e2e-spec.ts`) |

## 7. Deuda conocida

- Sin e2e propio de SaaS (observación 9 del plan de módulos).
- `billing` (cron de mora) es el único que cambia estado sin pasar por la consola.
- MRR depende de `mrr_monto` del plan: no hay facturación real.

## 8. Trazabilidad

- Jira: AYCDS-61 (API), AYCDS-65 (UI).
- PRs: #2 (API), #3/#7 (UI y verificación real).
- Docs: [decisiones](../../docs/decisiones.md).

## 9. Próximos pasos

1. Añadir e2e de suspensión/reactivación con login.
2. Definir facturación real (hoy el MRR es un campo del plan).
