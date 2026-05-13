import { Request, Response } from 'express';
import { perfilDePeticion } from '../middlewares/autenticarPeticion';
import { EstadoResultadosServicio } from '../servicios/estadoResultados.servicio';
import { bitacora } from '../utilitarios/bitacora';

export class RentabilidadControlador {
  static async analisisCompleto(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const incluirDetalles = req.query.incluir_detalles !== 'false';
    try {
      const data = await EstadoResultadosServicio.obtenerAnalisisRentabilidad(
        req.params.proyecto_id,
        perfil.sub,
        incluirDetalles
      );
      return res.json({
        success: true,
        data,
        metadata: {
          proyecto_id: req.params.proyecto_id,
          incluye_detalles: incluirDetalles,
          tipo_cambio_usado: data.resumen_monedas.tipo_cambio_usado,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err: any) {
      bitacora.error('Error en analisis de rentabilidad', err);
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  static async estadoResultados(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    try {
      const data = await EstadoResultadosServicio.obtenerAnalisisRentabilidad(
        req.params.proyecto_id, perfil.sub, false
      );
      return res.json({
        success: true,
        data: {
          proyecto_id: req.params.proyecto_id,
          nombre_proyecto: data.nombre_proyecto,
          estado_resultados: data.estado_resultados,
          tipo_cambio_usado: data.resumen_monedas.tipo_cambio_usado
        }
      });
    } catch (err: any) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  static async ratios(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    try {
      const data = await EstadoResultadosServicio.obtenerAnalisisRentabilidad(
        req.params.proyecto_id, perfil.sub, false
      );
      return res.json({
        success: true,
        data: {
          proyecto_id: req.params.proyecto_id,
          nombre_proyecto: data.nombre_proyecto,
          ratios: data.ratios_financieros,
          utilidades: {
            bruta: data.utilidad_bruta.utilidad_bruta,
            operativa: data.utilidad_operativa.utilidad_operativa,
            neta: data.utilidad_neta.utilidad_neta
          },
          ventas: { total_sin_igv: data.utilidad_bruta.ventas_totales_sin_igv },
          costo_ventas: data.utilidad_bruta.costo_ventas,
          resumen_monedas: data.resumen_monedas
        }
      });
    } catch (err: any) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  static async asientoConsolidado(req: Request, res: Response) {
    const perfil = perfilDePeticion(req);
    const moneda = (req.query.moneda as string) === 'PEN' ? 'PEN' : 'USD';
    try {
      const data = await EstadoResultadosServicio.generarAsientoConsolidado(
        req.params.proyecto_id, perfil.sub, moneda as 'USD' | 'PEN'
      );
      return res.json({
        success: true,
        data,
        metadata: {
          proyecto_id: req.params.proyecto_id,
          total_lineas: data.detalles.length,
          diferencia: data.diferencia,
          esta_balanceado: Math.abs(data.diferencia) <= 0.01,
          moneda: data.moneda,
          tipo_cambio: data.tipo_cambio,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err: any) {
      bitacora.error('Error generando asiento consolidado', err);
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }
}
