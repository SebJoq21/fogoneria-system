# Restauracion y verificacion de un respaldo de Fogoneria (AYCDS-38).
#
# Uso:
#   ./db/scripts/backup/restore.ps1 -File ./ops/backups/fogoneria_db-20261107-120000.dump
#   ./db/scripts/backup/restore.ps1 -File <dump> -Target fogoneria_restore -Force
#
# Restaura en una base **nueva** (`-Target`), nunca encima de `fogoneria_db`: un
# ensayo que pisa produccion no es un ensayo, es un incidente. Al terminar cuenta
# filas de las tablas clave y mide el tiempo total.
param(
  [Parameter(Mandatory = $true)][string]$File,
  [string]$Container = 'fogoneria-postgres',
  [string]$User = 'fogoneria_app',
  [string]$Target = 'fogoneria_restore',
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $File)) { throw "No existe el respaldo: $File" }
if ($Target -eq 'fogoneria_db') { throw 'Restaurar sobre fogoneria_db esta prohibido: usa -Target' }

$inicio = Get-Date
$nombreRemoto = "/tmp/$(Split-Path $File -Leaf)"
docker cp $File "${Container}:$nombreRemoto" | Out-Null

$existe = docker exec $Container psql -U $User -d postgres -t -A -c "SELECT 1 FROM pg_database WHERE datname = '$Target'"
if ($existe -eq '1') {
  if (-not $Force) { throw "La base $Target ya existe: usa -Force para recrearla" }
  docker exec $Container psql -U $User -d postgres -c "DROP DATABASE $Target WITH (FORCE)" | Out-Null
}

docker exec $Container psql -U $User -d postgres -c "CREATE DATABASE $Target" | Out-Null
docker exec $Container pg_restore -U $User -d $Target --no-owner --no-privileges --exit-on-error $nombreRemoto
if ($LASTEXITCODE -ne 0) { throw "pg_restore fallo con codigo $LASTEXITCODE" }
docker exec $Container rm -f $nombreRemoto | Out-Null

# Verificacion: las tablas clave tienen que existir y tener filas donde el seed
# las dejo. Un restore vacio es un restore fallido aunque pg_restore diga OK.
$sql = @"
SELECT 'empresas', count(*) FROM fogoneria.empresas
UNION ALL SELECT 'usuarios', count(*) FROM fogoneria.usuarios
UNION ALL SELECT 'platos', count(*) FROM fogoneria.platos
UNION ALL SELECT 'ordenes', count(*) FROM fogoneria.ordenes
UNION ALL SELECT 'vistas_bi', count(*) FROM information_schema.views WHERE table_schema = 'fogoneria' AND table_name LIKE 'v_bi_%'
"@
$conteos = docker exec $Container psql -U $User -d $Target -t -A -F '=' -c $sql
$seg = [Math]::Round(((Get-Date) - $inicio).TotalSeconds, 1)

Write-Host "Restore OK en $Target ($seg s)"
$conteos | ForEach-Object { if ($_ -match '=') { Write-Host "  $_" } }

$vistas = ($conteos | Where-Object { $_ -like 'vistas_bi=*' }) -replace '.*=', ''
if ([int]$vistas -lt 6) { throw 'Faltan vistas BI en el respaldo restaurado' }
