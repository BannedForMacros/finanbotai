import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';

import { config } from './config';
import { getOpenApiSpec } from './utilitarios/openapi';
import { bitacora } from './utilitarios/bitacora';

import autenticacionRoutes from './rutas/autenticacion.routes';
import proyectoRoutes from './rutas/proyecto.routes';
import compraInternacionalRoutes from './rutas/compraInternacional.routes';
import ventaInternacionalRoutes from './rutas/ventaInternacional.routes';
import egresoClasificadoRoutes from './rutas/egresoClasificado.routes';
import rentabilidadRoutes from './rutas/rentabilidad.routes';
import diagnosticoIaRoutes from './rutas/diagnosticoIA.routes';
import catalogoRoutes from './rutas/catalogo.routes';
import cotizacionRoutes from './rutas/cotizacion.routes';
import healthRoutes from './rutas/health.routes';

dotenv.config();

const app = express();

app.set('trust proxy', true);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use('/api/health', healthRoutes);
app.use('/api/auth', autenticacionRoutes);
app.use('/api/proyectos', proyectoRoutes);
app.use('/api/compras-internacionales', compraInternacionalRoutes);
app.use('/api/ventas-internacionales', ventaInternacionalRoutes);
app.use('/api/egresos', egresoClasificadoRoutes);
app.use('/api/rentabilidad', rentabilidadRoutes);
app.use('/api/diagnostico-ia', diagnosticoIaRoutes);
app.use('/api/catalogo', catalogoRoutes);
app.use('/api/cotizacion', cotizacionRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'FinanBotAI API: Simulador Financiero Inteligente' });
});

app.get('/openapi.json', async (_req: Request, res: Response) => {
  try {
    const spec = await getOpenApiSpec();
    res.json(spec);
  } catch (e) {
    bitacora.error('No se pudo generar OpenAPI', e);
    res.status(500).json({ message: 'No se pudo generar el OpenAPI' });
  }
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(undefined, {
  explorer: true,
  swaggerUrl: '/openapi.json'
}));

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: `Not Found: ${req.method} ${req.originalUrl}` });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  bitacora.error('Excepcion no controlada', err);
  res.status(err?.status || 500).json({
    message: err?.message || 'Error interno del servidor'
  });
});

app.listen(config.port, '0.0.0.0', () => {
  bitacora.info(`FinanBotAI API escuchando en http://localhost:${config.port}`);
  bitacora.info(`Docs: http://localhost:${config.port}/docs`);
});
