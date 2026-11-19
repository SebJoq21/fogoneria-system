# Plan de módulos, propiedad y flujo de issues

**Fecha:** 2026-11-18 · **Base:** `development` (`ce8493c`) · **Alcance:** todo el sistema (API + web + datos + infraestructura).

Este documento responde a tres preguntas:

1. ¿Cómo está el sistema **módulo por módulo** (backend y frontend)?
2. ¿Quién es **dueño** de cada módulo y quién lo respalda?
3. ¿Cómo se **reporta y resuelve** una observación sin que se pierda en el chat?

---

## 1. Resumen ejecutivo

- **Backend:** 20 módulos, **106 endpoints**, `ValidationPipe` global, RLS por empresa/sucursal y contratos documentados en Swagger. **Completo** para las tareas del plan.
- **Frontend:** 33 rutas bajo `/app` + `/saas`, `/onboarding` y `/demo`. **La mayoría ya consume la API**; quedan 4 pantallas de negocio en mock (gastos, combos, promociones y el maestro de inventario) y 4 pantallas heredadas sin tarea asignada (pagos, soporte, configuración, carta virtual).
- **Calidad:** API **302 unit · 112 e2e · 109 DB**; web **148**; `lint`, `check-types` y `build` en verde; CI con Postgres real.
- **Riesgo principal:** no existe **propiedad formal por módulo** ni un canal único para observaciones. Hoy una observación se pierde entre el chat, el PR y el tablero. Este plan lo corrige con componentes de Jira + `CODEOWNERS` + SLA por severidad.

**Estado global ponderado por módulo: ~88 %.** Lo que falta es UI específica y dos flujos heredados; el backend que la necesita ya existe salvo inventario maestro.

---

## 2. Inventario por módulo

### 2.1 Backend (`apps/api/src/modules`)

| Módulo | Endpoints | Qué resuelve | Tests unit | e2e | DB |
|---|---|---|---|---|---|
| `auth` | 3 | Login JWT, ticket de WebSocket | 1 | 1 | email-global |
| `tenant` | 3 | Empresa, sucursales y contexto | — | — | rls |
| `orders` | 5 | Comandas POS, transiciones del KDS, tablero con SLA | 4 | 1 | orders-pos, orders-sla |
| `tables` | 6 | Mesas por sucursal, bloqueo/liberación | 1 | 1 | tables-reservas |
| `reservations` | 5 | Aforo, solapamiento, estados | 1 | 1 | tables-reservas |
| `realtime` | gateway | Socket.io `/orders`, rooms por tenant | 1 | 1 | — |
| `catalog` | 14 | Categorías, platos, modificadores, grupos | 1 | — | — |
| `pricing` | 8 | Listas de precios y resolución de precio | 1 | — | — |
| `promotions` | 10 | Combos anti-inflación, cupones, horarios | 2 | 1 | — |
| `cash` | 7 | Turnos, movimientos, cobro con propina | 1 | 1 | caja |
| `receipts` | 4 | Emisión/anulación por serie, IGV | 1 | 1 | comprobantes |
| `expenses` | 5 | Gastos, pago con cruce a caja | 1 | 1 | gastos |
| `inventory` | 3 | Kardex por escandallo, semáforo y alertas | 3 | 1 | kardex, alertas-stock |
| `staff` | 10 | Turnos, asistencia, pozo de propinas | 2 | 1 | propinas |
| `crm` | 10 | Clientes, segmentos derivados, puntos | 2 | 1 | crm |
| `bi` | 4 | P&L, ranking y cobros por método | 1 | 1 | bi, bi-endpoints |
| `saas` | 8 | Alta/listado/suspensión de tenants, MRR | 1 | — | — |
| `billing` | cron | Mora y ciclo de suscripción | 1 | — | — |
| `onboarding` | 1 | Alta pública con RUC y logo | 1 | 1 | — |
| `audit` | — | Registro de eventos (servicio) | — | — | inmutabilidad |
| **Transversal** | — | RLS, secuencias, filtro de errores DB | — | — | rls, soft-delete, secuencias |

