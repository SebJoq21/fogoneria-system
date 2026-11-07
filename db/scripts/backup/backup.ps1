# Respaldo lógico de la base de Fogoneria (AYCDS-38).
#
# Uso:
#   ./db/scripts/backup/backup.ps1                       # fogoneria_db -> ./ops/backups
#   ./db/scripts/backup/backup.ps1 -Database fogoneria_test -OutDir D:\tmp
#
# Hace el dump en formato custom (-Fc) dentro del contenedor y lo copia al host:
# asi el binario no pasa por la tuberia de PowerShell, que en Windows corrompe
# archivos binarios.
param(
  [string]$Container = 'fogoneria-postgres',
  [string]$Database = 'fogoneria_db',
  [string]$User = 'fogoneria_app',
  [string]$OutDir = './ops/backups'
)

$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$nombre = "$Database-$stamp.dump"
$remoto = "/tmp/$nombre"

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$destino = Join-Path (Resolve-Path $OutDir) $nombre

Write-Host "Respaldo de $Database ..."
$inicio = Get-Date

docker exec $Container pg_dump -U $User -d $Database -Fc --no-owner --no-privileges -f $remoto
if ($LASTEXITCODE -ne 0) { throw "pg_dump fallo con codigo $LASTEXITCODE" }

docker cp "${Container}:$remoto" $destino | Out-Null
docker exec $Container rm -f $remoto | Out-Null

$mb = [Math]::Round((Get-Item $destino).Length / 1MB, 2)
$seg = [Math]::Round(((Get-Date) - $inicio).TotalSeconds, 1)
Write-Host "OK  $destino  ($mb MB en $seg s)"

# Manifiesto minimo: permite saber despues que se respaldo y con que version.
$version = docker exec $Container psql -U $User -d $Database -t -A -c 'SHOW server_version'
"database=$Database`narchivo=$nombre`ntamano_mb=$mb`nsegundos=$seg`npostgres=$version`nfecha=$((Get-Date).ToString('o'))" |
  Set-Content -Path "$destino.txt" -Encoding UTF8
