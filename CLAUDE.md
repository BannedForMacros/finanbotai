# FinanBotAI Server: contexto para Claude

## Stack
- Node.js + TypeScript + Express, puerto 4002 por defecto.
- PostgreSQL, esquema `intelfin`.
- Argon2id, JWT HS256 (15m), refresh rotatorio 32 bytes con hash SHA-256.
- Gemini 2.5 Flash (en backend: `servicios/diagnosticoIa.servicio.ts`).
- Decolecta SBS para tipo de cambio diario, con fallback a ultimo registro en BD.

## Variables `.env` clave
- `PG*` o `DATABASE_URL`: conexion local Postgres.
- `JWT_FIRMA`, `JWT_DURACION_ACCESO`, `REFRESH_DURACION_DIAS`.
- `GEMINI_API_KEY`, `GEMINI_MODEL`.
- `DECOLECTA_API_TOKEN`, `DECOLECTA_BASE_URL`.
- `SMTP_*`, `APP_FRONTEND_URL` (deep link `finanbotai://restablecer`).

## Convenciones del proyecto
- `dbQuery` no existe: usar `ejecutarSql` desde `datos.ts`.
- `datos.ts` mantiene el override del OID 1082 para no convertir DATE a Date JS.
- Todas las tablas en esquema `intelfin`. IDs principales son UUID (perfil, proyecto, compra, venta, egreso, partida_doble).
- IDs de catalogos son SERIAL (`tipos_mercaderia`, `tipos_articulo_venta`, `catalogo_egresos`, `plan_cuentas_pcge`, `tabla_impuestos`).
- Soft delete: compras y ventas usan `activa BOOL`, egresos y partida doble usan `activo BOOL`. Proyectos usan `estado_proyecto` con valor `archivado`.

## Modulo de compras (compras_internacionales)
Pipeline DTA:
- CIF = FOB + Flete + Seguro.
- A/V automatico desde `tasas_advalorem_intelfin` cuando no es compra local.
- ISC = (CIF + A/V) * tasa_isc cuando `aplica_isc`.
- IGV/IPM sobre (CIF + A/V + ISC) cuando `aplica_igv`.
- Antidumping, Compensatorio y SDA son montos fijos en USD.
- Base de percepcion = CIF + A/V + ISC + IGV + IPM + Antidumping + Compensatorio (sin SDA).
- Total carga aduanera = A/V + ISC + IGV + IPM + Antidumping + Compensatorio + Percepcion + SDA.
- Compras locales: solo IGV + IPM sobre el monto FOB (que representa el valor de compra).
- El asiento se guarda directamente en `libro_diario_jsonb` de `compras_internacionales` (no hay tabla aparte).

## Modulo de ventas (ventas_internacionales)
- Si `flag_venta_local`: subtotal_neto = importe_venta_neto / 1.18, subtotal_igv = diferencia. Si no, IGV cero.
- El asiento se persiste en `partida_doble_ventas` con UPSERT por `venta_id`.
- Cuentas: 1212 (clientes), 7011/7012/7021/7022 (segun tipo articulo), 4011 (IGV de ventas).

## Modulo de egresos (egresos_clasificados)
- Reglas IGV: vienen del `catalogo_egresos.computa_igv` e `igv_opcional`.
- Planillas (`flag_planilla = true`): importe_total = subtotal_neto * 1.09 (cuesta empleador con ESSALUD).
- Tributos laborales hardcoded: ESSALUD 9 por ciento, ONP 13 por ciento, AFP 11.37 por ciento.
- El asiento consolidado agrupa por cuenta_pcge y divisa.
- El asiento por egreso individual tiene 4 ramas: planilla, financiero, con IGV, sin IGV.

## Modulo de rentabilidad (estadoResultados.servicio.ts)
- Convierte todo a USD para el Estado de Resultados (PEN se divide entre el tipo de cambio).
- Costo de ventas usa `valor_cif_resultante` segregando importadas vs locales.
- Gastos clasificados por prefijo de cuenta (621, 627, 631..., 67).
- ESSALUD del 9 por ciento se autocalcula desde 621 (no se duplica si el usuario registro 627 manual).
- ROA y ROE solo si existe registro en `parametros_rentabilidad`.

## Modulo de diagnostico IA
- Llama a Gemini con un prompt JSON estricto, `responseMimeType: application/json`, `temperature: 0.3`.
- La API key vive en el backend (no en el cliente movil).
- Score 0 a 10 con corte segun margen neto.

## Tipo de cambio (tipoCambio.servicio.ts)
Flujo: cache en memoria, tabla `cotizacion_diaria`, API Decolecta, fallback ultimo TC en BD.
- Ruta `GET /api/cotizacion` es publica.
- Si Decolecta cae, el sistema sigue funcionando con el ultimo TC disponible.

## Rutas principales
- `/api/health`
- `/api/auth/*`
- `/api/proyectos/*`
- `/api/compras-internacionales/*`
- `/api/ventas-internacionales/*`
- `/api/egresos/*`
- `/api/rentabilidad/*`
- `/api/diagnostico-ia/:proyecto_id`
- `/api/catalogo/arancelario`, `/api/catalogo/advalorem`
- `/api/cotizacion`, `/api/cotizacion/convertir`, `/api/cotizacion/cache`
- `/docs` y `/openapi.json`

## Comandos
- `npm run dev`: arranca con ts-node-dev en watch mode.
- `npm run build`: compila a `dist/`.
- `npm start`: arranca el bundle compilado.
- `npm run db:apply`: aplica los SQL contra `finanbotai_db` (PowerShell).
