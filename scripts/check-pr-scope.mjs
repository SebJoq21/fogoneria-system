#!/usr/bin/env node
/**
 * Regla «un PR = un módulo» (2026-11-18).
 *
 * Clasifica los archivos tocados por un PR y falla si afecta a **más de un
 * módulo de negocio**. Los archivos compartidos (docs, CI, design system,
 * migraciones, tests) no cuentan como módulo.
 *
 * Uso:
 *   node scripts/check-pr-scope.mjs <base> <head>
 *
 * Ejemplo en CI:
 *   node scripts/check-pr-scope.mjs origin/development "$GITHUB_SHA"
 *
 * Escape: el PR puede llevar la etiqueta `multi-modulo` (ALLOW_MULTI=true) para
 * un refactor que cruce módulos con aprobación explícita del equipo.
 */

import { execSync } from 'node:child_process';

const [, , base, head] = process.argv;

if (!base || !head) {
  console.error('uso: node scripts/check-pr-scope.mjs <base> <head>');
  process.exit(2);
}

const MODULOS = {
  'api:catalog': 'catalogo',
  'api:pricing': 'catalogo',
  'api:promotions': 'promociones',
  'api:orders': 'ordenes',
  'api:realtime': 'ordenes',
  'api:tables': 'mesas',
  'api:reservations': 'mesas',
  'api:cash': 'caja',
  'api:receipts': 'comprobantes',
  'api:inventory': 'inventario',
  'api:expenses': 'gastos',
  'api:crm': 'crm',
  'api:staff': 'rrhh',
  'api:bi': 'bi',
  'api:auth': 'plataforma',
  'api:tenant': 'plataforma',
  'api:saas': 'plataforma',
  'api:billing': 'plataforma',
  'api:onboarding': 'plataforma',
  'api:audit': 'plataforma',
};

const VISTAS = {
  OrdersView: 'ordenes',
  MozoView: 'ordenes',
  AccountPanel: 'ordenes',
  useOrdersRealtime: 'ordenes',
  BookingsModule: 'mesas',
  SalonTablesView: 'mesas',
  CajaView: 'caja',
  ComprobantesView: 'comprobantes',
  InventoryModule: 'inventario',
  InventoryMovementsView: 'inventario',
  GastosView: 'gastos',
  CombosView: 'promociones',
  PromocionesView: 'promociones',
  ClientesView: 'crm',
  LoyaltyModule: 'crm',
  StaffAttendanceView: 'rrhh',
  StaffTurnosView: 'rrhh',
  StaffModule: 'rrhh',
  RolesView: 'rrhh',
  AnaliticasView: 'bi',
};

const FEATURES = {
  catalogo: 'catalogo',
  promociones: 'promociones',
  ordenes: 'ordenes',
  mesas: 'mesas',
  caja: 'caja',
  comprobantes: 'comprobantes',
  inventario: 'inventario',
  gastos: 'gastos',
  crm: 'crm',
  rrhh: 'rrhh',
  bi: 'bi',
  plataforma: 'plataforma',
};

const LIB = {
  catalog: 'catalogo',
  pricing: 'catalogo',
  promotions: 'promociones',
  orders: 'ordenes',
  realtime: 'ordenes',
  tables: 'mesas',
  reservations: 'mesas',
  cash: 'caja',
  receipts: 'comprobantes',
  inventory: 'inventario',
  expenses: 'gastos',
  crm: 'crm',
  staff: 'rrhh',
  bi: 'bi',
  auth: 'plataforma',
  tenant: 'plataforma',
  saas: 'plataforma',
  onboarding: 'plataforma',
};

const RUTAS = [
  [/^apps\/web\/app\/app\/(caja|comprobantes|clientes|analiticas|gastos|combos|promociones)(\/|$)/, (m) => ({
    caja: 'caja',
    comprobantes: 'comprobantes',
    clientes: 'crm',
    analiticas: 'bi',
    gastos: 'gastos',
    combos: 'promociones',
    promociones: 'promociones',
  })[m[1]]],
  [/^apps\/web\/app\/app\/(ordenes|cocina|mozo)(\/|$)/, () => 'ordenes'],
  [/^apps\/web\/app\/app\/(mesas|modulos\/reservas)(\/|$)/, () => 'mesas'],
  [/^apps\/web\/app\/app\/productos(\/|$)/, () => 'catalogo'],
  [/^apps\/web\/app\/app\/modulos\/inventario(\/|$)/, () => 'inventario'],
  [/^apps\/web\/app\/app\/modulos\/personal(\/|$)/, () => 'rrhh'],
  [/^apps\/web\/app\/app\/modulos\/fidelizacion(\/|$)/, () => 'crm'],
  [/^apps\/web\/app\/api\/(session|backend)(\/|$)/, () => 'plataforma'],
];

