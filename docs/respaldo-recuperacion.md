# Respaldo y recuperación (AYCDS-38)

Objetivo: que restaurar no sea una esperanza. Un respaldo sin restore probado no
cuenta.

## Objetivos

| Métrica | Objetivo | Cómo se cumple |
|---|---|---|
| **RPO** (datos que se pueden perder) | ≤ 24 h en local/demo, ≤ 1 h en producción | `pg_dump` diario + WAL/PITR en el proveedor gestionado |
| **RTO** (tiempo hasta servicio) | ≤ 30 min con el dataset actual | Restore medido en 3,3 s (0,28 MB, 27 comandas); el RTO lo domina el aprovisionamiento, no el restore |

Los objetivos son del entorno local y del piloto. En un Postgres gestionado se
sustituyen por la política del proveedor (snapshots + PITR) y el mismo ensayo.

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm db:backup` | `pg_dump -Fc` de `fogoneria_db` a `ops/backups/<db>-<fecha>.dump` + manifiesto `.txt` |
| `pnpm db:restore -File <dump>` | Restaura en **una base nueva** (`fogoneria_restore` por defecto) y verifica |

Ambos trabajan con el contenedor `fogoneria-postgres` y copian el binario con
`docker cp` en vez de redirigir la salida de PowerShell, que en Windows corrompe
archivos binarios.

`restore.ps1` **se niega a restaurar sobre `fogoneria_db`**: un ensayo que pisa
producción no es un ensayo. Al terminar cuenta filas de `empresas`, `usuarios`,
`platos`, `ordenes` y de las vistas `v_bi_%`; si falta alguna vista BI, falla.

## Procedimiento de restore

```powershell
# 1. Respaldo
pnpm db:backup

# 2. Ensayo en base nueva (nunca encima de la de trabajo)
pnpm db:restore -File ./ops/backups/fogoneria_db-20261107-001347.dump

# 3. Si el ensayo cuadra, promover:
#    - crear la base destino, pg_restore y cambiar DATABASE_URL
```

Para un restore real en un servidor sin el script: `pg_restore -d <base>
--no-owner --no-privileges <dump>`, luego aplicar `db:rls:roles` y
`db:rls:force` (los roles y el `FORCE RLS` no viajan en el dump de datos del
piloto por `--no-owner`).

## Ensayo (game day)

Trimestral y antes de cada entrega:

1. `pnpm db:backup`.
2. `pnpm db:restore -File <último dump> -Force`.
3. Comparar los conteos con la base origen (`empresas`, `ordenes`, `comprobantes`).
4. Levantar la API contra la base restaurada y hacer login + un cobro de prueba.
5. Anotar fecha, tamaño, segundos y diferencias.

## Bug encontrado y corregido

El primer restore falló con `fk_detalles_orden`: el volumen de pruebas de AYCDS-22
había dejado **150 000 líneas huérfanas**. `reset-perf.sql` borraba las órdenes con
`session_replication_role = replica`, y en ese modo **tampoco corren los `CASCADE`**
(las claves foráneas son triggers). El script ahora borra las hijas explícitamente
(`detalles_orden_modificadores`, `detalles_orden`, `movimientos_*`, `comprobantes`,
`canjes_cupones`) antes que la comanda.

Lección: cualquier limpieza con `session_replication_role = replica` tiene que
borrar los hijos a mano; el dump lo delata en el próximo restore.
