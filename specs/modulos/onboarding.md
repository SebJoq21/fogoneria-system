# onboarding — especificación

**Estado:** API real · **Última revisión:** 2026-11-19

## 1. Propósito

Dar de alta una empresa desde el sitio público con el mínimo fricción: razón social, RUC (módulo 11) y logo. Crea el tenant en `TRIAL` con su sucursal matriz, un administrador y una lista de precios inicial, en una sola transacción.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/onboarding/` | real |
| Web | `apps/web/features/plataforma/OnboardingPage.tsx` + `DropZone.tsx` | real |
| Contrato | `packages/contracts/src/plataforma.ts` (`validarOnboarding`, `toOnboardingPayload`, `isValidRuc`) | sí |
| Datos | `empresas`, `sucursales`, `usuarios`, `listas_precios`, `leads_cotizaciones`, `auditoria` | `20261019000000_init`, `20261020120400_rls_onboarding` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `POST` | `/api/v1/onboarding` | público (`@Public()`) | Alta transaccional de empresa `TRIAL` |

Reglas:
- **RUC SUNAT**: `checkDigit = (11 - (sum % 11)) % 10` con resto 0→1 y 1→0; un dígito inválido da **400**.
- RUC o email duplicado → **409**; el DTO usa `forbidNonWhitelisted`, así que enviar `plan` da **400** y el servicio fuerza `TRIAL` + `mrr_monto: 0`.
- Logo viaja como data URL (≤ ~2 MB). El body parser acepta **4 MB solo en esta ruta**; el resto de la API queda en 100 KB.
- Rate limit en memoria: 5 intentos / 10 min por IP (`ONBOARDING_RATE_LIMIT`, `ONBOARDING_RATE_WINDOW_MS`).
- Crea: empresa, sucursal matriz, admin `ADMIN_GLOBAL` con bcrypt, lista «Carta», lead `GANADO` y evento de auditoría.

## 4. Datos

- `empresas` (`estado = TRIAL`, `logo_url`), `sucursales`, `usuarios`, `listas_precios`, `leads_cotizaciones`.
- La política INSERT de RLS permite el alta con el rol de onboarding; ver `docs/rls-modelo.md`.

## 5. UI y rutas

- `/onboarding`: wizard de 3 pasos con validación de RUC y logo por archivo o URL.
- Auto-login al terminar y redirect por `ROLE_HOME`.
- El BFF tiene **una única excepción pública**: `POST /onboarding` (cualquier otra ruta exige cookie firmada).

## 6. Pruebas

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

| Suite | Archivo |
|---|---|
| Unit | `src/modules/onboarding/onboarding.service.spec.ts`, `src/common/utils/ruc.spec.ts` |
| e2e | `test/onboarding.e2e-spec.ts` (DTO, `plan` prohibido, 201, 429) |
| Unit (rate limit) | `src/common/guards/rate-limit.guard.spec.ts` |

## 7. Deuda conocida

- Rate limit en memoria: no sirve con más de una instancia (migrar a Redis).
- No hay storage de imágenes: el logo vive como data URL en la base.
- No hay verificación del RUC contra SUNAT, solo dígito verificador.

## 8. Trazabilidad

- Jira: AYCDS-57.
- PRs: #3 (`feat/web-conexion-api`), #9 (BFF público).
- Docs: [arquitectura](../../docs/arquitectura.md), [decisiones](../../docs/decisiones.md).

## 9. Próximos pasos

1. Storage de logo (S3/R2) y límite de tamaño real.
2. Rate limit distribuido antes de exponer el alta masivamente.
