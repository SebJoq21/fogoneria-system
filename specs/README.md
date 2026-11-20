# Especificaciones — Fogonería System

Repositorio de **especificaciones vivas** dentro del monorepo (docs-as-code). Responde, por módulo, qué existe, qué está mock, qué falta y dónde vive cada pieza.

> Última revisión: **2026-11-19** · Fase 3 de modularización completa (6/6 olas, baseline de fronteras **0**) · Fase 4 en curso (etapas 1 y 2 extraídas; etapa 3 empezando por catálogo).

## Relación con `docs/`

| Carpeta | Qué guarda | Cuándo se actualiza |
|---|---|---|
| `specs/` | **Estado actual**: contrato de cada módulo, superficies (API/web), datos, pruebas, deuda y próximos pasos. | En el mismo PR que cambia el contrato, la UI o el estado del módulo. |
| `docs/` | **Historia y operación**: arquitectura, decisiones (ADR), modelo de datos, runbooks, actas de QA, fichas de sprint y bitácora de sesión. | Cuando se toma una decisión, se cierra un sprint o se despliega. |

- No se duplica contenido: si un tema ya está explicado en `docs/`, la spec enlaza.
- `docs/` no se mueve (hay enlaces externos y en `opencode.json`). La portada de `docs/` es [INDICE](../docs/INDICE.md).
- `docs/SESION.md` es memoria operativa de la sesión; **no** es una spec.

## Mapa de `specs/`

```text
specs/
  README.md                     este índice
  templates/module-spec.md      plantilla de spec de módulo
  producto/
    vision.md                   qué es Fogonería, alcance SaaS y principios
    roles-permisos.md           roles web, RBAC y rutas por rol
    flujos.md                   flujos críticos end-to-end
  modulos/
    <modulo>.md                 una spec por módulo (grupo backend + su feature web)
  operacion/
    despliegue.md               resumen y enlace al runbook
    calidad.md                  gates locales, CI y verificación de despliegue
  trazabilidad.md               Jira → módulo → PR/commit → estado → evidencia
```

## Convenciones

1. **Idioma:** español técnico, sin relleno.
2. **Rutas reales:** toda ruta de archivo o endpoint debe existir en el repo; si no se pudo verificar, se marca `pendiente de verificar`.
3. **Estado del módulo** (valores cerrados):
   - `API real` — la UI opera contra la API; no hay mock en el flujo.
   - `Mixto` — parte del flujo es real y parte demo/mock (se detalla).
   - `Demo` — solo estado local/`localStorage`; no hay endpoints conectados.
4. **Nombres de tablas** en `snake_case` (los del `schema.prisma`).
5. **Enlaces relativos**, nunca absolutos de máquina.
6. **Sin secretos** ni credenciales reales; la contraseña demo solo se referencia desde `README.md`.

## Cómo actualizar una spec

1. Copia `templates/module-spec.md` si el módulo es nuevo.
2. Cambia solo lo que el PR cambió: endpoints, tabla, migración, ruta, contrato, test, estado.
3. Actualiza `trazabilidad.md` si la tarea Jira cambió de estado o apareció un PR.
4. Si la decisión es arquitectónica, registra además en `docs/decisiones.md` (no solo en la spec).
5. Verifica que cada ruta relativa exista antes de cerrar el PR (los enlaces se revisan en el mismo PR que la spec).

## Índice de módulos

### Plataforma
- [auth](modulos/auth.md) · [tenant](modulos/tenant.md) · [onboarding](modulos/onboarding.md) · [saas](modulos/saas.md) · [billing](modulos/billing.md) · [audit](modulos/audit.md) · [plataforma (web)](modulos/plataforma.md)

### Operación
- [tables](modulos/tables.md) · [reservations](modulos/reservations.md) · [orders](modulos/orders.md) · [realtime](modulos/realtime.md)

### Dinero
- [cash](modulos/cash.md) · [receipts](modulos/receipts.md) · [expenses](modulos/expenses.md)

### Catálogo y comercial
- [catalog](modulos/catalog.md) · [pricing](modulos/pricing.md) · [promotions](modulos/promotions.md)

### Inventario y personas
- [inventory](modulos/inventory.md) · [crm](modulos/crm.md) · [staff](modulos/staff.md)

### Lectura
- [bi](modulos/bi.md)

### Producto y operación
- [vision](producto/vision.md) · [roles y permisos](producto/roles-permisos.md) · [flujos](producto/flujos.md)
- [despliegue](operacion/despliegue.md) · [calidad](operacion/calidad.md) · [trazabilidad](trazabilidad.md)

## Estado global (resumen)

| Área | Estado | Evidencia |
|---|---|---|
| API NestJS | 20 módulos, 17 controladores, 106 endpoints, Swagger en `/api/docs` | [arquitectura](../docs/arquitectura.md) |
| Datos | 43 modelos Prisma, 14 migraciones, RLS + soft-delete + inmutabilidad | [modelo-datos](../docs/modelo-datos.md), [rls-modelo](../docs/rls-modelo.md) |
| Web | 38 `page.tsx`, 12 features migradas, resto en `components/erp/*` | [apps/web/AGENTS.md](../apps/web/AGENTS.md) |
| Modularización | Fase 3 completa; baseline de fronteras 0 | [MODULARIZACION](../docs/MODULARIZACION.md) |
| Producción | Vercel (web) + Railway (API + Postgres) | [despliegue](../docs/despliegue.md) |
