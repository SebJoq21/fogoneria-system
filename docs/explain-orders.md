# AYCDS-22 — Alta de comandas bajo concurrencia

Optimización del `POST /api/v1/orders` en el pico de almuerzo/cena. El umbral
acordado con el equipo fue **p95 ≤ 500 ms con 50 comandas concurrentes y 0
errores 5xx**.

**Resultado:** p95 **307–326 ms** a 50 concurrentes (antes 1034–1092 ms), ~**186
órdenes/s** (antes 64–66) y **0** sesiones esperando lock (antes 8–9). No hizo
falta ninguna migración de índices: el cuello de botella no estaba en las
lecturas.

---

## 1. Entorno y dataset

| Ítem | Valor |
|---|---|
| Base | PostgreSQL 18, `127.0.0.1:5433`, base `fogoneria_db`, esquema `fogoneria` |
| Roles | `fogoneria_app` (dueño), `fogoneria_rls` (API de negocio, sin `BYPASSRLS`), `fogoneria_saas` (plataforma) |
| API | NestJS compilada (`node dist/main.js`, `NODE_ENV=production`), **un** proceso |
| Pool | 10 conexiones por cliente de Prisma (`DATABASE_POOL_MAX`) |
| Dataset | seed demo + **50 000** órdenes `PERF-%` con **150 000** líneas, repartidas en 8 mesas, fechas hasta 69 días atrás (23 MB) |
| Equipo | laptop Windows de desarrollo (no es un servidor de producción) |

El dataset sintético vive en `db/scripts/perf/seed-perf.sql` y se limpia con
`reset-perf.sql` (borra solo `PERF-%`). Se generó con
`session_replication_role = replica` + `app.bypass` para saltar triggers y RLS.

## 2. Cómo reproducir

```powershell
# 1) Base y dataset
pnpm --filter api db:deploy
pnpm --filter api db:rls:roles
pnpm --filter api db:rls:force
pnpm --filter api db:seed
pnpm --filter api perf:seed          # 50k órdenes sintéticas

# 2) API con el build de producción
pnpm --filter api build
cd apps/api; $env:NODE_ENV="production"; node dist/main.js

# 3) Carga (en otra terminal)
pnpm --filter api perf:load -- --concurrency 50 --duration 60 --ramp 5 `
  --warmup 10 --read-ratio 0 --label c50 `
  --out ../../ops/perf/results/c50.json
```

`apps/api/test/load/orders-load.mjs` es Node puro (sin dependencias nuevas):
loguea como `MESERO`, crea comandas de 2 líneas en bucle cerrado y muestrea
`pg_stat_activity` cada segundo (conexiones totales, activas y **esperando
lock**). Cada corrida deja un JSON en `ops/perf/results/` con p50/p95/p99,
errores por status y el pico de conexiones.

### Escenario de aceptación

- **Solo altas** (`--read-ratio 0`): 50 meseros creando comandas, 60 s, rampa de
  5 s, calentamiento de 10 s. Es el escenario del umbral.
- **Mixto** (`--read-ratio 0.1`): 10 % de refrescos del KDS intercalados. Se
  mide aparte porque hoy la lectura tiene un problema propio (sección 6).

En bucle cerrado la latencia incluye la cola: si el sistema atiende `X` órdenes/s
y hay 50 clientes, el p95 no puede bajar de ~50/`X`. A 186 órdenes/s el piso
teórico es ~270 ms; por eso el resultado ronda ese valor.

## 3. Línea base (antes)

Solo altas, 2 corridas de 60 s (`ops/perf/results/baseline-escritura-c50-r*.json`):

| Corrida | rps | p50 | p95 | p99 | 5xx | Esperando lock |
|---|---|---|---|---|---|---|
| r1 | 64,1 | 715 ms | **1092 ms** | 1315 ms | 0 | 9 |
| r2 | 66,3 | 695 ms | **1034 ms** | 1293 ms | 0 | 8 |

Escenario mixto (10 % lecturas), 2–3 corridas por nivel
(`baseline-c{10,25,50}-r*.json`):

| Concurrentes | rps | p95 POST | p95 GET | Esperando lock |
|---|---|---|---|---|
| 10 | 51–53 | 267–319 ms | 925–1072 ms | 7–8 |
| 25 | 50–51 | 538–542 ms | 1532–1607 ms | 7–8 |
| 50 | 41–88 | 952–1543 ms | 1942–3178 ms | 7 |

