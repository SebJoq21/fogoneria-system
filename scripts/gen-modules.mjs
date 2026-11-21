#!/usr/bin/env node
/**
 * Generador de los archivos compartidos de módulos.
 *
 * Fuente de verdad:
 * - `modules/catalog.json` (orden, rutas, nav y estado por módulo)
 * - `modules/<id>/module.json` (manifiesto del dueño: id, kind, owner, status, routes)
 * - `apps/web/features/<id>/module.ts` (metadata de la feature, opcional)
 *
 * Genera (no editar a mano):
 * - `apps/api/src/modules/registry.ts`
 * - `apps/web/features/registry.ts`
 * - `apps/web/lib/modules-nav.ts`
 *
 * Uso:
 *   pnpm gen:modules              # regenera los archivos
 *   pnpm gen:modules --check      # falla si un generado está desactualizado
 *   pnpm gen:modules --sync-manifests   # crea los module.json que falten
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const CATALOG = join(ROOT, 'modules/catalog.json');
const MODULES_DIR = join(ROOT, 'modules');
const API_MODULES = join(ROOT, 'apps/api/src/modules');
const WEB_FEATURES = join(ROOT, 'apps/web/features');

const GENERATED = {
  apiRegistry: 'apps/api/src/modules/registry.ts',
  webRegistry: 'apps/web/features/registry.ts',
  modulesNav: 'apps/web/lib/modules-nav.ts',
};

const NAV_GROUPS = ['Principal', 'Carta', 'Clientes', 'Administración'];
const ROLE_VALUES = new Set(['superadmin', 'admin', 'sucursal', 'cajero', 'cocina', 'mesero']);
const SHELL_NAV = [
  {
    group: 'Principal',
    label: 'Inicio',
    icon: 'House',
    href: '/app',
    roles: ['admin', 'sucursal'],
    exact: true,
    order: 10,
  },
];

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const syncManifests = args.has('--sync-manifests');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const rel = (path) => relative(ROOT, path).split('\\').join('/');
const normalizeEol = (text) => text.replace(/\r\n/g, '\n');

const catalog = readJson(CATALOG);
const modules = catalog.modules ?? [];
const errors = [];

if (modules.length === 0) {
  console.error(`❌ ${rel(CATALOG)} no tiene módulos.`);
  process.exit(1);
}

/* ---------------------------- manifiestos -------------------------------- */

const manifestFields = (module) => ({
  id: module.id,
  kind: module.kind ?? 'ui',
  owner: module.owner ?? '@por-asignar',
  status: module.status ?? 'pending',
  routes: module.routes ?? [],
});

