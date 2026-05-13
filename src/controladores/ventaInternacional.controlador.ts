import { Request, Response } from 'express';
import { perfilDePeticion } from '../middlewares/autenticarPeticion';
import { VentaInternacionalServicio } from '../servicios/ventaInternacional.servicio';
import { ProyectoServicio } from '../servicios/proyecto.servicio';
import {
  crearVentaSchema, actualizarVentaSchema
} from '../esquemas/ventaInternacional.esquema';
import { bitacora } from '../utilitarios/bitacora';

export class VentaInternacionalControlador {
  static async listar(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const proyectoId = (req.query.proyecto_id as string) || undefined;
    const data = await VentaInternacionalServicio.listar(perfil.sub, proyectoId);
    return res.json({ data });
  }

  static async listarTiposArticulo(_req: Request, res: Response) {
    const data = await VentaInternacionalServicio.listarTiposArticulo();
    return res.json({ data });
  }

  static async obtener(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const venta = await VentaInternacionalServicio.obtener(req.params.id, perfil.sub);
    if (!venta) return res.status(404).json({ message: 'Venta no encontrada' });
    return res.json({ data: venta });
  }

  static async crear(req: Request, res: Response) {
    const parsed = crearVentaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Datos invalidos', errors: parsed.error.issues });
    }
    const perfil = perfilDePeticion(req);
    const ok = await ProyectoServicio.perteneceAPerfil(parsed.data.proyecto_id, perfil.sub);
    if (!ok) return res.status(403).json({ message: 'Proyecto no autorizado' });
    try {
      const data = await VentaInternacionalServicio.crear(perfil.sub, parsed.data as any);
      return res.status(201).json({ data });
    } catch (err: any) {
      bitacora.error('Error creando venta', err);
      return res.status(err.status || 500).json({ message: err.message || 'Error creando venta' });
    }
  }

  static async actualizar(req: Request, res: Response) {
    const parsed = actualizarVentaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Datos invalidos', errors: parsed.error.issues });
    }
    const perfil = perfilDePeticion(req);
    const data = await VentaInternacionalServicio.actualizar(req.params.id, perfil.sub, parsed.data);
    if (!data) return res.status(404).json({ message: 'Venta no encontrada' });
    return res.json({ data });
  }

  static async eliminar(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const ok = await VentaInternacionalServicio.eliminar(req.params.id, perfil.sub);
    if (!ok) return res.status(404).json({ message: 'Venta no encontrada' });
    return res.status(204).send();
  }

  static async asiento(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const asiento = await VentaInternacionalServicio.obtenerAsiento(req.params.id, perfil.sub);
    if (!asiento) return res.status(404).json({ message: 'Asiento no encontrado' });
    return res.json({ data: asiento });
  }

  static async regenerarAsiento(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    try {
      const asiento = await VentaInternacionalServicio.generarYGuardarAsiento(req.params.id, perfil.sub);
      return res.json({ data: asiento });
    } catch (err: any) {
      return res.status(err.status || 500).json({ message: err.message || 'Error regenerando asiento' });
    }
  }
}