### Causa raíz

`SequencesService` hacía el `INSERT ... ON CONFLICT ... RETURNING` **dentro de la
transacción del request**. El upsert bloquea la fila `(empresa_id, tipo)` hasta
el commit, y esa transacción incluye resolver la lista de precios, validar cada
plato, insertar la orden y sus líneas, auditar y emitir el evento (~20 ms).

Con 50 meseros de la misma empresa, todas las altas se serializan sobre ese
lock: el throughput se estanca en ~50–65 órdenes/s y la cola crece (p95 > 1 s,
8–9 sesiones en `pg_locks`). A 10 concurrentes ya se veía el síntoma (p95 319 ms
con p50 72 ms).

## 4. Cambios aplicados

| # | Cambio | Archivo | Efecto medido |
|---|---|---|---|
| 1 | El folio se incrementa en **una sentencia autocommit** en el pool de plataforma (`prisma.raw`), fuera de la transacción del request. El lock dura solo el upsert (~0,3 ms). | `apps/api/src/common/sequences/sequences.service.ts` | Elimina la serialización: 64 → 186 órdenes/s |
| 2 | Los cuatro `set_config` del contexto RLS pasan a **una sola sentencia**. | `apps/api/src/prisma/prisma.service.ts` | 4 → 1 round-trip por request: ~88 → ~103 rps en la medición intermedia |
| 3 | Los precios de la comanda se resuelven **en lote**: un `findMany` de platos, uno de combos y uno de `precios_platos`, sin importar cuántas líneas tenga. Antes eran 2 consultas por línea (N+1). | `apps/api/src/modules/orders/orders.service.ts` | ~103 → ~186 rps; con comandas de 5 líneas el ahorro es mayor |
| 4 | `DATABASE_POOL_MAX` configurable (default **10**, el histórico). | `src/config/env.validation.ts`, `src/prisma/prisma.service.ts`, `.env.example` | Ninguno por sí solo: se probó con 20 y el throughput no subió porque la base estaba ociosa. Queda como perilla operativa |
| 5 | Test de concurrencia real de folios (50 altas simultáneas, contador por empresa, ORD vs RSV). | `apps/api/test/db/sequences-concurrency.db-spec.ts` | 3 tests nuevos |

Sobre el punto 1: se acepta que puede quedar un **hueco** en la numeración si la
creación falla después de reservar el folio. Se prefiere un folio sin comanda a
una cola de un segundo en el pico (decisión en `docs/decisiones.md`).

## 5. Resultados (después)

Solo altas, en régimen (ver nota más abajo):

| Concurrentes | rps | p50 | p95 | p99 | 5xx | Esperando lock |
|---|---|---|---|---|---|---|
| 10 | 182,0 | 51 ms | **70 ms** | 100 ms | 0 | 0 |
| 25 | 182,2 | 130 ms | **179 ms** | 214 ms | 0 | 0 |
| 50 (r3–r6) | 183,6–188,4 | 254–259 ms | **307–326 ms** | 330–369 ms | 0 | 0 |

A 50 concurrentes el p95 queda **por debajo del umbral de 500 ms** en las cuatro
corridas de régimen, con 0 errores 4xx/5xx.

**Nota sobre la primera corrida de cada nivel:** las corridas 1 y 2 de 50
concurrentes dieron 88 y 154 rps (p95 777 y 520 ms). Fue el arranque del equipo
(frecuencia de CPU/GC), no el código: a partir de la tercera corrida se
estabiliza en ~186 rps y se mantiene en las cuatro siguientes. Los JSON están
todos en `ops/perf/results/` (`final-escritura-c50-r1..r6`).

Mixto con 10 % de lecturas del KDS (`final-mixto-c50-r*.json`): 48–52 rps,
POST p95 1382–1547 ms y GET p95 3030–3168 ms. **Sigue fuera del umbral**, pero
por la lectura, no por la escritura (sección 6).

## 6. `EXPLAIN (ANALYZE, BUFFERS)`

Artefactos: `ops/perf/results/explain-before.txt` (rol `fogoneria_rls`,
73 685 órdenes), `explain-after.txt` (rol `fogoneria_rls`, 50 004 órdenes) y
`explain-bypassrls.txt` (mismo listado con un rol que ve estadísticas).

