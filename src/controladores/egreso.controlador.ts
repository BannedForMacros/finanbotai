import { Request, Response } from 'express';
import { perfilDePeticion } from '../middlewares/autenticarPeticion';
import { EgresoServicio } from '../servicios/egreso.servicio';
import { ProyectoServicio } from '../servicios/proyecto.servicio';
import {
  crearEgresoSchema, actualizarEgresoSchema, parametrosRentabilidadSchema
} from '../esquemas/egresoClasificado.esquema';
import { bitacora } from '../utilitarios/bitacora';

export class EgresoControlador {
  static async listarCatalogo(_req: Request, res: Response) {
    const data = await EgresoServicio.listarCatalogoEgresos();
    return res.json({ data });
  }

  static async listar(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const proyectoId = req.query.proyecto_id as string;
    if (!proyectoId) return res.status(400).json({ message: 'proyecto_id es obligatorio' });
    const data = await EgresoServicio.listarPorProyecto(perfil.sub, proyectoId);
    return res.json({ data });
  }

  static async obtener(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const data = await EgresoServicio.obtener(req.params.id, perfil.sub);
    if (!data) return res.status(404).json({ message: 'Egreso no encontrado' });
    return res.json({ data });
  }

  static async crear(req: Request, res: Response) {
    const parsed = crearEgresoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Datos invalidos', errors: parsed.error.issues });
    }
    const perfil = perfilDePeticion(req);
    const ok = await ProyectoServicio.perteneceAPerfil(parsed.data.proyecto_id, perfil.sub);
    if (!ok) return res.status(403).json({ message: 'Proyecto no autorizado' });
    try {
      const data = await EgresoServicio.crear(perfil.sub, parsed.data as any);
      return res.status(201).json({ data });
    } catch (err: any) {
      bitacora.error('Error creando egreso', err);
      return res.status(err.status || 500).json({ message: err.message || 'Error creando egreso' });
    }
  }

  static async actualizar(req: Request, res: Response) {
    const parsed = actualizarEgresoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Datos invalidos', errors: parsed.error.issues });
    }
    const perfil = perfilDePeticion(req);
    const data = await EgresoServicio.actualizar(req.params.id, perfil.sub, parsed.data);
    if (!data) return res.status(404).json({ message: 'Egreso no encontrado' });
    return res.json({ data });
  }

  static async eliminar(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const ok = await EgresoServicio.eliminar(req.params.id, perfil.sub);
    if (!ok) return res.status(404).json({ message: 'Egreso no encontrado' });
    return res.status(204).send();
  }

  static async calcularTributos(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const proyectoId = req.query.proyecto_id as string;
    if (!proyectoId) return res.status(400).json({ message: 'proyecto_id es obligatorio' });
    const data = await EgresoServicio.calcularTributos(perfil.sub, proyectoId);
    return res.json({ data });
  }

  static async asientoConsolidado(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const proyectoId = req.query.proyecto_id as string;
    if (!proyectoId) return res.status(400).json({ message: 'proyecto_id es obligatorio' });
    const tipo = req.query.tipo_egreso as string | undefined;
    const data = await EgresoServicio.generarAsientoConsolidado(perfil.sub, proyectoId, tipo);
    return res.json({ data });
  }

  static async asientoPorEgreso(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    try {
      const data = await EgresoServicio.generarAsientoPorEgreso(perfil.sub, req.params.id);
      return res.json({ data });
    } catch (err: any) {
      return res.status(err.status || 500).json({ message: err.message || 'Error generando asiento' });
    }
  }

  static async resumenPorTipo(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const proyectoId = req.query.proyecto_id as string;
    if (!proyectoId) return res.status(400).json({ message: 'proyecto_id es obligatorio' });
    const data = await EgresoServicio.resumenPorTipo(perfil.sub, proyectoId);
    return res.json({ data });
  }

  static async guardarParametros(req: Request, res: Response) {
    const parsed = parametrosRentabilidadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Datos invalidos', errors: parsed.error.issues });
    }
    const perfil = perfilDePeticion(req);
    const ok = await ProyectoServicio.perteneceAPerfil(parsed.data.proyecto_id, perfil.sub);
    if (!ok) return res.status(403).json({ message: 'Proyecto no autorizado' });
    const data = await EgresoServicio.guardarParametrosRentabilidad(perfil.sub, parsed.data);
    return res.json({ data });
  }

  static async obtenerParametros(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const data = await EgresoServicio.obtenerParametrosRentabilidad(perfil.sub, req.params.proyecto_id);
    if (!data) return res.json({ data: null });
    return res.json({ data });
  }
}
