#!/usr/bin/env node
/**
 * Paridad de módulos backend ↔ frontend ↔ contratos ↔ specs.
 *
 * Fuente de verdad: `modules/catalog.json` (IDs canónicos).
 * Por defecto reporta y sale 0; con `--strict` falla si falta cualquier pieza.
 *
 * Uso:
 *   pnpm check:modules
 *   pnpm check:modules --strict
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const CATALOG = join(ROOT, 'modules/catalog.json');
const API_MODULES = join(ROOT, 'apps/api/src/modules');
const WEB_FEATURES = join(ROOT, 'apps/web/features');
const CONTRACTS = join(ROOT, 'packages/contracts/src');
const SPECS = join(ROOT, 'specs/modulos');
const APP = join(ROOT, 'apps/web/app');

const strict = process.argv.includes('--strict');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const dirs = (path) =>
  existsSync(path)
    ? readdirSync(path).filter((name) => statSync(join(path, name)).isDirectory())
    : [];
const files = (path) =>
  existsSync(path)
    ? readdirSync(path).filter((name) => statSync(join(path, name)).isFile())
    : [];

const catalog = readJson(CATALOG);
const modules = catalog.modules ?? [];
const ids = modules.map((m) => m.id);

const backend = dirs(API_MODULES);
const frontend = dirs(WEB_FEATURES);
const contracts = files(CONTRACTS)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'index.ts')
  .map((f) => f.replace(/\.ts$/, ''));
const specs = files(SPECS)
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace(/\.md$/, ''));

const missing = (list, expected) => expected.filter((id) => !list.includes(id));
const extra = (list, expected) => list.filter((id) => !ids.includes(id));

const issues = [];

const routeExists = (route) => {
  const clean = route.replace(/^\//, '');
  if (!clean) return existsSync(join(APP, 'page.tsx'));
  return existsSync(join(APP, clean, 'page.tsx'));
};

for (const module of modules) {
  const { id, kind = 'ui', routes = [] } = module;
  const backendPath = join(API_MODULES, id);
  const frontendPath = join(WEB_FEATURES, id);
  const contractPath = join(CONTRACTS, `${id}.ts`);
  const specPath = join(SPECS, `${id}.md`);

  if (!existsSync(join(backendPath, 'index.ts'))) {
    issues.push(`backend  ${id}: falta index.ts`);
  }
  if (!existsSync(join(frontendPath, 'index.ts'))) {
    issues.push(`frontend  ${id}: falta features/${id}/index.ts`);
  }
  if (!existsSync(join(frontendPath, 'module.ts'))) {
    issues.push(`frontend  ${id}: falta features/${id}/module.ts (metadata/nav)`);
  }
  if (kind !== 'infra' && !existsSync(join(frontendPath, 'api.ts'))) {
    issues.push(`frontend  ${id}: falta features/${id}/api.ts`);
  }
  if (!existsSync(contractPath)) {
    issues.push(`contrato  ${id}: falta packages/contracts/src/${id}.ts`);
  }
  if (!existsSync(specPath)) {
    issues.push(`spec      ${id}: falta specs/modulos/${id}.md`);
  }
  for (const route of routes) {
    if (!routeExists(route)) issues.push(`ruta      ${id}: falta app${route}/page.tsx`);
  }
}

const summary = {
  catalog: ids.length,
  backend: backend.length,
  frontend: frontend.length,
  contracts: contracts.length,
  specs: specs.length,
};

const lines = [
  'Paridad de módulos',
  `  catálogo: ${summary.catalog}`,
  `  backend:  ${summary.backend}`,
  `  frontend: ${summary.frontend}`,
  `  contratos:${summary.contracts}`,
  `  specs:    ${summary.specs}`,
];

if (missing(backend, ids).length) lines.push(`  backend faltan: ${missing(backend, ids).join(', ')}`);
if (extra(backend, ids).length) lines.push(`  backend sobran: ${extra(backend, ids).join(', ')}`);
if (missing(frontend, ids).length) lines.push(`  frontend faltan: ${missing(frontend, ids).join(', ')}`);
if (extra(frontend, ids).length) lines.push(`  frontend sobran: ${extra(frontend, ids).join(', ')}`);
if (missing(contracts, ids).length) lines.push(`  contratos faltan: ${missing(contracts, ids).join(', ')}`);
if (extra(contracts, ids).length) lines.push(`  contratos sobran: ${extra(contracts, ids).join(', ')}`);
if (missing(specs, ids).length) lines.push(`  specs faltan: ${missing(specs, ids).join(', ')}`);
if (extra(specs, ids).length) lines.push(`  specs sobran: ${extra(specs, ids).join(', ')}`);

if (issues.length) {
  lines.push('', 'Pendientes:');
  for (const issue of issues.slice(0, 60)) lines.push(`  - ${issue}`);
  if (issues.length > 60) lines.push(`  ... y ${issues.length - 60} más`);
}

console.log(lines.join('\n'));

if (strict) {
  const countsOk =
    summary.backend === ids.length &&
    summary.frontend === ids.length &&
    summary.contracts === ids.length &&
    summary.specs === ids.length;
  if (!countsOk || issues.length) {
    console.error(`\nParidad incompleta: ${issues.length} pendiente(s).`);
    process.exit(1);
  }
  console.log('\nParidad 20/20/20/20 OK.');
}
