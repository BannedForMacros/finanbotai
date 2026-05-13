import { z } from 'zod';

export const registroSchema = z.object({
  correo_corporativo: z.string().email(),
  nombres_completos: z.string().min(2),
  identificador_acceso: z.string().min(2).optional(),
  credencial: z.string().min(8)
});

export const accesoSchema = z.object({
  correo_corporativo: z.string().email(),
  credencial: z.string().min(8)
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(10)
});

export const solicitudResetSchema = z.object({
  correo_corporativo: z.string().email()
});

export const restablecerSchema = z.object({
  token: z.string().min(10),
  credencial: z.string().min(8)
});
