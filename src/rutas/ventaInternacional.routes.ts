import { Router } from 'express';
import { VentaInternacionalControlador } from '../controladores/ventaInternacional.controlador';
import { autenticarPeticion } from '../middlewares/autenticarPeticion';

const router = Router();

router.get('/tipos-articulo', VentaInternacionalControlador.listarTiposArticulo);

router.use(autenticarPeticion);

router.get('/', VentaInternacionalControlador.listar);
router.post('/', VentaInternacionalControlador.crear);
router.get('/:id', VentaInternacionalControlador.obtener);
router.get('/:id/asiento', VentaInternacionalControlador.asiento);
router.post('/:id/asiento/regenerar', VentaInternacionalControlador.regenerarAsiento);
router.put('/:id', VentaInternacionalControlador.actualizar);
router.delete('/:id', VentaInternacionalControlador.eliminar);

export default router;
