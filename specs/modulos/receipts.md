# receipts — especificación

**Estado:** Mixto (emisión real; SUNAT pendiente de OSE) · **Última revisión:** 2026-11-19

## 1. Propósito

Emitir y anular el comprobante de una comanda ya cobrada, con serie y correlativo por empresa. Es el documento fiscal, no una forma de cobrar.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/receipts/` | real |
| Web | `apps/web/features/comprobantes/` (`ComprobantesPage`, `api.ts`) | real |
| Contrato | `packages/contracts/src/comprobantes.ts` (`desgloseIgv`, SUNAT «pendiente de OSE») | sí |
| Datos | `comprobantes`, `secuencias`, `ordenes` | `20261019000000_init`, `20261027120000_secuencias_tenant`, `20261106140000_reversion_financiera` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/receipts` | admin, sucursal, cajero | Lista con filtros (día de Lima, tipo, estado, sucursal) |
| `GET` | `/receipts/:id` | mismos | Detalle con IGV |
| `POST` | `/receipts` | mismos | Emite sobre comanda `PAGADA` |
| `POST` | `/receipts/:id/void` | mismos | Anula con motivo obligatorio |

Reglas:
- Solo comanda `PAGADA`: el comprobante documenta un cobro existente.
- Serie por tipo: `B001` boleta, `F001` factura, `T001` ticket; correlativo por empresa y serie en `secuencias` (`B001-00000001`). Nunca `Date.now()` ni `COUNT(*)`.
- Factura exige RUC con dígito (módulo 11); boleta acepta DNI de 8; ticket no pide documento.
- IGV **derivado**: `base = total / 1.18`, `igv = total - base`; no se persiste.
- Anulación: estado `ANULADA` + actor + fecha + motivo. La reversión de caja/stock la hacen los triggers de AYCDS-39; sin turno abierto → `DB_REVERSION_SIN_TURNO` (409).
- **SUNAT no se simula**: la UI muestra «Pendiente de OSE»; el CDR/resumen diario solo existe en el demo sin sesión.

## 4. Datos

- `comprobantes`: `tipo` (`BOLETA|FACTURA|TICKET`), `serie_numero` (único por empresa), `total`, `estado` (`PAGADA|ANULADA`), `orden_id`, `cliente_ref`, `motivo_anulacion`, `anulado_por`, `anulado_at`.
- Inmutabilidad: nace `PAGADA`; solo `PAGADA → ANULADA`; no se borra.
- Índice `uq_comp_empresa_serie` como última defensa de concurrencia.

## 5. UI y rutas

- `/app/comprobantes` → `ComprobantesPage`: lista, emite (selector de comandas `PAGADA`) y anula.
- La tabla pinta la serie; la anulación resuelve el UUID real de la fila.
- `lib/receipts-api.ts` y `lib/receipt-mapping.ts` quedan como legados solo para tests.

## 6. Pruebas

- Cobertura p3 (2026-11-20): tests de ramas de error de órdenes/SaaS/reservas/mesas y variantes de sesión en caja, comprobantes, clientes e inventario; sin cambios de comportamiento. Se amplió con RTL de páginas y flujos (estados, permisos y acciones).

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

| Suite | Archivo |
|---|---|
| Unit | `src/modules/receipts/receipts.service.spec.ts` |
| e2e | `test/receipts.e2e-spec.ts` |
| DB | `test/db/comprobantes.db-spec.ts` |
| Web | `features/comprobantes/comprobantes.test.ts`, `lib/receipt-mapping.test.ts` |

## 7. Deuda conocida

- SUNAT real (OSE) fuera del piloto: no hay XML/UBL, CDR ni resumen diario.
- El listado de la UI no pagina (la API sí lo soporta).
- No hay notas de crédito: la anulación es el único camino.

## 8. Trazabilidad

- Jira: AYCDS-36 (API), AYCDS-46 p2 (UI), AYCDS-50 (acta).
- PRs: #26, #38, #39.
- Docs: [decisiones](../../docs/decisiones.md) (IGV derivado, anulación delega reversión).

## 9. Próximos pasos

1. Integración OSE con XML UBL y CDR.
2. Paginación de la tabla cuando crezca el volumen.
3. Nota de crédito si el negocio la requiere.