### 2.2 Frontend (rutas y componentes)

| Ruta / pantalla | Componente | Fuente de datos |
|---|---|---|
| `/app` (dashboard) | `dashboard/*` | API (tenant, órdenes, caja) |
| `/app/ordenes` y `/app/cocina` | `OrdersView` | **API** (tablero + WebSocket) |
| `/app/mozo` | `MozoView` | **API** (comandas, cuentas locales) |
| `/app/mesas` y `/app/modulos/reservas/agenda` | `BookingsModule` | **API** |
| `/app/mesas/maestro` | `SalonTablesView` | **API** |
| `/app/productos/*` | `ProductsView`, `CategoriesView`, `ModifiersView`, `PriceListsView` | **API** (vía provider) |
| `/app/caja` | `CajaView` | **API** |
| `/app/comprobantes` | `ComprobantesView` | **API** (SUNAT «pendiente de OSE») |
| `/app/clientes` | `ClientesView` | **API** |
| `/app/analiticas` | `AnaliticasView` | **API** (BI) |
| `/app/modulos/inventario/movimientos` | `InventoryMovementsView` | **API** (kardex + semáforo) |
| `/app/modulos/inventario/stock` | `InventoryModule` | **Mock** (maestro/ajustes) |
| `/app/modulos/personal/asistencia` | `StaffAttendanceView` | **API** |
| `/app/modulos/personal/turnos` | `StaffTurnosView` | **API** |
| `/app/modulos/personal/directorio`, `roles`, `propinas` | `StaffModule`, `RolesView` | **Mock** |
| `/app/gastos` | `GastosView` | **Mock** |
| `/app/combos`, `/app/promociones` | `CombosView`, `PromocionesView` | **Mock** |
| `/app/modulos/fidelizacion/regla` | `LoyaltyModule` | **Mock** |
| `/app/pagos`, `/app/soporte`, `/app/configuracion` | `PaymentsView`, `SupportView`, `SettingsView` | **Mock / sin tarea** |
| `/app/productos` (carta virtual) | `CartaVirtualView` | **Demo** |
| `/saas` | consola superadmin | **API** |
| `/onboarding` | wizard de alta | **API** |
| `/` (login) + BFF + `proxy.ts` | sesión y RBAC | **API** |

### 2.3 Estado por módulo de negocio

| Módulo de negocio | Backend | UI | Estado | Qué falta |
|---|---|---|---|---|
| Catálogo y precios | ✅ | ✅ | **100 %** | — |
| Órdenes, KDS y mozo | ✅ | ✅ | **95 %** | UX: «cerrar cuenta» intenta `PAGADA` por `PATCH` y recibe 400 |
| Mesas y reservas | ✅ | ✅ | **100 %** | — |
| Caja | ✅ | ✅ | **100 %** | — |
| Comprobantes | ✅ | ✅ | **95 %** | SUNAT real (OSE) fuera del piloto |
| Inventario | ✅ (stock/kardex/alertas) | 🟡 | **80 %** | Maestro de insumos y ajuste con motivo (API nueva) |
| Gastos | ✅ | ❌ | **50 %** | `GastosView` no consume `/expenses` |
| Promociones y combos | ✅ | ❌ | **40 %** | `CombosView`/`PromocionesView` no consumen `/promotions` |
| CRM y fidelización | ✅ | ✅ (clientes) | **90 %** | Reglas de fidelización siguen demo |
| RRHH y propinas | ✅ | 🟡 | **80 %** | Directorio, roles y propinas en demo |
| BI / analíticas | ✅ | ✅ | **100 %** | — |
| SaaS, onboarding, sesión | ✅ | ✅ | **100 %** | — |
| Pantallas heredadas (pagos, soporte, configuración, carta) | — | ❌ | **0 %** | Decidir retirar o convertir en módulo con tarea |

