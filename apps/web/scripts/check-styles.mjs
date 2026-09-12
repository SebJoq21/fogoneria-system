/**
 * Gate de sistema de diseño (patrón docs: componentes > strings sueltas).
 * Falla si encuentra recetas crudas fuera de su única fuente:
 *  - components/ui/*  (componentes canónicos)
 *  - app/globals.css  (tokens @theme)
 *  - app/demo/*       (marcas de clientes, exentas)
 *
 * Uso: node scripts/check-styles.mjs  (integrado en `pnpm lint`)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_DIR = join(fileURLToPath(import.meta.url), "..", "..");

const EXEMPT_DIRS = ["components/ui", "app/demo"];
const EXEMPT_FILES = ["app/globals.css"];

/** [descripción, regex] — todo match fuera de exentos es violación. */
const RULES = [
  ["const inputCls/inputClass duplicado (usar ui/TextInput)", /const input(Class|Cls)\s*=/],
  [
    "input píldora crudo (usar ui/TextInput)",
    /<(input|textarea)[^>]*w-full px-4 h-10 rounded-full border border-ink-900\/15/,
  ],
  [
    "textarea cruda (usar ui/Textarea)",
    /<textarea[^>]*w-full px-4 py-2\.5 rounded-2xl border border-ink-900\/15/,
  ],
  [
    "CTA primaria cruda en <button> (usar ui/Button)",
    /<button[^>]*bg-primary text-white/,
  ],
  [
    "card cruda (usar ui/Card)",
    /bg-surface rounded-2xl border border-ink-900\/10 p-4/,
  ],
];

function isExempt(rel) {
  if (EXEMPT_FILES.includes(rel)) return true;
  return EXEMPT_DIRS.some((d) => rel === d || rel.startsWith(d + "/"));
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      yield* walk(full);
    } else if (name.endsWith(".tsx") || name.endsWith(".ts")) {
      yield full;
    }
  }
}

const violations = [];
for (const root of [join(WEB_DIR, "app"), join(WEB_DIR, "components")]) {
  for (const full of walk(root)) {
    const rel = relative(WEB_DIR, full).split(sep).join("/");
    if (isExempt(rel)) continue;
    const lines = readFileSync(full, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const [label, re] of RULES) {
        if (re.test(line)) violations.push(`${rel}:${i + 1} [${label}] :: ${line.trim().slice(0, 100)}`);
      }
    });
  }
}

if (violations.length > 0) {
  console.error(`check-styles: ${violations.length} violación(es) del sistema de diseño:\n`);
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log("check-styles: OK (0 violaciones)");
