import swaggerJSDoc from 'swagger-jsdoc';
import path from 'path';
import { config } from '../config';

let cache: object | null = null;

export async function getOpenApiSpec(): Promise<object> {
  if (cache) return cache;
  const spec = swaggerJSDoc({
    definition: {
      openapi: '3.0.3',
      info: {
        title: 'FinanBotAI API',
        version: '1.0.0',
        description: 'Backend del Simulador Financiero Inteligente FinanBotAI'
      },
      servers: [
        { url: `http://localhost:${config.port}`, description: 'Local' }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    },
    apis: [path.join(__dirname, '..', 'rutas', '*.ts')]
  });
  cache = spec;
  return spec;
}
