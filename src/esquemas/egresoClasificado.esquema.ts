import { z } from 'zod';

export const crearEgresoSchema = z.object({
  proyecto_id: z.string({ required_error: 'El proyecto es requerido' }).uuid(),
  categoria_egreso_id: z.number().int().positive({ message: 'Debe seleccionar una categoria de egreso' }),
  concepto_egreso: z.string().min(3, 'El concepto debe tener al menos 3 caracteres'),
  importe_total: z.number().positive('El importe debe ser mayor a cero'),
  divisa: z.enum(['USD', 'PEN']),
  fecha_egreso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  flag_planilla: z.boolean().optional().default(false),
  regimen_previsional: z.enum(['ONP', 'AFP']).nullable().optional(),
  con_igv: z.boolean().optional().nullable()
}).refine(
  (data) => !(data.flag_planilla && !data.regimen_previsional),
  {
    message: 'Las planillas deben indicar el regimen previsional (ONP o AFP)',
    path: ['regimen_previsional']
  }
);

export const actualizarEgresoSchema = z.object({
  categoria_egreso_id: z.number().int().positive().optional(),
  concepto_egreso: z.string().min(3).optional(),
  importe_total: z.number().positive().optional(),
  divisa: z.enum(['USD', 'PEN']).optional(),
  fecha_egreso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  flag_planilla: z.boolean().optional(),
  regimen_previsional: z.enum(['ONP', 'AFP']).nullable().optional(),
  con_igv: z.boolean().optional().nullable()
}).refine(
  (data) => !(data.flag_planilla === true && !data.regimen_previsional),
  {
    message: 'Si se marca como planilla, debe indicar el regimen previsional (ONP o AFP)',
    path: ['regimen_previsional']
  }
);

export const parametrosRentabilidadSchema = z.object({
  proyecto_id: z.string().uuid(),
  total_activos_caso: z.number().positive('Los activos totales deben ser mayores a cero'),
  patrimonio_neto_caso: z.number().positive('El patrimonio debe ser mayor a cero'),
  divisa: z.enum(['USD', 'PEN'])
});
