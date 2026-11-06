# Backlog priorizado — Fogonería System

**Actualizado:** 2026-10-20

**Criterio:** primero lo que bloquea la entrega o la operación real; luego deuda técnica y mejoras.

## P0 — Bloqueantes de entrega

| # | Historia | Estado | Evidencia / próximo paso |
|---|---|---|---|
| 1 | RLS nativo por empresa/sucursal (AYCDS-53/62) | Listo | `runWithTenant`, políticas y FORCE activos; 27 pruebas DB |
| 2 | Auth JWT + sesión HttpOnly + BFF (AYCDS-48/55) | Listo | Cookie firmada, BFF valida sesión, 37 pruebas web |
| 3 | Login, onboarding y catálogo reales (AYCDS-57/63) | Listo | Verificado contra PostgreSQL real |
| 4 | Consola SaaS contra API (AYCDS-65) | Listo | `lib/saas-api.ts`; métricas, suspender/reactivar verificados |
| 5 | CI + Docker (AYCDS-58) | En curso (90%) | CI en verde (run `39540565973`); falta smoke completo de Compose en volumen limpio |

## P1 — Operación y calidad

| # | Historia | Estado | Próximo paso |
|---|---|---|---|
| 6 | Acta QA multi-tenant/RBAC (AYCDS-66) | En curso (95%) | Matriz y evidencias listas en `docs/acta-qa-aycds-66.md`; falta firma |
| 7 | Correo único global entre usuarios activos | Listo | Índice `uq_usuarios_email_activo` + 2 pruebas DB |
| 8 | `EXPLAIN (ANALYZE, BUFFERS)` de consultas críticas | Listo | Evidencia de órdenes, turnos y kardex en `docs/explain-rls.md` |
| 9 | Restauración de bajas lógicas desde consola | Pendiente | Endpoint reservado al rol de administración |

## P2 — Deuda técnica

| # | Historia | Estado | Próximo paso |
|---|---|---|---|
| 10 | Reducir imagen Docker (podar devDependencies) | Pendiente | `pnpm deploy --prod` por app |
| 11 | Migraciones automáticas en despliegue | Pendiente | Job `migrate` ya existe en Compose; llevar a CI/CD |
| 12 | Observabilidad (logs estructurados, métricas) | Pendiente | Evaluar OpenTelemetry |
| 13 | Backups y retención PostgreSQL | Pendiente | Política de respaldo y restauración probada |

## P3 — Producto

| # | Historia | Estado | Próximo paso |
|---|---|---|---|
| 14 | Facturación SUNAT real (OSE) | Pendiente | Reemplazar `MockFacturacionAdapter` |
| 15 | Portal de proveedores | Pendiente | Módulo y permisos |
| 16 | Reportes analíticos avanzados | Pendiente | Consultas agregadas + exportación |
