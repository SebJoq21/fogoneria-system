## Qué hace este PR

<!-- Una frase: qué cambia y para quién. -->

## Módulo

<!-- Marca UNO. Es la regla del repo: un PR = un módulo. -->

- [ ] catálogo y precios
- [ ] promociones y combos
- [ ] órdenes, KDS y mozo
- [ ] mesas y reservas
- [ ] caja
- [ ] comprobantes
- [ ] inventario
- [ ] gastos
- [ ] CRM y fidelización
- [ ] RRHH y propinas
- [ ] BI y analíticas
- [ ] plataforma (auth, sesión, SaaS, onboarding, billing, auditoría)
- [ ] datos e infraestructura (migraciones, RLS, respaldos)
- [ ] CI, Docker y QA
- [ ] documentación / chore (sin módulo de negocio)

## Checklist

- [ ] El PR toca **un solo módulo** (o lleva la etiqueta `multi-modulo` con justificación).
- [ ] `pnpm lint` y `pnpm check-types` en verde.
- [ ] Tests del módulo en verde (unit; e2e/DB si toca datos o contrato).
- [ ] Si cambia un contrato (endpoint, payload, evento): docs actualizadas y aviso al equipo.
- [ ] Sin secretos, credenciales ni datos reales.
- [ ] Evidencia para el reviewer (captura, log o respuesta de la API).

## Revisión

- [ ] Revisado por otra persona cuando sea posible (obligatorio al activar CODEOWNERS).
- [ ] El reviewer verificó el alcance del módulo y la evidencia.

## Issue / tarea

Ref: AYCDS-__

## Notas para el reviewer

<!-- Qué mirar primero, qué riesgo hay, qué quedó fuera. -->
