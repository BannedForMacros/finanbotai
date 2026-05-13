import { ejecutarSql } from '../datos';
import { TipoCambioServicio } from './tipoCambio.servicio';
import { EgresoServicio } from './egreso.servicio';
import { CalculoTributarioServicio } from './calculoTributario.servicio';
import { bitacora } from '../utilitarios/bitacora';

export interface DesgloseGastos {
  remuneraciones: number;
  seguridad_social: number;
  transporte_viajes: number;
  asesoria_consultoria: number;
  produccion_terceros: number;
  mantenimiento_reparaciones: number;
  alquileres: number;
  servicios_basicos: number;
  publicidad: number;
  otros_servicios: number;
  seguros: number;
  otros_gastos: number;
}

export interface RatiosRentabilidad {
  margen_bruto: number;
  margen_operativo: number;
  margen_neto: number;
  ros: number;
  roa: number | null;
  roe: number | null;
}

interface CompraDetalle {
  id: string;
  flag_compra_local: boolean;
  codigo_arancelario: string;
  descripcion_articulo: string | null;
  tipo_mercaderia_id: number;
  tipo_mercaderia_cuenta_pcge: string;
  tipo_mercaderia_denominacion: string;
  importe_fob: number;
  importe_flete: number;
  importe_seguro: number;
  valor_cif_resultante: number;
  valor_advalorem_resultante: number;
  valor_isc_resultante: number;
  valor_igv_resultante: number;
  valor_ipm_resultante: number;
  valor_percepcion_resultante: number;
  total_carga_aduanera: number;
  cargo_antidumping_usd: number;
  cargo_compensatorio_usd: number;
  cargo_sda_usd: number;
  divisa: string;
  fecha_compra: string;
  fecha_cotizacion: string | null;
}

interface VentaDetalle {
  id: string;
  flag_venta_local: boolean;
  tipo_articulo_id: number;
  tipo_articulo_denominacion: string;
  tipo_articulo_cuenta_pcge: string;
  termino_comercio_internacional: string | null;
  descripcion_articulo: string | null;
  importe_venta_neto: number;
  subtotal_neto: number;
  subtotal_igv: number;
  divisa: string;
  fecha_venta: string;
  pais_origen_iso: string | null;
  pais_destino_iso: string | null;
  fecha_cotizacion: string | null;
}

interface EgresoDetalle {
  id: string;
  categoria_egreso_id: number;
  clasificacion_nombre: string;
  concepto: string;
  cuenta_pcge: string;
  importe_total: number;
  subtotal_neto: number;
  subtotal_igv: number;
  divisa: string;
  fecha_egreso: string;
  fecha_cotizacion: string | null;
}

interface EgresosPorClasificacion {
  operativos: EgresoDetalle[];
  administrativos: EgresoDetalle[];
  ventas: EgresoDetalle[];
  financieros: EgresoDetalle[];
}

export class EstadoResultadosServicio {
  private static validarNumero(v: any, def = 0): number {
    if (v === null || v === undefined) return def;
    const n = parseFloat(v.toString());
    return isNaN(n) ? def : n;
  }

  private static redondear(v: number, dec = 4): number {
    const f = Math.pow(10, dec);
    return Math.round((v + Number.EPSILON) * f) / f;
  }

  private static convertirAUSD(monto: number, divisa: string, tipoCambio: number): number {
    const v = this.validarNumero(monto, 0);
    if (!divisa) divisa = 'USD';
    if (divisa === 'USD') return v;
    if (divisa === 'PEN') return v / tipoCambio;
    return v;
  }

  private static porcentaje(valor: number, base: number): number {
    if (base === 0) return 0;
    return parseFloat(((valor / base) * 100).toFixed(2));
  }

