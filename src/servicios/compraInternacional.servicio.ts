import { ejecutarSql } from '../datos';
import {
  CalculoTributarioServicio,
  CompraInputCalculo,
  TributoLinea,
  LineaAsiento
} from './calculoTributario.servicio';
import { TipoCambioServicio } from './tipoCambio.servicio';
import { bitacora } from '../utilitarios/bitacora';

export interface CompraFila {
  id: string;
  proyecto_id: string;
  perfil_id: string;
  flag_compra_local: boolean;
  tipo_mercaderia_id: number;
  codigo_arancelario: string;
  descripcion_articulo: string | null;
  divisa: string;
  importe_fob: string;
  importe_flete: string;
  importe_seguro: string;
  aplica_igv: boolean;
  aplica_isc: boolean;
  aplica_percepcion: boolean;
  tasa_advalorem_input: string | null;
  tasa_isc_input: string | null;
  tasa_percepcion_input: string | null;
  cargo_antidumping_usd: string;
  cargo_compensatorio_usd: string;
  cargo_sda_usd: string;
  valor_cif_resultante: string;
  valor_advalorem_resultante: string;
  valor_isc_resultante: string;
  valor_igv_resultante: string;
  valor_ipm_resultante: string;
  valor_percepcion_resultante: string;
  total_carga_aduanera: string;
  libro_diario_jsonb: LineaAsiento[] | null;
  fecha_compra: string;
  fecha_cotizacion: string | null;
  activa: boolean;
  registrada_en: string;
}

export interface CrearCompraInput extends CompraInputCalculo {
  proyecto_id: string;
  tipo_mercaderia_id: number;
  codigo_arancelario?: string;
  divisa: 'USD' | 'PEN';
  fecha_compra?: string;
}

export interface ActualizarCompraInput {
  proyecto_id?: string;
  flag_compra_local?: boolean;
  tipo_mercaderia_id?: number;
  codigo_arancelario?: string;
  descripcion_articulo?: string;
  divisa?: 'USD' | 'PEN';
  importe_fob?: number;
  importe_flete?: number;
  importe_seguro?: number;
  aplica_igv?: boolean;
  aplica_isc?: boolean;
  aplica_percepcion?: boolean;
  tasa_advalorem_input?: number | null;
  tasa_isc_input?: number | null;
  tasa_percepcion_input?: number | null;
  cargo_antidumping_usd?: number;
  cargo_compensatorio_usd?: number;
  cargo_sda_usd?: number;
  fecha_compra?: string;
}

export class CompraInternacionalServicio {
  static async listarTiposMercaderia() {
    const { rows } = await ejecutarSql<{
      id: number;
      denominacion: string;
      cuenta_pcge: string;
      descripcion_extendida: string | null;
    }>(
      `SELECT id, denominacion, cuenta_pcge, descripcion_extendida
         FROM intelfin.tipos_mercaderia
        ORDER BY cuenta_pcge`
    );
    return rows;
  }

  static async listar(perfilId: string, proyectoId?: string): Promise<CompraFila[]> {
    let sql = `
      SELECT ci.*, pa.nombre_proyecto, ca.descripcion_oficial AS descripcion_arancelaria,
             tm.denominacion AS tipo_mercaderia_denominacion,
             tm.cuenta_pcge AS tipo_mercaderia_cuenta_pcge
        FROM intelfin.compras_internacionales ci
        JOIN intelfin.proyectos_analisis pa ON pa.id = ci.proyecto_id
        LEFT JOIN intelfin.catalogo_arancelario ca ON ca.codigo_arancelario = ci.codigo_arancelario
        LEFT JOIN intelfin.tipos_mercaderia tm ON tm.id = ci.tipo_mercaderia_id
       WHERE ci.perfil_id = $1 AND ci.activa = true AND pa.estado_proyecto <> 'archivado'
    `;
    const params: any[] = [perfilId];
    if (proyectoId) {
      sql += ` AND ci.proyecto_id = $${params.length + 1}`;
      params.push(proyectoId);
    }
    sql += ` ORDER BY ci.registrada_en DESC`;
    const { rows } = await ejecutarSql<CompraFila>(sql, params);
    return rows;
  }

  static async obtener(id: string, perfilId: string): Promise<CompraFila | null> {
    const { rows } = await ejecutarSql<CompraFila>(
      `SELECT ci.*, pa.nombre_proyecto, ca.descripcion_oficial AS descripcion_arancelaria,
              tm.denominacion AS tipo_mercaderia_denominacion,
              tm.cuenta_pcge AS tipo_mercaderia_cuenta_pcge
         FROM intelfin.compras_internacionales ci
         JOIN intelfin.proyectos_analisis pa ON pa.id = ci.proyecto_id
         LEFT JOIN intelfin.catalogo_arancelario ca ON ca.codigo_arancelario = ci.codigo_arancelario
         LEFT JOIN intelfin.tipos_mercaderia tm ON tm.id = ci.tipo_mercaderia_id
        WHERE ci.id = $1 AND ci.perfil_id = $2 AND ci.activa = true`,
      [id, perfilId]
    );
    return rows[0] || null;
  }

