import { ejecutarSql } from '../datos';
import { CalculoTributarioServicio, LineaAsiento } from './calculoTributario.servicio';
import { TipoCambioServicio } from './tipoCambio.servicio';
import { bitacora } from '../utilitarios/bitacora';

export interface EgresoFila {
  id: string;
  perfil_id: string;
  proyecto_id: string;
  categoria_egreso_id: number;
  concepto_egreso: string;
  importe_total: string;
  subtotal_neto: string;
  subtotal_igv: string;
  divisa: string;
  fecha_egreso: string;
  flag_planilla: boolean;
  regimen_previsional: string | null;
  con_igv: boolean;
  fecha_cotizacion: string | null;
  activo: boolean;
  registrado_en: string;
  denominacion?: string;
  cuenta_pcge?: string;
  tipo_egreso?: string;
  computa_igv?: boolean;
  igv_opcional?: boolean;
}

export interface CrearEgresoInput {
  proyecto_id: string;
  categoria_egreso_id: number;
  concepto_egreso: string;
  importe_total: number;
  divisa: 'USD' | 'PEN';
  fecha_egreso?: string;
  flag_planilla?: boolean;
  regimen_previsional?: 'ONP' | 'AFP' | null;
  con_igv?: boolean | null;
}

export interface AsientoCompleto {
  fecha: string;
  glosa: string;
  detalles: LineaAsiento[];
  total_debe: number;
  total_haber: number;
}

export interface CalculoTributarioEgresos {
  total_planilla: number;
  essalud: number;
  onp: number;
  afp: number;
  planilla_neta_pagar: number;
  total_egresos_con_igv: number;
  igv_acumulado: number;
  facturas_por_pagar: number;
  total_egresos_financieros: number;
}