  static async validarProyecto(proyectoId: string, perfilId: string): Promise<boolean> {
    const { rows } = await ejecutarSql(
      `SELECT id FROM intelfin.proyectos_analisis
        WHERE id = $1 AND perfil_id = $2 AND estado_proyecto <> 'archivado'`,
      [proyectoId, perfilId]
    );
    return rows.length > 0;
  }

  static async obtenerInfoProyecto(proyectoId: string) {
    const { rows } = await ejecutarSql<{
      nombre_proyecto: string;
      descripcion_proyecto: string | null;
      estado_proyecto: string;
      creado_en: string;
    }>(
      `SELECT nombre_proyecto, descripcion_proyecto, estado_proyecto, creado_en
         FROM intelfin.proyectos_analisis WHERE id = $1`,
      [proyectoId]
    );
    if (rows.length === 0) {
      const err: any = new Error('Proyecto no encontrado');
      err.status = 404;
      throw err;
    }
    return rows[0];
  }

  private static async obtenerCompras(proyectoId: string): Promise<CompraDetalle[]> {
    const sql = `
      SELECT ci.id, ci.flag_compra_local, ci.codigo_arancelario, ci.descripcion_articulo,
             ci.tipo_mercaderia_id,
             tm.cuenta_pcge AS tipo_mercaderia_cuenta_pcge,
             tm.denominacion AS tipo_mercaderia_denominacion,
             ci.importe_fob, ci.importe_flete, ci.importe_seguro,
             ci.valor_cif_resultante, ci.valor_advalorem_resultante,
             ci.valor_isc_resultante, ci.valor_igv_resultante, ci.valor_ipm_resultante,
             ci.valor_percepcion_resultante, ci.total_carga_aduanera,
             ci.cargo_antidumping_usd, ci.cargo_compensatorio_usd, ci.cargo_sda_usd,
             ci.divisa, ci.fecha_compra, ci.fecha_cotizacion
        FROM intelfin.compras_internacionales ci
        LEFT JOIN intelfin.tipos_mercaderia tm ON tm.id = ci.tipo_mercaderia_id
       WHERE ci.proyecto_id = $1 AND ci.activa = true
       ORDER BY ci.fecha_compra DESC, ci.registrada_en DESC
    `;
    const { rows } = await ejecutarSql<any>(sql, [proyectoId]);
    return rows.map((r: any) => ({
      id: r.id,
      flag_compra_local: r.flag_compra_local,
      codigo_arancelario: r.codigo_arancelario,
      descripcion_articulo: r.descripcion_articulo,
      tipo_mercaderia_id: r.tipo_mercaderia_id,
      tipo_mercaderia_cuenta_pcge: r.tipo_mercaderia_cuenta_pcge,
      tipo_mercaderia_denominacion: r.tipo_mercaderia_denominacion,
      importe_fob: this.validarNumero(r.importe_fob),
      importe_flete: this.validarNumero(r.importe_flete),
      importe_seguro: this.validarNumero(r.importe_seguro),
      valor_cif_resultante: this.validarNumero(r.valor_cif_resultante),
      valor_advalorem_resultante: this.validarNumero(r.valor_advalorem_resultante),
      valor_isc_resultante: this.validarNumero(r.valor_isc_resultante),
      valor_igv_resultante: this.validarNumero(r.valor_igv_resultante),
      valor_ipm_resultante: this.validarNumero(r.valor_ipm_resultante),
      valor_percepcion_resultante: this.validarNumero(r.valor_percepcion_resultante),
      total_carga_aduanera: this.validarNumero(r.total_carga_aduanera),
      cargo_antidumping_usd: this.validarNumero(r.cargo_antidumping_usd),
      cargo_compensatorio_usd: this.validarNumero(r.cargo_compensatorio_usd),
      cargo_sda_usd: this.validarNumero(r.cargo_sda_usd),
      divisa: r.divisa || 'USD',
      fecha_compra: r.fecha_compra,
      fecha_cotizacion: r.fecha_cotizacion
    }));
  }