---

## 3. Mapa de propiedad propuesto

> **Regla:** cada módulo tiene **un dueño** (decide y responde) y **un backup** (revisa cuando el dueño no está). El dueño no es «quien escribe todo»: es quien **triaga, revisa PRs y mantiene el módulo sano**.

| Módulo | Dueño | Backup | Artefactos que posee |
|---|---|---|---|
| **Catálogo y precios** | Diego Arévalo | David Piñarreta | `modules/catalog`, `modules/pricing`, `components/erp/catalog/*`, `lib/catalog-api.ts` |
| **Promociones y combos** | Joshua Chávez | David Piñarreta | `modules/promotions`, `CombosView`, `PromocionesView`, `lib/promotions-api.ts` (crear) |
| **Órdenes, KDS y mozo** | David Piñarreta | Joshua Chávez | `modules/orders`, `modules/realtime`, `OrdersView`, `MozoView`, `lib/orders-api.ts`, `lib/realtime.ts` |
| **Mesas y reservas** | David Piñarreta | Diego Arévalo | `modules/tables`, `modules/reservations`, `BookingsModule`, `SalonTablesView` |
| **Caja** | Diego Arévalo | David Piñarreta | `modules/cash`, `CajaView`, `lib/cash-api.ts` |
| **Comprobantes y fiscal** | David Piñarreta | Sebastián Chicata | `modules/receipts`, `ComprobantesView`, `lib/receipts-api.ts`, `docs/errores-db.md` |
| **Inventario y kardex** | Sonny De La Cruz | Diego Arévalo | `modules/inventory`, `InventoryModule`, `InventoryMovementsView`, `lib/inventory-api.ts`, `db/scripts/perf/*` |
| **Gastos** | Joshua Chávez | Sonny De La Cruz | `modules/expenses`, `GastosView`, `lib/expenses-api.ts` (crear) |
| **CRM y fidelización** | Diego Arévalo | Joshua Chávez | `modules/crm`, `ClientesView`, `LoyaltyModule`, `lib/crm-api.ts` |
| **RRHH y propinas** | Joshua Chávez | David Piñarreta | `modules/staff`, `StaffAttendanceView`, `StaffTurnosView`, `lib/staff-api.ts` |
| **BI y analíticas** | Sonny De La Cruz | David Piñarreta | `modules/bi`, migración `vistas_bi`, `AnaliticasView`, `lib/bi-api.ts` |
| **Plataforma** (auth, tenant, sesión, SaaS, billing, onboarding, auditoría) | David Piñarreta | Sebastián Chicata | `modules/{auth,tenant,saas,billing,onboarding,audit}`, `lib/{session,auth,saas,onboarding,tenant}-api.ts`, `proxy.ts` |
| **Datos e infraestructura** | Sonny De La Cruz | Sebastián Chicata | `prisma/`, migraciones, RLS, scripts de respaldo/perf |
| **CI, Docker y QA** | Sebastián Chicata | Sonny De La Cruz | `.github/`, `docker-compose.yml`, Dockerfiles, `docs/acta-*` |
| **Design system y shell** | Diego Arévalo | Joshua Chávez | `components/ui/*`, `app/globals.css`, `scripts/check-styles.mjs`, `DashboardShell` |

**Células sugeridas** si el equipo crece (hoy se cubre con dueños + backups):

- **Salón** (mesas, reservas, órdenes, KDS, mozo, tiempo real) → David + Joshua.
- **Caja y fiscal** (caja, comprobantes, gastos) → Diego + Sebastián.
- **Catálogo y demanda** (catálogo, precios, promociones, CRM) → Diego + Joshua.
- **Inventario y datos** (inventario, BI, RLS, performance, respaldos) → Sonny + David.
- **Plataforma y entrega** (auth, SaaS, onboarding, CI/Docker, QA) → Sebastián + David.

