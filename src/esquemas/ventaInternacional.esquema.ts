import { z } from 'zod';

const incotermEnum = z.enum([
  'EXW', 'FCA', 'FAS', 'FOB',
  'CFR', 'CIF', 'CPT', 'CIP',
  'DPU', 'DAP', 'DDP'
]);

export const crearVentaSchema = z.object({
  proyecto_id: z.string({ required_error: 'El proyecto es requerido' }).uuid(),
  flag_venta_local: z.boolean().default(false),
  tipo_articulo_id: z.number({ required_error: 'El tipo de articulo es requerido' }).int().positive(),
  termino_comercio_internacional: incotermEnum.optional(),
  descripcion_articulo: z.string({ required_error: 'La descripcion es requerida' })
    .min(3).max(500),
  pais_origen_iso: z.string().length(3).optional(),
  pais_destino_iso: z.string().length(3).optional(),
  importe_venta_neto: z.number({ required_error: 'El importe de venta es requerido' })
    .positive()
    .max(999_999_999.99),
  divisa: z.enum(['USD', 'PEN']),
  fecha_venta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const actualizarVentaSchema = crearVentaSchema.partial();
