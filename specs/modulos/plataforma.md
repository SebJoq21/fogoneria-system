# plataforma (web) — especificación

**Estado:** Mixto (login/onboarding/SaaS reales; recuperación por correo) · **Última revisión:** 2026-11-19

## 1. Propósito

Feature web que agrupa **todo lo que ocurre fuera del ERP**: login, recuperación de acceso, alta pública de empresa y consola SaaS. No tiene módulo backend propio: consume `auth`, `tenant`, `onboarding`, `saas` y `billing`.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Web | `apps/web/features/plataforma/` | real |
| Backend | `auth`, `tenant`, `onboarding`, `saas`, `billing`, `audit` | real |
| Contrato | `packages/contracts/src/plataforma.ts` | sí |
| Sesión | `lib/session.ts`, `lib/backend.ts`, `proxy.ts`, `app/api/session/**`, `app/api/backend/**` | autoridad, no se mueve |

Archivos:
- `api.ts` (`plataformaApi`: onboarding, SaaS y mapeo de tenant).
- `LoginPage.tsx`, `RecoverPage.tsx`, `OnboardingPage.tsx`, `DropZone.tsx`, `SaasPage.tsx`.
- `plataforma.test.ts`.

## 3. Rutas

| Ruta | Vista | Público |
|---|---|---|
| `/` | `LoginPage` | sí (si hay sesión, redirige por rol) |
| `/recuperar` | `RecoverPage` | sí |
| `/onboarding` | `OnboardingPage` | sí |
| `/saas` | `SaasPage` | no (`SUPERADMIN`) |
| `/terminos` | estática | sí |

## 4. Reglas

- **El login es solo inicio de sesión**: sin botones de cuentas demo ni CTA de registro.
- «¿Olvidaste tu contraseña?» abre `mailto:` a soporte (`lib/support.ts`); no simula correo automático.
- La sesión no se toca en la feature: `SessionProvider` (`components/dashboard/providers/session.tsx`) maneja login/logout, expone `ready` (fin de la hidratación) y `ModulesProvider` lo reexpone.
- Con sesión, el shell nunca pinta datos demo.
- `RecoverPage` no está en el matcher de `proxy.ts`: es pública.

## 5. Pruebas

| Suite | Archivo |
|---|---|
| Web | `features/plataforma/plataforma.test.ts` |
| Web sesión | `lib/session.test.ts`, `proxy.test.ts`, `app/api/session/**/*.test.ts` |
| Web soporte | `lib/support.test.ts` |

## 6. Deuda conocida

- No hay endpoint de reset de contraseña; el flujo es manual por soporte.
- El formulario de recuperación depende del cliente de correo del usuario.

## 7. Trazabilidad

- Jira: AYCDS-57, AYCDS-65, AYCDS-55.
- PRs: #3, #4/#5, #64 (feature), #71 (login limpio + recuperación).
- Docs: [despliegue](../../docs/despliegue.md), [roles](../producto/roles-permisos.md).

## 8. Próximos pasos

1. Endpoint de solicitud de reset con token de un uso (cuando exista correo transaccional).
2. Migrar las vistas a `useSession` y retirar `login`/`logout` de `useModules` (Fase 4, etapa 4).
