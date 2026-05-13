import { ejecutarSql } from '../datos';
import { CalculoTributarioServicio, LineaAsiento } from './calculoTributario.servicio';
import { TipoCambioServicio } from './tipoCambio.servicio';
import { bitacora } from '../utilitarios/bitacora';

export interface VentaFila {
  id: string;
  proyecto_id: string;
  perfil_id: string;
  flag_venta_local: boolean;
  tipo_articulo_id: number;
  termino_comercio_internacional: string | null;
  descripcion_articulo: string | null;
  pais_origen_iso: string | null;
  pais_destino_iso: string | null;
  importe_venta_neto: string;
  subtotal_neto: string;
  subtotal_igv: string;
  divisa: string;
  fecha_venta: string;
  fecha_cotizacion: string | null;
  activa: boolean;
  registrada_en: string;
}

export interface AsientoVentaFila {
  id: string;
  venta_id: string;
  proyecto_id: string;
  perfil_id: string;
  fecha_asiento: string;
  glosa_asiento: string | null;
  detalle_lineas_jsonb: LineaAsiento[];
  total_debe: string;
  total_haber: string;
  activo: boolean;
}

export interface CrearVentaInput {
  proyecto_id: string;
  flag_venta_local: boolean;
  tipo_articulo_id: number;
  termino_comercio_internacional?: string;
  descripcion_articulo: string;
  pais_origen_iso?: string;
  pais_destino_iso?: string;
  importe_venta_neto: number;
  divisa: 'USD' | 'PEN';
  fecha_venta?: string;
}

export class VentaInternacionalServicio {
  static async listarTiposArticulo() {
    const { rows } = await ejecutarSql<{
      id: number;
      denominacion: string;
      cuenta_pcge: string;
      descripcion_extendida: string | null;
    }>(
      `SELECT id, denominacion, cuenta_pcge, descripcion_extendida
         FROM intelfin.tipos_articulo_venta
        ORDER BY cuenta_pcge`
    );
    return rows;
  }

  static async listar(perfilId: string, proyectoId?: string): Promise<VentaFila[]> {
    let sql = `
      SELECT vi.*, pa.nombre_proyecto,
             ta.denominacion AS tipo_articulo_denominacion,
             ta.cuenta_pcge AS tipo_articulo_cuenta_pcge
        FROM intelfin.ventas_internacionales vi
        JOIN intelfin.proyectos_analisis pa ON pa.id = vi.proyecto_id
        LEFT JOIN intelfin.tipos_articulo_venta ta ON ta.id = vi.tipo_articulo_id
       WHERE vi.perfil_id = $1 AND vi.activa = true AND pa.estado_proyecto <> 'archivado'
    `;
    const params: any[] = [perfilId];
    if (proyectoId) {
      sql += ` AND vi.proyecto_id = $${params.length + 1}`;
      params.push(proyectoId);
    }
    sql += ` ORDER BY vi.fecha_venta DESC, vi.registrada_en DESC`;
    const { rows } = await ejecutarSql<VentaFila>(sql, params);
    return rows;
  }

  static async obtener(id: string, perfilId: string): Promise<VentaFila | null> {
    const { rows } = await ejecutarSql<VentaFila>(
      `SELECT vi.*, pa.nombre_proyecto,
              ta.denominacion AS tipo_articulo_denominacion,
              ta.cuenta_pcge AS tipo_articulo_cuenta_pcge
         FROM intelfin.ventas_internacionales vi
         JOIN intelfin.proyectos_analisis pa ON pa.id = vi.proyecto_id
         LEFT JOIN intelfin.tipos_articulo_venta ta ON ta.id = vi.tipo_articulo_id
        WHERE vi.id = $1 AND vi.perfil_id = $2 AND vi.activa = true`,
      [id, perfilId]
    );
    return rows[0] || null;
  }

