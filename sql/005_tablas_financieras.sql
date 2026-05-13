CREATE TABLE intelfin.parametros_rentabilidad (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id              UUID NOT NULL REFERENCES intelfin.perfil_corporativo(id) ON DELETE CASCADE,
  proyecto_id            UUID UNIQUE NOT NULL REFERENCES intelfin.proyectos_analisis(id) ON DELETE CASCADE,
  total_activos_caso     NUMERIC(14,2) NOT NULL,
  patrimonio_neto_caso   NUMERIC(14,2) NOT NULL,
  divisa                 CHAR(3) NOT NULL DEFAULT 'PEN',
  modificado_en          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE intelfin.acumulados_ventas (
  perfil_id                       UUID NOT NULL REFERENCES intelfin.perfil_corporativo(id) ON DELETE CASCADE,
  proyecto_id                     UUID NOT NULL REFERENCES intelfin.proyectos_analisis(id) ON DELETE CASCADE,
  total_ventas_netas              NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ventas_internacionales    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ventas_nacionales         NUMERIC(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (perfil_id, proyecto_id)
);

CREATE TABLE intelfin.acumulados_costos (
  perfil_id                     UUID NOT NULL REFERENCES intelfin.perfil_corporativo(id) ON DELETE CASCADE,
  proyecto_id                   UUID NOT NULL REFERENCES intelfin.proyectos_analisis(id) ON DELETE CASCADE,
  total_costos_mercaderia       NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_costos_materias_primas  NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_costos_envases          NUMERIC(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (perfil_id, proyecto_id)
);
