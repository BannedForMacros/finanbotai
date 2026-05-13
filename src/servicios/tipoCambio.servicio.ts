import { ejecutarSql } from '../datos';
import { config } from '../config';
import { bitacora } from '../utilitarios/bitacora';

export type Divisa = 'USD' | 'PEN';

export interface CotizacionInfo {
  rate: number;
  buyPrice: number;
  date: string;
}

interface FilaCotizacion {
  valor_compra: string;
  valor_venta: string;
  fecha_cotizacion: string;
}

const cacheMemoria = new Map<string, CotizacionInfo & { timestamp: number }>();

export class TipoCambioServicio {
  static async getTipoCambio(fecha?: string): Promise<number> {
    const info = await this.getTipoCambioInfo(fecha);
    return info.rate;
  }

  static async getTipoCambioInfo(fecha?: string): Promise<CotizacionInfo> {
    const fechaObjetivo = fecha || new Date().toISOString().split('T')[0];

    const cacheado = cacheMemoria.get(fechaObjetivo);
    if (cacheado) {
      return { rate: cacheado.rate, buyPrice: cacheado.buyPrice, date: cacheado.date };
    }

    try {
      const { rows } = await ejecutarSql<FilaCotizacion>(
        `SELECT valor_compra, valor_venta, fecha_cotizacion::text AS fecha_cotizacion
           FROM intelfin.cotizacion_diaria
          WHERE divisa = 'USD' AND fecha_cotizacion = $1
          LIMIT 1`,
        [fechaObjetivo]
      );
      if (rows.length > 0) {
        const info: CotizacionInfo = {
          rate: parseFloat(rows[0].valor_venta),
          buyPrice: parseFloat(rows[0].valor_compra),
          date: rows[0].fecha_cotizacion
        };
        cacheMemoria.set(fechaObjetivo, { ...info, timestamp: Date.now() });
        return info;
      }
    } catch (e) {
      bitacora.warn('Lectura de cotizacion_diaria fallo', e);
    }

    try {
      const info = await this.consultarDecolecta(fechaObjetivo);
      try {
        await ejecutarSql(
          `INSERT INTO intelfin.cotizacion_diaria (divisa, valor_compra, valor_venta, fecha_cotizacion)
           VALUES ('USD', $1, $2, $3)
           ON CONFLICT (divisa, fecha_cotizacion) DO NOTHING`,
          [info.buyPrice, info.rate, info.date]
        );
      } catch (e) {
        bitacora.warn('No se pudo persistir cotizacion en BD', e);
      }
      cacheMemoria.set(info.date, { ...info, timestamp: Date.now() });
      return info;
    } catch (e) {
      bitacora.warn(`Decolecta no disponible para ${fechaObjetivo}`, e);
    }

    try {
      const { rows } = await ejecutarSql<FilaCotizacion>(
        `SELECT valor_compra, valor_venta, fecha_cotizacion::text AS fecha_cotizacion
           FROM intelfin.cotizacion_diaria
          WHERE divisa = 'USD' AND fecha_cotizacion <= $1
          ORDER BY fecha_cotizacion DESC
          LIMIT 1`,
        [fechaObjetivo]
      );
      if (rows.length > 0) {
        const info: CotizacionInfo = {
          rate: parseFloat(rows[0].valor_venta),
          buyPrice: parseFloat(rows[0].valor_compra),
          date: rows[0].fecha_cotizacion
        };
        cacheMemoria.set(fechaObjetivo, { ...info, timestamp: Date.now() });
        bitacora.warn(`Cotizacion ${fechaObjetivo} no disponible. Usando fallback: ${rows[0].fecha_cotizacion}`);
        return info;
      }
    } catch (e) {
      bitacora.warn('Fallback de cotizacion fallo', e);
    }

    throw new Error(`No se pudo obtener el tipo de cambio para ${fechaObjetivo}`);
  }

  private static async consultarDecolecta(fecha?: string): Promise<CotizacionInfo> {
    if (!config.decolecta.token) {
      throw new Error('DECOLECTA_API_TOKEN no configurado en el servidor');
    }
    const base = `${config.decolecta.baseUrl}/v1/tipo-cambio/sbs/average?currency=USD`;
    const url = fecha ? `${base}&date=${fecha}` : base;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.decolecta.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Decolecta respondio estado ${response.status}`);
    }

    const raw = (await response.json()) as Record<string, unknown>;
    const sellPrice = parseFloat(String(raw['sell_price']));
    const buyPrice = parseFloat(String(raw['buy_price']));

    if (isNaN(sellPrice) || isNaN(buyPrice)) {
      throw new Error(`Respuesta invalida: sell_price=${raw['sell_price']}, buy_price=${raw['buy_price']}`);
    }
    if (!raw['date']) {
      throw new Error('Respuesta invalida: falta campo date');
    }
    return { rate: sellPrice, buyPrice, date: String(raw['date']) };
  }

  static invalidarCache(fecha?: string): void {
    if (fecha) {
      cacheMemoria.delete(fecha);
    } else {
      cacheMemoria.clear();
    }
  }

  static async convertir(monto: number, de: Divisa, a: Divisa): Promise<number> {
    if (de === a) return monto;
    const tasa = await this.getTipoCambio();
    if (de === 'USD' && a === 'PEN') return monto * tasa;
    if (de === 'PEN' && a === 'USD') return monto / tasa;
    return monto;
  }
}
