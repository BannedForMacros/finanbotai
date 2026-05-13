import { Router } from 'express';
import { CompraInternacionalControlador } from '../controladores/compraInternacional.controlador';
import { autenticarPeticion } from '../middlewares/autenticarPeticion';

const router = Router();
router.use(autenticarPeticion);

/**
 * @openapi
 * /api/compras-internacionales/tipos-mercaderia:
 *   get:
 *     tags: [Compras]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/tipos-mercaderia', CompraInternacionalControlador.listarTiposMercaderia);
router.get('/', CompraInternacionalControlador.listar);
router.post('/', CompraInternacionalControlador.crear);
router.get('/:id', CompraInternacionalControlador.obtener);
router.get('/:id/asiento', CompraInternacionalControlador.asiento);
router.put('/:id', CompraInternacionalControlador.actualizar);
router.delete('/:id', CompraInternacionalControlador.eliminar);

export default router;
