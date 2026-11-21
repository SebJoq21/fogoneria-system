# Índice de `docs/`

Portada de la documentación histórica y operativa del proyecto. Para el **estado actual por módulo** empieza en [specs/README](../specs/README.md); para la memoria de la última sesión, [SESION](SESION.md).

> Última revisión: 2026-11-19.

## Cómo se organiza

| Bloque | Qué responde | Documentos |
|---|---|---|
| **Arquitectura** | Cómo está construido y por qué | [arquitectura](arquitectura.md), [MODULARIZACION](MODULARIZACION.md), [plan-paridad-modulos](plan-paridad-modulos.md), [decisiones](decisiones.md) |
| **Datos** | Modelo, aislamiento, errores y respaldo | [modelo-datos](modelo-datos.md), [rls-modelo](rls-modelo.md), [errores-db](errores-db.md), [respaldo-recuperacion](respaldo-recuperacion.md), [bi-vistas](bi-vistas.md) |
| **Operación** | Cómo se despliega y se mide | [despliegue](despliegue.md), [explain-orders](explain-orders.md), [explain-rls](explain-rls.md), [websockets](websockets.md) |
| **Calidad** | Qué se probó y con qué evidencia | [acta-qa-aycds-66](acta-qa-aycds-66.md), [acta-qa-aycds-50](acta-qa-aycds-50.md) |
| **Seguimiento** | Qué se planificó y en qué estado quedó | [TAREAS-SEMANAS-5-8](TAREAS-SEMANAS-5-8.md), [TAREAS-SEMANAS-9-10](TAREAS-SEMANAS-9-10.md), [TAREAS-SEMANAS-11-12](TAREAS-SEMANAS-11-12.md), [TAREAS-SEMANAS-13-14](TAREAS-SEMANAS-13-14.md), [TAREAS-SEMANAS-15-16](TAREAS-SEMANAS-15-16.md), [PLAN-MODULOS-Y-PROPIEDAD](PLAN-MODULOS-Y-PROPIEDAD.md), [backlog](backlog.md) |
| **Sesión** | Qué se hizo en la última sesión y cuál es el próximo paso | [SESION](SESION.md) |

## Arquitectura y decisiones

- **[arquitectura.md](arquitectura.md)** — mapa del sistema: rutas web, módulos API, BFF, sesión, WebSockets, datos.
- **[MODULARIZACION.md](MODULARIZACION.md)** — fases 0–4, reglas de dependencia, baseline de fronteras y criterios de aceptación por módulo.
- **[plan-paridad-modulos.md](plan-paridad-modulos.md)** — catálogo canónico de 20 módulos, paridad backend/frontend/contratos/specs, estrategia de rebase y plan por fases.
- **[plan-f6c-pos.md](plan-f6c-pos.md)** — diseño de F6c: `AccountsProvider`, `CashProvider`, `CheckoutCoordinator`, migración y fases para retirar `ModulesProvider`.
- **[decisiones.md](decisiones.md)** — decisiones vigentes (ADR en una línea): Prisma, RLS, sesión, precios, caja, comprobantes, CRM, BI…
- **[PLAN-MODULOS-Y-PROPIEDAD.md](PLAN-MODULOS-Y-PROPIEDAD.md)** — inventario por módulo, regla «un PR = un módulo», severidades y observaciones.

## Datos

- **[modelo-datos.md](modelo-datos.md)** — 43 modelos, 27 enums, ER por dominio, convenciones y migraciones.
- **[rls-modelo.md](rls-modelo.md)** — contrato `app.*`, roles (`fogoneria_app`, `fogoneria_rls`, `fogoneria_saas`), soft-delete e inmutabilidad.
- **[errores-db.md](errores-db.md)** — códigos `DB_*` con SQLSTATE `45000` y su traducción a HTTP.
- **[bi-vistas.md](bi-vistas.md)** — las 6 vistas `v_bi_*`, reglas de cálculo y `security_invoker`.
- **[respaldo-recuperacion.md](respaldo-recuperacion.md)** — RPO ≤24 h / RTO ≤30 min, `db:backup`/`db:restore` y ensayo de restore.

## Operación

- **[despliegue.md](despliegue.md)** — runbook Vercel + Railway, variables, RLS y 8 gotchas. Resumen en [specs/operacion/despliegue](../specs/operacion/despliegue.md).
- **[websockets.md](websockets.md)** — ticket de 60 s, rooms, sobre de eventos y límites (sin Redis adapter).
- **[explain-orders.md](explain-orders.md)** — medición del alta de comandas y del tablero KDS bajo RLS.
- **[explain-rls.md](explain-rls.md)** — evidencia `EXPLAIN` con RLS forzado.
- **[backlog.md](backlog.md)** — pendientes priorizados P0–P3 (visión de producto).

## Calidad

- **[acta-qa-aycds-66.md](acta-qa-aycds-66.md)** — aislamiento multi-tenant, RBAC, sesión/BFF y email global.
- **[acta-qa-aycds-50.md](acta-qa-aycds-50.md)** — matriz CT-FG-03 de caja, cobro y comprobantes.

## Seguimiento de sprints

| Documento | Rango | Qué contiene |
|---|---|---|
| [TAREAS-SEMANAS-5-8](TAREAS-SEMANAS-5-8.md) | S5–S8 | 14 tareas (32, 42, 44, 48, 53, 55, 57, 58, 60, 61, 62, 63, 65, 66) |
| [TAREAS-SEMANAS-9-10](TAREAS-SEMANAS-9-10.md) | S9–S10 | 7 tareas (14, 16, 20, 22, 25, 26, 28) |
| [TAREAS-SEMANAS-11-12](TAREAS-SEMANAS-11-12.md) | S11–S12 | 7 tareas (30, 39, 34, 36, 41, 46, 50) |
| [TAREAS-SEMANAS-13-14](TAREAS-SEMANAS-13-14.md) | S13–S14 | 8 tareas (11, 13, 17, 19, 23, 24, 27, 29) |
| [TAREAS-SEMANAS-15-16](TAREAS-SEMANAS-15-16.md) | S15–S16 | 8 tareas (31, 33, 35, 38, 40, 45, 49, 52) |

La vista consolidada **Jira → módulo → PR → estado → evidencia** está en [specs/trazabilidad](../specs/trazabilidad.md).

## API

- **Swagger:** `http://localhost:3001/api/docs` (runtime).
- **[postman/](postman/)** — colección Postman de la API (`fogoneria-api.postman_collection.json`).

## Sesión

- **[SESION.md](SESION.md)** — estado de la última sesión: hecho con rutas, pendiente y próximo paso. Se actualiza al cerrar un tema, no es una spec.

## Reglas de mantenimiento

1. Un documento nuevo entra en esta portada y, si describe el estado de un módulo, en `specs/`.
2. No mover documentos existentes: hay enlaces en `README.md`, `opencode.json` y specs.
3. Las decisiones arquitectónicas van a `decisiones.md`; el detalle de implementación, a la spec del módulo.
4. `SESION.md` se reescribe por sesión; el historial queda en git y en las bitácoras de sprint.