  private static async obtenerVentas(proyectoId: string): Promise<VentaDetalle[]> {
    const sql = `
      SELECT vi.id, vi.flag_venta_local, vi.tipo_articulo_id,
             ta.denominacion AS tipo_articulo_denominacion,
             ta.cuenta_pcge AS tipo_articulo_cuenta_pcge,
             vi.termino_comercio_internacional, vi.descripcion_articulo,
             vi.importe_venta_neto, vi.subtotal_neto, vi.subtotal_igv,
             vi.divisa, vi.fecha_venta, vi.pais_origen_iso, vi.pais_destino_iso,
             vi.fecha_cotizacion
        FROM intelfin.ventas_internacionales vi
        LEFT JOIN intelfin.tipos_articulo_venta ta ON ta.id = vi.tipo_articulo_id
       WHERE vi.proyecto_id = $1 AND vi.activa = true
       ORDER BY vi.fecha_venta DESC, vi.registrada_en DESC
    `;
    const { rows } = await ejecutarSql<any>(sql, [proyectoId]);
    return rows.map((r: any) => ({
      id: r.id,
      flag_venta_local: r.flag_venta_local || false,
      tipo_articulo_id: r.tipo_articulo_id,
      tipo_articulo_denominacion: r.tipo_articulo_denominacion,
      tipo_articulo_cuenta_pcge: r.tipo_articulo_cuenta_pcge,
      termino_comercio_internacional: r.termino_comercio_internacional,
      descripcion_articulo: r.descripcion_articulo,
      importe_venta_neto: this.validarNumero(r.importe_venta_neto),
      subtotal_neto: this.validarNumero(r.subtotal_neto),
      subtotal_igv: this.validarNumero(r.subtotal_igv),
      divisa: r.divisa || 'USD',
      fecha_venta: r.fecha_venta,
      pais_origen_iso: r.pais_origen_iso,
      pais_destino_iso: r.pais_destino_iso,
      fecha_cotizacion: r.fecha_cotizacion
    }));
  }

  private static async obtenerEgresosPorClasificacion(proyectoId: string): Promise<EgresosPorClasificacion> {
    const sql = `
      SELECT e.id, e.categoria_egreso_id,
             c.tipo_egreso AS clasificacion_nombre,
             e.concepto_egreso AS concepto,
             c.cuenta_pcge AS cuenta_pcge,
             e.importe_total, e.subtotal_neto, e.subtotal_igv,
             e.divisa, e.fecha_egreso, e.fecha_cotizacion
        FROM intelfin.egresos_clasificados e
        JOIN intelfin.catalogo_egresos c ON c.id = e.categoria_egreso_id
       WHERE e.proyecto_id = $1 AND e.activo = true
       ORDER BY e.fecha_egreso DESC, e.registrado_en DESC
    `;
    const { rows } = await ejecutarSql<any>(sql, [proyectoId]);
    const mapped: EgresoDetalle[] = rows.map((r: any) => ({
      id: r.id,
      categoria_egreso_id: r.categoria_egreso_id,
      clasificacion_nombre: r.clasificacion_nombre || '',
      concepto: r.concepto || '',
      cuenta_pcge: r.cuenta_pcge || '',
      importe_total: this.validarNumero(r.importe_total),
      subtotal_neto: this.validarNumero(r.subtotal_neto),
      subtotal_igv: this.validarNumero(r.subtotal_igv),
      divisa: r.divisa || 'PEN',
      fecha_egreso: r.fecha_egreso,
      fecha_cotizacion: r.fecha_cotizacion
    }));

    const out: EgresosPorClasificacion = {
      operativos: [], administrativos: [], ventas: [], financieros: []
    };
    mapped.forEach((g) => {
      const tipo = g.clasificacion_nombre.toLowerCase();
      if (tipo === 'operativo') out.operativos.push(g);
      else if (tipo === 'administrativo') out.administrativos.push(g);
      else if (tipo === 'ventas' || tipo === 'venta') out.ventas.push(g);
      else if (tipo === 'financiero') out.financieros.push(g);
    });
    return out;
  }

