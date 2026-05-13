import { Request, Response } from 'express';
import { perfilDePeticion } from '../middlewares/autenticarPeticion';
import { EstadoResultadosServicio } from '../servicios/estadoResultados.servicio';
import { DiagnosticoIaServicio } from '../servicios/diagnosticoIa.servicio';
import { bitacora } from '../utilitarios/bitacora';

export class DiagnosticoIAControlador {
  static async generar(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const proyectoId = req.params.proyecto_id;
    try {
      const analisis = await EstadoResultadosServicio.obtenerAnalisisRentabilidad(
        proyectoId, perfil.sub, true
      );
      const diagnostico = await DiagnosticoIaServicio.generarDiagnostico(analisis);
      return res.json({
        success: true,
        data: {
          proyecto_id: proyectoId,
          analisis_base: {
            utilidad_neta: analisis.utilidad_neta.utilidad_neta,
            margen_neto: analisis.utilidad_neta.margen_neto_porcentaje,
            ratios: analisis.ratios_financieros
          },
          diagnostico
        }
      });
    } catch (err: any) {
      bitacora.error('Error generando diagnostico IA', err);
      return res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Error generando diagnostico'
      });
    }
  }
}
