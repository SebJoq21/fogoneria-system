#!/usr/bin/env node
/**
 * Gate de specs (docs-as-code).
 *
 * Regla: todo PR que cambie código debe actualizar la spec del módulo afectado
 * y revisar la coherencia con las specs existentes. `specs/` es la fuente de
 * verdad del estado por módulo; `docs/` es histórico y operativo.
 *
 * Uso:
 *   node scripts/check-specs.mjs
 *   node scripts/check-specs.mjs --base origin/development
 *   node scripts/check-specs.mjs --diff [--base origin/development]
 *   SPECS_SKIP=1 node scripts/check-specs.mjs
 *
 * Sin `--base`/`--diff` solo valida estructura, cobertura y enlaces (útil en
 * local). En CI se pasa `--base` para además comparar el PR contra la rama
 * base. La excepción `SPECS_SKIP=1` (o `--skip`) debe justificarse en el PR.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ROOT = process.cwd();
const SPECS_DIR = join(ROOT, 'specs');
const SPECS_MODULOS = join(SPECS_DIR, 'modulos');
const SPECS_README = join(SPECS_DIR, 'README.md');
const SPECS_TRAZABILIDAD = join(SPECS_DIR, 'trazabilidad.md');
const PLANTILLA = join(SPECS_DIR, 'templates/module-spec.md');
const API_MODULES = join(ROOT, 'apps/api/src/modules');
const WEB_FEATURES = join(ROOT, 'apps/web/features');
const DOCS_INDICE = join(ROOT, 'docs/INDICE.md');

/**
 * Mapa explícito feature web → specs de módulo. No siempre es 1:1:
 * `salon` agrupa mesas + reservas, `rrhh` vive en `staff`, `plataforma` incluye
 * su spec web y los seis módulos backend (auth, tenant, saas, billing,
 * onboarding, audit) y el resto toma el nombre del módulo backend (caja →
 * cash, comprobantes → receipts, etc.).
 */
const FEATURE_SPECS = {
  bi: ['bi'],
  caja: ['cash'],
  catalogo: ['catalog'],
  comprobantes: ['receipts'],
  crm: ['crm'],
  gastos: ['expenses'],
  inventario: ['inventory'],
  ordenes: ['orders'],
  plataforma: ['plataforma', 'auth', 'tenant', 'saas', 'billing', 'onboarding', 'audit'],
  promociones: ['promotions'],
  rrhh: ['staff'],
  salon: ['tables', 'reservations'],
};

/** Rutas compartidas: exigen `specs/trazabilidad.md` o una spec de módulo. */
const COMPARTIDOS = [
  'apps/web/components/dashboard/providers/',
  'apps/web/app/layout.tsx',
  'packages/contracts/',
  'packages/kernel/',
  'packages/sdk/',
  'apps/api/prisma/',
];

const EXT_CODIGO = /\.(?:ts|tsx|js|jsx|mjs|cjs|prisma|sql|css)$/i;
const EXT_MD = /\.mdx?$/i;

/* ------------------------------- utilidades ------------------------------ */

function listarDirectorios(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name)
    .sort();
}

function walk(dir, filtro = () => true) {
  if (!existsSync(dir)) return [];
  const salida = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...walk(full, filtro));
    else if (filtro(full)) salida.push(full);
  }
  return salida;
}

function rel(file) {
  return relative(ROOT, file).split(sep).join('/');
}

