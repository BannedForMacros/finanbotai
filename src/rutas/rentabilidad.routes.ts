import { Router } from 'express';
import { RentabilidadControlador } from '../controladores/rentabilidad.controlador';
import { autenticarPeticion } from '../middlewares/autenticarPeticion';

const router = Router();
router.use(autenticarPeticion);

router.get('/analisis/:proyecto_id', RentabilidadControlador.analisisCompleto);
router.get('/estado-resultados/:proyecto_id', RentabilidadControlador.estadoResultados);
router.get('/ratios/:proyecto_id', RentabilidadControlador.ratios);
router.get('/asiento-consolidado/:proyecto_id', RentabilidadControlador.asientoConsolidado);

export default router;
