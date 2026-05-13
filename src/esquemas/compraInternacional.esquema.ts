import { z } from 'zod';

export const crearCompraSchema = z.object({
  proyecto_id: z.string({ required_error: 'El proyecto es obligatorio' }).uuid(),
  flag_compra_local: z.boolean().default(false),
  tipo_mercaderia_id: z.number({ required_error: 'El tipo de mercaderia es obligatorio' }).int().positive(),
  codigo_arancelario: z.string().optional(),
  descripcion_articulo: z.string({ required_error: 'La descripcion es obligatoria' })
    .min(3, 'La descripcion debe tener al menos 3 caracteres'),
  divisa: z.enum(['USD', 'PEN']),
  importe_fob: z.number().nonnegative(),
  importe_flete: z.number().nonnegative().default(0),
  importe_seguro: z.number().nonnegative().default(0),
  aplica_igv: z.boolean().default(true),
  aplica_isc: z.boolean().default(false),
  aplica_percepcion: z.boolean().default(true),
  tasa_advalorem_input: z.number().min(0).max(1).optional(),
  tasa_isc_input: z.number().min(0).max(1).optional(),
  tasa_percepcion_input: z.number().min(0).max(1).optional(),
  cargo_antidumping_usd: z.number().nonnegative().default(0),
  cargo_compensatorio_usd: z.number().nonnegative().default(0),
  cargo_sda_usd: z.number().nonnegative().default(0),
  fecha_compra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
}).superRefine((data, ctx) => {
  if (!data.flag_compra_local) {
    if (!data.codigo_arancelario || data.codigo_arancelario.length !== 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El codigo arancelario es obligatorio para compras internacionales (10 digitos)',
        path: ['codigo_arancelario']
      });
    }
  }
});

export const actualizarCompraSchema = z.object({
  proyecto_id: z.string().uuid().optional(),
  flag_compra_local: z.boolean().optional(),
  tipo_mercaderia_id: z.number().int().positive().optional(),
  codigo_arancelario: z.string().length(10).optional(),
  descripcion_articulo: z.string().min(3).optional(),
  divisa: z.enum(['USD', 'PEN']).optional(),
  importe_fob: z.number().nonnegative().optional(),
  importe_flete: z.number().nonnegative().optional(),
  importe_seguro: z.number().nonnegative().optional(),
  aplica_igv: z.boolean().optional(),
  aplica_isc: z.boolean().optional(),
  aplica_percepcion: z.boolean().optional(),
  tasa_advalorem_input: z.number().min(0).max(1).optional(),
  tasa_isc_input: z.number().min(0).max(1).optional(),
  tasa_percepcion_input: z.number().min(0).max(1).optional(),
  cargo_antidumping_usd: z.number().nonnegative().optional(),
  cargo_compensatorio_usd: z.number().nonnegative().optional(),
  cargo_sda_usd: z.number().nonnegative().optional(),
  fecha_compra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});
