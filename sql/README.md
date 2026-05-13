# SQL FinanBotAI

Esquema lógico `intelfin` con 18 tablas para FinanBotAI.

## Archivos

| Orden | Archivo | Contenido |
|-------|---------|-----------|
| 001 | `001_esquema_intelfin.sql` | Crea el esquema `intelfin` y extensión `pgcrypto`. |
| 002 | `002_tablas_autenticacion.sql` | 3 tablas: `perfil_corporativo`, `sesiones_token_jwt`, `recuperaciones_acceso`. |
| 003 | `003_tablas_catalogo.sql` | 8 tablas de catálogo + semillas (tabla de impuestos, tipos de mercadería, tipos de artículo de venta, plan de cuentas, catálogo de egresos). |
| 004 | `004_tablas_operativas.sql` | 5 tablas: `proyectos_analisis`, `compras_internacionales`, `ventas_internacionales`, `partida_doble_ventas`, `egresos_clasificados`. |
| 005 | `005_tablas_financieras.sql` | 3 tablas: `parametros_rentabilidad`, `acumulados_ventas`, `acumulados_costos`. |
| 006 | `006_seed_aranceles_y_pcge.sql` | 20 partidas arancelarias + tasas Ad Valorem + Plan de Cuentas PCGE. |

Total: 19 tablas + semillas.

## Aplicar todo (Windows PowerShell)

```powershell
cd finanbotai-server\sql
.\aplicar-todo.ps1
```

Por defecto crea la base `finanbotai_db` con el usuario `postgres` en `localhost:5432`.

Para usar otra base:

```powershell
.\aplicar-todo.ps1 -DbName otra_base -DbUser usuario -DbHost localhost -DbPort 5432
```

## Aplicar todo (Linux / macOS)

```bash
cd finanbotai-server/sql
chmod +x aplicar-todo.sh
./aplicar-todo.sh
```

## Aplicar uno a uno

```powershell
psql -U postgres -d finanbotai_db -f 001_esquema_intelfin.sql
psql -U postgres -d finanbotai_db -f 002_tablas_autenticacion.sql
psql -U postgres -d finanbotai_db -f 003_tablas_catalogo.sql
psql -U postgres -d finanbotai_db -f 004_tablas_operativas.sql
psql -U postgres -d finanbotai_db -f 005_tablas_financieras.sql
psql -U postgres -d finanbotai_db -f 006_seed_aranceles_y_pcge.sql
```

## Verificación

```sql
SET search_path TO intelfin, public;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'intelfin'
ORDER BY table_name;
```

Debe devolver 19 filas.
