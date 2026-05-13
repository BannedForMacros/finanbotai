CREATE TABLE intelfin.catalogo_arancelario (
  codigo_arancelario  CHAR(10) PRIMARY KEY,
  descripcion_oficial TEXT NOT NULL,
  activo              BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE intelfin.tasas_advalorem_intelfin (
  codigo_arancelario  CHAR(10) PRIMARY KEY
                      REFERENCES intelfin.catalogo_arancelario(codigo_arancelario)
                      ON DELETE CASCADE,
  tasa_porcentual     NUMERIC(5,2) NOT NULL
);

CREATE TABLE intelfin.tabla_impuestos (
  clave_concepto    VARCHAR(20) PRIMARY KEY,
  tasa_porcentual   NUMERIC(5,2) NOT NULL,
  vigente_desde     DATE NOT NULL DEFAULT CURRENT_DATE
);

INSERT INTO intelfin.tabla_impuestos(clave_concepto, tasa_porcentual) VALUES
  ('IGV',         16.00),
  ('IPM',          2.00),
  ('PERC_3.5',     3.50),
  ('PERC_5',       5.00),
  ('PERC_10',     10.00),
  ('IGV_VENTA',   18.00);

CREATE TABLE intelfin.tipos_mercaderia (
  id                     SERIAL PRIMARY KEY,
  denominacion           VARCHAR(80) NOT NULL,
  cuenta_pcge            VARCHAR(10) NOT NULL,
  descripcion_extendida  TEXT
);

INSERT INTO intelfin.tipos_mercaderia(denominacion, cuenta_pcge, descripcion_extendida) VALUES
  ('Mercaderias',           '601', 'Mercaderias adquiridas para venta sin transformacion'),
  ('Materias primas',       '602', 'Insumos destinados a procesos de produccion'),
  ('Materiales auxiliares', '603', 'Materiales complementarios al proceso productivo'),
  ('Envases y embalajes',   '604', 'Empaques y embalajes adquiridos');

CREATE TABLE intelfin.tipos_articulo_venta (
  id                     SERIAL PRIMARY KEY,
  denominacion           VARCHAR(80) NOT NULL,
  cuenta_pcge            VARCHAR(10) NOT NULL,
  descripcion_extendida  TEXT
);

INSERT INTO intelfin.tipos_articulo_venta(denominacion, cuenta_pcge, descripcion_extendida) VALUES
  ('Mercaderias nacionales',          '7011', 'Ventas de mercaderia nacional'),
  ('Mercaderias exportadas',          '7012', 'Ventas de mercaderia al exterior'),
  ('Productos terminados nacionales', '7021', 'Productos manufacturados nacionales'),
  ('Productos terminados exportados', '7022', 'Productos manufacturados exportados');

CREATE TABLE intelfin.plan_cuentas_pcge (
  id                    SERIAL PRIMARY KEY,
  codigo_cuenta         VARCHAR(10) NOT NULL UNIQUE,
  denominacion_cuenta   VARCHAR(180) NOT NULL
);

CREATE TABLE intelfin.catalogo_egresos (
  id                SERIAL PRIMARY KEY,
  denominacion      VARCHAR(120) NOT NULL,
  tipo_egreso       VARCHAR(20) NOT NULL
                    CHECK (tipo_egreso IN ('operativo', 'administrativo', 'ventas', 'financiero')),
  cuenta_pcge       VARCHAR(10) NOT NULL,
  computa_igv       BOOLEAN NOT NULL DEFAULT false,
  igv_opcional      BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO intelfin.catalogo_egresos(denominacion, tipo_egreso, cuenta_pcge, computa_igv, igv_opcional) VALUES
  ('Gastos de personal',                'operativo',      '62', false, false),
  ('Servicios prestados por terceros',  'operativo',      '63', true,  true),
  ('Gastos por tributos',               'operativo',      '64', false, false),
  ('Otros gastos de gestion',           'administrativo', '65', true,  true),
  ('Servicios administrativos',         'administrativo', '63', true,  true),
  ('Comisiones de venta',               'ventas',         '63', true,  true),
  ('Publicidad y marketing',            'ventas',         '63', true,  true),
  ('Gastos financieros',                'financiero',     '67', false, false),
  ('Intereses bancarios',               'financiero',     '67', false, false);

CREATE TABLE intelfin.cotizacion_diaria (
  id               SERIAL PRIMARY KEY,
  divisa           VARCHAR(3) NOT NULL DEFAULT 'USD',
  valor_compra     NUMERIC(10,6) NOT NULL,
  valor_venta      NUMERIC(10,6) NOT NULL,
  fecha_cotizacion DATE NOT NULL,
  capturada_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (divisa, fecha_cotizacion)
);

CREATE INDEX idx_cotizacion_fecha ON intelfin.cotizacion_diaria(fecha_cotizacion DESC);