if (syncManifests) {
  for (const module of modules) {
    const file = join(MODULES_DIR, module.id, 'module.json');
    try {
      readFileSync(file);
      continue;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(manifestFields(module), null, 2)}\n`, 'utf8');
    console.log(`  creado ${rel(file)}`);
  }
}

for (const module of modules) {
  const file = join(MODULES_DIR, module.id, 'module.json');
  let manifest;
  try {
    manifest = readJson(file);
  } catch (error) {
    if (error.code === 'ENOENT') {
      errors.push(`falta modules/${module.id}/module.json (ejecuta pnpm gen:modules --sync-manifests)`);
    } else {
      errors.push(`modules/${module.id}/module.json no es JSON válido: ${error.message}`);
    }
    continue;
  }
  if (manifest.id !== module.id) {
    errors.push(`modules/${module.id}/module.json declara id "${manifest.id}"`);
  }
  for (const field of ['kind', 'owner', 'status']) {
    if (!manifest[field]) errors.push(`modules/${module.id}/module.json no tiene "${field}"`);
  }
  if (!Array.isArray(manifest.routes)) {
    errors.push(`modules/${module.id}/module.json no tiene "routes" (array)`);
  }
}

if (errors.length > 0) {
  console.error('❌ Manifiestos inválidos:');
  for (const error of errors) console.error(`   - ${error}`);
  process.exit(1);
}

/* --------------------------- metadata de features ------------------------ */

async function webMetadataOf(id) {
  const file = join(WEB_FEATURES, id, 'module.ts');
  if (!existsSync(file)) return null;
  const mod = await import(pathToFileURL(file).href);
  const candidates = Object.entries(mod).filter(
    ([, value]) => value && typeof value === 'object' && value.id === id,
  );
  if (candidates.length !== 1) {
    errors.push(
      `apps/web/features/${id}/module.ts debe exportar un único objeto con id "${id}" (encontrados: ${candidates.length}).`,
    );
    return null;
  }
  const [exportName, metadata] = candidates[0];
  for (const field of ['label', 'icon', 'path', 'roles', 'group']) {
    if (metadata[field] === undefined) {
      errors.push(`apps/web/features/${id}/module.ts no tiene "${field}"`);
    }
  }
  for (const role of metadata.roles ?? []) {
    if (!ROLE_VALUES.has(role)) {
      errors.push(`apps/web/features/${id}/module.ts usa el rol desconocido "${role}"`);
    }
  }
  return { ...metadata, exportName };
}

const webMetadata = new Map();
for (const module of modules) {
  const metadata = await webMetadataOf(module.id);
  if (metadata) webMetadata.set(module.id, metadata);
}

if (errors.length > 0) {
  console.error('❌ Metadata de features inválida:');
  for (const error of errors) console.error(`   - ${error}`);
  process.exit(1);
}

/* ------------------------------- API registry ---------------------------- */

function apiModuleClass(id) {
  const file = join(API_MODULES, id, 'index.ts');
  let index;
  try {
    index = readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      errors.push(`apps/api/src/modules/${id}/index.ts no existe`);
      return null;
    }
    throw error;
  }
  const match = /export\s*\{\s*(\w+Module)\s*\}/.exec(index);
  if (!match) {
    errors.push(`apps/api/src/modules/${id}/index.ts no exporta un <Nombre>Module`);
    return null;
  }
  return match[1];
}

const apiImports = [];
const apiEntries = [];
for (const module of modules) {
  const className = apiModuleClass(module.id);
  if (!className) continue;
  apiImports.push(`import { ${className} } from './${module.id}/index.js';`);
  apiEntries.push(`  ${className},`);
}

const apiRegistry = `/**
 * GENERADO por scripts/gen-modules.mjs — no editar a mano.
 * Regenera con \`pnpm gen:modules\`; el CI lo compara con \`pnpm gen:modules --check\`.
 *
 * Orden: el de modules/catalog.json. Los módulos de infraestructura
 * (\`PrismaModule\`, \`TenantContextModule\`) se declaran en app.module.ts.
 */
${apiImports.join('\n')}

export const MODULE_REGISTRY = [
${apiEntries.join('\n')}
];
`;

/* ------------------------------ web registry ----------------------------- */

const implemented = modules.filter((module) => webMetadata.has(module.id));
const pending = modules.filter((module) => !webMetadata.has(module.id));

const registryImports = implemented.map((module) => ({
  module,
  exportName: webMetadata.get(module.id).exportName,
}));
const webRegistry = `/**
 * GENERADO por scripts/gen-modules.mjs — no editar a mano.
 * Regenera con \`pnpm gen:modules\`.
 *
 * Fase 0–3: lista las features que ya exponen \`module.ts\`. Los providers
 * por módulo llegan en la Fase 6; el layout todavía no consume este registry.
 */
import type { ComponentType, ReactNode } from 'react';
${registryImports.map(({ module }) => `import { ${webMetadata.get(module.id).exportName ?? `${module.id}Module`} } from './${module.id}/module';`).join('\n')}

export type FeatureModule = {
  id: string;
  label: string;
  icon: string;
  path: string;
  roles: string[];
  group: string;
};

export type FeatureProvider = {
  id: string;
  Provider: ComponentType<{ children: ReactNode }>;
};

export const featureModules: FeatureModule[] = [
${registryImports.map(({ module }) => `  ${webMetadata.get(module.id).exportName ?? `${module.id}Module`},`).join('\n')}
];

/** Módulos del catálogo que aún no exponen \`features/<id>/module.ts\`. */
export const pendingFeatureIds = ${JSON.stringify(pending.map((module) => module.id))};

/** Providers opcionales por módulo (Fase 6). */
export const featureProviders: FeatureProvider[] = [];
`;

/* -------------------------------- web nav -------------------------------- */

const navEntries = [...SHELL_NAV];
for (const module of modules) {
  const metadata = webMetadata.get(module.id);
  for (const entry of module.nav ?? []) {
    if (!NAV_GROUPS.includes(entry.group)) {
      errors.push(`modules/catalog.json: ${module.id} usa el grupo de nav desconocido "${entry.group}"`);
    }
    const overridden =
      metadata && metadata.path === entry.href
        ? {
            ...entry,
            label: metadata.label ?? entry.label,
            icon: metadata.icon ?? entry.icon,
            roles: metadata.roles ?? entry.roles,
            group: metadata.group ?? entry.group,
          }
        : entry;
    navEntries.push({ ...overridden, order: overridden.order ?? 999 });
  }
}

if (errors.length > 0) {
  console.error('❌ Nav inválida:');
  for (const error of errors) console.error(`   - ${error}`);
  process.exit(1);
}

const groups = [];
for (const label of [...NAV_GROUPS, ...new Set(navEntries.map((entry) => entry.group))]) {
  if (groups.some((group) => group.label === label)) continue;
  const entries = navEntries
    .filter((entry) => entry.group === label)
    .sort((a, b) => a.order - b.order)
    .map((entry) => {
      const roles = entry.roles ?? [];
      for (const role of roles) {
        if (!ROLE_VALUES.has(role)) {
          errors.push(`nav ${entry.href}: rol desconocido "${role}"`);
        }
      }
      const fields = [
        `href: ${JSON.stringify(entry.href)}`,
        `label: ${JSON.stringify(entry.label)}`,
        `icon: ${JSON.stringify(entry.icon)}`,
        `roles: ${JSON.stringify(roles)}`,
      ];
      if (entry.exact) fields.push('exact: true');
      return `      { ${fields.join(', ')} },`;
    });
  if (entries.length > 0) groups.push({ label, entries });
}

const modulesNav = `/**
 * GENERADO por scripts/gen-modules.mjs — no editar a mano.
 * Regenera con \`pnpm gen:modules\`.
 *
 * El shell todavía usa su lista de AppSidebar (Fase 6 conectará este nav).
 * Las entradas con \`module.ts\` (crm, catalog, pricing, tables, reservations) salen
 * de la metadata de la feature; el resto del catálogo, de \`modules/catalog.json\`.
 */
export type ModuleNavRole = 'superadmin' | 'admin' | 'sucursal' | 'cajero' | 'cocina' | 'mesero';

export type ModuleNavEntry = {
  href: string;
  label: string;
  icon: string;
  roles: ModuleNavRole[];
  exact?: boolean;
};

export type ModuleNavGroup = {
  label: string;
  entries: ModuleNavEntry[];
};

export const modulesNav: ModuleNavGroup[] = [
${groups
  .map(
    (group) => `  {
    label: ${JSON.stringify(group.label)},
    entries: [
${group.entries.join('\n')}
    ],
  },`,
  )
  .join('\n')}
];
`;

/* -------------------------------- salida --------------------------------- */

const outputs = new Map([
  [GENERATED.apiRegistry, apiRegistry],
  [GENERATED.webRegistry, webRegistry],
  [GENERATED.modulesNav, modulesNav],
]);

let stale = 0;
for (const [path, content] of outputs) {
  const full = join(ROOT, path);
  let current = null;
  try {
    current = readFileSync(full, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (checkOnly) {
    if (normalizeEol(current ?? '') !== normalizeEol(content)) {
      console.error(`❌ ${path} está desactualizado (ejecuta pnpm gen:modules).`);
      stale++;
    }
    continue;
  }
  if (current !== content) {
    writeFileSync(full, content, 'utf8');
    console.log(`  escrito ${path}`);
  }
}

if (checkOnly) {
  if (stale > 0) process.exit(1);
  console.log(`✅ Generados al día (${outputs.size}).`);
} else {
  console.log(`✅ Módulos generados (${outputs.size} archivos).`);
}
