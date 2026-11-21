#!/usr/bin/env node
/**
 * Paridad de módulos backend ↔ frontend ↔ contratos ↔ specs.
 *
 * Fuente de verdad: `modules/catalog.json` (IDs canónicos) y
 * `modules/<id>/module.json` (manifiesto del dueño).
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
const MODULES_DIR = join(ROOT, 'modules');
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
const contractFiles = files(CONTRACTS)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'index.ts')
  .map((f) => f.replace(/\.ts$/, ''));
const specs = files(SPECS)
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace(/\.md$/, ''));

const canonicalContracts = contractFiles.filter((id) => ids.includes(id));
const extraContracts = contractFiles.filter((id) => !ids.includes(id));

const isDeprecatedAlias = (id) => {
  const file = join(CONTRACTS, `${id}.ts`);
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  return /@deprecated/.test(content) && /export \* from '\.\/[a-z0-9-]+';/.test(content);
};

const aliases = extraContracts.filter(isDeprecatedAlias);
const unexpectedContracts = extraContracts.filter((id) => !isDeprecatedAlias(id));

const missing = (list, expected) => expected.filter((id) => !list.includes(id));
const extra = (list, expected) => list.filter((id) => !ids.includes(id));

const issues = [];

const routeExists = (route) => {
  const clean = route.replace(/^\//, '');
  if (!clean) return existsSync(join(APP, 'page.tsx'));
  if (existsSync(join(APP, clean, 'page.tsx'))) return true;
  // Los hubs de módulos se sirven con app/app/modulos/[id]/page.tsx.
  const dynamicHub = /^app\/modulos\/[^/]+$/.test(clean);
  return dynamicHub && existsSync(join(APP, 'app/modulos/[id]/page.tsx'));
};

/* --------------------------- manifiestos --------------------------------- */

const manifests = new Set(dirs(MODULES_DIR));
const manifestIssues = [];

for (const module of modules) {
  const { id, kind = 'ui', owner, status, routes = [] } = module;
  const file = join(MODULES_DIR, id, 'module.json');

  let manifest;
  try {
    manifest = readJson(file);
  } catch (error) {
    if (error.code === 'ENOENT') {
      manifestIssues.push(`modules/${id}/module.json: falta`);
    } else {
      manifestIssues.push(`modules/${id}/module.json: JSON inválido (${error.message})`);
    }
    continue;
  }

  if (manifest.id !== id) manifestIssues.push(`modules/${id}/module.json: id "${manifest.id}" ≠ "${id}"`);
  for (const field of ['kind', 'owner', 'status']) {
    if (!manifest[field]) manifestIssues.push(`modules/${id}/module.json: falta "${field}"`);
  }
  if (!Array.isArray(manifest.routes)) {
    manifestIssues.push(`modules/${id}/module.json: "routes" debe ser un array`);
  }
  if (manifest.kind && manifest.kind !== kind) {
    manifestIssues.push(`modules/${id}/module.json: kind "${manifest.kind}" ≠ catálogo "${kind}"`);
  }
  if (manifest.owner && owner && manifest.owner !== owner) {
    manifestIssues.push(`modules/${id}/module.json: owner "${manifest.owner}" ≠ catálogo "${owner}"`);
  }
  if (manifest.status && status && manifest.status !== status) {
    manifestIssues.push(`modules/${id}/module.json: status "${manifest.status}" ≠ catálogo "${status}"`);
  }
  if (Array.isArray(manifest.routes) && JSON.stringify(manifest.routes) !== JSON.stringify(routes)) {
    manifestIssues.push(`modules/${id}/module.json: routes no coinciden con modules/catalog.json`);
  }
}

for (const manifestDir of manifests) {
  if (!ids.includes(manifestDir)) {
    manifestIssues.push(`modules/${manifestDir}/: manifiesto sin entrada en modules/catalog.json`);
  }
}

/* ------------------------------ piezas ------------------------------------ */

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
  for (const entry of module.nav ?? []) {
    if (entry.href && !routeExists(entry.href)) {
      issues.push(`nav       ${id}: falta app${entry.href}/page.tsx`);
    }
  }
}

const summary = {
  catalog: ids.length,
  manifests: manifests.size,
  backend: backend.length,
  frontend: frontend.length,
  contracts: canonicalContracts.length,
  specs: specs.length,
};

const progress = (count) => `${count}/${ids.length}`;
const lines = [
  'Paridad de módulos',
  `  catálogo:    ${summary.catalog}`,
  `  manifiestos: ${progress(summary.manifests)}`,
  `  backend:     ${progress(summary.backend)}`,
  `  frontend:    ${progress(summary.frontend)}`,
  `  contratos:   ${progress(summary.contracts)}${aliases.length ? ` (+${aliases.length} alias deprecados)` : ''}`,
  `  specs:       ${summary.specs} (${progress(ids.filter((id) => specs.includes(id)).length)} canónicas)`,
];

if (missing(backend, ids).length) lines.push(`  backend faltan: ${missing(backend, ids).join(', ')}`);
if (extra(backend, ids).length) lines.push(`  backend sobran: ${extra(backend, ids).join(', ')}`);
if (missing(frontend, ids).length) lines.push(`  frontend faltan: ${missing(frontend, ids).join(', ')}`);
if (extra(frontend, ids).length) lines.push(`  frontend agrupadas: ${extra(frontend, ids).join(', ')}`);
if (missing(canonicalContracts, ids).length) {
  lines.push(`  contratos faltan: ${missing(canonicalContracts, ids).join(', ')}`);
}
if (aliases.length) lines.push(`  alias deprecados: ${aliases.join(', ')}`);
if (unexpectedContracts.length) lines.push(`  contratos sobran: ${unexpectedContracts.join(', ')}`);
if (missing(specs, ids).length) lines.push(`  specs faltan: ${missing(specs, ids).join(', ')}`);
if (extra(specs, ids).length) lines.push(`  specs sobran: ${extra(specs, ids).join(', ')}`);

if (manifestIssues.length) {
  lines.push('', 'Manifiestos:');
  for (const issue of manifestIssues.slice(0, 30)) lines.push(`  - ${issue}`);
  if (manifestIssues.length > 30) lines.push(`  ... y ${manifestIssues.length - 30} más`);
}

if (issues.length) {
  lines.push('', 'Pendientes:');
  for (const issue of issues.slice(0, 60)) lines.push(`  - ${issue}`);
  if (issues.length > 60) lines.push(`  ... y ${issues.length - 60} más`);
}

console.log(lines.join('\n'));

if (strict) {
  const countsOk =
    summary.manifests === ids.length &&
    summary.backend === ids.length &&
    summary.frontend === ids.length &&
    summary.contracts === ids.length &&
    summary.specs === ids.length;
  if (!countsOk || issues.length || manifestIssues.length || unexpectedContracts.length) {
    console.error(`\nParidad incompleta: ${issues.length + manifestIssues.length} pendiente(s).`);
    process.exit(1);
  }
  console.log('\nParidad 20/20/20/20 OK.');
}
