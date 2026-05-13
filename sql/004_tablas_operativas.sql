CREATE TABLE intelfin.proyectos_analisis (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id             UUID NOT NULL REFERENCES intelfin.perfil_corporativo(id) ON DELETE CASCADE,
  nombre_proyecto       VARCHAR(180) NOT NULL,
  descripcion_proyecto  TEXT,
  estado_proyecto       VARCHAR(20) NOT NULL DEFAULT 'en_curso'
                        CHECK (estado_proyecto IN ('en_curso', 'cerrado', 'archivado')),
  creado_en             TIMESTAMP NOT NULL DEFAULT NOW(),
  modificado_en         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proyectos_perfil ON intelfin.proyectos_analisis(perfil_id);

CREATE TABLE intelfin.compras_internacionales (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id                     UUID NOT NULL REFERENCES intelfin.proyectos_analisis(id) ON DELETE CASCADE,
  perfil_id                       UUID NOT NULL REFERENCES intelfin.perfil_corporativo(id) ON DELETE CASCADE,
  flag_compra_local               BOOLEAN NOT NULL DEFAULT false,
  tipo_mercaderia_id              INT NOT NULL REFERENCES intelfin.tipos_mercaderia(id),
  codigo_arancelario              CHAR(10) NOT NULL REFERENCES intelfin.catalogo_arancelario(codigo_arancelario),
  descripcion_articulo            VARCHAR(255),
  divisa                          CHAR(3) NOT NULL DEFAULT 'USD',
  importe_fob                     NUMERIC(14,2) NOT NULL,
  importe_flete                   NUMERIC(14,2) NOT NULL DEFAULT 0,
  importe_seguro                  NUMERIC(14,2) NOT NULL DEFAULT 0,
  aplica_igv                      BOOLEAN NOT NULL DEFAULT true,
  aplica_isc                      BOOLEAN NOT NULL DEFAULT false,
  aplica_percepcion               BOOLEAN NOT NULL DEFAULT true,
  tasa_advalorem_input            NUMERIC(5,2),
  tasa_isc_input                  NUMERIC(5,2),
  tasa_percepcion_input           NUMERIC(5,2) DEFAULT 3.5,
  cargo_antidumping_usd           NUMERIC(14,2) NOT NULL DEFAULT 0,
  cargo_compensatorio_usd         NUMERIC(14,2) NOT NULL DEFAULT 0,
  cargo_sda_usd                   NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_cif_resultante            NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_advalorem_resultante      NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_isc_resultante            NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_igv_resultante            NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_ipm_resultante            NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_percepcion_resultante     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_carga_aduanera            NUMERIC(14,2) NOT NULL DEFAULT 0,
  libro_diario_jsonb              JSONB,
  fecha_compra                    DATE NOT NULL,
  fecha_cotizacion                DATE,
  activa                          BOOLEAN NOT NULL DEFAULT true,
  registrada_en                   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compras_proyecto ON intelfin.compras_internacionales(proyecto_id);
CREATE INDEX idx_compras_perfil ON intelfin.compras_internacionales(perfil_id);

CREATE TABLE intelfin.ventas_internacionales (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id                     UUID NOT NULL REFERENCES intelfin.proyectos_analisis(id) ON DELETE CASCADE,
  perfil_id                       UUID NOT NULL REFERENCES intelfin.perfil_corporativo(id) ON DELETE CASCADE,
  flag_venta_local                BOOLEAN NOT NULL DEFAULT false,
  tipo_articulo_id                INT NOT NULL REFERENCES intelfin.tipos_articulo_venta(id),
  termino_comercio_internacional  VARCHAR(8),
  descripcion_articulo            VARCHAR(255),
  pais_origen_iso                 CHAR(3) DEFAULT 'PER',
  pais_destino_iso                CHAR(3),
  importe_venta_neto              NUMERIC(14,2) NOT NULL,
  subtotal_neto                   NUMERIC(14,2) NOT NULL,
  subtotal_igv                    NUMERIC(14,2) NOT NULL DEFAULT 0,
  divisa                          CHAR(3) NOT NULL DEFAULT 'USD',
  fecha_venta                     DATE NOT NULL,
  fecha_cotizacion                DATE,
  activa                          BOOLEAN NOT NULL DEFAULT true,
  registrada_en                   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ventas_proyecto ON intelfin.ventas_internacionales(proyecto_id);
CREATE INDEX idx_ventas_perfil ON intelfin.ventas_internacionales(perfil_id);

CREATE TABLE intelfin.partida_doble_ventas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id              UUID UNIQUE NOT NULL REFERENCES intelfin.ventas_internacionales(id) ON DELETE CASCADE,
  proyecto_id           UUID NOT NULL REFERENCES intelfin.proyectos_analisis(id) ON DELETE CASCADE,
  perfil_id             UUID NOT NULL REFERENCES intelfin.perfil_corporativo(id) ON DELETE CASCADE,
  fecha_asiento         DATE NOT NULL,
  glosa_asiento         VARCHAR(180),
  detalle_lineas_jsonb  JSONB NOT NULL,
  total_debe            NUMERIC(14,2) NOT NULL,
  total_haber           NUMERIC(14,2) NOT NULL,
  activo                BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE intelfin.egresos_clasificados (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id             UUID NOT NULL REFERENCES intelfin.perfil_corporativo(id) ON DELETE CASCADE,
  proyecto_id           UUID NOT NULL REFERENCES intelfin.proyectos_analisis(id) ON DELETE CASCADE,
  categoria_egreso_id   INT NOT NULL REFERENCES intelfin.catalogo_egresos(id),
  concepto_egreso       VARCHAR(255) NOT NULL,
  importe_total         NUMERIC(14,2) NOT NULL,
  subtotal_neto         NUMERIC(14,2) NOT NULL,
  subtotal_igv          NUMERIC(14,2) NOT NULL DEFAULT 0,
  divisa                CHAR(3) NOT NULL DEFAULT 'PEN',
  fecha_egreso          DATE NOT NULL,
  flag_planilla         BOOLEAN NOT NULL DEFAULT false,
  regimen_previsional   VARCHAR(4) CHECK (regimen_previsional IN ('ONP', 'AFP') OR regimen_previsional IS NULL),
  con_igv               BOOLEAN NOT NULL DEFAULT false,
  fecha_cotizacion      DATE,
  activo                BOOLEAN NOT NULL DEFAULT true,
  registrado_en         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_egresos_proyecto ON intelfin.egresos_clasificados(proyecto_id);
CREATE INDEX idx_egresos_perfil ON intelfin.egresos_clasificados(perfil_id);
