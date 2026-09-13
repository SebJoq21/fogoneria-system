# Fogonería System — AGENTS.md

SaaS ERP gastronómico (parrilla peruana). Monorepo `pnpm + turbo`, Node >=24.

## Estructura

- `apps/web/` — Next.js 16 + React 19 + Tailwind v4. ERP completo con mocks (sin backend aún). Ver `apps/web/AGENTS.md`.
- `apps/api/` — NestJS 12 + Vitest + Oxlint. Scaffold virgen `Hello World`. Ver `apps/api/AGENTS.md`.
- `packages/ui|eslint-config|typescript-config` — starter `create-turbo` sin personalizar. `web` NO usa `@repo/ui` (tiene `components/ui/` propio).
- `docs/arquitectura.md` — mapa del sistema. `docs/decisiones.md` — decisiones vigentes. `docs/SESION.md` — estado última sesión (leer al retomar).

## Comandos (desde raíz)

- `pnpm dev | build | lint | check-types` (vía turbo). Filtros: `turbo run build --filter=web`.
- Web: `pnpm --filter web dev|lint|check-types` (`lint` = eslint + `scripts/check-styles.mjs`).
- API: `pnpm --filter api dev|test|test:e2e|lint` (lint = oxlint).

## Reglas globales

- Commits en español, formato Conventional Commits (`feat/fix/refactor/chore/docs`).
- No commitear `*.tsbuildinfo`, `.next/`, `dist/`, `.env*` (solo `.env.example`).
- Verificar antes de cerrar: `lint + check-types`; en api además `vitest run` si tocó `src/`.
- Tareas chicas y enfocadas; `@explore` para búsquedas amplias, no leer 100+ archivos en el hilo principal.

## Memoria entre sesiones

- Al retomar: leer `docs/SESION.md` + `git log --oneline -10` + `git status --short`.
- Al cerrar un tema o con `/guardar-contexto`: actualizar `docs/SESION.md` (objetivo, hecho con `ruta:línea`, pendiente, próximo paso). Corto, sin pegar código.
- Decisiones nuevas que cambien arquitectura → `docs/decisiones.md`, no solo al chat.
