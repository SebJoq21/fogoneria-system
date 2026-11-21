# Plan de módulos, revisión y flujo de issues

**Fecha:** 2026-11-18 · **Base:** `development` · **Alcance:** todo el sistema (API + web + datos + infraestructura).

**Modelo vigente:** propiedad **colectiva**. Todos trabajamos en todos los módulos; lo que se formaliza no es «quién es dueño» sino **cómo se revisa y cómo se reporta**:

1. **Nadie aprueba su propio PR**: se exige la aprobación de otra persona (CODEOWNERS + branch protection).
2. **Un PR = un módulo**: el alcance se valida en CI (`pr-scope`).
3. **Toda observación entra like issue** con su componente de Jira y su severidad.

---

## 1. Resumen ejecutivo

- **Backend:** 20 módulos, **106 endpoints**, `ValidationPipe` global, RLS por empresa/sucursal y Swagger. **Completo** para el plan.
- **Frontend:** 33 rutas de app. La mayoría consume la API; quedan 4 pantallas de negocio en mock (gastos, combos, promociones y el maestro de inventario) y 4 heredadas sin tarea (pagos, soporte, configuración, carta).
- **Calidad:** API **302 unit · 112 e2e · 109 DB**; web **148**; `lint`, `check-types` y `build` en verde; CI con Postgres real.
- **Proceso:** antes no había propiedad formal ni canal único para observaciones. Desde hoy: `CODEOWNERS` (revisión cruzada), plantilla de PR, chequeo de alcance por módulo y plantilla de issue.

**Estado global ponderado por módulo: ~88 %.** Lo que falta es UI específica y dos flujos heredados.

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
| `/app/modulos/personal/asistencia` | `StaffAttendancePage` (`features/rrhh`) | **API** |
| `/app/modulos/personal/turnos` | `StaffShiftsPage` (`features/rrhh`) | **API** |
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

| Módulo | Backend | UI | Estado | Qué falta |
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
| Heredadas (pagos, soporte, configuración, carta) | — | ❌ | **0 %** | Decidir retirar o convertir en módulo con tarea |

---

## 3. Propiedad colectiva y reglas de revisión

### 3.0 Modo «avance masivo» (vigente)

El equipo decidió priorizar un **avance grande de módulos** antes de formalizar la revisión obligatoria:

- **Activo ahora:** un PR por módulo (validado en CI), issues por módulo con etiqueta, plantilla de PR y triage.
- **Diferido:** `CODEOWNERS` y la protección de rama (1 aprobación obligatoria). Se activan **al cerrar el avance masivo**, para no frenar el ritmo.
- **Mientras dure:** se sigue revisando por otra persona cuando se pueda, pero el merge no se bloquea por ello.

### 3.1 Principios

- **Todos son code owners.** Cualquiera revisa cualquier módulo; no hay silos.
- **Nadie aprueba ni mergea su propio PR** cuando la protección esté activa; GitHub ya bloquea la auto-aprobación y la protección añade **1 aprobación** de otra persona.
- **Guardia semanal rotativa**: una persona por semana hace el triage inicial de todos los módulos y asigna; no es dueño, es el embudo.

### 3.2 `CODEOWNERS` (diferido)

Aún **no** se crea `.github/CODEOWNERS`. Cuando termine el avance masivo se añade:

```gitignore
* @SebJoq21 @SOoOnny
```

Al sumar gente se agrega su handle. Con **«Require review from Code Owners»** activo, cualquier PR necesitará la aprobación de alguien de esa lista distinto del autor.

### 3.3 Protección de `development` (diferida)

Se configura **después del avance masivo**. Settings → Branches → `development`:

- [ ] Require a pull request before merging
- [ ] Require approvals: **1**
- [ ] Dismiss stale pull request approvals when new commits are pushed
- [ ] **Require review from Code Owners**
- [ ] Require status checks: `Lint, tipos y pruebas` **y** `Un PR por módulo`
- [ ] Require conversation resolution before merging
- [ ] Do not allow bypassing the above settings
- [ ] Allow auto-merge (apagado)
- [ ] Allow force pushes (apagado)

> Lo ideal es aplicar lo mismo a `main`.

### 3.4 Regla: **un PR = un módulo**

**Definición.** Un PR puede tocar **un solo módulo de negocio** (backend + su UI + su cliente API). Los archivos compartidos no cuentan como módulo: docs, CI, tests, migraciones, design system, configuración raíz.

**Cómo se valida.** `scripts/check-pr-scope.mjs` clasifica el diff y el job **`Un PR por módulo`** de CI falla si detecta más de un módulo:

```
❌ Un PR = un módulo. Este toca 2: rrhh, bi.
...
Separa el trabajo en un PR por módulo.
```

- Se ejecuta solo en `pull_request` contra `development`/`main`.
- Clasificación: `apps/api/src/modules/<módulo>`, `apps/web/lib/<módulo>-api.ts`, vistas conocidas (`CajaView`, `OrdersView`, …) y rutas (`/app/caja`, `/app/analiticas`, …).
- **Excepción controlada:** etiqueta **`multi-modulo`** en el PR (refactor de contrato que cruza módulos de verdad). Debe justificarse en la descripción y aprobarla el equipo.

