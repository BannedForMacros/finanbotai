import { Router } from 'express';
import { DiagnosticoIAControlador } from '../controladores/diagnosticoIA.controlador';
import { autenticarPeticion } from '../middlewares/autenticarPeticion';

const router = Router();
router.use(autenticarPeticion);

/**
 * @openapi
 * /api/diagnostico-ia/{proyecto_id}:
 *   post:
 *     tags: [Diagnostico IA]
 *     security: [{ bearerAuth: [] }]
 *     summary: Genera un diagnostico financiero usando Google Gemini.
 *     description: Toma el analisis de rentabilidad del proyecto y lo envia a Gemini para producir un diagnostico estructurado (resumen, fortalezas, areas de mejora, recomendaciones y score 0 a 10).
 */
router.post('/:proyecto_id', DiagnosticoIAControlador.generar);

export default router;
