# RLS, soft-delete e inmutabilidad (AYCDS-62)

Implementación de la tarea **AYCDS-62** sobre la migración inicial de la rama
`development`. Todo vive en `apps/api/prisma/migrations/`:

| Migración | Contenido |
|---|---|
| `20261020120000_indices_tenant` | Índices compuestos y parciales por empresa/sucursal/fecha |
| `20261020120100_rls_tenant` | Funciones de contexto, `ENABLE ROW LEVEL SECURITY` y políticas |
| `20261020120200_soft_delete` | `deleted_at` / `deleted_by`, únicos parciales, trigger de baja y `restore_row` |
| `20261020120300_inmutabilidad_contable` | Triggers de turnos, caja, comprobantes, kardex, puntos, auditoría, órdenes y gastos |

## Contrato de sesión

La API (o cualquier cliente) debe fijar el contexto **dentro de la misma
transacción** que ejecuta la consulta:

```sql
BEGIN;

SELECT set_config('app.empresa_id',  $1, true);
SELECT set_config('app.sucursal_id', $2, true);  -- opcional: limita a una sucursal
SELECT set_config('app.usuario_id',  $3, true);  -- opcional: actor de la baja
SELECT set_config('app.bypass', 'on', true);     -- SOLO consola SaaS / SUPERADMIN

-- consultas de negocio...
COMMIT;
```

El tercer argumento `true` es obligatorio. Un `SET` normal persiste en la
conexión y con un pool de conexiones filtra el tenant entre requests. Si el
contexto no se fija, las políticas no devuelven filas (salvo que el rol tenga
`BYPASSRLS`).

Funciones disponibles en `fogoneria`:

- `current_empresa_id()` → `app.empresa_id`
- `current_sucursal_id()` → `app.sucursal_id`
- `current_usuario_id()` → `app.usuario_id`
- `is_bypass()` → `app.bypass` (`on`, `true` o `1`)

## Roles

| Rol | Uso | RLS |
|---|---|---|
| `fogoneria_app` | Dueño del esquema, migraciones y onboarding | Bypassa mientras no se active `FORCE` |
| `fogoneria_rls` | API de negocio (creado por `db/scripts/rls/000-roles.sql`) | Sujeto a políticas |
| Rol SaaS / migrador | Consola SaaS, seeds, operaciones de plataforma | `BYPASSRLS` |

### Activar el aislamiento obligatorio

```bash
pnpm --filter api db:rls:roles   # una vez por clúster
pnpm --filter api db:rls:force   # cuando la API ya fije el contexto
```

Si `prisma db execute` no acepta el script completo, usar `psql`:

```bash
psql "$DATABASE_URL" -f db/scripts/rls/000-roles.sql
psql "$DATABASE_URL" -f db/scripts/rls/010-force-rls.sql
```

`010-force-rls.sql` aplica `FORCE ROW LEVEL SECURITY` a toda tabla con RLS
habilitada, incluido el dueño. **No ejecutarlo antes** de que la API escriba
`app.*`: las consultas devolverían 0 filas.

Para revertir una tabla:

```sql
ALTER TABLE fogoneria.<tabla> NO FORCE ROW LEVEL SECURITY;
```

## Cobertura

- **Empresa y sucursal:** `empleados`, `mesas`, `reservas`, `ordenes`,
  `stocks_sucursal`, `movimientos_inventario`, `turnos_caja`, `gastos`,
  `comprobantes`, `canjes_cupones`, `movimientos_puntos`, `turnos_plan`,
  `asistencias`, `pozos_propinas`, `auditoria`.
- **Solo empresa:** `sucursales`, `categorias`, `grupos_modificadores`,
  `platos`, `listas_precios`, `combos`, `reglas_horarias_promos`, `cupones`,
  `proveedores`, `insumos`, `clientes`, `config_lealtad`, `roles_empresa`,
  `suscripciones_eventos`.
- **Caso especial:** `usuarios` (los `SUPERADMIN` con `empresa_id NULL` solo
  aparecen con bypass), `movimientos_caja` (sucursal vía `turnos_caja`).
- **Hijas sin `empresa_id`:** `opciones_modificadores`,
  `platos_grupos_modificadores`, `precios_platos`, `combos_platos`,
  `escandallos_recetas`, `detalles_orden`, `detalles_orden_modificadores`,
  `repartos_propinas` (heredan por `EXISTS` del padre).
- **Sin RLS:** `leads_cotizaciones` (plataforma, la escribe la landing con el
  rol SaaS).

## Baja lógica