  static async crear(perfilId: string, datos: CrearVentaInput): Promise<{
    venta: VentaFila;
    asiento: AsientoVentaFila;
  }> {
    const montos = CalculoTributarioServicio.calcularMontosVenta(
      datos.importe_venta_neto,
      datos.flag_venta_local
    );

    const fechaOp = datos.fecha_venta || new Date().toISOString().split('T')[0];
    let fechaCotizacion: string | null = null;
    try {
      const info = await TipoCambioServicio.getTipoCambioInfo(fechaOp);
      fechaCotizacion = info.date;
    } catch (e) {
      bitacora.warn(`No se pudo obtener cotizacion para ${fechaOp}`, e);
    }

    const { rows } = await ejecutarSql<VentaFila>(
      `INSERT INTO intelfin.ventas_internacionales (
        proyecto_id, perfil_id, flag_venta_local, tipo_articulo_id,
        termino_comercio_internacional, descripcion_articulo,
        pais_origen_iso, pais_destino_iso,
        importe_venta_neto, subtotal_neto, subtotal_igv, divisa,
        fecha_venta, fecha_cotizacion, activa
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
      RETURNING *`,
      [
        datos.proyecto_id, perfilId, datos.flag_venta_local, datos.tipo_articulo_id,
        datos.termino_comercio_internacional ?? null, datos.descripcion_articulo,
        datos.pais_origen_iso ?? null, datos.pais_destino_iso ?? null,
        montos.total, montos.subtotal_neto, montos.subtotal_igv, datos.divisa,
        fechaOp, fechaCotizacion
      ]
    );
    const venta = rows[0];

    const asiento = await this.generarYGuardarAsiento(venta.id, perfilId);
    return { venta, asiento };
  }

  static async actualizar(
    id: string,
    perfilId: string,
    datos: Partial<CrearVentaInput>
  ): Promise<{ venta: VentaFila; asiento: AsientoVentaFila } | null> {
    const existente = await this.obtener(id, perfilId);
    if (!existente) return null;

    const flagLocal = datos.flag_venta_local ?? existente.flag_venta_local;
    const importeNeto = datos.importe_venta_neto ?? parseFloat(existente.importe_venta_neto);
    const montos = CalculoTributarioServicio.calcularMontosVenta(importeNeto, flagLocal);

    const { rows } = await ejecutarSql<VentaFila>(
      `UPDATE intelfin.ventas_internacionales
          SET proyecto_id = COALESCE($1, proyecto_id),
              flag_venta_local = $2,
              tipo_articulo_id = COALESCE($3, tipo_articulo_id),
              termino_comercio_internacional = COALESCE($4, termino_comercio_internacional),
              descripcion_articulo = COALESCE($5, descripcion_articulo),
              pais_origen_iso = COALESCE($6, pais_origen_iso),
              pais_destino_iso = COALESCE($7, pais_destino_iso),
              importe_venta_neto = $8,
              subtotal_neto = $9,
              subtotal_igv = $10,
              divisa = COALESCE($11, divisa),
              fecha_venta = COALESCE($12, fecha_venta)
        WHERE id = $13 AND perfil_id = $14 AND activa = true
        RETURNING *`,
      [
        datos.proyecto_id ?? null, flagLocal, datos.tipo_articulo_id ?? null,
        datos.termino_comercio_internacional ?? null, datos.descripcion_articulo ?? null,
        datos.pais_origen_iso ?? null, datos.pais_destino_iso ?? null,
        montos.total, montos.subtotal_neto, montos.subtotal_igv,
        datos.divisa ?? null, datos.fecha_venta ?? null,
        id, perfilId
      ]
    );
    if (rows.length === 0) return null;
    const venta = rows[0];

    const asiento = await this.generarYGuardarAsiento(venta.id, perfilId);
    return { venta, asiento };
  }

  static async eliminar(id: string, perfilId: string): Promise<boolean> {
    const { rows } = await ejecutarSql<{ id: string }>(
      `UPDATE intelfin.ventas_internacionales
          SET activa = false
        WHERE id = $1 AND perfil_id = $2 AND activa = true
        RETURNING id`,
      [id, perfilId]
    );
    return rows.length > 0;
  }

