# SESION — estado entre sesiones

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
