import { Request, Response } from 'express';
import { perfilDePeticion } from '../middlewares/autenticarPeticion';
import { CompraInternacionalServicio } from '../servicios/compraInternacional.servicio';
import { ProyectoServicio } from '../servicios/proyecto.servicio';
import {
  crearCompraSchema, actualizarCompraSchema
} from '../esquemas/compraInternacional.esquema';
import { bitacora } from '../utilitarios/bitacora';

export class CompraInternacionalControlador {
  static async listar(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const proyectoId = (req.query.proyecto_id as string) || undefined;
    const data = await CompraInternacionalServicio.listar(perfil.sub, proyectoId);
    return res.json({ data });
  }

  static async listarTiposMercaderia(_req: Request, res: Response) {
    const data = await CompraInternacionalServicio.listarTiposMercaderia();
    return res.json({ data });
  }

  static async obtener(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const compra = await CompraInternacionalServicio.obtener(req.params.id, perfil.sub);
    if (!compra) return res.status(404).json({ message: 'Compra no encontrada' });
    return res.json({ data: compra });
  }

  static async crear(req: Request, res: Response) {
    const parsed = crearCompraSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Datos invalidos', errors: parsed.error.issues });
    }
    const perfil = perfilDePeticion(req);
    const proyectoOk = await ProyectoServicio.perteneceAPerfil(parsed.data.proyecto_id, perfil.sub);
    if (!proyectoOk) return res.status(403).json({ message: 'Proyecto no autorizado' });
    try {
      const compra = await CompraInternacionalServicio.crear(perfil.sub, parsed.data as any);
      return res.status(201).json({ data: compra });
    } catch (err: any) {
      bitacora.error('Error creando compra internacional', err);
      return res.status(err.status || 500).json({ message: err.message || 'Error creando compra' });
    }
  }

  static async actualizar(req: Request, res: Response) {
    const parsed = actualizarCompraSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Datos invalidos', errors: parsed.error.issues });
    }
    const perfil = perfilDePeticion(req);
    const compra = await CompraInternacionalServicio.actualizar(req.params.id, perfil.sub, parsed.data);
    if (!compra) return res.status(404).json({ message: 'Compra no encontrada' });
    return res.json({ data: compra });
  }

  static async eliminar(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const ok = await CompraInternacionalServicio.eliminar(req.params.id, perfil.sub);
    if (!ok) return res.status(404).json({ message: 'Compra no encontrada' });
    return res.status(204).send();
  }

  static async asiento(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const data = await CompraInternacionalServicio.asientoContable(req.params.id, perfil.sub);
    if (!data) return res.status(404).json({ message: 'Compra no encontrada' });
    return res.json({ data });
  }
}
