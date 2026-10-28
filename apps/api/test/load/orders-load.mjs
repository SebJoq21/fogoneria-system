#!/usr/bin/env node
/**
 * AYCDS-22 — Prueba de carga de comandas (mesero → API → PostgreSQL).
 *
 * No usa dependencias nuevas: Node 24 trae `fetch`. Opcionalmente importa `pg`
 * (ya está en apps/api) para muestrear conexiones y esperas de lock.
 *
 * Qué mide:
 *   - `POST /orders` (alta de comanda) y, con `--read-ratio`, el `GET /orders`
 *     que refresca el KDS.
 *   - Latencia p50/p95/p99, RPS, respuestas por estado y muestras de error.
 *   - Si se pasa `--db-url`: conexiones totales/activas y sesiones esperando
 *     lock (`pg_stat_activity`), que es donde se ve la contención de folios.
 *
 * Uso:
 *   node test/load/orders-load.mjs --concurrency 50 --duration 60 \
 *     --out ../../ops/perf/results/baseline-50.json
 *
 * Requisitos: API arriba y seed demo cargado. El usuario debe poder crear
 * órdenes (`MESERO`, `CAJERO`, `GERENTE_SUCURSAL`, `ADMIN_GLOBAL`).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';

const DEFAULTS = {
  api: 'http://localhost:3001/api/v1',
  email: 'mesero@mirestaurante.com',
  password: 'Fogoneria123!',
  concurrency: 10,
  duration: 30,
  ramp: 0,
  items: 2,
  readRatio: 0.1,
  warmup: 5,
  timeout: 30_000,
  label: 'orders',
  out: null,
  dbUrl: process.env.DATABASE_URL ?? null,
};

function parseArgs(argv) {
  const parsed = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const [flag, inline] = token.slice(2).split('=');
    const value = inline ?? argv[i + 1];
    if (inline === undefined) i += 1;

    switch (flag) {
      case 'api':
        parsed.api = value.replace(/\/$/, '');
        break;
      case 'email':
      case 'password':
      case 'label':
      case 'out':
      case 'db-url':
        parsed[flag === 'db-url' ? 'dbUrl' : flag] = value;
        break;
      case 'items':
      case 'warmup':
      case 'timeout':
        parsed[flag] = Number(value);
        break;
      case 'concurrency':
        parsed.concurrency = Number(value);
        break;
      case 'duration':
      case 'ramp':
        parsed[flag] = Number(value);
        break;
      case 'read-ratio':
        parsed.readRatio = Number(value);
        break;
      case 'help':
        console.log(
          [
            'Opciones:',
            '  --api <url>            base de la API (default http://localhost:3001/api/v1)',
            '  --email/--password     credenciales demo',
            '  --concurrency <n>      workers simultáneos (default 10)',
            '  --duration <s>         segundos de medición (default 30)',
            '  --ramp <s>             segundos de subida gradual (default 0)',
            '  --items <n>            líneas por comanda (default 2)',
            '  --read-ratio <0..1>    proporción de GET /orders (default 0.1)',
            '  --warmup <n>           POSTs de calentamiento excluidos (default 5)',
            '  --label <texto>        nombre del escenario',
            '  --db-url <url>         muestrea pg_stat_activity (omite con --db-url none)',
            '  --out <archivo.json>   guarda el reporte',
          ].join('\n'),
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Opción desconocida: --${flag}`);
    }
  }
  if (parsed.dbUrl === 'none') parsed.dbUrl = null;
  return parsed;
}

const config = parseArgs(process.argv.slice(2));

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function round(value) {
  return Math.round(value * 100) / 100;
}

async function call(path, { method = 'GET', token, body } = {}) {
  const started = performance.now();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const options = { method, headers, signal: AbortSignal.timeout(config.timeout) };
  if (body) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${config.api}${path}`, options);
  const elapsed = performance.now() - started;
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { status: response.status, ms: elapsed, payload };
}

async function login() {
  const result = await call('/auth/login', {
    method: 'POST',
    body: { email: config.email, password: config.password },
  });
  if (result.status !== 200 && result.status !== 201) {
    throw new Error(`Login ${result.status}: ${JSON.stringify(result.payload).slice(0, 300)}`);
  }
  return {
    token: result.payload.accessToken,
    sucursalId: result.payload.user?.sucursalId ?? null,
    rol: result.payload.user?.rol ?? null,
  };
}

async function pickDishes(token) {
  const result = await call('/catalog/dishes', { token });
  if (result.status !== 200) {
    throw new Error(`Catálogo ${result.status}: ${JSON.stringify(result.payload).slice(0, 300)}`);
  }
  const dishes = (result.payload.items ?? result.payload ?? []).filter(
    (dish) => dish.activo !== false && dish.deleted_at == null,
  );
  if (dishes.length === 0) throw new Error('El catálogo no tiene platos activos');

  const unique = [...new Map(dishes.map((dish) => [dish.id, dish])).values()];
  const chosen = unique.slice(0, Math.max(3, config.items)).map((dish) => dish.id);
  if (chosen.length === 0) throw new Error('No se pudo elegir platos para la comanda');
  return chosen;
}

function buildItems(dishIds) {
  return Array.from({ length: config.items }, (_, index) => ({
    tipo: 'PLATO',
    platoId: dishIds[index % dishIds.length],
    cantidad: 1 + (index % 2),
  }));
}

async function startSampler(dbUrl) {
  if (!dbUrl) return () => ({ samples: [], maxTotal: 0, maxActive: 0, maxWaiting: 0 });
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: dbUrl, max: 2 });
  const samples = [];

  const query = `
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE state = 'active')::int AS active,
      count(*) FILTER (WHERE wait_event_type = 'Lock')::int AS waiting
    FROM pg_stat_activity
    WHERE datname = current_database()
  `;

  const timer = setInterval(async () => {
    try {
      const { rows } = await pool.query(query);
      samples.push({ at: Date.now(), ...rows[0] });
    } catch {
      /* la muestra es best-effort */
    }
  }, 1_000);
  timer.unref?.();

  return async () => {
    clearInterval(timer);
    await pool.end();
    const max = (key) => samples.reduce((acc, sample) => Math.max(acc, sample[key] ?? 0), 0);
    return {
      samples: samples.length,
      maxTotal: max('total'),
      maxActive: max('active'),
      maxWaiting: max('waiting'),
    };
  };
}