  static async crear(perfilId: string, datos: CrearCompraInput): Promise<CompraFila> {
    const tipoMercaderia = await CalculoTributarioServicio.obtenerTipoMercaderia(datos.tipo_mercaderia_id);
    if (!tipoMercaderia) {
      const err: any = new Error('Tipo de mercaderia no encontrado');
      err.status = 404;
      throw err;
    }

    if (!datos.flag_compra_local && !datos.tasa_advalorem_input && datos.codigo_arancelario) {
      const tasaAutomatica = await CalculoTributarioServicio.obtenerTasaAdValorem(datos.codigo_arancelario);
      datos.tasa_advalorem_input = tasaAutomatica ?? 0;
    }

    const tasas = await CalculoTributarioServicio.obtenerTasasImpuestos();
    const calculado = await CalculoTributarioServicio.calcularCompra(datos, tasas, tipoMercaderia);

    const fechaOp = datos.fecha_compra || new Date().toISOString().split('T')[0];
    let fechaCotizacion: string | null = null;
    try {
      const info = await TipoCambioServicio.getTipoCambioInfo(fechaOp);
      fechaCotizacion = info.date;
    } catch (e) {
      bitacora.warn(`No se pudo obtener cotizacion para ${fechaOp}`, e);
    }

    const { rows } = await ejecutarSql<CompraFila>(
      `INSERT INTO intelfin.compras_internacionales (
        proyecto_id, perfil_id, flag_compra_local, tipo_mercaderia_id, codigo_arancelario,
        descripcion_articulo, divisa, importe_fob, importe_flete, importe_seguro,
        aplica_igv, aplica_isc, aplica_percepcion,
        tasa_advalorem_input, tasa_isc_input, tasa_percepcion_input,
        cargo_antidumping_usd, cargo_compensatorio_usd, cargo_sda_usd,
        valor_cif_resultante, valor_advalorem_resultante, valor_isc_resultante,
        valor_igv_resultante, valor_ipm_resultante, valor_percepcion_resultante,
        total_carga_aduanera, libro_diario_jsonb,
        fecha_compra, fecha_cotizacion, activa
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26, $27,
        $28, $29, true
      ) RETURNING *`,
      [
        datos.proyecto_id, perfilId, datos.flag_compra_local || false,
        datos.tipo_mercaderia_id, datos.codigo_arancelario || null,
        datos.descripcion_articulo, datos.divisa,
        datos.importe_fob, datos.importe_flete || 0, datos.importe_seguro || 0,
        datos.aplica_igv, datos.aplica_isc, datos.aplica_percepcion,
        datos.tasa_advalorem_input ?? null, datos.tasa_isc_input ?? null, datos.tasa_percepcion_input ?? null,
        datos.cargo_antidumping_usd || 0, datos.cargo_compensatorio_usd || 0, datos.cargo_sda_usd || 0,
        calculado.valor_cif_resultante, calculado.valor_advalorem_resultante, calculado.valor_isc_resultante,
        calculado.valor_igv_resultante, calculado.valor_ipm_resultante, calculado.valor_percepcion_resultante,
        calculado.total_carga_aduanera, JSON.stringify(calculado.libro_diario),
        fechaOp, fechaCotizacion
      ]
    );

    return rows[0];
  }