/** Devuelve la clave del módulo o `null` si el archivo es compartido. */
function moduloDe(archivo) {
  if (archivo.startsWith('docs/') || archivo.endsWith('.md')) return null;
  if (archivo.startsWith('.github/') || archivo.startsWith('scripts/')) return null;
  if (archivo.startsWith('apps/api/prisma/') || archivo.startsWith('db/')) return null;
  if (archivo.startsWith('apps/api/test/')) return null;

  // Contratos por módulo: `packages/contracts/src/<m>.ts`.
  const contrato = /^packages\/contracts\/src\/([a-z-]+)\.ts$/.exec(archivo);
  if (contrato && contrato[1] !== 'index') {
    return FEATURES[contrato[1]] ?? contrato[1];
  }
  // Kernel, SDK y UI son plataforma compartida.
  if (archivo.startsWith('packages/')) return null;

  // Features del frontend: `apps/web/features/<m>/**`.
  const feature = /^apps\/web\/features\/([^/]+)\//.exec(archivo);
  if (feature) return FEATURES[feature[1]] ?? feature[1];
  if (
    archivo === 'package.json' ||
    archivo === 'pnpm-lock.yaml' ||
    archivo === 'turbo.json' ||
    archivo === 'docker-compose.yml' ||
    archivo.endsWith('tsconfig.json') ||
    archivo.endsWith('.example') ||
    archivo.startsWith('apps/web/components/ui/') ||
    archivo.startsWith('apps/web/components/dashboard/') ||
    archivo === 'apps/web/app/globals.css' ||
    archivo === 'apps/web/proxy.ts' ||
    archivo === 'apps/web/next.config.ts' ||
    archivo === 'apps/web/scripts/check-styles.mjs'
  ) {
    return null;
  }

  const api = /^apps\/api\/src\/modules\/([^/]+)\//.exec(archivo);
  if (api) return MODULOS[`api:${api[1]}`] ?? 'plataforma';

  const lib = /^apps\/web\/lib\/([a-z-]+)(?:-api)?\.tsx?$/.exec(archivo);
  if (lib) {
    if (lib[1] === 'session' || lib[1] === 'backend' || lib[1] === 'session-api') return 'plataforma';
    if (lib[1] === 'order-mapping') return 'ordenes';
    if (lib[1] === 'table-mapping') return 'mesas';
    if (lib[1] === 'receipt-mapping') return 'comprobantes';
    return LIB[lib[1]] ?? null;
  }

  const vista = /^apps\/web\/components\/erp\/(?:.*\/)?([A-Za-z0-9]+)\.tsx$/.exec(archivo);
  if (vista) {
    if (archivo.includes('/catalog/')) return 'catalogo';
    return VISTAS[vista[1]] ?? null;
  }

  for (const [patron, resolver] of RUTAS) {
    const match = patron.exec(archivo);
    if (match) return resolver(match);
  }

  return null;
}

let archivos;
try {
  archivos = execSync(`git diff --name-only "${base}...${head}"`, { encoding: 'utf8' })
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean);
} catch (error) {
  console.error(`No se pudo calcular el diff: ${error.message}`);
  process.exit(2);
}

if (archivos.length === 0) {
  console.log('Sin cambios: nada que validar.');
  process.exit(0);
}

const porModulo = new Map();
const compartidos = [];
for (const archivo of archivos) {
  const modulo = moduloDe(archivo);
  if (modulo) {
    if (!porModulo.has(modulo)) porModulo.set(modulo, []);
    porModulo.get(modulo).push(archivo);
  } else {
    compartidos.push(archivo);
  }
}

console.log('Alcance del PR:');
for (const [modulo, lista] of porModulo) {
  console.log(`  ${modulo} (${lista.length} archivo${lista.length === 1 ? '' : 's'})`);
}
if (compartidos.length) {
  console.log(`  compartidos (${compartidos.length}): docs, CI, tests, migraciones o design system`);
}

if (porModulo.size > 1) {
  const detalle = [...porModulo.entries()]
    .map(([modulo, lista]) => `  - ${modulo}:\n${lista.map((f) => `      ${f}`).join('\n')}`)
    .join('\n');

  if (process.env.ALLOW_MULTI === 'true') {
    console.warn(
      `\n⚠️  El PR toca ${porModulo.size} módulos y lleva la etiqueta multi-modulo: se permite con aprobación explícita.\n${detalle}`,
    );
    process.exit(0);
  }

  console.error(
    `\n❌ Un PR = un módulo. Este toca ${porModulo.size}: ${[...porModulo.keys()].join(', ')}.\n${detalle}\n\n` +
      'Separa el trabajo en un PR por módulo. Si el cambio cruza módulos de verdad ' +
      '(refactor de contrato), pide la etiqueta `multi-modulo` al equipo y justifícalo en la descripción.',
  );
  process.exit(1);
}

console.log('\n✅ PR dentro de un solo módulo.');