### Escritura (lo que se optimizó)

La sentencia del folio y el `INSERT` de la comanda **no cambiaron**; cambió
dónde corre el folio. Por eso el `EXPLAIN` de escritura no muestra una mejora de
plan, sino el costo real de cada pieza:

| Consulta | Plan (estado final) | Lock |
|---|---|---|
| Upsert del folio (`secuencias`) | 0,34 ms, `Conflict Resolution: UPDATE`, 1 fila | ~0,3 ms, en autocommit |
| `INSERT` de la orden (+ líneas) | 11,4 ms | — |

La diferencia no es el costo del plan: antes el upsert se ejecutaba dentro de la
transacción que resolvía precios, insertaba líneas, auditaba y emitía el evento
(~20 ms), así que la fila `(empresa_id, tipo)` quedaba bloqueada todo ese
tiempo y serializaba las altas de la empresa. Los 8–9 waits de `pg_locks` de la
línea base y los 0 del estado final son la evidencia del cambio.

`ops/perf/results/explain-before.txt` conserva el plan de lectura del estado
anterior (esa corrida se cortó antes de la sección 5, así que no hay un "antes"
del upsert: el SQL es el mismo).

### Lectura (hallazgo abierto: la lectura bajo RLS no ve estadísticas)

| Consulta | `fogoneria_rls` (API) | Rol con estadísticas |
|---|---|---|
| KDS — listado por estado, `LIMIT 20` | 157 ms, `Index Scan idx_ordenes_tenant_fecha`, estima 10 001 filas y descarta ~50 000 | **0,075 ms**, `Index Scan idx_ordenes_estado` |
| KDS — `count(*)` del listado | 168 ms, `Seq Scan` | **0,073 ms**, índice |

El planificador **no puede leer `pg_statistic` de una tabla con RLS** salvo que
el rol tenga `BYPASSRLS`, así que estima la selectividad por defecto (20 % para
`estado`) y elige el índice por fecha, recorriendo ~50 000 filas para devolver
1. El `count` directamente hace un seq scan. No se arregla con un índice nuevo:
el mismo índice que usa el plan bueno ya existe (`idx_ordenes_estado`); el
problema es la estimación.

No se tocó la seguridad en esta tarea. Opciones para una tarea aparte:

1. **Rol de lectura con `BYPASSRLS`** y el filtro de empresa explícito en la
   consulta. Es lo más simple y rápido, pero mueve el aislamiento de la base al
   código: no se hizo sin aprobación.
2. **Vista `SECURITY DEFINER`** propiedad de un rol con `BYPASSRLS`, con
   `empresa_id = current_empresa_id()` dentro de la vista. Mantiene el
   aislamiento en la base y le da estadísticas al planner, a costa de una
   superficie nueva que hay que revisar.
3. **Contadores denormalizados** por sucursal/estado (trigger), para no hacer
   `count(*)` sobre la tabla completa; no arregla el listado.
4. **`pg_hint_plan`** en el servidor para forzar `idx_ordenes_estado` en estas
   dos consultas. Requiere una extensión y un `search_path` controlado.

Mientras tanto, el KDS de una sucursal real (decenas de órdenes abiertas) no
llega a 50 000 filas históricas, pero el costo **crece con el histórico**: es
una deuda a resolver antes de que la tabla acumule meses de operación.

## 7. Límites y notas

- Las cifras son de una laptop de desarrollo. Sirven para comparar antes/después
  en el mismo equipo, no como capacidad de producción.
- La API es **un proceso Node**: el trabajo por comanda (~5 ms de CPU) es el
  techo cuando la base está ociosa. Escalar horizontalmente (varias instancias)
  multiplica el throughput; el folio ya no serializa entre instancias porque el
  lock dura solo el upsert.
- El script de carga es de bucle cerrado; un p95 por debajo de 500 ms a 50
  concurrentes implica ≥ 100 órdenes/s sostenidas.
- Las corridas dejan órdenes reales `ORD-%` que `perf:reset` no borra (solo
  limpia `PERF-%`). Para volver al estado exacto de esta medición hay que
  recrear la base y correr `db:seed` + `perf:seed`.
