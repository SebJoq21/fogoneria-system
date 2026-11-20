# Roles y permisos

**Última revisión:** 2026-11-19 · Fuente: `apps/web/lib/auth.ts`, `apps/web/lib/permissions.ts`, `apps/web/proxy.ts`, `apps/api/src/modules/*/*.controller.ts`.

Hay **tres capas** de autorización. Las tres deben coincidir; el servidor es la última palabra.

1. **Navegación (servidor Next):** `proxy.ts` verifica la cookie firmada y aplica `canViewPath`.
2. **Acciones de UI:** helpers de `lib/permissions.ts` (ocultan o deshabilitan botones).
3. **API:** `JwtAuthGuard` global + `RolesGuard` con `@Roles(...)` por endpoint.

## 1. Roles

| Rol web | Enum API (`rol_usuario`) | Etiqueta | Home (`ROLE_HOME`) | Sucursal en el token |
|---|---|---|---|---|
| `superadmin` | `SUPERADMIN` | Superadmin SaaS | `/saas` | `null` (consola global) |
| `admin` | `ADMIN_GLOBAL` | Dueño franquicia | `/app` | `null` (opera la empresa) |
| `sucursal` | `GERENTE_SUCURSAL` | Admin sucursal | `/app` | obligatoria |
| `cajero` | `CAJERO` | Cajero | `/app/caja` | obligatoria |
| `cocina` | `COCINERO` | Cocina | `/app/cocina` | obligatoria |
| `mesero` | `MESERO` | Mesero | `/app/mozo` | obligatoria |

- `ANFITRION` y `BARMAN` existen en el enum de base pero **no** tienen rol web: `appRoleFromApi` devuelve `null` y el login falla cerrado.
- Un rol operativo sin `sucursalId` se rechaza (`appUserFromApi` → `null`); nunca se cae a «todas».
- `canSwitchBranch` solo habilita el selector de sucursal a `admin`.

## 2. Matriz de navegación (`canViewPath`)

| Ruta | superadmin | admin | sucursal | cajero | cocina | mesero |
|---|---|---|---|---|---|---|
| `/saas` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/app` | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/app/caja`, `/app/comprobantes` | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/app/cocina` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `/app/mozo` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/app/mesas/maestro` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Resto de `/app/*` | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |

- Un usuario autenticado que pide una ruta prohibida es redirigido a su `ROLE_HOME` (307).
- Sin sesión, toda ruta del matcher redirige a `/` y borra la cookie.
- `/`, `/recuperar`, `/onboarding`, `/terminos` y `/demo/[id]` quedan fuera del matcher o son públicas.

## 3. Sesión y cookie

| Pieza | Detalle |
|---|---|
| Cookie de sesión | `fogoneria.session`, HttpOnly + SameSite, JWT HS256 firmado con `SESSION_SECRET` (`lib/session.ts`) |
| Ventana | deslizante **15 min** con refresh en cada navegación; tope absoluto **8 h** |
| Token de API | `fogoneria.token`, HttpOnly; **solo** lo lee el BFF `app/api/backend/[...path]` |
| Login | `POST /api/session` (rate limit 5/10 min por IP) valida contra `POST /auth/login`; no devuelve el token al navegador |
| Logout | `GET|POST /api/session/logout` borra ambas cookies y redirige con 303 |
| Ticket WS | `GET /api/session/ws-ticket` canjea el Bearer por un JWT de 60 s con `scope: 'ws'` |
| CSRF del BFF | mutaciones comparan `Origin` contra `Host`/`x-forwarded-host` |

Detalle de flujo en [flujos](flujos.md) y contrato en [websockets](../../docs/websockets.md).

## 4. Acciones de negocio (`lib/permissions.ts`)

| Helper | Quién | Qué habilita |
|---|---|---|
| `canCreateOrder` | mesero | Crear comanda desde el panel del mesero |
| `canOpenAccount` | mesero, sucursal | Abrir cuenta de mesa |
| `canCheckout` | admin, sucursal, cajero, mesero | Cobrar una cuenta |
| `canAnnulAccount` | admin, sucursal, mesero | Anular cuenta con motivo |
| `canOperateCash` | sucursal, cajero | Abrir/cerrar turno, movimientos |
| `canManageReservations` | admin, sucursal | Crear/editar/cancelar reservas |
| `canChangeTableStatus` | sucursal | Bloquear/liberar mesa (el dueño solo lee) |
| `canConfirmRecepcion` | cocina (modo cocina) | Confirmar comanda en el KDS |
| `canMarkListo` | cocina (modo cocina) | Marcar `LISTO` |
| `canMarkEntregado` | mesero | Marcar `ENTREGADO` |
| `canAnularPendiente` | mesero (solo su comanda `POR_CONFIRMAR`) | Anular antes de cocina |

## 5. Roles en la API (resumen por módulo)

| Módulo | Escritura | Lectura |
|---|---|---|
| `catalog`, `pricing` | `ADMIN_GLOBAL`, `GERENTE_SUCURSAL` | cualquier autenticado |
| `tables` | `ADMIN_GLOBAL`, `GERENTE_SUCURSAL` | cualquier autenticado |
| `reservations` | + `MESERO`, `CAJERO` | cualquier autenticado |
| `orders` | crear: admin/sucursal/mesero/cajero; estado: + `COCINERO` | cualquier autenticado |
| `cash`, `receipts` | `ADMIN_GLOBAL`, `GERENTE_SUCURSAL`, `CAJERO` | mismas roles |
| `expenses` | alta/edición: admin/sucursal; pago: + cajero | admin/sucursal/cajero |
| `inventory` (alertas) | `ADMIN_GLOBAL`, `GERENTE_SUCURSAL` | autenticado (stock/kardex) |
| `promotions` | escritura: `ADMIN_GLOBAL`, `GERENTE_SUCURSAL`; lectura de cupones: + `CAJERO` | autenticado |
| `crm` | alta: + mesero/cajero; ajuste: admin/sucursal | autenticado |
| `staff` (turnos/pozos) | `ADMIN_GLOBAL`, `GERENTE_SUCURSAL`; marcar asistencia: + `CAJERO` | autenticado |
| `bi` | — | `ADMIN_GLOBAL`, `GERENTE_SUCURSAL` |
| `saas` | `SUPERADMIN` | `SUPERADMIN` |
| `onboarding` | público (`@Public()`, rate limit 5/10 min) | — |
| `audit`, `billing`, `realtime` | sin controller HTTP (servicio/cron/gateway) | — |

## 6. Deuda conocida

- `ANFITRION` y `BARMAN` no tienen flujo web: si se usan, definen rol y rutas.
- La UI de `canCheckout`/`canAnnulAccount` permite más que la norma escrita en `apps/web/AGENTS.md` («sucursal y cajero cobran»); el servidor solo acepta el cobro por `POST /cash/charges` con roles de caja.
- Rate limit del onboarding y tickets WS viven en memoria: con más de una instancia hace falta Redis.
