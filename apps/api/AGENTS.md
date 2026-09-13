# apps/api — AGENTS.md

NestJS 12 + ESM puro (`"type": "module"`, `module/nodenext`). Vitest 4 (no Jest), Oxlint (no ESLint).

## Dónde está qué

- `src/main.ts` — bootstrap, puerto `3001`. `src/app.module.ts|app.controller.ts|app.service.ts` — scaffold `Hello World`.
- `test/app.e2e-spec.ts` — e2e. Configs: `vitest.config.ts` (unit `*.spec.ts`), `vitest.config.e2e.ts`, `oxlint.json`, `nest-cli.json`.

## Reglas api

- Imports internos SIEMPRE con sufijo `.js` (ej: `./app.module.js`). Sin eso rompe `nodenext`.
- Estructura por dominio al crecer: `src/modules/<dominio>/{*.controller.ts,*.service.ts,*.dto.ts}`. No acumular en `app.*`.
- Al agregar endpoint con DTO: activar `ValidationPipe` global + `class-validator/class-transformer` (hoy ausente).
- No hay DB/auth/config aún (decisión: Postgres + Prisma en fase 3, ver `docs/decisiones.md`). No inventar otro ORM sin actualizar decisiones.
- `strictPropertyInitialization: false` en `tsconfig.json` — no confiarse, inicializar igual.

## Comandos

- `pnpm --filter api dev | build | test | test:e2e | lint | check-types`.
- `test` = `vitest run` (unit), `test:e2e` usa su propio config.