export interface ResumenPorTipo {
  tipo: string;
  egresos: Array<{ cuenta: string; concepto: string; importe: number }>;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export class EgresoServicio {
  static async listarCatalogoEgresos() {
    const { rows } = await ejecutarSql<{
      id: number;
      denominacion: string;
      cuenta_pcge: string;
      tipo_egreso: string;
      computa_igv: boolean;
      igv_opcional: boolean;
    }>(
      `SELECT id, denominacion, cuenta_pcge, tipo_egreso, computa_igv, igv_opcional
         FROM intelfin.catalogo_egresos
        ORDER BY tipo_egreso, cuenta_pcge`
    );
    return rows;
  }

  static async crear(perfilId: string, datos: CrearEgresoInput): Promise<EgresoFila> {
    const { rows: clas } = await ejecutarSql<{ computa_igv: boolean; igv_opcional: boolean }>(
      `SELECT computa_igv, igv_opcional FROM intelfin.catalogo_egresos WHERE id = $1`,
      [datos.categoria_egreso_id]
    );
    if (clas.length === 0) {
      const err: any = new Error('Categoria de egreso no encontrada');
      err.status = 404;
      throw err;
    }

    let conIgvFinal: boolean = false;
    if (!clas[0].computa_igv) conIgvFinal = false;
    else if (clas[0].computa_igv && !clas[0].igv_opcional) conIgvFinal = true;
    else conIgvFinal = datos.con_igv ?? false;

    const montos = CalculoTributarioServicio.calcularMontosEgreso(datos.importe_total, conIgvFinal);
    let total = montos.total;
    if (datos.flag_planilla) {
      total = round2(montos.subtotal_neto * 1.09);
    }

    const fechaG = datos.fecha_egreso || new Date().toISOString().split('T')[0];
    let fechaCotizacion: string | null = null;
    try {
      const info = await TipoCambioServicio.getTipoCambioInfo(fechaG);
      fechaCotizacion = info.date;
    } catch (e) {
      bitacora.warn(`No se pudo obtener cotizacion para ${fechaG}`, e);
    }

    const { rows } = await ejecutarSql<EgresoFila>(
      `INSERT INTO intelfin.egresos_clasificados (
        perfil_id, proyecto_id, categoria_egreso_id, concepto_egreso,
        importe_total, subtotal_neto, subtotal_igv, divisa, fecha_egreso,
        flag_planilla, regimen_previsional, con_igv, fecha_cotizacion, activo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
      RETURNING *`,
      [
        perfilId, datos.proyecto_id, datos.categoria_egreso_id, datos.concepto_egreso,
        total, montos.subtotal_neto, montos.subtotal_igv, datos.divisa, fechaG,
        datos.flag_planilla || false, datos.regimen_previsional || null, conIgvFinal, fechaCotizacion
      ]
    );
    return rows[0];
  }

  static async actualizar(
    id: string,
    perfilId: string,
    datos: Partial<CrearEgresoInput>
  ): Promise<EgresoFila | null> {
    const sqlSelect = `
      SELECT e.*, c.computa_igv, c.igv_opcional
        FROM intelfin.egresos_clasificados e
        JOIN intelfin.catalogo_egresos c ON c.id = e.categoria_egreso_id
       WHERE e.id = $1 AND e.perfil_id = $2 AND e.activo = true
    `;
    const { rows: currentRows } = await ejecutarSql<EgresoFila>(sqlSelect, [id, perfilId]);
    if (currentRows.length === 0) return null;

    const actual = currentRows[0];
    const fusion: any = { ...actual, ...datos };

    let regimenFinal = fusion.regimen_previsional;
    if (datos.flag_planilla === false) regimenFinal = null;

    let conIgvFinal: boolean = actual.con_igv;
    if (!actual.computa_igv) conIgvFinal = false;
    else if (actual.computa_igv && !actual.igv_opcional) conIgvFinal = true;
    else conIgvFinal = datos.con_igv ?? actual.con_igv;

    let importeTotal = parseFloat(actual.importe_total);
    let subNeto = parseFloat(actual.subtotal_neto);
    let subIgv = parseFloat(actual.subtotal_igv);

    if (datos.importe_total !== undefined) {
      const montos = CalculoTributarioServicio.calcularMontosEgreso(datos.importe_total, conIgvFinal);
      subNeto = montos.subtotal_neto;
      subIgv = montos.subtotal_igv;
      importeTotal = fusion.flag_planilla ? round2(subNeto * 1.09) : montos.total;
    }

    const { rows } = await ejecutarSql<EgresoFila>(
      `UPDATE intelfin.egresos_clasificados
          SET categoria_egreso_id = $1,
              concepto_egreso = $2,
              importe_total = $3,
              subtotal_neto = $4,
              subtotal_igv = $5,
              divisa = $6,
              fecha_egreso = $7,
              flag_planilla = $8,
              regimen_previsional = $9,
              con_igv = $10
        WHERE id = $11 AND perfil_id = $12 AND activo = true
        RETURNING *`,
      [
        fusion.categoria_egreso_id, fusion.concepto_egreso, importeTotal, subNeto, subIgv,
        fusion.divisa, fusion.fecha_egreso, fusion.flag_planilla, regimenFinal, conIgvFinal,
        id, perfilId
      ]
    );
    return rows[0] || null;
  }

  static async listarPorProyecto(perfilId: string, proyectoId: string): Promise<EgresoFila[]> {
    const sql = `
      SELECT e.*, c.denominacion, c.cuenta_pcge, c.tipo_egreso,
             c.computa_igv, c.igv_opcional
        FROM intelfin.egresos_clasificados e
        JOIN intelfin.catalogo_egresos c ON c.id = e.categoria_egreso_id
        JOIN intelfin.proyectos_analisis pa ON pa.id = e.proyecto_id
       WHERE e.perfil_id = $1 AND e.proyecto_id = $2 AND e.activo = true
         AND pa.estado_proyecto <> 'archivado'
       ORDER BY c.tipo_egreso, e.fecha_egreso DESC, e.registrado_en DESC
    `;
    const { rows } = await ejecutarSql<EgresoFila>(sql, [perfilId, proyectoId]);
    return rows;
  }

  static async obtener(id: string, perfilId: string): Promise<EgresoFila | null> {
    const sql = `
      SELECT e.*, c.denominacion, c.cuenta_pcge, c.tipo_egreso,
             c.computa_igv, c.igv_opcional
        FROM intelfin.egresos_clasificados e
        JOIN intelfin.catalogo_egresos c ON c.id = e.categoria_egreso_id
       WHERE e.id = $1 AND e.perfil_id = $2 AND e.activo = true
    `;
    const { rows } = await ejecutarSql<EgresoFila>(sql, [id, perfilId]);
    return rows[0] || null;
  }

  static async eliminar(id: string, perfilId: string): Promise<boolean> {
    const { rows } = await ejecutarSql<{ id: string }>(
      `UPDATE intelfin.egresos_clasificados
          SET activo = false
        WHERE id = $1 AND perfil_id = $2 AND activo = true
        RETURNING id`,
      [id, perfilId]
    );
    return rows.length > 0;
  }

  static async calcularTributos(perfilId: string, proyectoId: string): Promise<CalculoTributarioEgresos> {
    const egresos = await this.listarPorProyecto(perfilId, proyectoId);

    const planillas = egresos.filter((g) => g.cuenta_pcge?.startsWith('621'));
    const conIgv = egresos.filter((g) =>
      parseFloat(g.subtotal_igv) > 0 &&
      !g.cuenta_pcge?.startsWith('621') &&
      !g.cuenta_pcge?.startsWith('627') &&
      !g.cuenta_pcge?.startsWith('67')
    );
    const financieros = egresos.filter((g) => g.cuenta_pcge?.startsWith('67'));

    const totalPlanilla = planillas.reduce((s, g) => s + parseFloat(g.subtotal_neto), 0);
    const essalud = totalPlanilla * 0.09;

    const planillaOnp = planillas
      .filter((g) => g.regimen_previsional === 'ONP')
      .reduce((s, g) => s + parseFloat(g.subtotal_neto), 0);
    const planillaAfp = planillas
      .filter((g) => g.regimen_previsional === 'AFP')
      .reduce((s, g) => s + parseFloat(g.subtotal_neto), 0);

    const onp = planillaOnp * 0.13;
    const afp = planillaAfp * 0.1137;
    const planillaNetaPagar = totalPlanilla - onp - afp;

    const totalConIgv = conIgv.reduce((s, g) => s + parseFloat(g.subtotal_neto), 0);
    const igvAcumulado = conIgv.reduce((s, g) => s + parseFloat(g.subtotal_igv), 0);
    const facturasPorPagar = totalConIgv + igvAcumulado;

    const totalFinancieros = financieros.reduce((s, g) => s + parseFloat(g.importe_total), 0);

    return {
      total_planilla: totalPlanilla,
      essalud,
      onp,
      afp,
      planilla_neta_pagar: planillaNetaPagar,
      total_egresos_con_igv: totalConIgv,
      igv_acumulado: igvAcumulado,
      facturas_por_pagar: facturasPorPagar,
      total_egresos_financieros: totalFinancieros
    };
  }

  static async generarAsientoConsolidado(
    perfilId: string,
    proyectoId: string,
    tipoEgresoFiltro?: string
  ): Promise<AsientoCompleto> {
    const reglas = CalculoTributarioServicio.reglasPcge();
    const todos = await this.listarPorProyecto(perfilId, proyectoId);
    const egresos = tipoEgresoFiltro
      ? todos.filter((g) => g.tipo_egreso === tipoEgresoFiltro)
      : todos;

    const debePart: LineaAsiento[] = [];
    const haberPart: LineaAsiento[] = [];

    const monedasUnicas = new Set(egresos.map((g) => g.divisa));

    const gastosPorCuentaDivisa = new Map<string, { denominacion: string; total: number; divisa: string }>();

    egresos.forEach((g) => {
      if (!g.cuenta_pcge) return;
      const key = `${g.cuenta_pcge}-${g.divisa}`;
      if (!gastosPorCuentaDivisa.has(key)) {
        gastosPorCuentaDivisa.set(key, {
          denominacion: g.denominacion || g.concepto_egreso,
          total: 0,
          divisa: g.divisa
        });
      }
      gastosPorCuentaDivisa.get(key)!.total += parseFloat(g.subtotal_neto);
    });

    gastosPorCuentaDivisa.forEach((valor, key) => {
      if (valor.total === 0) return;
      const cuenta = key.split('-')[0];
      debePart.push({
        cuenta,
        nombre_cuenta: valor.denominacion,
        debe: valor.total,
        haber: 0,
        glosa: `Egreso (${valor.divisa})`
      });

      if (cuenta.startsWith('621')) {
        const essalud = valor.total * 0.09;
        if (essalud === 0) return;
        const cuentaEssalud = cuenta.replace('621', '627');
        debePart.push({
          cuenta: cuentaEssalud,
          nombre_cuenta: 'ESSALUD (aportes empleador)',
          debe: essalud,
          haber: 0,
          glosa: `ESSALUD 9% (${valor.divisa})`
        });
      }
    });

    const tributosPorDivisa = new Map<string, {
      igv: number; essalud: number; onp: number; afp: number;
      planilla_neta: number; facturas_por_pagar: number;
      egresos_financieros: number; egresos_sin_igv: number;
    }>();
    monedasUnicas.forEach((divisa) => {
      tributosPorDivisa.set(divisa, {
        igv: 0, essalud: 0, onp: 0, afp: 0, planilla_neta: 0,
        facturas_por_pagar: 0, egresos_financieros: 0, egresos_sin_igv: 0
      });
    });

    egresos.forEach((g) => {
      const divisa = g.divisa;
      const t = tributosPorDivisa.get(divisa)!;
      const subNeto = parseFloat(g.subtotal_neto);
      const subIgv = parseFloat(g.subtotal_igv);
      const esPlanilla = g.cuenta_pcge?.startsWith('621');
      const esEssalud = g.cuenta_pcge?.startsWith('627');
      const esFinanciero = g.cuenta_pcge?.startsWith('67');

      if (subIgv > 0 && !esPlanilla && !esEssalud && !esFinanciero) {
        t.igv += subIgv;
        t.facturas_por_pagar += subNeto + subIgv;
      }
      if (esPlanilla) {
        const ess = subNeto * 0.09;
        t.essalud += ess;
        let descuento = 0;
        if (g.regimen_previsional === 'ONP') {
          descuento = subNeto * 0.13;
          t.onp += descuento;
        } else if (g.regimen_previsional === 'AFP') {
          descuento = subNeto * 0.1137;
          t.afp += descuento;
        }
        t.planilla_neta += subNeto - descuento;
      }
      if (esFinanciero) {
        t.egresos_financieros += subNeto;
      }
      if (subIgv === 0 && !esPlanilla && !esEssalud && !esFinanciero) {
        t.egresos_sin_igv += subNeto;
      }
    });

    tributosPorDivisa.forEach((t, divisa) => {
      if (t.igv > 0) {
        debePart.push({ cuenta: reglas.igv.cuenta, nombre_cuenta: reglas.igv.nombre, debe: t.igv, haber: 0, glosa: `IGV de egresos (${divisa})` });
      }
    });

    tributosPorDivisa.forEach((t, divisa) => {
      if (t.essalud > 0) haberPart.push({ cuenta: reglas.essalud_pagar.cuenta, nombre_cuenta: reglas.essalud_pagar.nombre, debe: 0, haber: t.essalud, glosa: `ESSALUD por pagar (${divisa})` });
      if (t.onp > 0) haberPart.push({ cuenta: reglas.onp_pagar.cuenta, nombre_cuenta: reglas.onp_pagar.nombre, debe: 0, haber: t.onp, glosa: `ONP por pagar (${divisa})` });
      if (t.afp > 0) haberPart.push({ cuenta: reglas.afp_pagar.cuenta, nombre_cuenta: reglas.afp_pagar.nombre, debe: 0, haber: t.afp, glosa: `AFP por pagar (${divisa})` });
      if (t.planilla_neta > 0) haberPart.push({ cuenta: reglas.remuneraciones_pagar.cuenta, nombre_cuenta: reglas.remuneraciones_pagar.nombre, debe: 0, haber: t.planilla_neta, glosa: `Planilla neta (${divisa})` });
      if (t.facturas_por_pagar > 0) haberPart.push({ cuenta: reglas.facturas_pagar.cuenta, nombre_cuenta: reglas.facturas_pagar.nombre, debe: 0, haber: t.facturas_por_pagar, glosa: `Facturas por pagar (${divisa})` });
      if (t.egresos_sin_igv > 0) haberPart.push({ cuenta: reglas.otras_cuentas_pagar.cuenta, nombre_cuenta: reglas.otras_cuentas_pagar.nombre, debe: 0, haber: t.egresos_sin_igv, glosa: `Otras cuentas por pagar (${divisa})` });
      if (t.egresos_financieros > 0) haberPart.push({ cuenta: reglas.caja_bancos.cuenta, nombre_cuenta: reglas.caja_bancos.nombre, debe: 0, haber: t.egresos_financieros, glosa: `Egresos financieros pagados (${divisa})` });
    });

    const detalles = [...debePart, ...haberPart];
    const totalDebe = round2(detalles.reduce((s, d) => s + d.debe, 0));
    const totalHaber = round2(detalles.reduce((s, d) => s + d.haber, 0));

    return {
      fecha: new Date().toISOString().split('T')[0],
      glosa: `Asiento por egresos ${tipoEgresoFiltro ? tipoEgresoFiltro.toLowerCase() : 'consolidado'} del proyecto`,
      detalles,
      total_debe: totalDebe,
      total_haber: totalHaber
    };
  }

  static async generarAsientoPorEgreso(perfilId: string, egresoId: string): Promise<AsientoCompleto> {
    const egreso = await this.obtener(egresoId, perfilId);
    if (!egreso) {
      const err: any = new Error('Egreso no encontrado');
      err.status = 404;
      throw err;
    }
    const reglas = CalculoTributarioServicio.reglasPcge();
    const detalles: LineaAsiento[] = [];

    const subNeto = parseFloat(egreso.subtotal_neto);
    const subIgv = parseFloat(egreso.subtotal_igv);
    const divisa = egreso.divisa;
    const esPlanilla = egreso.cuenta_pcge?.startsWith('621');
    const esFinanciero = egreso.cuenta_pcge?.startsWith('67');

    detalles.push({
      cuenta: egreso.cuenta_pcge || '',
      nombre_cuenta: egreso.denominacion || egreso.concepto_egreso,
      debe: subNeto,
      haber: 0,
      glosa: `Egreso (${divisa})`
    });

    if (esPlanilla) {
      const ess = subNeto * 0.09;
      const cuentaEssalud = (egreso.cuenta_pcge || '').replace('621', '627');
      detalles.push({ cuenta: cuentaEssalud, nombre_cuenta: 'ESSALUD (aporte empleador)', debe: ess, haber: 0, glosa: `ESSALUD 9% (${divisa})` });
      detalles.push({ cuenta: reglas.essalud_pagar.cuenta, nombre_cuenta: reglas.essalud_pagar.nombre, debe: 0, haber: ess, glosa: `ESSALUD por pagar (${divisa})` });

      let descuento = 0;
      if (egreso.regimen_previsional === 'ONP') {
        descuento = subNeto * 0.13;
        detalles.push({ cuenta: reglas.onp_pagar.cuenta, nombre_cuenta: reglas.onp_pagar.nombre, debe: 0, haber: descuento, glosa: `ONP por pagar (${divisa})` });
      } else if (egreso.regimen_previsional === 'AFP') {
        descuento = subNeto * 0.1137;
        detalles.push({ cuenta: reglas.afp_pagar.cuenta, nombre_cuenta: reglas.afp_pagar.nombre, debe: 0, haber: descuento, glosa: `AFP por pagar (${divisa})` });
      }
      detalles.push({ cuenta: reglas.remuneraciones_pagar.cuenta, nombre_cuenta: reglas.remuneraciones_pagar.nombre, debe: 0, haber: subNeto - descuento, glosa: `Planilla neta (${divisa})` });
    } else if (esFinanciero) {
      detalles.push({ cuenta: reglas.caja_bancos.cuenta, nombre_cuenta: reglas.caja_bancos.nombre, debe: 0, haber: subNeto, glosa: `Egreso financiero pagado (${divisa})` });
    } else if (subIgv > 0) {
      detalles.push({ cuenta: reglas.igv.cuenta, nombre_cuenta: reglas.igv.nombre, debe: subIgv, haber: 0, glosa: `IGV del egreso (${divisa})` });
      detalles.push({ cuenta: reglas.facturas_pagar.cuenta, nombre_cuenta: reglas.facturas_pagar.nombre, debe: 0, haber: subNeto + subIgv, glosa: `Factura por pagar (${divisa})` });
    } else {
      detalles.push({ cuenta: reglas.otras_cuentas_pagar.cuenta, nombre_cuenta: reglas.otras_cuentas_pagar.nombre, debe: 0, haber: subNeto, glosa: `Otra cuenta por pagar (${divisa})` });
    }

    const totalDebe = round2(detalles.reduce((s, d) => s + d.debe, 0));
    const totalHaber = round2(detalles.reduce((s, d) => s + d.haber, 0));

    return {
      fecha: egreso.fecha_egreso,
      glosa: `Asiento del egreso: ${egreso.concepto_egreso}`,
      detalles,
      total_debe: totalDebe,
      total_haber: totalHaber
    };
  }

  static async resumenPorTipo(perfilId: string, proyectoId: string): Promise<ResumenPorTipo[]> {
    const egresos = await this.listarPorProyecto(perfilId, proyectoId);
    const tipos = ['operativo', 'administrativo', 'ventas', 'financiero'];
    const out: ResumenPorTipo[] = [];

    tipos.forEach((tipo) => {
      const sub = egresos.filter((g) => g.tipo_egreso === tipo);
      if (sub.length === 0) return;
      const lista = sub.map((g) => ({
        cuenta: g.cuenta_pcge || '',
        concepto: g.denominacion || g.concepto_egreso,
        importe: parseFloat(g.importe_total)
      }));
      const total = lista.reduce((s, x) => s + x.importe, 0);
      out.push({ tipo, egresos: lista, total });
    });
    return out;
  }

  static async guardarParametrosRentabilidad(
    perfilId: string,
    datos: { proyecto_id: string; total_activos_caso: number; patrimonio_neto_caso: number; divisa: 'USD' | 'PEN' }
  ) {
    const existeSql = `SELECT id FROM intelfin.parametros_rentabilidad WHERE perfil_id = $1 AND proyecto_id = $2`;
    const { rows: existentes } = await ejecutarSql<{ id: string }>(existeSql, [perfilId, datos.proyecto_id]);

    if (existentes.length > 0) {
      const { rows } = await ejecutarSql(
        `UPDATE intelfin.parametros_rentabilidad
            SET total_activos_caso = $1,
                patrimonio_neto_caso = $2,
                divisa = $3,
                modificado_en = NOW()
          WHERE perfil_id = $4 AND proyecto_id = $5
          RETURNING *`,
        [datos.total_activos_caso, datos.patrimonio_neto_caso, datos.divisa, perfilId, datos.proyecto_id]
      );
      return rows[0];
    }
    const { rows } = await ejecutarSql(
      `INSERT INTO intelfin.parametros_rentabilidad
        (perfil_id, proyecto_id, total_activos_caso, patrimonio_neto_caso, divisa)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [perfilId, datos.proyecto_id, datos.total_activos_caso, datos.patrimonio_neto_caso, datos.divisa]
    );
    return rows[0];
  }

  static async obtenerParametrosRentabilidad(perfilId: string, proyectoId: string) {
    const { rows } = await ejecutarSql<{
      id: string;
      total_activos_caso: string;
      patrimonio_neto_caso: string;
      divisa: string;
    }>(
      `SELECT id, total_activos_caso, patrimonio_neto_caso, divisa
         FROM intelfin.parametros_rentabilidad
        WHERE perfil_id = $1 AND proyecto_id = $2`,
      [perfilId, proyectoId]
    );
    return rows[0] || null;
  }
}
