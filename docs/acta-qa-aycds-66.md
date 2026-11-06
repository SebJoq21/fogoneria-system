# Acta de QA — Aislamiento multi-tenant y RBAC (AYCDS-66)

**Fecha:** 2026-10-20

**Responsable:** Sebastián Chicata

**Ambiente:** PostgreSQL 16 local (`localhost:5433`), API NestJS (`localhost:3001`) y web Next.js

**Alcance:** aislamiento por empresa/sucursal, RBAC por rol, sesión/BFF, email global y suspensión de tenant.

## 1. Resultado general

**Aprobado con observaciones menores.** No se detectaron fugas de datos entre empresas ni accesos de un rol a rutas fuera de su alcance.

| Suite | Resultado |
|---|---|
| API unitarias | 52/52 |
| API base de datos (RLS, soft delete, inmutabilidad, email) | 27/27 |
| API e2e | 10/10 |
| Web (RBAC, sesión, BFF, tenant) | 37/37 |

## 2. Matriz RBAC

| Rol | `/app` | Catálogo | Caja | Cocina | Mozo | `/saas` |
|---|---|---|---|---|---|---|
| superadmin | Sí | Sí | Sí | Sí | Sí | Sí |
| admin | Sí | Sí | Sí | Sí | Sí | No |
| sucursal | Sí | Sí | Sí | Sí | Sí | No |
| cajero | Sí | No | Sí | No | No | No |
| cocina | Sí | No | No | Sí | No | No |
| mesero | Sí | No | No | No | Sí | No |

Verificado con `proxy.ts`, `canViewPath` y pruebas de la matriz de roles. Una URL privada sin sesión redirige al login; una sesión con rol insuficiente redirige a su `ROLE_HOME`.

## 3. Aislamiento de datos

| Caso | Resultado |
|---|---|
| `fogoneria_rls` sin contexto de sesión | 0 filas visibles |
| Contexto de la empresa demo | 6 platos demo |
| Empresa QA recién creada | 0 platos |
| Token QA leyendo plato de la empresa demo | 404 |
| Escritura cruzada entre empresas | Rechazada por políticas RLS |
| SUPERADMIN/SaaS | Acceso global vía `fogoneria_saas` (BYPASSRLS) |

## 4. Sesión y BFF

- Login emite `fogoneria.session` (HttpOnly, SameSite=Lax, firmada HS256) y `fogoneria.token` (HttpOnly, solo BFF).
- `GET /api/backend/*` sin cookie de sesión responde **401** con `no-store`.
- Mutaciones con `Origin` ajeno responden **403**.
- La cookie no es legible ni alterable desde JavaScript.
- En Compose local se añadió `SESSION_COOKIE_SECURE=false`; en producción debe quedar `true`.

## 5. Reglas de negocio verificadas

| Caso | Resultado |
|---|---|
| Email activo repetido en dos empresas | Rechazado (`uq_usuarios_email_activo`) |
| Email de usuario soft-deleted reutilizado | Permitido |
| Tenant suspendido | Login/API responden **403** |
| Tenant reactivado | Acceso restaurado |
| Onboarding con RUC inválido/duplicado | 400/409 |
| Logo/sucursal/admin en onboarding | Creados en una transacción |

## 6. Observaciones

1. Los porcentajes de `docs/TAREAS-SEMANAS-5-8.md` estaban desalineados (84% vs 79%); se corrigen en esta sesión.
2. Falta ejecutar el workflow de CI en GitHub y el smoke completo de `docker compose up` en un entorno limpio.
3. Falta adjuntar `EXPLAIN (ANALYZE, BUFFERS)` de órdenes, caja y kardex.
4. El correo de un usuario dado de baja lógica queda libre; es el comportamiento acordado.

## 7. Conclusión

El aislamiento multi-tenant y el RBAC cumplen el criterio de aceptación para la entrega académica. Las observaciones son de evidencia/operación y no bloquean el flujo funcional.

**Firma QA:** ____________________

**Firma producto:** ____________________