**Ejemplos:**

| PR | Archivos | Resultado |
|---|---|---|
| Caja: `cash` + `CajaView` + `cash-api` | un módulo | ✅ |
| Turnos y analíticas en el mismo PR | `rrhh` + `bi` | ❌ (ya pasó en #43; la regla rige desde hoy) |
| Migración + módulo de inventario | `inventario` + `shared` (prisma) | ✅ |
| Docs + CI | solo compartidos | ✅ |

### 3.5 Guardia semanal y triage

- El **guardia** revisa los issues nuevos cada día (15 min), asigna componente/severidad y busca reviewer.
- Cualquiera puede tomar un issue; el guardia solo garantiza que **ninguno quede sin respuesta**.
- Rotación semanal. La tabla de guardias vive en el tablero de Jira (o en el canal del equipo).

---

## 4. Issues por módulo

### 4.1 Dónde vive un issue

En **Jira (AYCDS)** con:

- **Componente** = módulo (lista en §4.2).
- **Etiqueta** `modulo:<nombre>` para filtros cruzados.
- **Assignee**: quien lo toma en el triage (no un dueño fijo).
- **Reviewer**: otra persona (nunca el autor).

### 4.2 Componentes de Jira

`catalogo` · `promociones` · `ordenes-kds` · `mesas-reservas` · `caja` · `comprobantes` · `inventario` · `gastos` · `crm` · `rrhh` · `bi` · `plataforma` · `datos-infra` · `ci-qa` · `design-system`.

### 4.3 Plantilla de issue (obligatoria)

```
## Módulo
[componente]

## Tipo
Defecto | Mejora | Deuda técnica | Decisión

## Severidad
S1 (bloquea demo/operación) | S2 (afecta un flujo) | S3 (molesto) | S4 (idea)

## Qué pasa
[resultado observado vs esperado, 1–3 líneas]

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

### 4.4 SLA y flujo

| Severidad | Triage | Resolución objetivo |
|---|---|---|
| **S1** | 4 h hábiles | 24 h |
| **S2** | 1 día | 3 días |
| **S3** | 3 días | 10 días |
| **S4** | 1 semana | Backlog priorizado |

```
Nuevo → Triage (guardia, 1 día) → Listo (DoR) → En curso → Revisión (otra persona) → Hecho (DoD)
                                                              ↘ Bloqueado (dependencia cross-módulo)
```

- **DoR:** módulo, pasos reproducibles, criterio de aceptación y severidad.
- **DoD:** tests verdes, `lint`/`types`, docs si cambia el contrato, **PR revisado por otra persona** y evidencia en el issue.
- **Cross-módulo:** el issue se abre en el **módulo dueño del contrato** (ej. una comanda que falla al cobrar → `caja`) y se enlaza el del módulo afectado. Si el cambio cruza módulos, el PR lleva `multi-modulo` y lo aprueban ambos revisores.

### 4.5 Ritual semanal (30 min)

1. **Salud por módulo** (15 min): S1/S2 abiertos, bloqueados, PRs sin reviewer.
2. **PRs** (10 min): quién revisa qué (nadie revisa lo suyo).
3. **Cross-módulo** (5 min): etiquetas `multi-modulo` pendientes y contratos que cambian.

**Métricas del mes:** PRs con review de otra persona **100 %** · PRs de un solo módulo ≥ 90 % · triage < 1 día · lead time por severidad · defectos escapados a demo · cobertura por módulo.

---

## 5. Observaciones detectadas (backlog inicial de issues)

| # | Módulo | Sev. | Observación | Acción propuesta |
|---|---|---|---|---|
| 1 | `inventario` | S2 | El maestro de insumos y el ajuste con motivo siguen en demo: no hay `GET/POST/PATCH /inventory/items` ni `POST /inventory/items/:id/adjust`. | Crear endpoints + conectar `InventoryModule`; cierra el 20 % de AYCDS-24. |
| 2 | `gastos` | S2 | `GastosView` no consume `/expenses` (5 endpoints listos). | Crear `lib/expenses-api.ts` y conectar (AYCDS-27). |
| 3 | `promociones` | S2 | `CombosView`/`PromocionesView` no consumen `/promotions` (10 endpoints listos). | Crear `lib/promotions-api.ts` y conectar (AYCDS-27). |
| 4 | `ordenes-kds` | S2 | «Cerrar cuenta» intenta `PATCH /orders/:id/status` con `PAGADA` y recibe **400**; el usuario ve error aunque la comanda avanzó. | Derivar a Caja o mostrar guía; test de regresión. |
| 5 | `comprobantes` | S3 | SUNAT «pendiente de OSE»; no hay CDR real. | Mantener explícito y planificar integración OSE. |
| 6 | `rrhh` | S2 | Directorio, roles y propinas siguen en demo. | Conectar o retirar del menú. |
| 7 | `heredadas` | S3 | Pagos, soporte, configuración y carta son mock sin tarea Jira. | Decisión: retirar o crear módulo con tarea. |
| 8 | `plataforma` | S2 | Faltaba protección de rama y revisión cruzada. | **Implementado**: CODEOWNERS, plantilla y CI `pr-scope`; falta activar la protección en GitHub (§3.3). |
| 9 | `datos-infra` | S3 | `tenant` sin unit test; `billing`, `audit` y `realtime` sin e2e propio. | Cobertura mínima por módulo. |
| 10 | `datos-infra` | S3 | KDS bajo RLS no ve estadísticas y recorre la tabla (deuda documentada). | Medir y decidir vista `SECURITY DEFINER` o contadores. |
| 11 | `design-system` | S4 | Recharts avisa `width(0) height(0)` en varias vistas. | Revisar contenedores y fijar alto mínimo. |
| 12 | `ci-qa` | S3 | No hay E2E full-stack (Playwright). | AYCDS-49: flujo mesa → cocina → caja → comprobante. |
| 13 | `plataforma` | S3 | Rate limit de onboarding en memoria (no multi-instancia). | Migrar a Redis con más de una instancia. |
| 14 | `comprobantes` | S4 | Listado sin paginación en UI (API sí soporta). | Añadir paginación cuando crezca el volumen. |

---

## 6. Plan de implantación

### Semana 1 — Habilitar el proceso (en curso)

- [x] Plantilla de PR con módulo, checklist y revisión cruzada.
- [x] Chequeo `Un PR por módulo` en CI + etiqueta `multi-modulo`.
- [ ] Crear los 15 componentes en Jira + etiqueta `modulo:*` y la plantilla de issue (los componentes son manuales en la UI).
- [ ] Convertir las observaciones 1–8 en issues con etiqueta de módulo y severidad.
- [ ] Publicar la rotación de guardias semanales.
- [ ] **Diferido:** `CODEOWNERS` y protección de rama, al cerrar el avance masivo (§3.2 y §3.3).

### Semana 2 — Operar

- [ ] Triage completo del backlog por el guardia; cada issue con componente y reviewer.
- [ ] Sprint por módulos: cerrar `gastos` (2), `promociones` (3) y `cerrar cuenta` (4) en **tres PRs separados**.
- [ ] README corto por módulo: contrato, endpoints, tests y cómo correrlo.
- [ ] Tablero Jira por componente con filtros guardados.

### Semana 3 — Medir, ajustar y formalizar

- [ ] Revisión de salud con las métricas de §4.5.
- [ ] Decidir pantallas heredadas (7).
- [ ] Planificar inventario maestro (1) y E2E (12).
- [ ] Retro de 30 min: PRs que se trabaron por revisión o por alcance.
- [ ] **Al cerrar el avance masivo:** crear `CODEOWNERS`, activar la protección de `development` (1 aprobación + Code Owners + checks) y pasar a revisión obligatoria.

**Criterio de éxito del avance masivo:** ≥ 90 % de PRs de un solo módulo · 0 issues sin etiqueta de módulo · triage < 1 día · observaciones 1–4 cerradas o en curso. (La revisión obligatoria por otra persona se mide recién al activar la protección.)

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

### 7.2 Clasificación del chequeo `pr-scope`

| Ruta | Módulo |
|---|---|
| `apps/api/src/modules/<m>/` | según mapa (`catalog`→catalogo, `cash`→caja, …) |
| `apps/web/lib/<m>-api.ts` | según mapa |
| `apps/web/features/catalog/**` | catalog |
| `OrdersView`, `MozoView`, `AccountPanel`, `useOrdersRealtime` | ordenes |
| `BookingsModule`, `SalonTablesView` | mesas |
| `CajaView` / `ComprobantesView` | caja / comprobantes |
| `InventoryModule`, `InventoryMovementsView` | inventario |
| `GastosView` / `CombosView`, `PromocionesView` | gastos / promociones |
| `ClientesView`, `LoyaltyModule` | crm |
| `Staff*View`, `StaffModule`, `RolesView` | rrhh |
| `AnaliticasView` | bi |
| `app/app/{caja,analiticas,…}/page.tsx` | por ruta |
| docs, tests, prisma, `.github`, `scripts`, `components/ui`, `dashboard` | compartido (no cuenta) |

### 7.3 Cómo abrir un issue (30 segundos)

1. ¿Defecto, mejora o deuda? → tipo.
2. ¿Módulo? → componente + etiqueta.
3. ¿Severidad? → S1–S4.
4. ¿Se reproduce? → pasos + evidencia.
5. ¿Cuándo se cierra? → criterio de aceptación.
6. Asignar; reviewer = otra persona.

### 7.4 Reglas de convivencia

- Nadie aprueba ni mergea su propio PR.
- Un PR toca un módulo (o lleva `multi-modulo` justificado).
- Un cambio de contrato exige RFC de 1 página y aviso al equipo.
- La deuda se registra como issue S3/S4, no como comentario en el código.
