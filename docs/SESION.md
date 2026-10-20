# SESION — estado entre sesiones

## 2026-10-20 — Revisión estática de 57/63: P0 y P1 aplicados (RUC, onboarding, modificadores, tenant real, cajero)

- Objetivo: cerrar los hallazgos de la revisión de la rama `feat/web-conexion-api` sin depender de Postgres.
- Hecho:
  - P0 RUC: `(11 - (sum % 11)) % 10` en `apps/api/src/common/utils/ruc.ts`, `apps/web/lib/onboarding-api.ts` y `apps/web/lib/domain.ts:isValidRuc` (antes invertía los restos 0/1). Casos verificados en `ruc.spec.ts`.
  - P0 onboarding: el DTO ya no acepta `plan`; el servicio fuerza `TRIAL` + `mrr_monto: 0`, devuelve **400** por RUC inválido, **409** por RUC/email duplicado (sin filtrar `deleted_at`) y mapea `P2002`; auditoría best-effort. Reglas de `logoUrl`/longitudes en `submit-onboarding.dto.ts`.
  - P1 abuso del endpoint público: `RateLimitGuard` (5/10 min por IP, en memoria) + `ONBOARDING_RATE_LIMIT`/`ONBOARDING_RATE_WINDOW_MS` en `env.validation.ts` y `.env.example`; body parser de 4 MB **solo** en `/api/v1/onboarding` (100 KB global).
  - P1 login ambiguo: `auth.service.ts:login` compara bcrypt contra los candidatos del email y responde **409** si hay más de un tenant (antes elegía uno al azar).
  - P0 modificadores: `UpdateModifierGroupDto.opciones[].id` permite renombrar sin borrar; `catalog.service.ts:updateModifierGroup` sincroniza por id en transacción, valida ids ajenos/repetidos y bloquea el borrado de opciones usadas en órdenes (409).
  - P0 tenant real en web: nuevo `lib/tenant-api.ts`; `ModulesProvider` hidrata `/tenant` + `/tenant/branches`, valida la sucursal guardada, poda combos huérfanos, aborta el catálogo al desmontar y deshace altas de plato/lista si falla el paso siguiente.
  - Rol **cajero** real: `AppRole`/`API_ROLE.CAJERO`, `proxy.ts`, `canViewPath`, `permissions.ts`, sidebar y mobileLinks; `appUserFromApi` usa `sucursalId` real.
  - E2E nuevo `test/onboarding.e2e-spec.ts` (400 de DTO, `plan` prohibido, 201 y 429 por rate limit).
- Verificado: `api lint` 0/0, `api check-types` OK, `api test` 52/52, `api test:e2e` 10/10; `web lint` OK, `web check-types` OK, `web build` OK (45 rutas).
- Pendiente: verificación en vivo con Postgres (sin Docker/`psql` aquí) para marcar 57/63 como Listo, Jira y PR.
- Próximo paso: push de la rama y abrir el PR a `development` con la descripción preparada.

## 2026-10-20 — Tarea 55 de Joshua: sesión HttpOnly + BFF (PR #4 sobre `development`)

