import { ejecutarSql } from '../datos';

export interface TipoMercaderiaInfo {
  id: number;
  denominacion: string;
  cuenta_pcge: string;
}

export interface LineaAsiento {
  cuenta: string;
  nombre_cuenta: string;
  debe: number;
  haber: number;
  glosa: string;
}

export interface TributoLinea {
  concepto: string;
  base_imponible: number;
  tasa_aplicada: number;
  monto_calculado: number;
}

export interface CompraCalculada {
  valor_cif_resultante: number;
  valor_advalorem_resultante: number;
  valor_isc_resultante: number;
  valor_igv_resultante: number;
  valor_ipm_resultante: number;
  valor_percepcion_resultante: number;
  total_carga_aduanera: number;
  tributos: TributoLinea[];
  libro_diario: LineaAsiento[];
}

export interface CompraInputCalculo {
  flag_compra_local: boolean;
  importe_fob: number;
  importe_flete: number;
  importe_seguro: number;
  aplica_igv: boolean;
  aplica_isc: boolean;
  aplica_percepcion: boolean;
  tasa_advalorem_input?: number | null;
  tasa_isc_input?: number | null;
  tasa_percepcion_input?: number | null;
  cargo_antidumping_usd: number;
  cargo_compensatorio_usd: number;
  cargo_sda_usd: number;
  descripcion_articulo: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const REGLAS_PCGE = {
  ad_valorem: { cuenta: '4015', nombre: 'Derechos aduaneros' },
  isc: { cuenta: '4012', nombre: 'Impuesto Selectivo al Consumo' },
  igv: { cuenta: '4011', nombre: 'IGV - Cuenta propia' },
  costos_vinculados: { cuenta: '609', nombre: 'Costos vinculados con las compras' },
  percepcion: { cuenta: '4011', nombre: 'IGV - Regimen de percepciones' },
  proveedores: { cuenta: '4212', nombre: 'Facturas, boletas y otros comprobantes por pagar' },
  clientes_nacional: { cuenta: '1212', nombre: 'Cuentas por cobrar nacionales' },
  clientes_internacional: { cuenta: '1212', nombre: 'Cuentas por cobrar internacionales' },
  igv_ventas: { cuenta: '4011', nombre: 'IGV - Cuenta propia' },
  remuneraciones_pagar: { cuenta: '411', nombre: 'Remuneraciones por pagar' },
  essalud_pagar: { cuenta: '4031', nombre: 'Instituciones publicas (ESSALUD)' },
  onp_pagar: { cuenta: '4032', nombre: 'Instituciones publicas (ONP)' },
  afp_pagar: { cuenta: '407', nombre: 'Administradoras de fondos de pensiones' },
  facturas_pagar: { cuenta: '4212', nombre: 'Facturas, boletas y otros comprobantes por pagar' },
  otras_cuentas_pagar: { cuenta: '469', nombre: 'Otras cuentas por pagar diversas' },
  caja_bancos: { cuenta: '101', nombre: 'Caja y bancos' }
} as const;

export class CalculoTributarioServicio {
  static reglasPcge() {
    return REGLAS_PCGE;
  }

