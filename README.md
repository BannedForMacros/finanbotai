# FinanBotAI Server

Backend de **FinanBotAI: Simulador Financiero Inteligente**. Node.js + TypeScript + Express + PostgreSQL (esquema `intelfin`).

## Requisitos

- Node.js 18 o superior.
- PostgreSQL 14 o superior (probado en 17).
- Cuenta de correo con SMTP (Gmail App Password u otra).
- API key de Google Gemini.
- Token de Decolecta (tipo de cambio SBS).

## Arranque rapido

```powershell
# 1. Crear y aplicar la base de datos (Windows)
cd sql
.\aplicar-todo.ps1

# 2. Instalar dependencias
cd ..
npm install

# 3. Copiar variables de entorno
copy .env.example .env
# edita .env con tus valores

# 4. Modo desarrollo
npm run dev
```

Servidor en `http://localhost:4002` y Swagger en `http://localhost:4002/docs`.

## Endpoints principales

| Modulo | Ruta base |
|--------|-----------|
| Salud | `GET /api/health` |
| Autenticacion | `POST /api/auth/registro` `acceso` `refresh` `cerrar-sesion` `solicitud-recuperacion` `restablecer`. `GET /api/auth/me` |
| Proyectos | `GET POST /api/proyectos`, `GET PUT DELETE /api/proyectos/:id`, `PATCH /api/proyectos/:id/cerrar` |
| Compras internacionales | `GET POST /api/compras-internacionales`, `GET PUT DELETE /api/compras-internacionales/:id`, `GET /api/compras-internacionales/:id/asiento`, `GET /api/compras-internacionales/tipos-mercaderia` |
| Ventas internacionales | `GET POST /api/ventas-internacionales`, `GET PUT DELETE /api/ventas-internacionales/:id`, `GET /api/ventas-internacionales/:id/asiento`, `POST /api/ventas-internacionales/:id/asiento/regenerar`, `GET /api/ventas-internacionales/tipos-articulo` |
| Egresos | `GET POST /api/egresos`, `GET PATCH DELETE /api/egresos/:id`, `GET /api/egresos/:id/asiento`, `GET /api/egresos/catalogo`, `GET /api/egresos/tributos`, `GET /api/egresos/asiento-consolidado`, `GET /api/egresos/resumen-por-tipo`, `POST GET /api/egresos/parametros-rentabilidad` |
| Rentabilidad | `GET /api/rentabilidad/analisis/:proyecto_id`, `estado-resultados/:proyecto_id`, `ratios/:proyecto_id`, `asiento-consolidado/:proyecto_id` |
| Diagnostico IA | `POST /api/diagnostico-ia/:proyecto_id` |
| Catalogo | `GET /api/catalogo/arancelario`, `GET /api/catalogo/advalorem` |
| Cotizacion | `GET /api/cotizacion`, `POST /api/cotizacion/convertir`, `DELETE /api/cotizacion/cache` |

## Estructura

```
finanbotai-server/
  sql/                            # 6 archivos SQL + scripts de aplicacion
  src/
    config.ts                     # variables de entorno
    datos.ts                      # pool Postgres + override OID 1082
    server.ts                     # bootstrap Express
    middlewares/
      autenticarPeticion.ts       # JWT Bearer + perfilDePeticion
    utilitarios/
      seguridad.ts                # Argon2id (memCost 19456, time 2)
      tokensJwt.ts                # JWT HS256 + refresh SHA-256
      bitacora.ts                 # logger simple
      openapi.ts                  # swagger spec
    esquemas/                     # validadores Zod
      autenticacion.esquema.ts
      proyecto.esquema.ts
      compraInternacional.esquema.ts
      ventaInternacional.esquema.ts
      egresoClasificado.esquema.ts
    servicios/
      autenticacion.servicio.ts
      correo.servicio.ts
      proyecto.servicio.ts
      tipoCambio.servicio.ts
      calculoTributario.servicio.ts
      compraInternacional.servicio.ts
      ventaInternacional.servicio.ts
      egreso.servicio.ts
      estadoResultados.servicio.ts
      diagnosticoIa.servicio.ts
    controladores/                # 8 controllers (autenticacion, proyecto, compras, ventas, egresos, rentabilidad, diagnostico IA, cotizacion)
    rutas/                        # 10 routers
  package.json
  tsconfig.json
  .env / .env.example
  CLAUDE.md
  README.md
```

## Detalles importantes

- El override `types.setTypeParser(1082)` mantiene fechas como string `YYYY-MM-DD` para evitar desfases por la zona horaria de Lima (UTC-5).
- Argon2id usa `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`.
- Access token expira en 15 minutos por defecto. Refresh token rota en cada uso.
- El endpoint `GET /api/cotizacion` es publico (el cliente movil lo consulta antes de iniciar sesion).
- El diagnostico IA usa Gemini con `responseMimeType: application/json` y `temperature: 0.3`.
- El esquema `intelfin` no contempla roles, XP ni niveles (simplificacion respecto a versiones anteriores).
