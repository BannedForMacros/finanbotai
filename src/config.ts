import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 4002,
  jwtFirma: process.env.JWT_FIRMA || 'cambia_esta_firma',
  jwtDuracionAcceso: process.env.JWT_DURACION_ACCESO || '15m',
  refreshDuracionDias: Number(process.env.REFRESH_DURACION_DIAS) || 30,
  databaseUrl: process.env.DATABASE_URL,
  pgSsl: (process.env.PGSSL || 'false').toLowerCase() === 'true',
  pg: {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'finanbotai_db'
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  },
  decolecta: {
    token: process.env.DECOLECTA_API_TOKEN || '',
    baseUrl: process.env.DECOLECTA_BASE_URL || 'https://api.decolecta.com'
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'FinanBotAI <noreply@finanbotai.pe>'
  },
  appFrontendUrl: process.env.APP_FRONTEND_URL || 'finanbotai://restablecer'
};