  static async obtenerTipoMercaderia(id: number): Promise<TipoMercaderiaInfo | null> {
    const { rows } = await ejecutarSql<TipoMercaderiaInfo>(
      `SELECT id, denominacion, cuenta_pcge
         FROM intelfin.tipos_mercaderia
        WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  static async obtenerTipoArticuloVenta(id: number) {
    const { rows } = await ejecutarSql<{ id: number; denominacion: string; cuenta_pcge: string }>(
      `SELECT id, denominacion, cuenta_pcge
         FROM intelfin.tipos_articulo_venta
        WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  static async obtenerTasaAdValorem(codigo: string): Promise<number | null> {
    const { rows } = await ejecutarSql<{ tasa_porcentual: string }>(
      `SELECT tasa_porcentual
         FROM intelfin.tasas_advalorem_intelfin
        WHERE codigo_arancelario = $1`,
      [codigo]
    );
    return rows.length > 0 ? parseFloat(rows[0].tasa_porcentual) / 100 : null;
  }

  static async obtenerTasasImpuestos(): Promise<{ igv: number; ipm: number }> {
    try {
      const { rows } = await ejecutarSql<{ clave_concepto: string; tasa_porcentual: string }>(
        `SELECT clave_concepto, tasa_porcentual
           FROM intelfin.tabla_impuestos
          WHERE clave_concepto IN ('IGV', 'IPM')`
      );
      const tasas = { igv: 0.16, ipm: 0.02 };
      rows.forEach((r) => {
        const valor = parseFloat(r.tasa_porcentual) / 100;
        if (r.clave_concepto === 'IGV') tasas.igv = valor;
        if (r.clave_concepto === 'IPM') tasas.ipm = valor;
      });
      return tasas;
    } catch {
      return { igv: 0.16, ipm: 0.02 };
    }
  }

  static async calcularCompra(
    data: CompraInputCalculo,
    tasas: { igv: number; ipm: number },
    tipoMercaderia: TipoMercaderiaInfo
  ): Promise<CompraCalculada> {
    if (data.flag_compra_local) {
      return this.calcularCompraLocal(data, tasas, tipoMercaderia);
    }

    const valorCIF = round2(data.importe_fob + data.importe_flete + data.importe_seguro);
    const tasaAV = data.tasa_advalorem_input || 0;
    const valorAV = round2(valorCIF * tasaAV);

    const baseISC = round2(valorCIF + valorAV);
    const valorISC = data.aplica_isc ? round2(baseISC * (data.tasa_isc_input || 0)) : 0;

    const baseIGV = round2(valorCIF + valorAV + valorISC);
    const valorIGV = data.aplica_igv ? round2(baseIGV * tasas.igv) : 0;
    const valorIPM = data.aplica_igv ? round2(baseIGV * tasas.ipm) : 0;

    const antidumping = round2(data.cargo_antidumping_usd || 0);
    const compensatorio = round2(data.cargo_compensatorio_usd || 0);
    const sda = round2(data.cargo_sda_usd || 0);

    const basePerc = round2(
      valorCIF + valorAV + valorISC + valorIGV + valorIPM + antidumping + compensatorio
    );
    const tasaPerc = data.tasa_percepcion_input || 0;
    const valorPerc = data.aplica_percepcion ? round2(basePerc * tasaPerc) : 0;

    const total = round2(
      valorAV + valorISC + valorIGV + valorIPM + antidumping + compensatorio + valorPerc + sda
    );

    const tributos: TributoLinea[] = [];
    if (valorAV > 0) tributos.push({ concepto: 'ad_valorem', base_imponible: valorCIF, tasa_aplicada: tasaAV, monto_calculado: valorAV });
    if (data.aplica_isc) tributos.push({ concepto: 'isc', base_imponible: baseISC, tasa_aplicada: data.tasa_isc_input || 0, monto_calculado: valorISC });
    if (valorIGV > 0) tributos.push({ concepto: 'igv', base_imponible: baseIGV, tasa_aplicada: tasas.igv, monto_calculado: valorIGV });
    if (valorIPM > 0) tributos.push({ concepto: 'ipm', base_imponible: baseIGV, tasa_aplicada: tasas.ipm, monto_calculado: valorIPM });
    if (antidumping > 0) tributos.push({ concepto: 'antidumping', base_imponible: 0, tasa_aplicada: 0, monto_calculado: antidumping });
    if (compensatorio > 0) tributos.push({ concepto: 'compensatorio', base_imponible: 0, tasa_aplicada: 0, monto_calculado: compensatorio });
    if (valorPerc > 0) tributos.push({ concepto: 'percepcion', base_imponible: basePerc, tasa_aplicada: tasaPerc, monto_calculado: valorPerc });
    if (sda > 0) tributos.push({ concepto: 'sda', base_imponible: 0, tasa_aplicada: 0, monto_calculado: sda });

    const libro: LineaAsiento[] = [];

    libro.push({
      cuenta: tipoMercaderia.cuenta_pcge,
      nombre_cuenta: tipoMercaderia.denominacion,
      debe: round2(valorCIF),
      haber: 0,
      glosa: `Compra internacional: ${data.descripcion_articulo}`
    });
    if (valorAV > 0) {
      libro.push({ cuenta: REGLAS_PCGE.ad_valorem.cuenta, nombre_cuenta: REGLAS_PCGE.ad_valorem.nombre, debe: valorAV, haber: 0, glosa: 'Derechos aduaneros (Ad Valorem)' });
    }
    if (data.aplica_isc && valorISC > 0) {
      libro.push({ cuenta: REGLAS_PCGE.isc.cuenta, nombre_cuenta: REGLAS_PCGE.isc.nombre, debe: valorISC, haber: 0, glosa: 'ISC de importacion' });
    }
    const igvIpm = round2(valorIGV + valorIPM);
    if (igvIpm > 0) {
      libro.push({ cuenta: REGLAS_PCGE.igv.cuenta, nombre_cuenta: REGLAS_PCGE.igv.nombre, debe: igvIpm, haber: 0, glosa: 'IGV e IPM de importacion' });
    }
    const vinculados = round2(antidumping + compensatorio + sda);
    if (vinculados > 0) {
      libro.push({ cuenta: REGLAS_PCGE.costos_vinculados.cuenta, nombre_cuenta: REGLAS_PCGE.costos_vinculados.nombre, debe: vinculados, haber: 0, glosa: 'Costos vinculados (Antidumping, Compensatorio, SDA)' });
    }
    if (valorPerc > 0) {
      libro.push({ cuenta: REGLAS_PCGE.percepcion.cuenta, nombre_cuenta: REGLAS_PCGE.percepcion.nombre, debe: valorPerc, haber: 0, glosa: 'Percepcion de IGV' });
    }
    const totalDebe = round2(libro.reduce((s, l) => s + l.debe, 0));
    libro.push({
      cuenta: REGLAS_PCGE.proveedores.cuenta,
      nombre_cuenta: REGLAS_PCGE.proveedores.nombre,
      debe: 0,
      haber: totalDebe,
      glosa: 'Total a pagar por compra internacional'
    });

    return {
      valor_cif_resultante: valorCIF,
      valor_advalorem_resultante: valorAV,
      valor_isc_resultante: valorISC,
      valor_igv_resultante: valorIGV,
      valor_ipm_resultante: valorIPM,
      valor_percepcion_resultante: valorPerc,
      total_carga_aduanera: total,
      tributos,
      libro_diario: libro
    };
  }

  private static calcularCompraLocal(
    data: CompraInputCalculo,
    tasas: { igv: number; ipm: number },
    tipoMercaderia: TipoMercaderiaInfo
  ): CompraCalculada {
    const monto = round2(data.importe_fob);
    const valorIGV = data.aplica_igv ? round2(monto * tasas.igv) : 0;
    const valorIPM = data.aplica_igv ? round2(monto * tasas.ipm) : 0;

    const tributos: TributoLinea[] = [];
    if (valorIGV > 0) tributos.push({ concepto: 'igv', base_imponible: monto, tasa_aplicada: tasas.igv, monto_calculado: valorIGV });
    if (valorIPM > 0) tributos.push({ concepto: 'ipm', base_imponible: monto, tasa_aplicada: tasas.ipm, monto_calculado: valorIPM });

    const libro: LineaAsiento[] = [];
    libro.push({
      cuenta: tipoMercaderia.cuenta_pcge,
      nombre_cuenta: tipoMercaderia.denominacion,
      debe: monto,
      haber: 0,
      glosa: `Compra nacional: ${data.descripcion_articulo}`
    });
    const igvIpm = round2(valorIGV + valorIPM);
    if (igvIpm > 0) {
      libro.push({ cuenta: REGLAS_PCGE.igv.cuenta, nombre_cuenta: REGLAS_PCGE.igv.nombre, debe: igvIpm, haber: 0, glosa: 'IGV e IPM de compra nacional' });
    }
    const totalDebe = round2(libro.reduce((s, l) => s + l.debe, 0));
    libro.push({
      cuenta: REGLAS_PCGE.proveedores.cuenta,
      nombre_cuenta: REGLAS_PCGE.proveedores.nombre,
      debe: 0,
      haber: totalDebe,
      glosa: 'Total a pagar por compra nacional'
    });

    return {
      valor_cif_resultante: monto,
      valor_advalorem_resultante: 0,
      valor_isc_resultante: 0,
      valor_igv_resultante: valorIGV,
      valor_ipm_resultante: valorIPM,
      valor_percepcion_resultante: 0,
      total_carga_aduanera: igvIpm,
      tributos,
      libro_diario: libro
    };
  }

  static calcularMontosVenta(importeVentaNeto: number, esVentaLocal: boolean) {
    if (esVentaLocal) {
      const base = round2(importeVentaNeto / 1.18);
      const igv = round2(importeVentaNeto - base);
      return { subtotal_neto: base, subtotal_igv: igv, total: importeVentaNeto };
    }
    return { subtotal_neto: importeVentaNeto, subtotal_igv: 0, total: importeVentaNeto };
  }

  static calcularMontosEgreso(importe: number, conIgv: boolean) {
    if (conIgv) {
      const base = round2(importe / 1.18);
      const igv = round2(importe - base);
      return { subtotal_neto: base, subtotal_igv: igv, total: importe };
    }
    return { subtotal_neto: importe, subtotal_igv: 0, total: importe };
  }
}