  private static desglosarEgresos(egresos: EgresoDetalle[], tipoCambio: number): {
    totalRaw: number;
    desglose: DesgloseGastos;
  } {
    const acc: DesgloseGastos = {
      remuneraciones: 0, seguridad_social: 0, transporte_viajes: 0,
      asesoria_consultoria: 0, produccion_terceros: 0, mantenimiento_reparaciones: 0,
      alquileres: 0, servicios_basicos: 0, publicidad: 0, otros_servicios: 0,
      seguros: 0, otros_gastos: 0
    };
    const mapa: Record<string, keyof DesgloseGastos> = {
      '621': 'remuneraciones',
      '627': 'seguridad_social',
      '631': 'transporte_viajes',
      '632': 'asesoria_consultoria',
      '633': 'produccion_terceros',
      '634': 'mantenimiento_reparaciones',
      '635': 'alquileres',
      '636': 'servicios_basicos',
      '637': 'publicidad',
      '639': 'otros_servicios',
      '651': 'seguros',
      '659': 'otros_gastos'
    };

    egresos.forEach((g) => {
      const tc = g.fecha_cotizacion ? tipoCambio : tipoCambio;
      const usd = this.convertirAUSD(g.subtotal_neto, g.divisa, tc);
      const cuenta = (g.cuenta_pcge || '').trim();
      const prefijo = cuenta.substring(0, 3);
      if (prefijo === '627') return;
      const categoria = mapa[prefijo] || 'otros_gastos';
      acc[categoria] += usd;
      if (prefijo === '621') {
        acc.seguridad_social += usd * 0.09;
      }
    });

    const totalRaw = Object.values(acc).reduce((s, v) => s + v, 0);
    const desglose: DesgloseGastos = {
      remuneraciones: this.redondear(acc.remuneraciones),
      seguridad_social: this.redondear(acc.seguridad_social),
      transporte_viajes: this.redondear(acc.transporte_viajes),
      asesoria_consultoria: this.redondear(acc.asesoria_consultoria),
      produccion_terceros: this.redondear(acc.produccion_terceros),
      mantenimiento_reparaciones: this.redondear(acc.mantenimiento_reparaciones),
      alquileres: this.redondear(acc.alquileres),
      servicios_basicos: this.redondear(acc.servicios_basicos),
      publicidad: this.redondear(acc.publicidad),
      otros_servicios: this.redondear(acc.otros_servicios),
      seguros: this.redondear(acc.seguros),
      otros_gastos: this.redondear(acc.otros_gastos)
    };
    return { totalRaw, desglose };
  }

  private static desglosarFinancieros(egresos: EgresoDetalle[], tipoCambio: number) {
    let intereses = 0;
    let comisiones = 0;
    egresos.forEach((g) => {
      const usd = this.convertirAUSD(g.subtotal_neto, g.divisa, tipoCambio);
      const cuenta = (g.cuenta_pcge || '').trim();
      if (cuenta.startsWith('671.2')) comisiones += usd;
      else intereses += usd;
    });
    return {
      totalRaw: intereses + comisiones,
      desglose: {
        intereses_desgravamen: this.redondear(intereses),
        comisiones_bancarias: this.redondear(comisiones)
      }
    };
  }