async function main() {
  const session = await login();
  const dishes = await pickDishes(session.token);
  const body = { items: buildItems(dishes) };
  const stopSampler = await startSampler(config.dbUrl);

  console.log(
    `[AYCDS-22] ${config.label} · ${config.concurrency} concurrentes · ${config.duration}s · ` +
      `${config.items} líneas · rol ${session.rol}`,
  );

  // Calentamiento: deja listo el pool de Prisma, el planner y las cachés de
  // precios sin ensuciar las métricas.
  for (let i = 0; i < config.warmup; i += 1) {
    const result = await call('/orders', { method: 'POST', token: session.token, body });
    if (result.status >= 400) {
      throw new Error(`Warmup ${result.status}: ${JSON.stringify(result.payload).slice(0, 300)}`);
    }
  }

  const measurements = { create: [], read: [] };
  const statuses = { create: new Map(), read: new Map() };
  const errors = [];
  const startAt = performance.now();
  const measureMs = config.duration * 1_000;
  const endAt = startAt + measureMs;

  function record(kind, result) {
    const bucket = measurements[kind];
    if (bucket.length < 400_000) bucket.push(result.ms);
    const counter = statuses[kind];
    counter.set(result.status, (counter.get(result.status) ?? 0) + 1);
    if (result.status >= 400 && errors.length < 10) {
      errors.push({
        kind,
        status: result.status,
        body: JSON.stringify(result.payload)?.slice(0, 240) ?? null,
      });
    }
  }

  async function worker(index) {
    const delay = config.ramp > 0 ? (index / config.concurrency) * config.ramp * 1_000 : 0;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

    while (performance.now() < endAt) {
      const created = await call('/orders', { method: 'POST', token: session.token, body });
      record('create', created);

      if (config.readRatio > 0 && Math.random() < config.readRatio) {
        const read = await call('/orders?limit=20', { token: session.token });
        record('read', read);
      }
    }
  }

  await Promise.all(Array.from({ length: config.concurrency }, (_, index) => worker(index)));
  const elapsedSec = (performance.now() - startAt) / 1_000;
  const database = await stopSampler();

  const createSorted = measurements.create.sort((a, b) => a - b);
  const readSorted = measurements.read.sort((a, b) => a - b);
  const created = measurements.create.length;
  const reads = measurements.read.length;
  const failures = [...statuses.create.entries()]
    .filter(([status]) => status >= 500)
    .reduce((sum, [, count]) => sum + count, 0);
  const clientErrors = [...statuses.create.entries()]
    .filter(([status]) => status >= 400 && status < 500)
    .reduce((sum, [, count]) => sum + count, 0);

  const report = {
    label: config.label,
    startedAt: new Date(startAt).toISOString(),
    api: config.api,
    concurrency: config.concurrency,
    durationSec: config.duration,
    rampSec: config.ramp,
    itemsPerOrder: config.items,
    readRatio: config.readRatio,
    role: session.rol,
    sucursalId: session.sucursalId,
    orders: {
      total: created,
      rps: round(created / elapsedSec),
      ok: created - failures - clientErrors,
      clientErrors,
      serverErrors: failures,
      p50: round(percentile(createSorted, 50)),
      p95: round(percentile(createSorted, 95)),
      p99: round(percentile(createSorted, 99)),
      max: round(createSorted.at(-1) ?? 0),
      avg: round(createSorted.reduce((sum, ms) => sum + ms, 0) / Math.max(1, created)),
      byStatus: Object.fromEntries([...statuses.create.entries()].sort()),
    },
    kdsReads: {
      total: reads,
      p50: round(percentile(readSorted, 50)),
      p95: round(percentile(readSorted, 95)),
      p99: round(percentile(readSorted, 99)),
      byStatus: Object.fromEntries([...statuses.read.entries()].sort()),
    },
    database,
    errors,
  };

  console.log(
    `  POST /orders  n=${created}  rps=${report.orders.rps}  ` +
      `p50=${report.orders.p50}ms  p95=${report.orders.p95}ms  p99=${report.orders.p99}ms  ` +
      `4xx=${clientErrors}  5xx=${failures}`,
  );
  if (reads > 0) {
    console.log(
      `  GET  /orders  n=${reads}  p50=${report.kdsReads.p50}ms  p95=${report.kdsReads.p95}ms`,
    );
  }
  if (config.dbUrl) {
    console.log(
      `  PostgreSQL    conexiones máx=${database.maxTotal} (activas ${database.maxActive}, ` +
        `esperando lock ${database.maxWaiting})`,
    );
  }

  if (config.out) {
    await mkdir(dirname(config.out), { recursive: true });
    await writeFile(config.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`  Reporte: ${config.out}`);
  }

  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[AYCDS-22] ${error.message}`);
  // Sin esto el pool de `pg` y el sampler dejan el proceso vivo tras un fallo.
  process.exit(1);
});
