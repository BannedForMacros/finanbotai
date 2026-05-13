import { Router } from 'express';
import { EgresoControlador } from '../controladores/egreso.controlador';
import { autenticarPeticion } from '../middlewares/autenticarPeticion';

const router = Router();
router.use(autenticarPeticion);

router.get('/catalogo', EgresoControlador.listarCatalogo);
router.get('/', EgresoControlador.listar);
router.post('/', EgresoControlador.crear);
router.get('/tributos', EgresoControlador.calcularTributos);
router.get('/asiento-consolidado', EgresoControlador.asientoConsolidado);
router.get('/resumen-por-tipo', EgresoControlador.resumenPorTipo);
router.post('/parametros-rentabilidad', EgresoControlador.guardarParametros);
router.get('/parametros-rentabilidad/:proyecto_id', EgresoControlador.obtenerParametros);
router.get('/:id', EgresoControlador.obtener);
router.get('/:id/asiento', EgresoControlador.asientoPorEgreso);
router.patch('/:id', EgresoControlador.actualizar);
router.delete('/:id', EgresoControlador.eliminar);

export default router;