  static async obtenerAnalisisRentabilidad(proyectoId: string, perfilId: string, incluirDetalles = true) {
    const valido = await this.validarProyecto(proyectoId, perfilId);
    if (!valido) {
      const err: any = new Error('Proyecto no encontrado o no autorizado');
      err.status = 404;
      throw err;
    }

    const info = await this.obtenerInfoProyecto(proyectoId);
    const tipoCambio = await TipoCambioServicio.getTipoCambio();

    const compras = await this.obtenerCompras(proyectoId);
    const ventas = await this.obtenerVentas(proyectoId);
    const egresos = await this.obtenerEgresosPorClasificacion(proyectoId);
    const parametros = await EgresoServicio.obtenerParametrosRentabilidad(perfilId, proyectoId);

    let mercaderiasNac = 0, mercaderiasInt = 0, productosNac = 0, productosInt = 0;
    ventas.forEach((v) => {
      const tc = tipoCambio;
      const usd = this.convertirAUSD(v.subtotal_neto, v.divisa, tc);
      if (v.flag_venta_local) {
        if (v.tipo_articulo_cuenta_pcge?.startsWith('701')) mercaderiasNac += usd;
        else if (v.tipo_articulo_cuenta_pcge?.startsWith('702')) productosNac += usd;
      } else {
        if (v.tipo_articulo_cuenta_pcge?.startsWith('701')) mercaderiasInt += usd;
        else if (v.tipo_articulo_cuenta_pcge?.startsWith('702')) productosInt += usd;
      }
    });
    const totalVentasSinIgv = mercaderiasNac + mercaderiasInt + productosNac + productosInt;

    let mercaderias = 0, mercaderiasImportadas = 0, mercaderiasNacCosto = 0;
    let materiasPrimas = 0, mpImp = 0, mpNac = 0;
    let materialesAux = 0, envases = 0, costosVinculados = 0;
    compras.forEach((c) => {
      const tc = tipoCambio;
      const cifUSD = this.convertirAUSD(c.valor_cif_resultante, c.divisa, tc);
      const local = c.flag_compra_local;
      switch (c.tipo_mercaderia_cuenta_pcge) {
        case '601':
          mercaderias += cifUSD;
          if (local) mercaderiasNacCosto += cifUSD;
          else mercaderiasImportadas += cifUSD;
          break;
        case '602':
          materiasPrimas += cifUSD;
          if (local) mpNac += cifUSD;
          else mpImp += cifUSD;
          break;
        case '603': materialesAux += cifUSD; break;
        case '604': envases += cifUSD; break;
      }
      if (!local) {
        const ad = this.convertirAUSD(c.cargo_antidumping_usd, c.divisa, tc);
        const cv = this.convertirAUSD(c.cargo_compensatorio_usd, c.divisa, tc);
        const sd = this.convertirAUSD(c.cargo_sda_usd, c.divisa, tc);
        costosVinculados += ad + cv + sd;
      }
    });
    const totalCostoVentas = mercaderias + materiasPrimas + materialesAux + envases + costosVinculados;
    const utilidadBruta = totalVentasSinIgv - totalCostoVentas;

    const op = this.desglosarEgresos(egresos.operativos, tipoCambio);
    const adm = this.desglosarEgresos(egresos.administrativos, tipoCambio);
    const ven = this.desglosarEgresos(egresos.ventas, tipoCambio);
    const fin = this.desglosarFinancieros(egresos.financieros, tipoCambio);

    const utilidadOperativa = utilidadBruta - op.totalRaw;
    const utilidadNeta = utilidadOperativa - adm.totalRaw - ven.totalRaw - fin.totalRaw;

    let roa: number | null = null;
    let roe: number | null = null;
    if (parametros) {
      const activos = parseFloat(String(parametros.total_activos_caso)) || 0;
      const patrimonio = parseFloat(String(parametros.patrimonio_neto_caso)) || 0;
      if (activos > 0) roa = this.porcentaje(utilidadNeta, activos);
      if (patrimonio > 0) roe = this.porcentaje(utilidadNeta, patrimonio);
    }

    const ratios: RatiosRentabilidad = {
      margen_bruto: this.porcentaje(utilidadBruta, totalVentasSinIgv),
      margen_operativo: this.porcentaje(utilidadOperativa, totalVentasSinIgv),
      margen_neto: this.porcentaje(utilidadNeta, totalVentasSinIgv),
      ros: this.porcentaje(utilidadNeta, totalVentasSinIgv),
      roa,
      roe
    };

    let totalUSD = 0, totalPEN = 0;
    ventas.forEach((v) => {
      const monto = this.validarNumero(v.subtotal_neto);
      if (v.divisa === 'USD') totalUSD += monto;
      else totalPEN += monto;
    });
    compras.forEach((c) => {
      const monto = this.validarNumero(c.valor_cif_resultante);
      if (c.divisa === 'USD') totalUSD += monto;
      else totalPEN += monto;
    });
    [...egresos.operativos, ...egresos.administrativos, ...egresos.ventas, ...egresos.financieros].forEach((g) => {
      const monto = this.validarNumero(g.subtotal_neto);
      if (g.divisa === 'USD') totalUSD += monto;
      else totalPEN += monto;
    });
    const resumenMonedas = {
      total_usd: this.redondear(totalUSD),
      total_pen: this.redondear(totalPEN),
      tipo_cambio_usado: parseFloat(tipoCambio.toFixed(4))
    };

    return {
      proyecto_id: proyectoId,
      nombre_proyecto: info.nombre_proyecto,
      utilidad_bruta: {
        ventas_totales_sin_igv: this.redondear(totalVentasSinIgv),
        costo_ventas: this.redondear(totalCostoVentas),
        utilidad_bruta: this.redondear(utilidadBruta),
        margen_bruto_porcentaje: ratios.margen_bruto
      },
      utilidad_operativa: {
        utilidad_bruta: this.redondear(utilidadBruta),
        gastos_operativos: this.redondear(op.totalRaw),
        utilidad_operativa: this.redondear(utilidadOperativa),
        margen_operativo_porcentaje: ratios.margen_operativo
      },
      utilidad_neta: {
        utilidad_operativa: this.redondear(utilidadOperativa),
        gastos_administrativos: this.redondear(adm.totalRaw),
        gastos_ventas: this.redondear(ven.totalRaw),
        gastos_financieros: this.redondear(fin.totalRaw),
        total_otros_gastos: this.redondear(adm.totalRaw + ven.totalRaw + fin.totalRaw),
        utilidad_neta: this.redondear(utilidadNeta),
        margen_neto_porcentaje: ratios.margen_neto
      },
      estado_resultados: {
        ventas: {
          mercaderias_nacionales: this.redondear(mercaderiasNac),
          mercaderias_internacionales: this.redondear(mercaderiasInt),
          productos_terminados_nacionales: this.redondear(productosNac),
          productos_terminados_internacionales: this.redondear(productosInt),
          total_ventas_sin_igv: this.redondear(totalVentasSinIgv)
        },
        costo_ventas: {
          mercaderias: this.redondear(mercaderias),
          mercaderias_importadas: this.redondear(mercaderiasImportadas),
          mercaderias_nacionales: this.redondear(mercaderiasNacCosto),
          materias_primas: this.redondear(materiasPrimas),
          materias_primas_importadas: this.redondear(mpImp),
          materias_primas_nacionales: this.redondear(mpNac),
          materiales_auxiliares: this.redondear(materialesAux),
          envases_embalajes: this.redondear(envases),
          costos_vinculados: this.redondear(costosVinculados),
          total_costo_ventas: this.redondear(totalCostoVentas)
        },
        utilidad_bruta: this.redondear(utilidadBruta),
        gastos_operativos: { ...op.desglose, total_gastos_operativos: this.redondear(op.totalRaw) },
        utilidad_operativa: this.redondear(utilidadOperativa),
        gastos_administrativos: { ...adm.desglose, total_gastos_administrativos: this.redondear(adm.totalRaw) },
        gastos_ventas: { ...ven.desglose, total_gastos_ventas: this.redondear(ven.totalRaw) },
        gastos_financieros: { ...fin.desglose, total_gastos_financieros: this.redondear(fin.totalRaw) },
        utilidad_neta: this.redondear(utilidadNeta)
      },
      ratios_financieros: ratios,
      resumen_monedas: resumenMonedas,
      detalles: incluirDetalles
        ? { compras, ventas, egresos }
        : { compras: [], ventas: [], egresos: { operativos: [], administrativos: [], ventas: [], financieros: [] } }
    };
  }

