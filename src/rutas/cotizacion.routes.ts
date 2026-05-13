import { Router } from 'express';
import { CotizacionControlador } from '../controladores/cotizacion.controlador';
import { autenticarPeticion } from '../middlewares/autenticarPeticion';

const router = Router();

/**
 * @openapi
 * /api/cotizacion:
 *   get:
 *     tags: [Cotizacion]
 *     summary: Obtiene el tipo de cambio USD/PEN (publico).
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 */
router.get('/', CotizacionControlador.obtener);
router.post('/convertir', autenticarPeticion, CotizacionControlador.convertir);
router.delete('/cache', autenticarPeticion, CotizacionControlador.invalidarCache);

export default router;
