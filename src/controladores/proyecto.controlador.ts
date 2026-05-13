import { Request, Response } from 'express';
import { perfilDePeticion } from '../middlewares/autenticarPeticion';
import { ProyectoServicio } from '../servicios/proyecto.servicio';
import {
  crearProyectoSchema, actualizarProyectoSchema
} from '../esquemas/proyecto.esquema';
import { bitacora } from '../utilitarios/bitacora';

export class ProyectoControlador {
  static async listar(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const soloAbiertos = req.query.solo_abiertos === 'true';
    try {
      const data = await ProyectoServicio.listar(perfil.sub, soloAbiertos);
      return res.json({ data });
    } catch (e) {
      bitacora.error('Error listando proyectos', e);
      return res.status(500).json({ message: 'Error listando proyectos' });
    }
  }

  static async obtener(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const proyecto = await ProyectoServicio.obtener(req.params.id, perfil.sub);
    if (!proyecto) return res.status(404).json({ message: 'Proyecto no encontrado' });
    return res.json({ data: proyecto });
  }

  static async crear(req: Request, res: Response) {
    const parsed = crearProyectoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos invalidos', errors: parsed.error.issues });
    const perfil = perfilDePeticion(req);
    const proyecto = await ProyectoServicio.crear(perfil.sub, parsed.data);
    return res.status(201).json({ data: proyecto });
  }

  static async actualizar(req: Request, res: Response) {
    const parsed = actualizarProyectoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos invalidos', errors: parsed.error.issues });
    const perfil = perfilDePeticion(req);
    const proyecto = await ProyectoServicio.actualizar(req.params.id, perfil.sub, parsed.data);
    if (!proyecto) return res.status(404).json({ message: 'Proyecto no encontrado' });
    return res.json({ data: proyecto });
  }

  static async cerrar(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const proyecto = await ProyectoServicio.cerrar(req.params.id, perfil.sub);
    if (!proyecto) return res.status(404).json({ message: 'Proyecto no encontrado' });
    return res.json({ data: proyecto });
  }

  static async archivar(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const ok = await ProyectoServicio.archivar(req.params.id, perfil.sub);
    if (!ok) return res.status(404).json({ message: 'Proyecto no encontrado' });
    return res.status(204).send();
  }
}
