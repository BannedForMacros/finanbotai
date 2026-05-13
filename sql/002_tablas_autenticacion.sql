CREATE TABLE intelfin.perfil_corporativo (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correo_corporativo      VARCHAR(160) UNIQUE NOT NULL,
  identificador_acceso    VARCHAR(80),
  nombres_completos       VARCHAR(180) NOT NULL,
  hash_credencial         TEXT NOT NULL,
  perfil_activo           BOOLEAN NOT NULL DEFAULT true,
  correo_validado_en      TIMESTAMP,
  registrado_en           TIMESTAMP NOT NULL DEFAULT NOW(),
  modificado_en           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_perfil_correo ON intelfin.perfil_corporativo(correo_corporativo);

CREATE TABLE intelfin.sesiones_token_jwt (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id           UUID NOT NULL REFERENCES intelfin.perfil_corporativo(id) ON DELETE CASCADE,
  firma_refresh       CHAR(64) NOT NULL,
  agente_dispositivo  TEXT,
  ip_origen           INET,
  expira_en           TIMESTAMP NOT NULL,
  invalidada_en       TIMESTAMP,
  creada_en           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sesiones_firma ON intelfin.sesiones_token_jwt(firma_refresh);
CREATE INDEX idx_sesiones_perfil ON intelfin.sesiones_token_jwt(perfil_id);

CREATE TABLE intelfin.recuperaciones_acceso (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id     UUID NOT NULL REFERENCES intelfin.perfil_corporativo(id) ON DELETE CASCADE,
  firma_token   CHAR(64) NOT NULL,
  expira_en     TIMESTAMP NOT NULL,
  consumida_en  TIMESTAMP,
  emitida_en    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recup_firma ON intelfin.recuperaciones_acceso(firma_token);