function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^\s*\d+[.)]\s*/, '')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titulos(contenido, { incluirCodigo = false } = {}) {
  const texto = incluirCodigo
    ? contenido
    : contenido.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '');
  return texto
    .split(/\r?\n/)
    .filter((linea) => /^##\s+/.test(linea))
    .map((linea) => normalizar(linea.replace(/^##\s+/, '')));
}

/* ---------------------------------- CLI ---------------------------------- */

const args = process.argv.slice(2);
const skip = process.env.SPECS_SKIP === '1' || args.includes('--skip');
const argumentoBase = args.find((arg) => arg.startsWith('--base='));
const indiceBase = args.indexOf('--base');
const pideDiff = args.includes('--diff') || indiceBase !== -1 || Boolean(argumentoBase);
let base = 'origin/development';

if (argumentoBase) {
  base = argumentoBase.slice('--base='.length) || base;
} else if (indiceBase !== -1) {
  const candidato = args[indiceBase + 1];
  if (candidato && !candidato.startsWith('-')) base = candidato;
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Gate de specs

  node scripts/check-specs.mjs                 estructura + cobertura + enlaces
  node scripts/check-specs.mjs --diff          lo anterior + diff contra origin/development
  node scripts/check-specs.mjs --base <ref>    lo anterior + diff contra <ref>
  SPECS_SKIP=1 node scripts/check-specs.mjs    omite el gate (justificar en el PR)
`);
  process.exit(0);
}

if (skip) {
  console.warn('⚠️  Gate de specs omitido (SPECS_SKIP=1 / --skip).');
  console.warn('   Justifica en el PR (sección «Specs») por qué este cambio no requiere spec.');
  process.exit(0);
}

const errores = [];

/* ------------------------------- cobertura ------------------------------- */

const modulosApi = listarDirectorios(API_MODULES);
const featuresWeb = listarDirectorios(WEB_FEATURES);
const specsExistentes = new Set(
  existsSync(SPECS_MODULOS)
    ? readdirSync(SPECS_MODULOS, { withFileTypes: true })
        .filter((entrada) => entrada.isFile() && entrada.name.endsWith('.md'))
        .map((entrada) => entrada.name)
    : [],
);

const specsEsperadas = new Set();
for (const modulo of modulosApi) {
  const spec = `${modulo}.md`;
  specsEsperadas.add(spec);
  if (!specsExistentes.has(spec)) {
    errores.push(
      `El módulo API «${modulo}» no tiene spec: falta specs/modulos/${spec}.`,
    );
  }
}

for (const feature of featuresWeb) {
  const specs = FEATURE_SPECS[feature];
  if (!specs) {
    errores.push(
      `La feature web «${feature}» no está en el mapa FEATURE_SPECS de scripts/check-specs.mjs. ` +
        'Agrega su spec o declara el mapeo explícito.',
    );
    continue;
  }
  for (const spec of specs) {
    specsEsperadas.add(`${spec}.md`);
    if (!specsExistentes.has(`${spec}.md`)) {
      errores.push(
        `La feature web «${feature}» apunta a specs/modulos/${spec}.md, que no existe.`,
      );
    }
  }
}

for (const spec of specsExistentes) {
  if (!specsEsperadas.has(spec)) {
    console.warn(`⚠️  Spec sin módulo/feature asociado (huérfana): specs/modulos/${spec}`);
  }
}

if (errores.length === 0) {
  console.log(
    `✅ Cobertura: ${modulosApi.length} módulos API y ${featuresWeb.length} features web con spec.`,
  );
} else {
  console.error('❌ Cobertura de specs:');
  for (const error of errores) console.error(`   - ${error}`);
}

/* ------------------------------ estructura ------------------------------- */

const plantilla = existsSync(PLANTILLA) ? readFileSync(PLANTILLA, 'utf8') : '';
const seccionesPlantilla = new Set(titulos(plantilla, { incluirCodigo: true }));
const plantillaEsperada = [
  ['proposito', (h) => h.includes('proposito')],
  ['superficies', (h) => h.includes('superficies')],
  ['api', (h) => /(^|\s)(api|endpoint|endpoints|uso|protocolo)(\s|$)/.test(h)],
  ['datos', (h) => h.includes('datos')],
  ['ui', (h) => /(^|\s)(ui|interfaz|cliente web)(\s|$)/.test(h) || h === 'rutas'],
  ['contratos compartidos', (h) => h.includes('contratos')],
  ['pruebas', (h) => h.includes('prueba') || h.includes('test')],
  ['deuda', (h) => h.includes('deuda')],
  ['trazabilidad', (h) => h.includes('trazabilidad')],
  ['proximos pasos', (h) => h.includes('proximos pasos') || h.includes('siguientes pasos')],
];

if (!plantilla) {
  errores.push('No existe specs/templates/module-spec.md (plantilla de specs).');
} else {
  const faltantesPlantilla = plantillaEsperada.filter(
    ([, prueba]) => ![...seccionesPlantilla].some((h) => prueba(h)),
  );
  if (faltantesPlantilla.length > 0) {
    errores.push(
      `La plantilla specs/templates/module-spec.md no tiene las secciones esperadas: ` +
        faltantesPlantilla.map(([nombre]) => nombre).join(', ') + '.',
    );
  }
}

const seccionesMinimas = [
  ['Propósito', (h) => h.includes('proposito')],
  ['Superficies', (h) => h.includes('superficies')],
  ['API/endpoints', (h) => /(^|\s)(api|endpoint|endpoints|uso|protocolo)(\s|$)/.test(h)],
  ['Datos', (h) => h.includes('datos')],
  ['UI', (h) => /(^|\s)(ui|interfaz|cliente web)(\s|$)/.test(h) || h === 'rutas'],
  ['Pruebas', (h) => h.includes('prueba') || h.includes('test')],
  ['Deuda conocida', (h) => h.includes('deuda')],
  ['Trazabilidad', (h) => h.includes('trazabilidad')],
  ['Próximos pasos', (h) => h.includes('proximos pasos') || h.includes('siguientes pasos')],
];

// Módulos sin API propia, sin UI o sin persistencia propia: la sección
// correspondiente no aplica y no se exige (p. ej. `realtime` no tiene tablas,
// `plataforma` es la web de los módulos de plataforma y `audit`/`billing` no
// tienen pantalla).
const SIN_API = new Set(['plataforma']);
const SIN_UI = new Set(['audit', 'billing']);
const SIN_DATOS = new Set(['plataforma', 'realtime']);

let specsRevisadas = 0;
for (const spec of [...specsExistentes].sort()) {
  const archivo = join(SPECS_MODULOS, spec);
  if (!existsSync(archivo)) continue;
  specsRevisadas++;
  const contenido = readFileSync(archivo, 'utf8');
  const cabeceras = titulos(contenido);
  const nombre = spec.replace(/\.md$/, '');
  const faltantes = [];

  if (!/^\*\*Estado:\*\*/m.test(contenido)) faltantes.push('**Estado:**');

  for (const [etiqueta, prueba] of seccionesMinimas) {
    if (etiqueta === 'API/endpoints' && SIN_API.has(nombre)) continue;
    if (etiqueta === 'UI' && SIN_UI.has(nombre)) continue;
    if (etiqueta === 'Datos' && SIN_DATOS.has(nombre)) continue;
    if (!cabeceras.some((h) => prueba(h))) faltantes.push(etiqueta);
  }

  if (faltantes.length > 0) {
    errores.push(`specs/modulos/${spec}: faltan secciones → ${faltantes.join(', ')}.`);
  }
}

if (errores.length === 0) {
  console.log(`✅ Estructura: ${specsRevisadas} specs con Estado y secciones mínimas.`);
}

/* --------------------------------- enlaces -------------------------------- */

for (const [ruta, etiqueta] of [
  [SPECS_README, 'specs/README.md'],
  [SPECS_TRAZABILIDAD, 'specs/trazabilidad.md'],
  [DOCS_INDICE, 'docs/INDICE.md'],
]) {
  if (!existsSync(ruta)) errores.push(`Falta ${etiqueta}, obligatorio para el gate de specs.`);
}

const archivosMarkdown = [
  ...walk(SPECS_DIR, (file) => EXT_MD.test(file)),
  ...(existsSync(DOCS_INDICE) ? [DOCS_INDICE] : []),
];

const enlacesRotos = [];
let enlacesRevisados = 0;

for (const archivo of archivosMarkdown) {
  let contenido = readFileSync(archivo, 'utf8');
  // Los enlaces dentro de código no son enlaces Markdown.
  contenido = contenido
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/`[^`\n]*`/g, '');

  const regex = /!?\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g;
  let match;
  while ((match = regex.exec(contenido)) !== null) {
    let destino = match[1].replace(/^<|>$/g, '').trim();
    if (!destino || /^(?:[a-z][a-z0-9+.-]*:|#|\/\/|\/)/i.test(destino)) continue;

    destino = destino.split('#')[0].split('?')[0];
    if (!destino || destino.includes('{{')) continue;

    enlacesRevisados++;
    let ruta = destino;
    try {
      ruta = decodeURIComponent(destino);
    } catch {
      // Si no se puede decodificar, se valida el texto tal cual.
    }

    if (!existsSync(resolve(dirname(archivo), ruta))) {
      enlacesRotos.push(`${rel(archivo)} → ${destino}`);
    }
  }
}

if (enlacesRotos.length === 0) {
  console.log(
    `✅ Enlaces: ${enlacesRevisados} relativos válidos en ${archivosMarkdown.length} archivos.`,
  );
} else {
  errores.push(
    `Enlaces relativos rotos (${enlacesRotos.length}):\n` +
      enlacesRotos.map((enlace) => `   - ${enlace}`).join('\n'),
  );
}

/* ---------------------------------- diff --------------------------------- */

function archivosCambiados(baseRef) {
  const salida = execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return salida
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);
}

function esCodigo(archivo) {
  if (!archivo.startsWith('apps/') && !archivo.startsWith('packages/')) return false;
  return EXT_CODIGO.test(archivo);
}

function esCompartido(archivo) {
  return COMPARTIDOS.some((prefijo) => archivo === prefijo || archivo.startsWith(prefijo));
}

if (pideDiff) {
  let archivos;
  try {
    archivos = archivosCambiados(base);
  } catch (error) {
    errores.push(
      `No se pudo calcular el diff contra «${base}»: ${error.message.trim()}. ` +
        'Ejecuta `git fetch origin development` o pasa --base <ref>.',
    );
    archivos = [];
  }

  const codigo = archivos.filter(esCodigo);
  const specsCambiadas = archivos.filter((archivo) => archivo.startsWith('specs/'));
  const specsModuloCambiadas = new Set(
    specsCambiadas
      .filter((archivo) => /^specs\/modulos\/[^/]+\.md$/.test(archivo))
      .map((archivo) => archivo.replace(/^specs\/modulos\//, '').replace(/\.md$/, '')),
  );

  console.log(
    `🔍 Diff (${base}): ${archivos.length} archivo(s), ${codigo.length} de código, ` +
      `${specsCambiadas.length} de specs.`,
  );

  if (archivos.length === 0) {
    console.log('✅ Sin cambios en el rango: no exige spec.');
  } else if (codigo.length === 0) {
    console.log('✅ Sin cambios de código: no exige spec.');
  } else if (codigo.length > 0) {
    if (specsCambiadas.length === 0) {
      errores.push(
        'Cambió código y no se tocó nada bajo specs/**.\n' +
          codigo.map((archivo) => `   - ${archivo}`).join('\n') +
          '\n   Actualiza specs/modulos/<m>.md (o specs/trazabilidad.md si el cambio es compartido).',
      );
    }

    const grupos = new Map(); // origen → { specs, archivos }

    for (const archivo of codigo) {
      const api = /^apps\/api\/src\/modules\/([^/]+)\//.exec(archivo);
      if (api) {
        const modulo = api[1];
        const clave = `api:${modulo}`;
        if (!grupos.has(clave)) {
          grupos.set(clave, {
            etiqueta: `el módulo API ${modulo}`,
            specs: [modulo],
            archivos: [],
          });
        }
        grupos.get(clave).archivos.push(archivo);
        continue;
      }

      const feature = /^apps\/web\/features\/([^/]+)\//.exec(archivo);
      if (feature) {
        const nombre = feature[1];
        const specs = FEATURE_SPECS[nombre];
        const clave = `web:${nombre}`;
        if (!grupos.has(clave)) {
          grupos.set(clave, {
            etiqueta: `la feature web ${nombre}`,
            specs: specs ?? [],
            archivos: [],
          });
        }
        grupos.get(clave).archivos.push(archivo);
        continue;
      }
    }

    for (const { etiqueta, specs, archivos: tocados } of grupos.values()) {
      if (specs.length === 0) {
        errores.push(
          `Cambió ${etiqueta} pero no tiene spec mapeada:\n` +
            tocados.map((archivo) => `   - ${archivo}`).join('\n'),
        );
        continue;
      }
      const actualizada = specs.some((spec) => specsModuloCambiadas.has(spec));
      if (!actualizada) {
        errores.push(
          `Cambió ${etiqueta} pero no su spec:\n` +
            tocados.map((archivo) => `   - ${archivo}`).join('\n') +
            `\n   Actualiza ${specs.map((spec) => `specs/modulos/${spec}.md`).join(' o ')}.`,
        );
      }
    }

    const compartidos = codigo.filter(
      (archivo) => !/^apps\/api\/src\/modules\//.test(archivo) &&
        !/^apps\/web\/features\//.test(archivo),
    );
    const trazabilidadCambiada = specsCambiadas.includes('specs/trazabilidad.md');

    if (compartidos.length > 0 && !trazabilidadCambiada && specsModuloCambiadas.size === 0) {
      errores.push(
        'Cambios compartidos sin trazabilidad ni spec de módulo:\n' +
          compartidos
            .map((archivo) => `   - ${archivo}${esCompartido(archivo) ? ' (compartido)' : ''}`)
            .join('\n') +
          '\n   Actualiza specs/trazabilidad.md o la spec del módulo afectado.',
      );
    }

    if (errores.length === 0) {
      console.log('✅ Diff: el código tocado tiene su spec actualizada.');
    }
  }
}

/* --------------------------------- salida -------------------------------- */

if (errores.length > 0) {
  console.error('\n❌ Gate de specs: falló.');
  console.error('   Regla: todo PR de código actualiza la spec del módulo y revisa coherencia.');
  console.error('   Excepción justificada: SPECS_SKIP=1 (o --skip) en la descripción del PR.\n');
  for (const [indice, error] of errores.entries()) {
    console.error(`${indice + 1}. ${error}`);
  }
  process.exit(1);
}

console.log('\n✅ Gate de specs OK.');
