# auth — especificación

**Estado:** API real · **Última revisión:** 2026-11-19

## 1. Propósito

Autenticar usuarios contra la base, emitir el access token JWT y el ticket efímero para WebSockets. Valida que el usuario esté activo y que el **estado del tenant** permita operar.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/auth/` | real |
| Web | `apps/web/features/plataforma/LoginPage.tsx` + BFF `app/api/session/` | real |
| Contrato | `packages/contracts/src/plataforma.ts` (`RespuestaLogin`, `rolDesdeApi`) | sí |
| Datos | `usuarios`, `empresas` | `20261019000000_init`, `20261020130000_email_global` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | público | Valida email+bcrypt, usuario `ACTIVO` y estado del tenant; devuelve JWT y usuario |
| `GET` | `/api/v1/auth/me` | autenticado | Usuario del token |
| `POST` | `/api/v1/auth/ws-ticket` | autenticado con empresa | JWT de 60 s con `scope: 'ws'` |

Reglas:
- Rechaza tenants `SUSPENDED`, `EXPIRED`, `LEAD`, `NO_CALIFICADO` y trial vencido.
- Si el email existe en más de un tenant, responde **409** (no elige uno al azar).
- `JwtStrategy` **rechaza cualquier token con `scope`**: un ticket WS no abre la API HTTP.
- El login lo consume el BFF; el navegador no recibe el access token.

## 4. Datos

- `usuarios`: `email`, `password_hash` (bcrypt), `rol`, `estado`, `empresa_id`, `sucursal_id`.
- `empresas`: `estado`, `trial_fin`, `plan_actual`.
- Único parcial `uq_usuarios_email_activo` (`deleted_at IS NULL`): un email soft-deleted libera el correo.

## 5. UI y rutas

- `/` login limpio (sin cuentas demo en pantalla); «¿Olvidaste tu contraseña?» → `/recuperar`.
- `lib/auth.ts` mapea rol API → rol web y **falla cerrado** ante rol/sucursal desconocidos.
- `proxy.ts` aplica `canViewPath` con la cookie firmada; el rol no se puede alterar desde DevTools.

## 6. Pruebas

| Suite | Archivo |
|---|---|
| Unit | `src/modules/auth/auth.service.spec.ts` |
| Unit (SUNAT) | `src/common/utils/ruc.spec.ts` |
| e2e | `test/auth.e2e-spec.ts` |
| DB | `test/db/email-global.db-spec.ts` |
| Web | `lib/auth.test.ts`, `lib/session.test.ts`, `proxy.test.ts`, `app/api/session/route.test.ts` |

## 7. Deuda conocida

- Sin refresh token: la sesión web se refresca por cookie deslizante (15 min) con tope de 8 h; el rol del JWT es inmutable en ese lapso.
- No hay reset de contraseña automático: `/recuperar` abre `mailto:` a soporte.
- `JWT_SECRET`/`SESSION_SECRET` de demo deben rotarse antes de usuarios reales (`docs/despliegue.md`).

## 8. Trazabilidad

- Jira: AYCDS-48 (auth), AYCDS-55 (sesión), AYCDS-14 (ticket WS).
- PRs: #2 (`feat/api-david`), #4/#5 (sesión HttpOnly), #13 (ticket WS).
- Specs: [plataforma](plataforma.md) · [roles](../producto/roles-permisos.md).

## 9. Próximos pasos

1. Definir política de rotación de secretos y de la contraseña demo del seed.
2. Evaluar refresh token explícito si se requiere sesión > 8 h.
