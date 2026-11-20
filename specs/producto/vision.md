# Visión de producto

**Última revisión:** 2026-11-19 · **Alcance:** MVP académico-operativo (piloto) con arquitectura de SaaS real.

## 1. Qué es Fogonería

ERP gastronómico para restaurantes de parrilla peruana: cubre el ciclo completo **salón → comanda → cocina → caja → comprobante**, más catálogo con listas de precios, inventario por escandallo, CRM con puntos, RRHH con propinas, BI y consola SaaS para dar de alta empresas.

No es un POS aislado: la operación (mesas, órdenes, caja, kardex) está **scoped por sucursal** y el maestro (catálogo, clientes, proveedores, insumos) es **global por empresa**.

## 2. Problema y propuesta

| Dolor del restaurante | Cómo lo resuelve |
|---|---|
| Comandas en papel o WhatsApp | Comanda digital con KDS en vivo y SLA de 20 min |
| Precios desactualizados o manipulables | El **servidor** resuelve el precio; el cliente no puede enviarlo |
| Descuadre de caja y comprobantes sin correlativo | Turno con arqueo, cobro único por caja y serie SUNAT por tipo |
| Inventario que no cuadra con las ventas | Kardex automático por receta al pasar a `ENTREGADO` |
| Clientes sin seguimiento | Segmento derivado de visitas + puntos por consumo (worker) |
| Propinas repartidas a mano | Pozo diario exacto al céntimo entre los presentes |
| Dueño sin visibilidad | P&L, ranking de platos y cobros por método en día de Lima |

## 3. Usuarios y roles

Seis roles web (`superadmin`, `admin`, `sucursal`, `cajero`, `cocina`, `mesero`) mapeados 1:1 desde el enum `rol_usuario` de la API, más `ANFITRION`/`BARMAN` que existen en la base pero **no** tienen shell web. Detalle en [roles-permisos](roles-permisos.md).

## 4. Alcance SaaS

```text
Superadmin (consola /saas)
  └── Empresa (tenant, RUC único, plan TRIAL|BASICO|PROFESIONAL, estado LEAD|TRIAL|ACTIVE|SUSPENDED|EXPIRED)
        ├── Sucursal 1..N (operación)
        │     ├── Mesas y reservas
        │     ├── Órdenes / KDS
        │     ├── Caja y comprobantes
        │     └── Inventario (stock por sucursal)
        ├── Catálogo y precios (global de la empresa)
        ├── Clientes y fidelidad (global de la empresa)
        └── Personal (asignado a sucursal)
```

- **Aislamiento:** `empresa_id` en casi todas las tablas y `sucursal_id` en operación; RLS de PostgreSQL + extensión de Prisma. Ver [rls-modelo](../../docs/rls-modelo.md).
- **Alta:** wizard público `/onboarding` (RUC módulo 11 + logo) crea empresa `TRIAL`, sucursal matriz, admin y lista de precios en una transacción.
- **Ciclo de vida:** `TRIAL → EXPIRED` al vencer `trial_fin`; `EXPIRED → SUSPENDED` tras la gracia (5 días por defecto), por cron diario 03:00.
- **Aislamiento del demo:** sin sesión el web usa datos demo (`DEMO_COMPANY`/`GENERAL_BRANCH`); con sesión **nunca** cae a demo.

## 5. Principios (no negociables)

1. **El servidor manda.** Precio, descuento, IGV, `mesero_id`, folio y estados se calculan/validan en la API. El cliente no envía importes ni identidades.
2. **La contabilidad no se edita, se compensa.** Caja, kardex, puntos, auditoría y comprobantes son append-only; una anulación inserta el movimiento contrario por trigger.
3. **Aislamiento por diseño.** Toda query de negocio pasa por `prisma.scoped` y RLS; `findUnique/update/delete` se validan en el servicio.
4. **Módulos independientes.** Un módulo importa solo el `index.js` público de otro; los contratos viven en `@fogoneria/contracts`. Baseline de fronteras en **0**.
5. **Degradación honesta.** Sin sesión hay demo; con sesión, si la API falla se muestra el error, no datos falsos. SUNAT se muestra «pendiente de OSE» en vez de simular un CDR.
6. **Trazabilidad.** Cada cambio relevante deja tarea Jira, PR y evidencia (ver [trazabilidad](../trazabilidad.md)).

## 6. Fuera de alcance (piloto)

- Integración real con OSE/SUNAT (solo estructura de comprobante y estados).
- Pasarela de pagos en línea y conciliación bancaria.
- App móvil nativa (la UI es responsive web).
- Multi-idioma y multi-moneda (todo en soles, IGV 18 %).
- Redis adapter para WebSockets multi-instancia y rate limit distribuido.

## 7. Documentos relacionados

- [Arquitectura](../../docs/arquitectura.md) · [Decisiones vigentes](../../docs/decisiones.md)
- [Modelo de datos](../../docs/modelo-datos.md) · [RLS](../../docs/rls-modelo.md)
- [Modularización](../../docs/MODULARIZACION.md) · [Plan de módulos](../../docs/PLAN-MODULOS-Y-PROPIEDAD.md)
