# Despliegue — resumen

**Última revisión:** 2026-11-19. El runbook completo, con gotchas y verificación, vive en [docs/despliegue.md](../../docs/despliegue.md). Aquí solo el mapa y los enlaces.

## 1. Topología

| Pieza | Plataforma | Detalle |
|---|---|---|
| Web Next.js 16 | Vercel | `fogoneria-system.vercel.app`, root `apps/web`, Node 24, Production Branch `development` |
| API NestJS 12 | Railway | `fogoneria-system-production.up.railway.app`, puerto 3001, Dockerfile desde la raíz del monorepo |
| PostgreSQL 18 | Railway | schema `fogoneria` (`public` vacío) |
| Realtime | Railway (mismo API) | Socket.io namespace `/orders` |

Vercel no tiene base de datos: el navegador llama al BFF y este a Railway.

## 2. Variables críticas

| Variable | Dónde | Nota |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Vercel | `https://…/api/v1` |
| `NEXT_PUBLIC_REALTIME_URL` | Vercel | Host del socket (sin `/api/v1`) |
| `SESSION_SECRET` | Vercel | Firma la cookie de sesión |
| `SESSION_COOKIE_SECURE` | Vercel | `true` en producción |
| `DATABASE_URL` | Railway | Rol de migraciones |
| `DATABASE_URL_RLS` | Railway | `fogoneria_rls` (sin `BYPASSRLS`) |
| `DATABASE_URL_SAAS` | Railway | `fogoneria_saas` (con `BYPASSRLS`) |
| `JWT_SECRET` | Railway | Rotar antes de usuarios reales |
| `STOCK_WEBHOOK_URL` / `_SECRET` | Railway | Opcional; sin URL el cron solo audita |

## 3. Orden de despliegue

1. Railway: `preDeploy` ejecuta `npx prisma migrate deploy` y healthcheck `/api/v1/health` (120 s).
2. Roles RLS: `apps/api/prisma/rls-roles.ts` (PR #69) provisiona `fogoneria_rls` y `fogoneria_saas`.
3. Vercel: build desde `apps/web`; el `output: standalone` está desactivado en Vercel (`next.config.ts`).
4. Verificación rápida: health, login, `/tenant`, `/catalog/dishes`, `/orders/board`, `/bi/pnl`.

> **No** se ejecuta `FORCE ROW LEVEL SECURITY` en producción: con roles separados no hace falta y bloquearía migraciones/seed.

## 4. Riesgos abiertos

- Rotar `JWT_SECRET` y `SESSION_SECRET` antes de abrir a usuarios reales.
- Decidir si el **seed demo** sigue público (hoy la contraseña es conocida).
- Revisar `CORS_ORIGIN` y el rate limit del onboarding (en memoria).
- Sin Redis adapter, la API no escala horizontalmente para WebSockets.

## 5. Enlaces

- Runbook y gotchas: [despliegue](../../docs/despliegue.md)
- Respaldo y recuperación: [respaldo-recuperacion](../../docs/respaldo-recuperacion.md)
- Calidad y gates: [calidad](calidad.md)
- Decisión de RLS y roles: [rls-modelo](../../docs/rls-modelo.md)
