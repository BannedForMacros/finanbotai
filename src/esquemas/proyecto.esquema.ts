import { z } from 'zod';

export const crearProyectoSchema = z.object({
  nombre_proyecto: z.string({ required_error: 'El nombre es obligatorio' })
    .min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion_proyecto: z.string().optional()
});

export const actualizarProyectoSchema = z.object({
  nombre_proyecto: z.string().min(3).optional(),
  descripcion_proyecto: z.string().optional(),
  estado_proyecto: z.enum(['en_curso', 'cerrado', 'archivado']).optional()
});