---

## 4. Modelo operativo: issues por módulo

### 4.1 Dónde vive un issue

Todo issue se abre en **Jira (AYCDS)** con:

- **Componente** = módulo (`catalogo`, `promociones`, `ordenes-kds`, `mesas-reservas`, `caja`, `comprobantes`, `inventario`, `gastos`, `crm`, `rrhh`, `bi`, `plataforma`, `datos-infra`, `ci-qa`, `design-system`).
- **Etiqueta** `modulo:<nombre>` (sirve para filtros cruzados y automatizaciones).
- **Assignee** = dueño del módulo (automation: componente → assignee).
- **Reviewer** = backup.

> Un issue **no** se abre en el módulo si es una duda o una idea sin impacto: eso va al chat del equipo. Si requiere trabajo, se abre.

### 4.2 Plantilla de issue (obligatoria)

```
## Módulo
[componente]

## Tipo
Defecto | Mejora | Deuda técnica | Decisión

## Severidad
S1 (bloquea demo/operación) | S2 (afecta a un flujo) | S3 (molesto) | S4 (idea)

## Qué pasa
[1–3 líneas, con el resultado observado y el esperado]

## Pasos para reproducir
1. …
2. …

## Evidencia
[log, captura, request/response, commit]

## Impacto
[qué deja de poder hacer el usuario]

## Criterio de aceptación
[qué tiene que pasar para cerrarlo]

## Entorno
[local / Docker / demo] · [rol] · [sucursal]
```

### 4.3 SLA y flujo

| Severidad | Triage | Resolución objetivo | Quién |
|---|---|---|---|
| **S1** | 4 h hábiles | 24 h | Dueño + backup (avisa al líder) |
| **S2** | 1 día | 3 días | Dueño |
| **S3** | 3 días | 10 días | Dueño (entra al sprint) |
| **S4** | 1 semana | Backlog priorizado | Dueño |

```
Nuevo → Triage (dueño, 1 día) → Listo (DoR) → En curso → Revisión (backup) → Hecho (DoD)
                                                              ↘ Bloqueado (dependencia cross-módulo)
```

- **DoR:** módulo identificado, pasos reproducibles, criterio de aceptación, severidad.
- **DoD:** tests verdes, `lint`/`types`, docs del módulo si cambia el contrato, PR revisado por el backup, evidencia en el issue.
- **Cross-módulo:** se abre en el módulo **dueño del contrato** (ej. una comanda que falla al cobrar → `caja`) y se enlaza el issue del módulo afectado. Un cambio de contrato exige RFC corto (1 página) aprobado por ambos dueños.

### 4.4 `CODEOWNERS` (revisión automática en GitHub)

```gitignore
# .github/CODEOWNERS — completar con los handles reales del equipo
*                                   @SebJoq21

/apps/api/src/modules/catalog/      @diego
/apps/api/src/modules/pricing/      @diego
/apps/api/src/modules/promotions/   @joshua
/apps/api/src/modules/orders/       @david
/apps/api/src/modules/realtime/     @david
/apps/api/src/modules/tables/       @david
/apps/api/src/modules/reservations/ @david
/apps/api/src/modules/cash/         @diego
/apps/api/src/modules/receipts/     @david @SebJoq21
/apps/api/src/modules/inventory/    @SOoOnny
/apps/api/src/modules/expenses/     @joshua
/apps/api/src/modules/crm/          @diego
/apps/api/src/modules/staff/        @joshua
/apps/api/src/modules/bi/           @SOoOnny
/apps/api/src/modules/{auth,tenant,saas,billing,onboarding,audit}/ @david
/apps/api/src/prisma/               @SOoOnny
/apps/api/prisma/migrations/        @SOoOnny @david
/apps/web/components/erp/catalog/   @diego
/apps/web/components/erp/{OrdersView,MozoView}.tsx @david @joshua
/apps/web/components/erp/{CajaView,ComprobantesView}.tsx @diego @SebJoq21
/apps/web/components/erp/{InventoryModule,InventoryMovementsView}.tsx @SOoOnny @diego
/apps/web/components/erp/{GastosView,CombosView,PromocionesView}.tsx @joshua
/apps/web/components/erp/{ClientesView,LoyaltyModule}.tsx @diego
/apps/web/components/erp/{StaffAttendanceView,StaffTurnosView}.tsx @joshua
/apps/web/components/erp/AnaliticasView.tsx @SOoOnny
/apps/web/components/ui/            @diego
/.github/                           @SebJoq21
/docker-compose.yml                 @SebJoq21
```

