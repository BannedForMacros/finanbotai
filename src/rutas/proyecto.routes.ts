import { Router } from 'express';
import { ProyectoControlador } from '../controladores/proyecto.controlador';
import { autenticarPeticion } from '../middlewares/autenticarPeticion';

const router = Router();
router.use(autenticarPeticion);

/**
 * @openapi
 * /api/proyectos:
 *   get:
 *     tags: [Proyectos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: solo_abiertos
 *         schema: { type: boolean }
 */
router.get('/', ProyectoControlador.listar);
router.post('/', ProyectoControlador.crear);
router.get('/:id', ProyectoControlador.obtener);
router.put('/:id', ProyectoControlador.actualizar);
router.patch('/:id/cerrar', ProyectoControlador.cerrar);
router.delete('/:id', ProyectoControlador.archivar);

export default router;
