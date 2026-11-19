# Despliegue — Vercel + Railway

Estado vigente al **2026-11-19**. Este documento es el runbook de producción; la sesión de deploy lo verificó de punta a punta.

## Mapa

| Pieza | Plataforma | Detalle |
|---|---|---|
| Web Next.js 16 | Vercel | `fogoneria-system.vercel.app`, root `apps/web`, Node 24 |
| API NestJS 12 | Railway | `fogoneria-system-production.up.railway.app`, target port `3001` |
| PostgreSQL 18 | Railway | schema `fogoneria`; `public` queda vacío |
| Realtime | Railway (mismo API) | Socket.io `/orders` |

Vercel **no tiene base de datos**: el navegador llama al BFF y este a la API de Railway.

## Vercel

- Proyecto: `fogoneria-system` (`prj_Fp8hCPO8x82wFjvuADXsJu5rASj1`, team `ankarmins-projects`).
- **Production Branch: `development`**. Ojo: el campo ya no está en Settings → Git; se cambia en **Settings → Environments → Production → Branch Tracking**. Por API funciona `PATCH /v9/projects/{id}/branch` con `{ "branch": "development" }`; `PATCH /v9/projects/{id}` con `link.productionBranch` se descarta.
- Producción actual: `development@9771f72` (login limpio, `/recuperar` 200, BFF login 200).
- Variables (production/preview/development):
  - `NEXT_PUBLIC_API_URL=https://fogoneria-system-production.up.railway.app/api/v1`
  - `NEXT_PUBLIC_REALTIME_URL=https://fogoneria-system-production.up.railway.app`
  - `SESSION_SECRET` (64 chars)
  - `SESSION_COOKIE_SECURE=true`
- `apps/web/next.config.ts`: `output = process.env.VERCEL ? undefined : "standalone"`. Next 16.3 + standalone rompe el build de Vercel (`ENOENT next-server.js.nft.json`); el Dockerfile sigue usando standalone.

## Railway

- Proyecto: `test-fogoneria` (`14d0c06c-f2dd-488d-9e97-79bbdf157e7d`), entorno `production`.
- Servicios: `fogoneria-system` (API, `5d15fe4a-6c4c-4995-9885-ae4bb09c58a7`) y `Postgres 18`.
- API: repo `kallanka-org/fogoneria-system`, rama `development`, root `/` + `dockerfilePath apps/api/Dockerfile`, `node dist/main.js`, healthcheck `/api/v1/health` (120 s), **preDeploy `npx prisma migrate deploy`**, watchPatterns `apps/api`, `packages/contracts`, `packages/kernel`, lock/package/workspace/turbo, **Wait for CI**.
- Los Dockerfiles asumen **contexto = raíz del monorepo**. Con `rootDirectory /apps/api` fallan (`packages/ui/package.json: not found`).

## Datos y RLS

- Schema `fogoneria` (por eso Postgres → Data se ve vacío si el dropdown está en `public`).
- 14 migraciones aplicadas. Seed demo: 1 empresa, 6 usuarios, 3 sucursales, 6 platos. Admin demo: `admin@mirestaurante.com` / `Fogoneria123!`.
- Roles provisionados con `apps/api/prisma/rls-roles.ts` (PR #69):
  - `fogoneria_rls`: login, **sin** `BYPASSRLS` → `DATABASE_URL_RLS`.
  - `fogoneria_saas`: login, **con** `BYPASSRLS` → `DATABASE_URL_SAAS`.
  - `DATABASE_URL` sigue en `postgres` solo para migraciones.
- **No** se ejecuta `FORCE ROW LEVEL SECURITY`: con roles separados no hace falta y forzar bloquearía migraciones/seed, que conectan como dueño.
- Verificado tras el cambio: `health` 200, login 200, `/tenant`, `/tenant/branches`, `/catalog/dishes`, `/tables`, `/orders/board` y `/bi/pnl` 200 con datos.

## Gotchas

1. Un redeploy de Railway reutiliza el snapshot del deployment anterior, incluido `preDeployCommand`; un cambio de config solo aplica en un **deployment nuevo**.
2. `connect-service-source` con el mismo commit se **skippea** si no cambian los watch paths.
3. `update-service` **no** dispara deploy; `set-variables` sí (salvo `skipDeploys=true`).
4. Dockerfiles con contexto raíz; no mover a `rootDirectory /apps/api`.
5. Next 16.3 + standalone en Vercel: usar el condicional de `next.config.ts` (PR #67).
6. `productionBranch` no se cambia con el MCP de Vercel; usar `PATCH /v9/projects/{id}/branch`.
7. Turbo oculta variables no declaradas en `globalEnv`; las `NEXT_PUBLIC_*` y `SESSION_*` están en `turbo.json` (PR #68).
8. En PowerShell, `orca orchestration send` con llaves o `$` rompe el parser; escribir las referencias sin llaves.

## Seguridad pendiente

Antes de abrir el entorno a usuarios reales:

- Rotar `JWT_SECRET` y `SESSION_SECRET`.
- Decidir si el **seed demo** sigue en un entorno público: hoy cualquiera con la contraseña conocida entra como administrador.
- Revisar `CORS_ORIGIN` (hoy incluye los aliases de Vercel) y el rate limit del onboarding.

## Verificación rápida

```bash
curl -fsS https://fogoneria-system-production.up.railway.app/api/v1/health
curl -fsS -X POST https://fogoneria-system-production.up.railway.app/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@mirestaurante.com","password":"Fogoneria123!"}'
curl -fsS https://fogoneria-system.vercel.app/recuperar
```
