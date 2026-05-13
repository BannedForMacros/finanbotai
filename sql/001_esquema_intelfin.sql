CREATE SCHEMA IF NOT EXISTS intelfin;

COMMENT ON SCHEMA intelfin IS
  'Esquema logico de FinanBotAI: autenticacion, proyectos, operaciones, analisis financiero y catalogos del PCGE peruano.';

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

SET search_path TO intelfin, public;