Tablas con `deleted_at` / `deleted_by`: `empresas`, `sucursales`, `usuarios`,
`categorias`, `grupos_modificadores`, `platos`, `listas_precios`, `combos`,
`reglas_horarias_promos`, `cupones`, `proveedores`, `insumos`, `clientes`,
`roles_empresa`, `empleados`, `mesas`.

- Un `DELETE` se convierte en `UPDATE deleted_at = now()` mediante el trigger
  `soft_delete_row`. El `DELETE` devuelve 0 filas: la API debe usar `update`
  explícito si necesita el registro de vuelta.
- Los únicos de negocio son **parciales** (`WHERE deleted_at IS NULL`), así que
  el nombre/SKU/código se puede reutilizar.
- Restaurar: `SELECT fogoneria.restore_row('platos', '<uuid>')`. Es
  `SECURITY DEFINER` y está revocado para `fogoneria_rls`.
- `empresas.ruc` conserva su único global: el RUC de un tenant dado de baja no
  se reutiliza (trazabilidad).
- `opciones_modificadores` queda fuera: el catálogo las borra físicamente
  cuando no están referenciadas y convertirlas a baja lógica obligaría a
  filtrar todos sus `include` anidados.

> [!warning] Filtro de lectura pendiente en la API
> La extensión `withTenantScope` no filtra `deleted_at`. Mientras no exista un
> endpoint de baja para una entidad, no hay filas ocultas; cuando se agregue,
> las consultas de esa entidad deben incluir `deleted_at: null` (incluidos los
> `include` anidados).

## Inmutabilidad

| Tabla | Regla |
|---|---|
| `turnos_caja` | No se borra; `CERRADO` no se reabre ni se edita; empresa, sucursal, apertura, fondo y cajero son fijos |
| `movimientos_caja` | Append-only; solo se insertan en turnos `ABIERTO` de la misma empresa |
| `comprobantes` | No se borra; nace `PAGADA`; solo `PAGADA → ANULADA` con actor, fecha y motivo |
| `movimientos_inventario` | Append-only (kardex) |
| `movimientos_puntos` | Append-only |
| `auditoria` | Append-only |
| `ordenes` | Transiciones del KDS (`POR_CONFIRMAR → EN_COCINA → LISTO → ENTREGADO → PAGADA/CERRADA`, `ANULADA` desde las tres primeras); las terminales se congelan |
| `detalles_orden` | No se tocan si la orden está `PAGADA`, `CERRADA` o `ANULADA` |
| `gastos` | Un gasto pagado en caja no cambia de monto, turno ni sucursal |

Los errores usan SQLSTATE `45000` con un código estable en el mensaje; ver
`docs/errores-db.md`.

## Pruebas

```bash
# Base descartable con las migraciones aplicadas
export DATABASE_URL_TEST="postgresql://fogoneria_app:fogoneria_app@localhost:5433/fogoneria_db?schema=fogoneria"

pnpm --filter api exec prisma migrate deploy
pnpm --filter api test:db
```

Los specs crean el rol `fogoneria_rls` y le otorgan permisos si la conexión
puede hacerlo (dueño o superusuario, como el `fogoneria_app` del
`docker-compose`). Si no, hay que ejecutar antes
`db/scripts/rls/000-roles.sql`.

Sin `DATABASE_URL_TEST` los specs se saltan y `pnpm test` sigue verde. Las
pruebas **truncan** `fogoneria.empresas` y `fogoneria.leads_cotizaciones`: no
apuntar `DATABASE_URL_TEST` a una base con datos reales.

Cobertura de los specs (`apps/api/test/db/`):

- `rls.db-spec.ts`: lectura aislada, escritura cruzada rechazada, bypass,
  alcance por sucursal, hijas por padre, superadmin oculto.
- `soft-delete.db-spec.ts`: baja verificable, actor, reutilización de SKU,
  unicidad entre vigentes, restauración.
- `inmutabilidad.db-spec.ts`: turnos, caja, comprobantes, órdenes, líneas,
  kardex, auditoría y gastos.

## Limitaciones conocidas

- La extensión de Prisma (`withTenantScope`) y RLS coexisten: la primera filtra
  el SQL que genera Prisma; la segunda protege accesos directos y errores desde
  la aplicación. Hasta que la API conecte con `fogoneria_rls` y fije el contexto,
  el aislamiento efectivo sigue siendo el de la extensión.
- No se eliminaron índices de una sola columna: sin datos de volumen no hay
  evidencia para justificar el borrado. Se revisará con `pg_stat_user_indexes`.
- Los triggers de inmutabilidad también aplican al dueño del esquema: cualquier
  corrección contable debe hacerse con movimientos compensatorios, no con
  `UPDATE`.
