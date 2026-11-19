#!/usr/bin/env node
/**
 * Fronteras de módulos (2026-11-19).
 *
 * Un módulo no puede importar los internals de otro: solo su `index` público.
 * En el frontend, una feature no puede importar otra feature ni las vistas
 * `components/erp/*` (esas vistas deben mudarse a su feature).
 *
 * El repo arranca con acoplamientos históricos, así que existe un **baseline**
 * (`scripts/module-boundaries.baseline.json`): la CI falla solo con violaciones
 * NUEVAS. Al refactorizar un módulo se quita su entrada del baseline.
 *
 * Uso:
 *   node scripts/check-module-boundaries.mjs
 *   node scripts/check-module-boundaries.mjs --write-baseline
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ROOT = process.cwd();
const API_MODULES = join(ROOT, 'apps/api/src/modules');
const WEB_FEATURES = join(ROOT, 'apps/web/features');
const BASELINE = join(ROOT, 'scripts/module-boundaries.baseline.json');
const writeBaseline = process.argv.includes('--write-baseline');

const EXTENSIONES = ['.ts', '.tsx'];

function walk(dir) {
  if (!existsSync(dir)) return [];
  const salida = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      salida.push(...walk(full));
    } else if (EXTENSIONES.some((ext) => full.endsWith(ext))) {
      salida.push(full);
    }
  }
  return salida;
}

function importsDe(file) {
  const contenido = readFileSync(file, 'utf8');
  const specs = [];
  const regex = /(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(contenido)) !== null) specs.push(match[1]);
  return specs;
}

function rel(file) {
  return relative(ROOT, file).split(sep).join('/');
}

/* ------------------------------ backend ---------------------------------- */

function violacionesApi() {
  if (!existsSync(API_MODULES)) return [];
  const modulos = readdirSync(API_MODULES).filter((name) =>
    statSync(join(API_MODULES, name)).isDirectory(),
  );
  const violaciones = [];

  for (const modulo of modulos) {
    for (const file of walk(join(API_MODULES, modulo))) {
      if (file.endsWith('.spec.ts')) continue; // los tests pueden usar fixtures

      for (const spec of importsDe(file)) {
        if (!spec.startsWith('.')) continue;

        const destino = resolve(dirname(file), spec);
        const partes = relative(API_MODULES, destino).split(sep);
        const otro = partes[0];
        if (!otro || otro === modulo || !modulos.includes(otro)) continue;

        const resto = partes.slice(1).join('/');
        const esPublico = resto === '' || resto === 'index' || resto === 'index.js' || resto === 'index.ts';
        if (!esPublico) {
          violaciones.push({
            file: rel(file),
            spec,
            modulo,
            destino: otro,
            regla: 'api-internals',
            mensaje: `importa internals de "${otro}" (solo se permite su index público)`,
          });
        }
      }
    }
  }

  return violaciones;
}

/* ------------------------------ frontend --------------------------------- */

function violacionesWeb() {
  if (!existsSync(WEB_FEATURES)) return [];
  const features = readdirSync(WEB_FEATURES).filter((name) =>
    statSync(join(WEB_FEATURES, name)).isDirectory(),
  );
  const violaciones = [];

  for (const feature of features) {
    for (const file of walk(join(WEB_FEATURES, feature))) {
      for (const spec of importsDe(file)) {
        if (spec.startsWith('@/features/')) {
          const otra = spec.split('/')[2];
          if (otra && otra !== feature) {
            violaciones.push({
              file: rel(file),
              spec,
              modulo: feature,
              destino: otra,
              regla: 'web-feature',
              mensaje: `importa la feature "${otra}" (usa URL o un contrato compartido)`,
            });
          }
        }
        if (spec.startsWith('@/components/erp/')) {
          violaciones.push({
            file: rel(file),
            spec,
            modulo: feature,
            destino: 'components/erp',
            regla: 'web-erp',
            mensaje: 'importa una vista de components/erp: muévela a su feature',
          });
        }
        if (spec.startsWith('@/app/') || spec.includes('apps/api')) {
          violaciones.push({
            file: rel(file),
            spec,
            modulo: feature,
            destino: 'app/api',
            regla: 'web-upward',
            mensaje: 'una feature no puede importar la app ni la API',
          });
        }
      }
    }
  }

  return violaciones;
}

/* --------------------------------- main ----------------------------------- */

const actuales = [...violacionesApi(), ...violacionesWeb()];
const fingerprint = (v) => `${v.file}|${v.spec}`;
const actualesSet = new Set(actuales.map(fingerprint));

if (writeBaseline) {
  const baseline = [...actualesSet].sort();
  writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
  console.log(`Baseline escrito: ${baseline.length} acoplamientos históricos.`);
  process.exit(0);
}

let baseline = [];
if (existsSync(BASELINE)) {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
}
const baselineSet = new Set(baseline);

const nuevos = actuales.filter((v) => !baselineSet.has(fingerprint(v)));
const resueltos = baseline.filter((f) => !actualesSet.has(f));

if (nuevos.length > 0) {
  console.error(`❌ ${nuevos.length} violación(es) NUEVA(S) de fronteras de módulos:\n`);
  for (const v of nuevos.slice(0, 40)) {
    console.error(`  [${v.modulo}] ${v.file}`);
    console.error(`      ${v.spec} → ${v.mensaje}`);
  }
  if (nuevos.length > 40) console.error(`  … y ${nuevos.length - 40} más`);
  console.error('\nRegla: un módulo solo importa el index público de otro módulo.');
  console.error('Si el acoplamiento es histórico, no lo agregues al baseline: refactorízalo.');
  process.exit(1);
}

console.log(`✅ Fronteras OK (${actuales.length} históricas en baseline, ${resueltos.length} ya resueltas).`);
if (resueltos.length > 0) {
  console.log('   Quita del baseline las resueltas con --write-baseline cuando toque.');
}
