# Fogonería System — AGENTS.md

SaaS ERP gastronómico (parrilla peruana). Monorepo `pnpm + turbo`, Node >=24.

## Estructura

- `apps/web/` — Next.js 16 + React 19 + Tailwind v4. ERP completo con mocks (sin backend aún). Ver `apps/web/AGENTS.md`.
- `apps/api/` — NestJS 12 + Vitest + Oxlint. Scaffold virgen `Hello World`. Ver `apps/api/AGENTS.md`.
- `packages/ui|eslint-config|typescript-config` — starter `create-turbo` sin personalizar. `web` NO usa `@repo/ui` (tiene `components/ui/` propio).
- `docs/arquitectura.md` — mapa del sistema. `docs/decisiones.md` — decisiones vigentes. `docs/SESION.md` — estado última sesión (leer al retomar). `docs/INDICE.md` — portada de docs. `specs/README.md` — specs por módulo y trazabilidad (leer antes de tocar un módulo).

## Comandos (desde raíz)

- `pnpm dev | build | lint | check-types` (vía turbo). Filtros: `turbo run build --filter=web`.
- Web: `pnpm --filter web dev|lint|check-types` (`lint` = eslint + `scripts/check-styles.mjs`).
- API: `pnpm --filter api dev|test|test:e2e|lint` (lint = oxlint).

## Reglas globales

- Commits en español, formato Conventional Commits (`feat/fix/refactor/chore/docs`).
- Ramas desde `development`; no commitear directo en `main`.
- No commitear `*.tsbuildinfo`, `.next/`, `dist/`, `.env*` (solo `.env.example`).
- Verificar antes de cerrar: `lint + check-types`; en api además `vitest run` si tocó `src/`.
- Tareas chicas y enfocadas; `@explore` para búsquedas amplias, no leer 100+ archivos en el hilo principal.
- Paridad de módulos: el mismo ID debe existir en `apps/api/src/modules/<id>`, `apps/web/features/<id>`, `packages/contracts/src/<id>.ts` y `specs/modulos/<id>.md`; si el módulo tiene tablas, sus modelos viven en `apps/api/prisma/schema/<id>.prisma` (lo compartido en `core.prisma`). Un PR toca un solo módulo y evita archivos generados/compartidos. Ver `docs/plan-paridad-modulos.md` y `pnpm check:modules`.

## Seguimiento de tareas

- Al terminar cualquier tarea de `docs/TAREAS-SEMANAS-5-8.md`, actualizar ese archivo: estado, % por tarea, % global (promedio simple), evidencia y bitácora.
- Actualizar también el estado y comentario en Jira (`AYCDS-*`) con la evidencia.
- No marcar una tarea como Listo si no cumple el DoD o si su dependencia dura no existe.
- Todo PR que cambie código actualiza `specs/modulos/<m>.md` (estado/endpoints/tablas/UI/tests/deuda) y revisa coherencia; `pnpm check:specs` es gate en CI (job `Specs al día`). Excepción `SPECS_SKIP=1` justificada en el PR; el reviewer verifica coherencia.

## Memoria entre sesiones

- Al retomar: leer `docs/SESION.md` + `git log --oneline -10` + `git status --short`.
- Al cerrar un tema o con `/guardar-contexto`: actualizar `docs/SESION.md` (objetivo, hecho con `ruta:línea`, pendiente, próximo paso). Corto, sin pegar código.
- Decisiones nuevas que cambien arquitectura → `docs/decisiones.md`, no solo al chat.
