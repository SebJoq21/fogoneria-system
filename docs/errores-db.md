# Errores de base de datos (AYCDS-62)

Los triggers de inmutabilidad lanzan `RAISE EXCEPTION` con `ERRCODE = '45000'`
y un código estable como mensaje. Prisma los entrega como
`PrismaClientKnownRequestError` (`P2025`/`P2010`) con `meta.code = '45000'` y
`meta.message = 'DB_...'`.

## Mapeo sugerido en la API

| Código | HTTP | Significado |
|---|---|---|
| `DB_TURNO_CERRADO` | 409 Conflict | El turno ya se cerró (o el gasto intenta pagarse en un turno cerrado) |
| `DB_TURNO_NO_BORRABLE` | 409 Conflict | Los turnos son históricos |
| `DB_TURNO_DATOS_INMUTABLES` | 422 Unprocessable | Empresa, sucursal, apertura, fondo o cajero de un turno |
| `DB_TURNO_CIERRE_INCOMPLETO` | 422 Unprocessable | `CERRADO` sin `cierre_at` |
| `DB_TURNO_NO_EXISTE` | 404 Not Found | `turno_id` inexistente en un movimiento |
| `DB_MOVIMIENTO_INMUTABLE` | 409 Conflict | Edición o borrado de un movimiento de caja |
| `DB_COMPROBANTE_NO_BORRABLE` | 409 Conflict | Borrado de un comprobante |
| `DB_COMPROBANTE_ESTADO_INICIAL` | 422 Unprocessable | Alta de comprobante que no nace `PAGADA` |
| `DB_COMPROBANTE_INMUTABLE` | 409 Conflict | Intento de cambiar un comprobante `PAGADA` sin anular |
| `DB_COMPROBANTE_ANULADO` | 409 Conflict | El comprobante ya está `ANULADA` |
| `DB_COMPROBANTE_DATOS_INMUTABLES` | 422 Unprocessable | La anulación intentó cambiar importes o numeración |
| `DB_ANULACION_INCOMPLETA` | 422 Unprocessable | Falta actor, fecha o motivo de anulación |
| `DB_KARDEX_INMUTABLE` | 409 Conflict | Edición o borrado de un movimiento de inventario |
| `DB_PUNTOS_INMUTABLE` | 409 Conflict | Edición o borrado de un movimiento de puntos |
| `DB_AUDITORIA_INMUTABLE` | 409 Conflict | Edición o borrado de auditoría |
| `DB_ORDEN_NO_BORRABLE` | 409 Conflict | Borrado de una orden (se anula) |
| `DB_ORDEN_CERRADA` | 409 Conflict | La orden está en estado terminal |
| `DB_ORDEN_TRANSICION_INVALIDA` | 422 Unprocessable | Transición fuera del flujo del KDS |
| `DB_ORDEN_ANULACION_TARDIA` | 409 Conflict | Anulación con la orden ya en cocina o lista: se entrega y se compensa (AYCDS-20) |
| `DB_DETALLE_INMUTABLE` | 409 Conflict | Línea nueva o editada sobre una orden cerrada |
| `DB_GASTO_PAGADO` | 409 Conflict | Gasto pagado en caja que intenta cambiar de monto o turno |
| `DB_TABLA_NO_RESTAURABLE` | 422 Unprocessable | `restore_row` sobre una tabla fuera de la lista blanca |
| `DB_TENANT_MISMATCH` | 403 Forbidden | Fila de otra empresa (defensa en profundidad de RLS) |

## RLS

Una violación de política llega con SQLSTATE `42501`:

```
new row violates row-level security policy for table "..."
```

La API debe responder **403** y ocultar el detalle al cliente; el log interno
conserva tabla y operación.

## Cómo probar un código

```sql
-- Esperado: ERROR 45000: DB_MOVIMIENTO_INMUTABLE
UPDATE fogoneria.movimientos_caja SET monto = 1 WHERE id = '<uuid>';
```

En tests, `captureDbError` + `expectDbError` (`apps/api/test/db/helpers.ts`)
verifican el código sin depender del texto completo del motor.