### 4.5 Ritual semanal (30 min)

1. **Salud por módulo** (15 min): issues abiertos por severidad, S1/S2 del sprint, bloqueados.
2. **Dueños** (10 min): qué PRs necesitan review, qué deuda entra.
3. **Cross-módulo** (5 min): RFCs pendientes y contratos que cambian.

**Métricas del mes:** % de módulos con dueño activo · issues abiertos/cerrados por módulo · tiempo de triage · lead time por severidad · defectos escapados a demo · cobertura de tests del módulo.

---

## 5. Observaciones detectadas (backlog inicial de issues)

> Estas son las observaciones reales de la auditoría, listas para convertirse en issues con su componente.

| # | Módulo | Sev. | Observación | Acción propuesta |
|---|---|---|---|---|
| 1 | `inventario` | S2 | El maestro de insumos y el ajuste con motivo siguen en demo: no hay `GET/POST/PATCH /inventory/items` ni `POST /inventory/items/:id/adjust`. | Crear endpoints + conectar `InventoryModule`; cierra el 20 % de AYCDS-24. |
| 2 | `gastos` | S2 | `GastosView` no consume `/expenses` (5 endpoints listos). | Crear `lib/expenses-api.ts` y conectar la vista (AYCDS-27). |
| 3 | `promociones` | S2 | `CombosView`/`PromocionesView` no consumen `/promotions` (10 endpoints listos). | Crear `lib/promotions-api.ts` y conectar (AYCDS-27). |
| 4 | `ordenes-kds` | S2 | «Cerrar cuenta» intenta `PATCH /orders/:id/status` con `PAGADA` y recibe **400** («el cobro va por caja»); el usuario ve un error aunque la comanda sí avanzó. | Derivar a Caja o mostrar guía «cobra en Caja»; agregar test de regresión. |
| 5 | `comprobantes` | S3 | SUNAT está «pendiente de OSE»; no hay CDR real. | Mantener explícito en UI y planificar integración OSE (fuera del piloto). |
| 6 | `rrhh` | S2 | Directorio, roles y propinas siguen en demo. | Conectar `StaffModule`/`RolesView` o retirarlos del menú. |
| 7 | `heredadas` | S3 | Pagos, soporte, configuración y carta virtual son mock y no tienen tarea Jira. | Decisión: retirar del menú o crear módulo con dueño. |
| 8 | `plataforma` | S2 | No hay `CODEOWNERS`, ni componentes/labels de Jira, ni plantilla de issue. | Implantar este plan (semana 1). |
| 9 | `datos-infra` | S3 | `tenant` no tiene unit test; `billing`, `audit` y `realtime` no tienen e2e propio. | Agregar cobertura mínima por módulo. |
| 10 | `datos-infra` | S3 | KDS bajo RLS no ve estadísticas y recorre la tabla (deuda documentada). | Medir y decidir vista `SECURITY DEFINER` o contadores. |
| 11 | `design-system` | S4 | Recharts avisa `width(0) height(0)` en varias vistas (contenedor sin alto). | Revisar `ChartCard`/contenedores y fijar alto mínimo. |
| 12 | `ci-qa` | S3 | No hay E2E full-stack (Playwright); la cobertura es RTL + API. | AYCDS-49: flujo crítico mesa → cocina → caja → comprobante. |
| 13 | `plataforma` | S3 | Rate limit de onboarding en memoria (no multi-instancia). | Migrar a Redis cuando haya más de una instancia. |
| 14 | `comprobantes` | S4 | Listado sin paginación en UI (API soporta `page`/`limit`). | Añadir paginación cuando el volumen crezca. |