  static async generarAsientoConsolidado(
    proyectoId: string,
    perfilId: string,
    monedaBase: 'USD' | 'PEN' = 'USD'
  ) {
    const valido = await this.validarProyecto(proyectoId, perfilId);
    if (!valido) {
      const err: any = new Error('Proyecto no encontrado');
      err.status = 404;
      throw err;
    }
    const info = await this.obtenerInfoProyecto(proyectoId);
    const tipoCambio = await TipoCambioServicio.getTipoCambio();
    const reglas = CalculoTributarioServicio.reglasPcge();

    const cuentasMap = new Map<string, { nombre_cuenta: string; debe: number; haber: number; glosa: string }>();

    const { rows: comprasJsonb } = await ejecutarSql<any>(
      `SELECT id, libro_diario_jsonb, descripcion_articulo, divisa
         FROM intelfin.compras_internacionales
        WHERE proyecto_id = $1 AND activa = true
        ORDER BY fecha_compra`,
      [proyectoId]
    );

    comprasJsonb.forEach((c: any) => {
      if (!c.libro_diario_jsonb) return;
      const lineas = typeof c.libro_diario_jsonb === 'string'
        ? JSON.parse(c.libro_diario_jsonb) : c.libro_diario_jsonb;
      if (!Array.isArray(lineas)) return;
      lineas.forEach((linea: any) => {
        const cuenta = linea.cuenta || linea.codigo_cuenta;
        if (!cuenta) return;
        let debe = this.validarNumero(linea.debe);
        let haber = this.validarNumero(linea.haber);
        if (c.divisa === 'USD' && monedaBase === 'PEN') {
          debe = debe * tipoCambio;
          haber = haber * tipoCambio;
        } else if (c.divisa === 'PEN' && monedaBase === 'USD') {
          debe = debe / tipoCambio;
          haber = haber / tipoCambio;
        }
        if (!cuentasMap.has(cuenta)) {
          cuentasMap.set(cuenta, {
            nombre_cuenta: linea.nombre_cuenta || linea.denominacion || '',
            debe: 0,
            haber: 0,
            glosa: linea.glosa || `Compra: ${c.descripcion_articulo}`
          });
        }
        const e = cuentasMap.get(cuenta)!;
        e.debe += debe;
        e.haber += haber;
      });
    });

    const { rows: ventas } = await ejecutarSql<any>(
      `SELECT vi.id, vi.flag_venta_local, vi.descripcion_articulo,
              vi.subtotal_neto, vi.subtotal_igv, vi.divisa,
              ta.cuenta_pcge AS tipo_articulo_cuenta_pcge
         FROM intelfin.ventas_internacionales vi
         LEFT JOIN intelfin.tipos_articulo_venta ta ON ta.id = vi.tipo_articulo_id
        WHERE vi.proyecto_id = $1 AND vi.activa = true`,
      [proyectoId]
    );
    ventas.forEach((v: any) => {
      const subNeto = this.validarNumero(v.subtotal_neto);
      const subIgv = this.validarNumero(v.subtotal_igv);
      const total = subNeto + subIgv;
      const a = (m: number) => monedaBase === 'USD'
        ? (v.divisa === 'USD' ? m : m / tipoCambio)
        : (v.divisa === 'PEN' ? m : m * tipoCambio);

      const cuentaClientes = reglas.clientes_internacional.cuenta;
      if (!cuentasMap.has(cuentaClientes)) {
        cuentasMap.set(cuentaClientes, {
          nombre_cuenta: 'Cuentas por cobrar',
          debe: 0, haber: 0,
          glosa: v.flag_venta_local ? 'Ventas nacionales' : 'Exportaciones'
        });
      }
      cuentasMap.get(cuentaClientes)!.debe += a(total);

      const cuentaVenta = v.tipo_articulo_cuenta_pcge || '7011';
      if (!cuentasMap.has(cuentaVenta)) {
        cuentasMap.set(cuentaVenta, { nombre_cuenta: 'Ventas', debe: 0, haber: 0, glosa: 'Venta' });
      }
      cuentasMap.get(cuentaVenta)!.haber += a(subNeto);

      if (subIgv > 0) {
        const c = reglas.igv_ventas.cuenta;
        if (!cuentasMap.has(c)) {
          cuentasMap.set(c, { nombre_cuenta: reglas.igv_ventas.nombre, debe: 0, haber: 0, glosa: 'IGV de ventas' });
        }
        cuentasMap.get(c)!.haber += a(subIgv);
      }
    });

    try {
      const asientoEgresos = await EgresoServicio.generarAsientoConsolidado(perfilId, proyectoId);
      const { rows: divisasRows } = await ejecutarSql<{ divisa: string; cantidad: string }>(
        `SELECT divisa, COUNT(*) AS cantidad
           FROM intelfin.egresos_clasificados
          WHERE proyecto_id = $1 AND activo = true
          GROUP BY divisa
          ORDER BY cantidad DESC
          LIMIT 1`,
        [proyectoId]
      );
      const divisaEgresos = divisasRows.length > 0 ? divisasRows[0].divisa : 'PEN';

      asientoEgresos.detalles.forEach((linea) => {
        if (!linea.cuenta) return;
        let debe = linea.debe;
        let haber = linea.haber;
        if (divisaEgresos === 'PEN' && monedaBase === 'USD') {
          debe = debe / tipoCambio;
          haber = haber / tipoCambio;
        } else if (divisaEgresos === 'USD' && monedaBase === 'PEN') {
          debe = debe * tipoCambio;
          haber = haber * tipoCambio;
        }
        if (!cuentasMap.has(linea.cuenta)) {
          cuentasMap.set(linea.cuenta, {
            nombre_cuenta: linea.nombre_cuenta,
            debe: 0, haber: 0,
            glosa: linea.glosa
          });
        }
        const e = cuentasMap.get(linea.cuenta)!;
        e.debe += debe;
        e.haber += haber;
      });
    } catch (e) {
      bitacora.warn('No se pudo consolidar egresos', e);
    }

    const detalles = Array.from(cuentasMap.entries())
      .map(([cuenta, data]) => ({
        cuenta,
        nombre_cuenta: data.nombre_cuenta,
        debe: data.debe,
        haber: data.haber,
        glosa: data.glosa
      }))
      .filter((d) => d.debe > 0.001 || d.haber > 0.001)
      .sort((a, b) => a.cuenta.localeCompare(b.cuenta));

    const totalDebe = detalles.reduce((s, d) => s + d.debe, 0);
    const totalHaber = detalles.reduce((s, d) => s + d.haber, 0);
    const diferencia = totalDebe - totalHaber;

    const detallesRedondeados = detalles.map((d) => ({
      ...d,
      debe: parseFloat(d.debe.toFixed(2)),
      haber: parseFloat(d.haber.toFixed(2))
    }));

    return {
      fecha: new Date().toISOString().split('T')[0],
      glosa: `Asiento consolidado del proyecto: ${info.nombre_proyecto}`,
      detalles: detallesRedondeados,
      totalDebe: parseFloat(totalDebe.toFixed(2)),
      totalHaber: parseFloat(totalHaber.toFixed(2)),
      moneda: monedaBase,
      tipo_cambio: parseFloat(tipoCambio.toFixed(4)),
      diferencia: parseFloat(diferencia.toFixed(2))
    };
  }
}
