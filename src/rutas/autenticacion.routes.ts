import { Router } from 'express';
import { AutenticacionControlador } from '../controladores/autenticacion.controlador';
import { autenticarPeticion } from '../middlewares/autenticarPeticion';

const router = Router();

/**
 * @openapi
 * /api/auth/registro:
 *   post:
 *     tags: [Auth]
 *     summary: Crea una cuenta corporativa y devuelve tokens.
 */
router.post('/registro', AutenticacionControlador.registrar);

/**
 * @openapi
 * /api/auth/acceso:
 *   post:
 *     tags: [Auth]
 *     summary: Inicia sesion con correo corporativo y credencial.
 */
router.post('/acceso', AutenticacionControlador.iniciarSesion);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rota el token de refresco y emite un nuevo access token.
 */
router.post('/refresh', AutenticacionControlador.refrescar);

/**
 * @openapi
 * /api/auth/cerrar-sesion:
 *   post:
 *     tags: [Auth]
 *     summary: Invalida la sesion asociada al refresh token.
 */
router.post('/cerrar-sesion', AutenticacionControlador.cerrarSesion);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     summary: Devuelve el perfil autenticado.
 */
router.get('/me', autenticarPeticion, AutenticacionControlador.perfilActual);

/**
 * @openapi
 * /api/auth/solicitud-recuperacion:
 *   post:
 *     tags: [Auth]
 *     summary: Envia un correo con enlace para restablecer la credencial.
 */
router.post('/solicitud-recuperacion', AutenticacionControlador.solicitarRecuperacion);

/**
 * @openapi
 * /api/auth/restablecer:
 *   post:
 *     tags: [Auth]
 *     summary: Restablece la credencial usando el token recibido por correo.
 */
router.post('/restablecer', AutenticacionControlador.restablecer);

export default router;