- Objetivo: cerrar AYCDS-55 (rutas protegidas por rol) tras el merge del PR #3 (`da18b70`).
- Rama: `feat/session-cookie` rebasada sobre `origin/development`; PR [#4](https://github.com/SebJoq21/fogoneria-system/pull/4) reapuntado a `development` y listo para revisión.
- Hecho:
  - `lib/session.ts`: cookie `fogoneria.session` HttpOnly/SameSite firmada HS256 (`jose` + `SESSION_SECRET`). Ventana deslizante de **15 min** con refresh en `proxy.ts` y tope absoluto de **8 h** (`startedAt`). Fuera de `development`/`test`, sin `SESSION_SECRET` falla cerrado.
  - `app/api/session/route.ts`: login contra la API, rate limit **5/10 min por IP**, `Cache-Control: no-store`, sin devolver el access token. Emite `fogoneria.session` y `fogoneria.token` (ambas HttpOnly).
  - `app/api/session/logout/route.ts`: `GET`/`POST` borran ambas cookies y redirigen con 303; el cliente navega ahí, así un fallo de red no simula un logout exitoso.
  - `app/api/backend/[...path]/route.ts`: BFF que adjunta el Bearer desde la cookie HttpOnly; el JWT de la API ya **no** vive en `localStorage`. Valida `Origin` en mutaciones.
  - `lib/auth.ts`: `appRoleFromApi` devuelve `null` para roles desconocidos y `appUserFromApi` rechaza roles operativos sin sucursal (no cae a "todas"). `cajero` incluido en la allowlist de sesión.
  - `ModulesProvider`: sin empresa/sucursales demo cuando hay sesión; si `/tenant` falla, no usa datos demo. `logout` limpia `localStorage` y navega al logout del servidor.
  - Vitest en web con integración: proxy, route handler de login (cookies/flags/rate limit), logout, BFF y matriz RBAC.
- Verificado: `pnpm --filter web test` **34/34**, `lint`, `check-types` y `build` (47 rutas: `/api/session`, `/api/session/logout`, `/api/backend/[...path]`) verdes; `pnpm lint` raíz OK.
- Pendiente: verificación en vivo del login/cookie con API + PostgreSQL (`localhost:5433` no responde aquí); al mergear #4, actualizar Jira y marcar 55 Listo.
- Próximo paso: 65 (`/saas` contra la API) desde `development` actualizado.

## 2026-10-20 — Tareas 57 y 63 de Diego: login real, onboarding y catálogo contra la API

- Objetivo: conectar el frontend a la API — login real (57), wizard de onboarding con RUC/logo (57) y `/app/productos` sin mocks (63).
- Hecho:
  - Cliente HTTP `lib/api.ts` (`NEXT_PUBLIC_API_URL` ?? `http://localhost:3001/api/v1`, JWT en `fogoneria:token`, `ApiError`), `lib/auth-api.ts` (`loginRequest`) y `lib/onboarding-api.ts` (RUC módulo 11 + `submitOnboarding`).
  - 57: `LoginContent.tsx` con `await login(email, password)` y estados de carga/error; `OnboardingContent.tsx` reescrito (3 pasos reales, `DropZone` con archivo/URL de logo, auto-login + redirect por rol). El logo subido se lee como **data URL** (≤2 MB, validado en cliente) y el body parser de Express se subió a 4 MB en `apps/api/src/main.ts`. `lib/auth.ts` mapea rol y sucursal de la API y sigue dejando las cookies `fogoneria.role`/`fogoneria.branch` para no romper el RBAC de `proxy.ts`.
  - 57 backend (módulo nuevo): `apps/api/src/modules/onboarding/**` expone `POST /api/v1/onboarding` (`@Public()`): valida RUC, 409 si existe, y en transacción crea empresa `TRIAL` con `logo_url`, sucursal matriz, admin bcrypt, lista "Carta", lead `GANADO` y evento de auditoría. Registrado en `app.module.ts`.
  - 63: `lib/catalog-api.ts` (lecturas de categorías/platos/modificadores/listas + precios y todas las mutaciones); `ModulesProvider.tsx` mantiene el catálogo en estado con `refreshCatalog`/`catalogLoading`/`catalogError` y expone las mutaciones; `ProductsView`, `CategoriesView`, `ModifiersView` y `PriceListsView` dejaron de usar mocks. Los `id` del catálogo pasan a UUID en todo el ERP (`erp`, `domain`, `dashboard`, `tenancy`, `AddItemModal`, resúmenes) y `ErpState` sube a `v2` (`fogoneria:erp:v2`) sin catálogo. `catalog.service.ts` incluye `platos_grupos_modificadores` en el listado.
  - `apps/web/.env.example` nuevo con `NEXT_PUBLIC_API_URL`.
- Verificado: `web lint` OK (eslint + `check-styles`), `web check-types` OK, `web build` OK (45 rutas), `api lint` OK, `api test` 28/28 (3 nuevas de onboarding) y `api test:e2e` 7/7.
- Pendiente: **verificación en vivo con Postgres** (en este entorno no hay Docker ni `psql`; `localhost:5433` no responde), sincronizar Jira y commitear.
- Próximo paso: levantar `docker compose up` + `db:deploy` + `db:seed`, probar login y onboarding desde la UI, y luego commit/PR.

## 2026-10-20 — Docker Compose + verificación real de PostgreSQL

- Objetivo: levantar una base local para probar la API como en `dydalo` y cerrar la verificación pendiente de las tareas 44/48/53/60/61.
- Hecho:
  - `docker-compose.yml` raíz con PostgreSQL 16 en `localhost:5433` (evita el 5432 de `dydalo`), healthcheck, volumen `pgdata` y `docker/initdb/01-shadow.sql` para `fogoneria_shadow`.
  - Scripts `db:up`, `db:down`, `db:logs`, `db:status` y `db:psql` en `apps/api/package.json`; `.env.example` y `env.validation.ts` alineados a 5433; README de la API actualizado.
  - `db:deploy` aplicó `20261019000000_init` y `db:seed` cargó el demo en la base real.
  - Bug real encontrado: `PrismaService extends PrismaClient` dejaba `raw.usuarios` en `undefined` con Prisma 7 (el constructor devuelve un proxy). Corregido a **composición** en `apps/api/src/prisma/prisma.service.ts`.
  - Verificado contra Postgres: health, login de los 6 usuarios demo, JWT, `/tenant`, `/catalog`, `/pricing`, `/orders`, CRUD real de catálogo/precios, alta de tenant, `/saas/metrics`, suspensión (login 403) y reactivación; aislamiento con 2 empresas (la B ve 1 sucursal y 0 órdenes de A).
- Verificado: `api check-types`, `api lint`, 25 unit y 7 e2e verdes.
- Pendiente: Dockerfiles api/web + CI (tarea 58), conectar UIs 63/65, RLS nativo (62) y sincronizar Jira.
- Próximo paso: revisar y mergear el PR [#2](https://github.com/SebJoq21/fogoneria-system/pull/2) (`feat/api-david` → `development`).

## 2026-10-20 — Backend de David: tareas 44, 48, 53, 60 y 61

- Objetivo: implementar los módulos backend de David sobre el schema de Sonny.
- Hecho:
  - Merge local de `origin/feat/prisma-schema` (`d6bb6a6`): Prisma 7.10.1, schema de 41 modelos, migración y seed. Ese trabajo no estaba en `main`.
  - 44: wiring en `app.module.ts`, `bootstrap.ts` (prefijo `/api/v1`, CORS, `ValidationPipe`), `swagger.ts` (`/api/docs`), `config/env.validation.ts` y health.
  - 48: `modules/auth` con JWT/Passport, `JwtStrategy`, guards globales, decoradores `@Public/@Roles/@CurrentUser`, login con bcrypt y bloqueo por estado del tenant; colección Postman y contraseña demo `Fogoneria123!`.
  - 53: `TenantContextService` + `TenantContextInterceptor` + extensión Prisma (`prisma.scoped`) con bypass SUPERADMIN; tests en `tenant-scope.spec.ts`.
  - 60: `modules/catalog` y `modules/pricing` con DTOs, RBAC, Swagger y tests.
  - 61: `modules/saas`, `modules/billing` (cron diario 03:00) y `modules/audit`; MRR, alta transaccional, suspensión/reactivación y eventos.
- Verificado: `api check-types`, `api lint`, `api build`, `api test` (25) y `api test:e2e` (7). Sin PostgreSQL (Docker apagado y sin `psql`): los tests usan Prisma mockeado.
- Pendiente: verificar contra Postgres real (tarea 58), conectar UIs 63/65 y RLS nativo (62).
- Próximo paso: levantar Docker/Postgres, correr `db:deploy` + `db:seed` + colección Postman y luego push.

## 2026-10-19 — Integración con `origin/main` (Fases 0–3 preservadas)

- Objetivo: traer los cambios del remoto sin perder las fases 0–3 locales.
- Hecho:
  - Commit local `5a1d10c` con Fases 0–3 (cuentas, persistencia, SUNAT mock, KDS, reservas).
  - Merge de `origin/main`: entra `db/fogoneria_schema.sql` (41 tablas), `docs/TAREAS-SEMANAS-5-8.md` y la reorganización del módulo Platos (se retiran `valorizado` y `resumen-categoria`).
  - Conflictos resueltos respetando ambos lados: `MozoView` conserva cuentas/POS + muestra precio unitario y total al mesero; `OrdersView` conserva timers sin comandas simuladas y oculta totales en modo cocina; `AppTopBar` conserva "Reiniciar datos demo" sin las rutas retiradas. Se mantiene la eliminación de breadcrumbs.
- Verificado: `web lint` OK, `web check-types` OK (borrando `.next` obsoleto), `web build` OK.
- Pendiente: Fase 4–6 del ERP mock; tareas Jira 44/48/53/60/61 (David).
- Próximo paso: arrancar AYCDS-44 (scaffold NestJS modular) o Fase 4.

## 2026-10-06 — Fase 3: KDS con campana/timers + mesas y reservas reales

- Objetivo: cerrar la operación del salón — avisos reales a cocina/mesero, urgencia por comanda, estados de mesa derivados y reservas con CRUD.
- Hecho:
  - **Campana**: `ui/Toast.tsx` (aviso transitorio 4s, sin reintroducir el bell podado) renderizado en `DashboardShell`; `notify()` por fin tiene UI. Sync multi-pestaña ya vía `BroadcastChannel` (Fase 0).
  - **Timers KDS**: `components/useNow.ts` (tick 30s) + badge de urgencia por comanda en `OrdersView` (`timerTone`: >10 min warning, >20 min danger) y `elapsedLabel` vivo en `AccountPanel`.
  - **Mesas derivadas**: `deriveTableStatus` (`lib/domain.ts`) — ocupada si cuenta abierta, reservada si reserva confirmada de hoy o bloqueo manual, libre si no. Quitado el ciclo ficticio `libre→ocupada→reservada`; seeds de mesas todas "libre" + cuenta demo abierta en Mesa 2 (`initialAccounts` en `tenancy.ts`). Drawer del mapa: cuenta abierta (total/acción), reserva, "Abrir cuenta", "Registrar llegada", bloquear/desbloquear (solo sucursal, `canChangeTableStatus`).
  - **Reservas CRUD**: `Reservation` con `date` ISO + estado (`confirmada/llego/no_show/cancelada`); `BookingsModule` agenda con filtro por fecha, alta/edición, "Llegó → abrir cuenta" (crea cuenta + marca llego), cancelar/no-show con confirm. `canManageReservations` (admin|sucursal).
  - **Maestro de mesas**: zonas editables ("+ Nueva zona…" libre) y columna de estado derivado.
  - Regla `apps/web/AGENTS.md` actualizada (mesero abre cuenta, estados derivados).
- Verificado: `web lint` OK, `web check-types` OK, `web build` OK.
- Pendiente: Fase 4 (escandallo→consumo, gastos→caja, promos/fidelización aplicadas al cobro); Fase 5 (personal + dueño con KPIs derivados); Fase 6 (portal proveedor con cobro por sucursal).
- Próximo paso: Fase 4 o recorrido visual por roles en `dev`.

## 2026-10-06 — Fase 2: facturación electrónica SUNAT (mock OSE)

- Objetivo: ciclo de vida legal de comprobantes (Boleta 03 / Factura 01 / NC 07) con estados CDR, listo para enchufar un OSE real.
- Hecho:
  - `lib/facturacion.ts`: puerto `FacturacionPort` (hexagonal) + `MockFacturacionAdapter` con validaciones reales (RUC con dígito verificador, DNI, Factura exige RUC), CDR numerado, latencia simulada y **modo contingencia** (OSE caído → CPE en cola, la venta nunca se detiene). `cpeFromReceipt()` como payload UBL-ready.
  - `Receipt` (`lib/erp.ts`) con ciclo SUNAT: `estadoSunat` (en_cola→enviado→aceptado/rechazado/anulado), `cdr` (número/fecha/código/mensaje), `intentosEnvio`, `refId` (NC→origen), `bajaResumenId` (RC-pendiente→RC-YYYYMMDD-NN), tipo `"07"` y status `"Emitida"`.
  - Provider: `enviarSunat` (cola+reintento), `generarResumenDiario` (bajas de boletas), `toggleSunatContingencia`, `annulReceipt` reescrito — **factura aceptada → NC01 auto-enviada**; **boleta → baja en resumen diario**; ambos con reverso de caja. Checkout y emisión manual disparan envío automático.
  - `ComprobantesView`: columna SUNAT con badges, acciones Enviar/Reenviar + modal CDR, botones "Resumen diario (n)" y "Contingencia SUNAT ON/OFF"; la anulación explica NC vs baja según el tipo.
- Verificado: `web lint` OK, `web check-types` OK, `web build` OK.
- Pendiente: Fase 3 (KDS con campana/timers/sync + mesas y reservas reales); Fase 4 (escandallo→consumo, gastos→caja, promos/fidelización aplicadas); Fase 5 (personal + dueño con KPIs derivados); Fase 6 (portal proveedor con cobro por sucursal). Backend fase 3: sustituir `MockFacturacionAdapter` por OSE real.
- Próximo paso: Fase 3 o recorrido visual por roles en `dev`.

## 2026-10-06 — Fase 0+1: dominio de operación, persistencia y venta/cobro

- Objetivo: ejecutar el plan "sistema de restaurantes 100%" — cimientos (modelo + persistencia) y el flujo de dinero (venta → cobro → caja → comprobante).
- Hecho:
  - Dominio nuevo `lib/domain.ts`: `TableAccount`/`AccountItem` (qty + modificadores con extra), `Payment`, `CashShift` (apertura/arqueo/cierre), IGV 18% desglosado, validación RUC/DNI (checksum SUNAT), `nextReceiptNumber` (serie B001/F001).
  - Persistencia `lib/persistence.ts`: estado ERP serializado en `localStorage` (`fogoneria:erp:v1`) + `BroadcastChannel` (mesero ↔ cocina en pestañas distintas). `ModulesProvider` reescrito sobre estado único con acciones de dominio (`openAccount`, `sendToKitchen`, `checkoutAccount`, `annulReceipt`, `startCashShift/closeCashShift`, `resetDemoData`).
  - Tipos evolucionados en `lib/erp.ts`/`tenancy.ts`: `Order` con `accountId/tableId/createdAt/amount` + estado `anulado`; `CashMovement` con `at` ISO + `shiftId`; `Receipt` con `type/docType/docNumber/subtotal/igv/total` numérico.
  - POS mesero (`MozoView` + `mozo/AddItemModal` + `mozo/AccountPanel`): cuentas por mesa/para llevar, líneas con qty±/modificadores/notas, envío a cocina (comanda vinculada a la cuenta), anulación como estado con motivo.
  - `CheckoutModal` compartido: pagos mixtos, propina, cupón (incrementa `used`), cliente (acredita puntos/visitas), Boleta/Factura con documento validado.
  - `CajaView`: turno real (apertura con fondo, "efectivo esperado" vs contado, diferencia, observaciones, snapshot) + cuentas por cobrar + historial de turnos; `ComprobantesView`: emisión con IGV, anulación con motivo + reverso de caja. Quitado el generador de pedidos falsos de `OrdersView`.
  - Permisos (`lib/permissions.ts`): `canOpenAccount` (mesero|sucursal), `canCheckout`/`canAnnulAccount` (sucursal). Botón "Reiniciar datos demo" en el menú de perfil.
- Verificado: `web lint` OK, `web check-types` OK, `web build` OK (0 errores).
- Pendiente (siguientes fases del plan): Fase 2 facturación electrónica SUNAT (adaptador OSE/mock, CDR, resúmenes/bajas); Fase 3 KDS (campana, timers, sync) y mesas/reservas reales; Fase 4 escandallo→consumo, gastos→caja, promos/fidelización aplicadas; Fase 5 personal + dueño (KPIs derivados, settings); Fase 6 portal proveedor (cobro por sucursal).
- Próximo paso: recorrido visual por roles (mesero → cocina → caja) en `dev`, y luego Fase 2.

## 2026-10-06 — Retiro de breadcrumb en todo el ERP

- Objetivo: quitar la miga de pan de todo el sistema a pedido del dueño.
- Hecho: eliminado `ui/Breadcrumb.tsx` + `lib/breadcrumbs.ts` y su uso en `DashboardShell.tsx`; regla retirada de `apps/web/AGENTS.md`.
- Verificado: `web lint` OK, `web check-types` OK, sin restos (`Breadcrumb|trailFor` 0 resultados).
- Pendiente: commit (incluye bloque grande previo sin commitear); recorrido visual por rol.
- Próximo paso: commit del conjunto cuando se indique.

## 2026-10-19 — Tareas 32 y 42: Prisma 7, migración inicial y seed demo

- Objetivo: desbloquear la fundación backend con `schema.prisma`, migraciones PostgreSQL y datos demo.
- Hecho:
  - Prisma 7.10.1 + `@prisma/adapter-pg` + `prisma.config.ts`; `schema.prisma` con 41 modelos, 27 enums e índices parciales (`apps/api/prisma/schema.prisma`).
  - Migración `20261019000000_init` desde el DDL, con CHECKs, 22 triggers y 4 vistas; verificada en base limpia.
  - Seed demo idempotente (`apps/api/prisma/seed.ts`): empresa, 3 sucursales, usuarios, catálogo, inventario, caja y RRHH.
  - Documentación: `docs/modelo-datos.md`, README de API, `TAREAS-SEMANAS-5-8.md` (global 37%, Sonny 72%).
- PR #1 abierto: https://github.com/SebJoq21/fogoneria-system/pull/1 (`feat/prisma-schema` → `development`).
- Próximo paso: David retoma 44/48 sobre el schema y el seed ya listos.
- Verificado: `api check-types`, `api lint`, `api build`, `api test`, `api test:e2e`, `pnpm lint` raíz, `migrate deploy`, seed 2 veces sin duplicar.
- Extra: se agregó `@babel/preset-typescript` a la raíz para que `@repo/ui` lint resuelva el preset en pnpm estricto (falla preexistente).

## 2026-09-13 — Bloque grande sin commitear: sidebar, nombres, confirms, hubs, tipos, consola, breadcrumb

- Objetivo: dejar el ERP navegable, seguro y consistente (dueño) en una sola jornada; todo verificado pero SIN commit.
- Hecho:
  - Sidebar: 4 grupos (Principal/Carta/Clientes/Administración); Cocina y Mis órdenes solo-rol (`AppSidebar.tsx:42-77`, `DashboardShell.tsx:11-17`, `lib/auth.ts:56-57`); densidad `py-1.5/gap-0.5`, etiquetas `mt-5 mb-3` + `pb-5` en grupo; todo el nav a 14px.
  - Nombres: títulos generales (`lib/erp.ts:18,30,42,54` sin prefijos); URLs `articulos→platos`, `trabajadores→personal` (git `R`); `Carta virtual` absorbida como tab de Platos (ruta `/app/carta` eliminada); sin duplicados grupo/ítem (`Carta virtual`, tab `Maestro`, `Comensales`).
  - Seguridad: `ui/ConfirmDialog.tsx` + `danger` en `ui/Button.tsx`; confirms en 16 acciones (mesas, cocina, mozo, catálogo, comprobantes, precios con Enter/blur, promos); dueño sin operar mesas (`canChangeTableStatus`, Drawer lectura).
  - Hubs: norma `HubBlocks` (`workspace-ui.tsx`: `Acceso rápido` arriba + `Informes y másteres` debajo, 18px semibold, links en grilla; bloque vacío no se pinta); 5 hubs + bloques en Combos/Promociones/Comprobantes/Gastos (Analíticas sin bloques); Gastos/Comprobantes con tabs Panel/gestión; tira `ui/Tabs` en Platos.
  - Tipos: escala `12/13/14/16/18/24` (`globals.css`, `AGENTS.md`); jerarquía hubs 14/16/18 semibold; `text-section`=24 títulos, `text-display`=24 números/marca.
  - Consola Next 16 limpia: `next/script beforeInteractive` (`app/layout.tsx`) + `ThemeProvider` con `useSyncExternalStore`; fix key duplicada `Categorías` (`CategoriesView.tsx:55`).
  - Breadcrumb automático (`ui/Breadcrumb.tsx` + `lib/breadcrumbs.ts:trailFor`, 39 rutas) en `DashboardShell`.
  - Fix preexistente api: `test/app.e2e-spec.ts` sin `supertest/types`.
  - Verificado: `pnpm lint` 3/3 OK, `pnpm check-types` 3/3 OK, `api test` 1/1 + `test:e2e` 1/1.
- Pendiente: commit del bloque (64 archivos, +936/−344); `packages/ui` starter sin decidir; `*.tsbuildinfo` commiteado.
- Próximo paso: recorrido visual en `dev` por rol y commit.

## Historial 2026-09-12 — Memoria del agente + revisión 100%

- Montado sistema en capas (`AGENTS.md` raíz + anidados, `opencode.json`, `/guardar-contexto`, `/retomar`, `docs/`); decisión fase 3 = Postgres + Prisma.
- Revisión: web ERP mock avanzado, api scaffold, sin CI/Docker/`.env`.

## Historial previo — Frontend anterior

- `git log`: temas, onboarding, demo y planes previos al sistema turbo (commits `style(tema)`, `refactor(ui)`, `feat(operacion)`, `feat(pedidos)`); base reemplazada por monorepo actual (`b5ca606`).
