# TAREAS — Semanas 15 y 16: CRM, RRHH, BI y cierre

**Rango:** 2026-12-02 → 2026-12-09
**Épica:** AYCDS-9 — «CRM, RRHH, BI y cierre S15-S16»
**Base:** `development` · **Regla:** un PR por tarea desde `development`, revisado por otra persona.

## 1. Resumen ejecutivo

| Indicador | Valor |
|---|---|
| Tareas del rango | **8** |
| En revisión (PR) | **2** |
| Por hacer | **6** |
| Avance global (promedio simple) | **25%** |

**Diagnóstico:** el CRM y el RRHH ya tienen API (PR #32 y PR #33, en revisión): comensales con segmento derivado y puntos por consumo, y personal con turnos, marcación y reparto de propinas exacto. Falta lo que cierra el ciclo: **BI** (P&L y ranking de platos), las **vistas de base** que lo alimentan, las **dos UI** que consumen CRM y RRHH, y el **QA integral con Docker** que valida todo el sistema antes de la sustentación.

> **Pendiente heredado de S11–S12:** AYCDS-46 quedó al 60 % (caja lista, `ComprobantesView` pendiente por el mock SUNAT) y AYCDS-50 (acta) depende de ella.

## 2. Tabla maestra

| Jira | Tarea | Sem. | Responsable | Estado Jira | Avance | Ya existe | Falta |
|---|---|---|---|---|---|---|---|
| AYCDS-31 | [51.0] API CRM recategoriza VIP puntos | 15 | David Piñarreta | En revisión | 100% | Módulo `crm` (PR #32): segmento por visitas, worker de puntos, ajuste manual y config | — |
| AYCDS-33 | [52.0] API RRHH turnos asistencia propinas | 15 | David Piñarreta | En revisión | 100% | Módulo `staff` (PR #33): turnos, marcación y pozo de propinas exacto | — |
| AYCDS-35 | [53.0] Endpoints BI P&L ranking platos | 16 | David Piñarreta | Por hacer | 0% | Órdenes, caja, comprobantes, gastos y propinas con datos reales | Módulo `bi` con P&L, ranking de platos y series |
| AYCDS-38 | [54.0] Vistas BI + backup restore final | 16 | Sonny De La Cruz | Por hacer | 0% | Migración inicial con 4 vistas, RLS y triggers | Vistas materializadas/índices de BI y guion de restore probado |
| AYCDS-40 | [55.0] UI CRM comensales fidelización | 16 | Diego Arévalo | Por hacer | 0% | `ClientesView` (mock) | Conectar ficha, segmentos, puntos y canjes a `/crm` |
| AYCDS-45 | [56.0] UI RRHH y analíticas | 16 | Joshua Chávez | Por hacer | 0% | `StaffAttendanceView` (mock), `AnaliticasView` (mock) | Conectar turnos/asistencia/propinas y los endpoints de BI |
| AYCDS-49 | [57.0] QA integral CT-01-09 deploy Docker | 16 | Sebastián Chicata | Por hacer | 0% | CI con Postgres, Compose y 6 roles | Corrida integral de controles, despliegue Docker y acta |
| AYCDS-52 | [58.0] Ensayo y sustentación final | 16 | Sebastián Chicata | Por hacer | 0% | Demos y documentación | Guion, ensayo y sustentación |

## 3. Fichas de las tareas de API

### AYCDS-31 — [51.0] API CRM recategoriza VIP y puntos

- **Estado:** En revisión (PR #32) · **Avance:** 100 %
- **Qué entrega:** `GET/POST/PATCH /crm/customers`, ficha con movimientos, historial y ajuste de puntos, `GET/PATCH /crm/config` y `POST /crm/process`.
- **Reglas clave:** el segmento se **deriva** de las comandas `PAGADA` (no se acumula); los puntos por consumo los otorga un **worker** (cron 5 min + proceso manual) idempotente por movimiento `GANANCIA`; el saldo se recalcula desde los movimientos y un canje mayor al saldo da **400**.
- **Evidencia:** 200 unit, 73 e2e, 71 DB y smoke 15/15.

### AYCDS-33 — [52.0] API RRHH turnos, asistencia y propinas

- **Estado:** En revisión (PR #33) · **Avance:** 100 %
- **Qué entrega:** `GET /staff/employees`, CRUD de plan de turnos, marcación con upsert y el flujo de propinas (`calculate` → `confirm`).
- **Reglas clave:** el pozo suma `ordenes.propina` del día; reparten solo `PRESENTE`/`TARDANZA`; reparto **exacto al céntimo**; un pozo por sucursal y día (409); confirmar es idempotente.
- **Evidencia:** 198 unit, 73 e2e, 73 DB y smoke 17/17.

### AYCDS-35 — [53.0] Endpoints BI P&L ranking platos

- **Estado:** Por hacer · **Avance:** 0 %
- **Qué debe hacerse:**
  1. `GET /bi/pnl?desde&hasta&sucursalId`: ingresos (comprobantes `PAGADA`), gastos (`gastos` `PAGADO`), propinas y margen; desglose por día.
  2. `GET /bi/top-dishes?desde&hasta&limit`: ranking por unidades e importe usando `detalles_orden` de órdenes pagadas.
  3. `GET /bi/sales-by-method`: cobros por método desde `movimientos_caja` (INGRESO).
  4. Rango acotado (máx. 12 meses) y agregación en SQL para que RLS no obligue a traer filas al proceso.
  5. Tests unit (cálculo de margen y ranking), e2e (RBAC y rango) y DB (dos empresas, sucursales, propinas).
- **Depende de:** AYCDS-17 (gastos, PR #31) y AYCDS-38 (vistas de Sonny). Sin la 17 no hay P&L completo.
- **Bloquea a:** AYCDS-45 (UI de analíticas).

### AYCDS-38 — [54.0] Vistas BI + backup restore final

- **Estado:** Por hacer · **Avance:** 0 %
- **Qué debe hacerse:**
  1. Vistas (o materializadas) para P&L diario, ranking de platos y ventas por método, con índices de apoyo.
  2. Guion de respaldo y restauración probado (`pg_dump`/`pg_restore` o base temporal) con tiempos medidos.
  3. Documentar RPO/RTO alcanzados y el procedimiento en `docs/` con evidencia.
- **Depende de:** nada (los datos existen).
- **Bloquea a:** AYCDS-35 (ideal: consumir las vistas) y AYCDS-49.

## 4. Fichas de UI y QA

- **AYCDS-40 (Diego):** `ClientesView` contra `/crm/customers` (lista con segmento, búsqueda, ficha con movimientos) y canje de puntos con `ConfirmDialog`. Depende de **31**.
- **AYCDS-45 (Joshua):** `StaffAttendanceView` contra `/staff` (turnos, marcación, pozo con reparto) y `AnaliticasView` contra `/bi` (P&L y ranking). Depende de **33** y **35**.
- **AYCDS-49 (Sebastián):** corrida integral de los controles `CT-01`…`CT-09`, despliegue con `docker compose` en volumen limpio y acta con evidencias. Depende de todo lo anterior.
- **AYCDS-52 (Sebastián):** guion de demo por rol, ensayo cronometrado y sustentación.

## 5. Dependencias

```text
31 CRM (API) ──► 40 UI CRM
33 RRHH (API) ──► 45 UI RRHH
17 gastos (S13-S14) ──┐
34 caja ──────────────┤
36 comprobantes ──────┼─► 35 BI ──► 45 UI analíticas
38 vistas BI ─────────┘
todo ──► 49 QA integral ──► 52 sustentación
46 p2 comprobantes ──► 50 acta (heredado de S11-S12)
```

**Ruta crítica:** `38 → 35 → 45 → 49 → 52`. La **40** es independiente en cuanto entre la 31.

## 6. Orden de PRs

| Orden | Tarea | Rama | Condición |
|---|---|---|---|
| 1 | AYCDS-38 | `feat/aycds-38-vistas-bi-sonny` | Base `development` |
| 2 | AYCDS-35 | `feat/aycds-35-bi-pyl` | Base con 38 y 17 mergeadas |
| 3 | AYCDS-40 | `feat/aycds-40-ui-crm-diego` | Base con 31 mergeada |
| 4 | AYCDS-45 | `feat/aycds-45-ui-rrhh-joshua` | Base con 33 y 35 |
| 5 | AYCDS-49 | `test/aycds-49-qa-integral-sebastian` | Todo mergeado |
| 6 | AYCDS-52 | `docs/aycds-52-sustentacion-sebastian` | Cierre |

## 7. DoD

El mismo de S11–S12: funciona contra la API real, RBAC y aislamiento probados, unit + e2e (+DB si toca datos), `lint`/`check-types`/`build` y **CI verde**, smoke real cuando haya Postgres, docs actualizadas, y Jira en **Listo** solo después del merge.

## 8. Bitácora

| Fecha | Tarea | Responsable | Qué | Evidencia |
|---|---|---|---|---|
| 2026-11-06 | plan | David Piñarreta | Ficha de S15-S16 con las 8 tareas, dependencias y ruta crítica; se documenta el estado real (31 y 33 en revisión) | Este archivo |
| 2026-11-06 | 31 | David Piñarreta | CRM: segmento derivado, worker de puntos, canje y config | PR #32: 200 unit, 73 e2e, 71 DB, smoke 15/15 |
| 2026-11-06 | 33 | David Piñarreta | RRHH: turnos, marcación y pozo de propinas exacto | PR #33: 198 unit, 73 e2e, 73 DB, smoke 17/17 |
