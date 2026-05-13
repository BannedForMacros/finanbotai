# Aplica los 6 archivos SQL de FinanBotAI en orden contra Postgres local.
# Uso: .\aplicar-todo.ps1 [nombreBD]   (por defecto: finanbotai_db)

param(
  [string]$DbName = "finanbotai_db",
  [string]$DbUser = "postgres",
  [string]$DbHost = "localhost",
  [string]$DbPort = "5432"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==> Verificando si la base $DbName existe..."
$exists = & psql -U $DbUser -h $DbHost -p $DbPort -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'"
if ($exists -ne "1") {
  Write-Host "==> Creando base de datos $DbName"
  & createdb -U $DbUser -h $DbHost -p $DbPort $DbName
} else {
  Write-Host "==> La base $DbName ya existe, se aplican los SQL sobre ella."
}

$archivos = Get-ChildItem -Path $scriptDir -Filter "00*.sql" | Sort-Object Name
foreach ($f in $archivos) {
  Write-Host ("==> Aplicando " + $f.Name)
  & psql -U $DbUser -h $DbHost -p $DbPort -d $DbName -v ON_ERROR_STOP=1 -f $f.FullName
}

Write-Host ""
Write-Host "OK. Base $DbName lista con 19 tablas en esquema intelfin."
