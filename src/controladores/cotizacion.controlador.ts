import { Request, Response } from 'express';
import { TipoCambioServicio } from '../servicios/tipoCambio.servicio';
import { bitacora } from '../utilitarios/bitacora';

export class CotizacionControlador {
  static async obtener(req: Request, res: Response) {
    try {
      const fecha = req.query.date as string | undefined;
      const info = await TipoCambioServicio.getTipoCambioInfo(fecha);
      return res.json({
        rate: info.rate,
        buy_price: info.buyPrice,
        date: info.date
      });
    } catch (err: any) {
      bitacora.error('Error obteniendo cotizacion', err);
      return res.status(500).json({ message: err.message || 'Error obteniendo cotizacion' });
    }
  }

  static async convertir(req: Request, res: Response) {
    const { amount, from, to } = req.body;
    if (typeof amount !== 'number' || isNaN(amount)) {
      return res.status(400).json({ message: 'amount debe ser un numero' });
    }
    if (!['USD', 'PEN'].includes(from) || !['USD', 'PEN'].includes(to)) {
      return res.status(400).json({ message: 'from y to deben ser USD o PEN' });
    }
    try {
      const convertido = await TipoCambioServicio.convertir(amount, from, to);
      return res.json({ convertedAmount: convertido });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  static async invalidarCache(req: Request, res: Response) {
    const fecha = (req.query.date as string) || undefined;
    TipoCambioServicio.invalidarCache(fecha);
    return res.json({ message: 'Cache invalidado' });
  }
}