  static async actualizar(
    id: string,
    perfilId: string,
    datos: ActualizarCompraInput
  ): Promise<CompraFila | null> {
    const existente = await this.obtener(id, perfilId);
    if (!existente) return null;

    const mezclado: any = {
      flag_compra_local: datos.flag_compra_local ?? existente.flag_compra_local,
      importe_fob: datos.importe_fob ?? parseFloat(existente.importe_fob),
      importe_flete: datos.importe_flete ?? parseFloat(existente.importe_flete),
      importe_seguro: datos.importe_seguro ?? parseFloat(existente.importe_seguro),
      aplica_igv: datos.aplica_igv ?? existente.aplica_igv,
      aplica_isc: datos.aplica_isc ?? existente.aplica_isc,
      aplica_percepcion: datos.aplica_percepcion ?? existente.aplica_percepcion,
      tasa_advalorem_input: datos.tasa_advalorem_input ?? (existente.tasa_advalorem_input ? parseFloat(existente.tasa_advalorem_input) : null),
      tasa_isc_input: datos.tasa_isc_input ?? (existente.tasa_isc_input ? parseFloat(existente.tasa_isc_input) : null),
      tasa_percepcion_input: datos.tasa_percepcion_input ?? (existente.tasa_percepcion_input ? parseFloat(existente.tasa_percepcion_input) : null),
      cargo_antidumping_usd: datos.cargo_antidumping_usd ?? parseFloat(existente.cargo_antidumping_usd),
      cargo_compensatorio_usd: datos.cargo_compensatorio_usd ?? parseFloat(existente.cargo_compensatorio_usd),
      cargo_sda_usd: datos.cargo_sda_usd ?? parseFloat(existente.cargo_sda_usd),
      descripcion_articulo: datos.descripcion_articulo ?? existente.descripcion_articulo
    };

    const tipoMercaderiaId = datos.tipo_mercaderia_id ?? existente.tipo_mercaderia_id;
    const tipoMercaderia = await CalculoTributarioServicio.obtenerTipoMercaderia(tipoMercaderiaId);
    if (!tipoMercaderia) {
      const err: any = new Error('Tipo de mercaderia no encontrado');
      err.status = 404;
      throw err;
    }

    const codigoArancelario = datos.codigo_arancelario ?? existente.codigo_arancelario;
    if (!mezclado.flag_compra_local && datos.codigo_arancelario && !datos.tasa_advalorem_input) {
      const tasa = await CalculoTributarioServicio.obtenerTasaAdValorem(datos.codigo_arancelario);
      mezclado.tasa_advalorem_input = tasa ?? 0;
    }

    const tasas = await CalculoTributarioServicio.obtenerTasasImpuestos();
    const calc = await CalculoTributarioServicio.calcularCompra(mezclado, tasas, tipoMercaderia);

    const fechaCompra = datos.fecha_compra ?? existente.fecha_compra;
    const divisa = datos.divisa ?? existente.divisa;
    const proyectoId = datos.proyecto_id ?? existente.proyecto_id;

    const { rows } = await ejecutarSql<CompraFila>(
      `UPDATE intelfin.compras_internacionales
          SET proyecto_id = $1,
              flag_compra_local = $2,
              tipo_mercaderia_id = $3,
              codigo_arancelario = $4,
              descripcion_articulo = $5,
              divisa = $6,
              importe_fob = $7,
              importe_flete = $8,
              importe_seguro = $9,
              aplica_igv = $10,
              aplica_isc = $11,
              aplica_percepcion = $12,
              tasa_advalorem_input = $13,
              tasa_isc_input = $14,
              tasa_percepcion_input = $15,
              cargo_antidumping_usd = $16,
              cargo_compensatorio_usd = $17,
              cargo_sda_usd = $18,
              valor_cif_resultante = $19,
              valor_advalorem_resultante = $20,
              valor_isc_resultante = $21,
              valor_igv_resultante = $22,
              valor_ipm_resultante = $23,
              valor_percepcion_resultante = $24,
              total_carga_aduanera = $25,
              libro_diario_jsonb = $26,
              fecha_compra = $27
        WHERE id = $28 AND perfil_id = $29 AND activa = true
        RETURNING *`,
      [
        proyectoId, mezclado.flag_compra_local, tipoMercaderiaId, codigoArancelario,
        mezclado.descripcion_articulo, divisa,
        mezclado.importe_fob, mezclado.importe_flete, mezclado.importe_seguro,
        mezclado.aplica_igv, mezclado.aplica_isc, mezclado.aplica_percepcion,
        mezclado.tasa_advalorem_input, mezclado.tasa_isc_input, mezclado.tasa_percepcion_input,
        mezclado.cargo_antidumping_usd, mezclado.cargo_compensatorio_usd, mezclado.cargo_sda_usd,
        calc.valor_cif_resultante, calc.valor_advalorem_resultante, calc.valor_isc_resultante,
        calc.valor_igv_resultante, calc.valor_ipm_resultante, calc.valor_percepcion_resultante,
        calc.total_carga_aduanera, JSON.stringify(calc.libro_diario),
        fechaCompra, id, perfilId
      ]
    );

    return rows[0] || null;
  }

  static async eliminar(id: string, perfilId: string): Promise<boolean> {
    const { rows } = await ejecutarSql<{ id: string }>(
      `UPDATE intelfin.compras_internacionales
          SET activa = false
        WHERE id = $1 AND perfil_id = $2 AND activa = true
        RETURNING id`,
      [id, perfilId]
    );
    return rows.length > 0;
  }

  static async asientoContable(
    id: string,
    perfilId: string
  ): Promise<{ lineas: LineaAsiento[]; totalDebe: number; totalHaber: number } | null> {
    const compra = await this.obtener(id, perfilId);
    if (!compra) return null;
    const libro = (compra.libro_diario_jsonb as unknown as LineaAsiento[]) || [];
    const totalDebe = libro.reduce((s, l) => s + Number(l.debe || 0), 0);
    const totalHaber = libro.reduce((s, l) => s + Number(l.haber || 0), 0);
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return { lineas: libro, totalDebe: round2(totalDebe), totalHaber: round2(totalHaber) };
  }
}