  static async obtenerAsiento(ventaId: string, perfilId: string): Promise<AsientoVentaFila | null> {
    const { rows } = await ejecutarSql<AsientoVentaFila>(
      `SELECT * FROM intelfin.partida_doble_ventas
        WHERE venta_id = $1 AND perfil_id = $2 AND activo = true`,
      [ventaId, perfilId]
    );
    return rows[0] || null;
  }

  static async generarYGuardarAsiento(ventaId: string, perfilId: string): Promise<AsientoVentaFila> {
    const sqlVenta = `
      SELECT vi.*, ta.denominacion AS tipo_articulo_denominacion,
             ta.cuenta_pcge AS tipo_articulo_cuenta_pcge
        FROM intelfin.ventas_internacionales vi
        JOIN intelfin.tipos_articulo_venta ta ON ta.id = vi.tipo_articulo_id
       WHERE vi.id = $1 AND vi.perfil_id = $2 AND vi.activa = true
    `;
    const { rows } = await ejecutarSql<VentaFila & {
      tipo_articulo_denominacion: string;
      tipo_articulo_cuenta_pcge: string;
    }>(sqlVenta, [ventaId, perfilId]);
    if (rows.length === 0) {
      throw new Error('Venta no encontrada');
    }
    const v = rows[0];
    const reglas = CalculoTributarioServicio.reglasPcge();
    const detalles: LineaAsiento[] = [];

    const subNeto = parseFloat(v.subtotal_neto);
    const subIgv = parseFloat(v.subtotal_igv);
    const total = parseFloat(v.importe_venta_neto);

    const cuentaCobrar = v.flag_venta_local
      ? reglas.clientes_nacional
      : reglas.clientes_internacional;
    detalles.push({
      cuenta: cuentaCobrar.cuenta,
      nombre_cuenta: v.flag_venta_local ? 'Cuentas por cobrar nacionales' : 'Cuentas por cobrar internacionales',
      debe: total,
      haber: 0,
      glosa: v.flag_venta_local ? 'Cobranza por venta nacional' : 'Cobranza por exportacion'
    });

    detalles.push({
      cuenta: v.tipo_articulo_cuenta_pcge,
      nombre_cuenta: v.tipo_articulo_denominacion,
      debe: 0,
      haber: subNeto,
      glosa: v.flag_venta_local ? 'Venta nacional' : 'Venta de exportacion'
    });

    if (v.flag_venta_local && subIgv > 0) {
      detalles.push({
        cuenta: reglas.igv_ventas.cuenta,
        nombre_cuenta: reglas.igv_ventas.nombre,
        debe: 0,
        haber: subIgv,
        glosa: 'IGV de venta nacional'
      });
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const totalDebe = round2(detalles.reduce((s, d) => s + d.debe, 0));
    const totalHaber = round2(detalles.reduce((s, d) => s + d.haber, 0));
    const glosa = `Asiento por ${v.flag_venta_local ? 'venta nacional' : 'exportacion'}: ${v.descripcion_articulo}`;

    const { rows: asientoRows } = await ejecutarSql<AsientoVentaFila>(
      `INSERT INTO intelfin.partida_doble_ventas
        (venta_id, proyecto_id, perfil_id, fecha_asiento, glosa_asiento,
         detalle_lineas_jsonb, total_debe, total_haber, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       ON CONFLICT (venta_id) DO UPDATE
          SET fecha_asiento = EXCLUDED.fecha_asiento,
              glosa_asiento = EXCLUDED.glosa_asiento,
              detalle_lineas_jsonb = EXCLUDED.detalle_lineas_jsonb,
              total_debe = EXCLUDED.total_debe,
              total_haber = EXCLUDED.total_haber,
              activo = true
       RETURNING *`,
      [ventaId, v.proyecto_id, perfilId, v.fecha_venta, glosa, JSON.stringify(detalles), totalDebe, totalHaber]
    );

    return asientoRows[0];
  }
}
