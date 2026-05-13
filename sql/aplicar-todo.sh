#!/bin/bash
# Aplica los 6 archivos SQL de FinanBotAI en orden.
# Uso: ./aplicar-todo.sh [nombreBD]   (por defecto: finanbotai_db)

set -e
DB=${1:-finanbotai_db}
DIR="$(cd "$(dirname "$0")" && pwd)"

if ! psql -lqt | cut -d \| -f 1 | grep -qw "$DB"; then
  echo "==> Creando base de datos $DB"
  createdb "$DB"
else
  echo "==> La base $DB ya existe, se aplican los SQL sobre ella."
fi

for f in $(ls "$DIR"/00*.sql | sort); do
  echo "==> Aplicando $(basename "$f")"
  psql -d "$DB" -v ON_ERROR_STOP=1 -f "$f"
done

echo
echo "OK. Base $DB lista con 19 tablas en esquema intelfin."
