import { Request, Response } from 'express';
import {
  registroSchema, accesoSchema, refreshSchema,
  solicitudResetSchema, restablecerSchema
} from '../esquemas/autenticacion.esquema';
import { AutenticacionServicio } from '../servicios/autenticacion.servicio';
import { perfilDePeticion } from '../middlewares/autenticarPeticion';
import { bitacora } from '../utilitarios/bitacora';

function infoSesion(req: Request) {
  return {
    agente_dispositivo: (req.headers['user-agent'] as string) || null,
    ip_origen: req.ip || null
  };
}

export class AutenticacionControlador {
  static async registrar(req: Request, res: Response) {
    const parsed = registroSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Datos invalidos', errors: parsed.error.issues });
    }
    try {
      const data = await AutenticacionServicio.registrar(parsed.data, infoSesion(req));
      return res.status(201).json(data);
    } catch (err: any) {
      bitacora.error('Error en registro', err);
      return res.status(err.status || 500).json({ message: err.message || 'Error en registro' });
    }
  }

  static async iniciarSesion(req: Request, res: Response) {
    const parsed = accesoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Datos invalidos', errors: parsed.error.issues });
    }
    try {
      const data = await AutenticacionServicio.iniciarSesion(parsed.data, infoSesion(req));
      return res.json(data);
    } catch (err: any) {
      return res.status(err.status || 500).json({ message: err.message || 'Error de acceso' });
    }
  }

  static async refrescar(req: Request, res: Response) {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos invalidos' });
    try {
      const data = await AutenticacionServicio.refrescar(parsed.data.refresh_token);
      return res.json(data);
    } catch (err: any) {
      return res.status(err.status || 500).json({ message: err.message || 'Error de refresh' });
    }
  }

  static async cerrarSesion(req: Request, res: Response) {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos invalidos' });
    await AutenticacionServicio.cerrarSesion(parsed.data.refresh_token);
    return res.status(204).send();
  }

  static async perfilActual(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const data = await AutenticacionServicio.perfilPorId(perfil.sub);
    if (!data) return res.status(404).json({ message: 'Perfil no encontrado' });
    return res.json({ perfil: data });
  }

  static async solicitarRecuperacion(req: Request, res: Response) {
    const parsed = solicitudResetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Correo invalido' });
    try {
      await AutenticacionServicio.solicitarRecuperacion(parsed.data.correo_corporativo);
    } catch (e) {
      bitacora.warn('Solicitud de recuperacion fallida (no se expone)', e);
    }
    return res.json({
      message: 'Si existe una cuenta asociada al correo, te enviamos un enlace para restablecer tu credencial.'
    });
  }

  static async restablecer(req: Request, res: Response) {
    const parsed = restablecerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos invalidos' });
    try {
      await AutenticacionServicio.restablecerAcceso(parsed.data.token, parsed.data.credencial);
      return res.status(204).send();
    } catch (err: any) {
      return res.status(err.status || 500).json({ message: err.message || 'Error restableciendo' });
    }
  }
}