---

## 6. Plan de implantación (3 semanas)

### Semana 1 — Acordar y habilitar

- [ ] Validar dueños/backups en reunión de equipo (30 min) y firmar la tabla.
- [ ] Crear los **14 componentes** en Jira y la etiqueta `modulo:*`; automation componente → assignee.
- [ ] Añadir `.github/CODEOWNERS` con handles reales y activar «Require review from Code Owners».
- [ ] Publicar la plantilla de issue (Jira) y el enlace a este documento.
- [ ] Convertir las observaciones 1–8 en issues con su componente y severidad.

### Semana 2 — Operar

- [ ] Triage de todo el backlog por dueño (1 día por módulo).
- [ ] Primer sprint por módulos: cerrar `gastos` y `promociones` (observaciones 2 y 3) y el flujo de «cerrar cuenta» (4).
- [ ] README corto por módulo: contrato, endpoints, dueño, backup, tests.
- [ ] Tablero Jira por componente con filtros guardados.

### Semana 3 — Medir y ajustar

- [ ] Primera revisión de salud (métricas de §4.5).
- [ ] Decidir pantallas heredadas (7): retirar o módulo nuevo.
- [ ] Planificar inventario maestro (1) y E2E (12).
- [ ] Retro de 30 min: qué issue se atascó y por qué.

**Criterio de éxito a 3 semanas:** 100 % de módulos con dueño y backup · 0 issues sin componente · triage < 1 día · S1/S2 con SLA cumplido ≥ 80 % · observaciones 1–4 cerradas o en curso.

---

## 7. Anexos

### 7.1 Endpoints por módulo (para el README de cada uno)

```
auth          3   POST /auth/login · GET /auth/me · POST /auth/ws-ticket
tenant        3   GET /tenant · /tenant/context · /tenant/branches
orders        5   GET/POST /orders · GET /orders/board · GET /orders/:id · PATCH /orders/:id/status
tables        6   CRUD /tables · PATCH /tables/:id/status
reservations  5   CRUD /reservations · PATCH /reservations/:id/status
catalog      14   categorías, platos, modificadores y asignación a platos
pricing       8   listas, precios, activar, resolver
promotions   10   combos, cupones, validar, horarios
cash          7   turnos, movimientos, cobro
receipts      4   listar, detalle, emitir, anular
expenses      5   listar, resumen, alta, editar, pagar
inventory     3   stock, movements, alerts/check
staff        10   empleados, turnos, asistencia, propinas
crm          10   clientes, ficha, puntos, config, process
bi            4   pnl, pnl/daily, top-dishes, sales-by-method
saas          8   tenants, suspender, reactivar, plan, historial, métricas
onboarding    1   POST /onboarding (público, rate limit)
```

### 7.2 Cómo abrir un issue (checklist de 30 segundos)

1. ¿Es un defecto, una mejora o deuda? → tipo.
2. ¿A qué módulo pertenece? → componente + etiqueta.
3. ¿Severidad? → S1–S4 según impacto.
4. ¿Se reproduce? → pasos + evidencia.
5. ¿Cómo sabremos que está cerrado? → criterio de aceptación.
6. Asignar al dueño; backup como reviewer.

### 7.3 Reglas de convivencia entre módulos

- Nadie mergea en un módulo sin review del dueño o su backup.
- Un cambio de contrato (endpoint, payload, evento) exige RFC de 1 página y aviso en el canal.
- El dueño puede rechazar un issue mal formado y pedir la plantilla.
- La deuda del módulo se registra como issue S3/S4, no como comentario en el código.
