-- ============================================
-- REQUERIMIENTOS DE COMPRA
-- Un almacén (farmacia, cocina…) pide artículos o medicinas; compras lo
-- confirma o lo rechaza y, confirmado, genera una o varias compras a partir de él.
-- Una compra también puede anotar a mano el número y la fecha de un
-- requerimiento hecho en papel.
-- Idempotente: se puede ejecutar varias veces.
-- Uso: cd backend && npm run migrate:requerimientos
-- Los __TIPO_…__ los reemplaza el script con el tipo real de cada id en esta base
-- (medicinas.id, codigos_articulos.id y users.id no son iguales en todas las instalaciones).
-- ============================================

BEGIN;

CREATE SEQUENCE IF NOT EXISTS requerimientos_compra_numero_seq START 1;

CREATE TABLE IF NOT EXISTS requerimientos_compra (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(20) NOT NULL UNIQUE,                 -- REQ-0001
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    almacen VARCHAR(60) NOT NULL,
    categoria VARCHAR(20),                              -- en farmacia: medicinas o descartables
    forma_pago VARCHAR(15),
    observaciones TEXT,
    estado VARCHAR(12) NOT NULL DEFAULT 'pendiente',
    motivo_rechazo TEXT,
    total NUMERIC(14, 2) NOT NULL DEFAULT 0,
    solicitado_por __TIPO_USUARIO_ID__ REFERENCES users(id) ON DELETE SET NULL,
    solicitado_por_nombre VARCHAR(150) NOT NULL DEFAULT '',
    revisado_por_nombre VARCHAR(150),
    revisado_en TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT requerimientos_estado_valido CHECK (estado IN ('pendiente', 'confirmada', 'rechazada')),
    CONSTRAINT requerimientos_forma_pago_valida CHECK (forma_pago IS NULL OR forma_pago IN ('efectivo', 'tarjeta', 'cheque', 'transferencia')),
    CONSTRAINT requerimientos_categoria_valida CHECK (categoria IS NULL OR categoria IN ('medicinas', 'descartables'))
);

CREATE INDEX IF NOT EXISTS idx_requerimientos_compra_fecha ON requerimientos_compra (fecha DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_requerimientos_compra_estado ON requerimientos_compra (estado);

CREATE TABLE IF NOT EXISTS requerimiento_compra_items (
    id SERIAL PRIMARY KEY,
    requerimiento_id INTEGER NOT NULL REFERENCES requerimientos_compra(id) ON DELETE CASCADE,
    orden INTEGER NOT NULL DEFAULT 0,
    medicina_id __TIPO_MEDICINA_ID__ REFERENCES medicinas(id),
    articulo_id __TIPO_ARTICULO_ID__ REFERENCES codigos_articulos(id),
    presentacion_id INTEGER,
    presentacion_nombre VARCHAR(40),
    factor INTEGER NOT NULL DEFAULT 1,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10, 2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal NUMERIC(12, 2) NOT NULL,
    CONSTRAINT requerimiento_item_un_concepto CHECK ((medicina_id IS NULL) <> (articulo_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_requerimiento_items_req ON requerimiento_compra_items (requerimiento_id, orden);

-- La compra guarda de qué requerimiento sale: el del sistema (requerimiento_id)
-- o el número y la fecha de uno en papel
ALTER TABLE compras ADD COLUMN IF NOT EXISTS requerimiento_id INTEGER REFERENCES requerimientos_compra(id) ON DELETE SET NULL;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS numero_requerimiento VARCHAR(30);
ALTER TABLE compras ADD COLUMN IF NOT EXISTS fecha_requerimiento DATE;

-- ============================================
-- BODEGAS Y CORRELATIVOS
-- Cada bodega tiene un código corto y su propio contador por año, distinto
-- para requerimientos y para compras: FAR-0001-2026, COC-0001-2026…
-- Los números anteriores (REQ-0001, COMP-001) se conservan.
-- ============================================

CREATE TABLE IF NOT EXISTS bodegas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL,
    codigo VARCHAR(6) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bodegas_codigo_valido CHECK (codigo ~ '^[A-Z0-9]{2,6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bodegas_nombre ON bodegas (LOWER(nombre));
CREATE UNIQUE INDEX IF NOT EXISTS idx_bodegas_codigo ON bodegas (codigo);

INSERT INTO bodegas (nombre, codigo) VALUES
    ('Farmacia', 'FAR'), ('Cocina', 'COC'), ('Enfermería', 'ENF'),
    ('Limpieza', 'LIM'), ('Mantenimiento', 'MAN'), ('Administración', 'ADM')
ON CONFLICT DO NOTHING;

-- Último número usado por tipo de documento, ámbito (código de bodega) y año
CREATE TABLE IF NOT EXISTS correlativos (
    tipo VARCHAR(20) NOT NULL,
    ambito VARCHAR(10) NOT NULL,
    anio INTEGER NOT NULL,
    ultimo INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tipo, ambito, anio)
);

ALTER TABLE requerimientos_compra ADD COLUMN IF NOT EXISTS bodega_id INTEGER REFERENCES bodegas(id);
ALTER TABLE compras ADD COLUMN IF NOT EXISTS bodega_id INTEGER REFERENCES bodegas(id);
ALTER TABLE requerimientos_compra ALTER COLUMN numero TYPE VARCHAR(30);

-- Requerimientos hechos antes del catálogo: su almacén escrito pasa a ser una bodega
DO $$
DECLARE
    r RECORD;
    base TEXT;
    cod TEXT;
    i INTEGER;
BEGIN
    FOR r IN
        SELECT DISTINCT TRIM(almacen) AS almacen FROM requerimientos_compra rc
        WHERE TRIM(COALESCE(almacen, '')) <> ''
          AND NOT EXISTS (SELECT 1 FROM bodegas b WHERE LOWER(b.nombre) = LOWER(TRIM(rc.almacen)))
    LOOP
        base := REGEXP_REPLACE(UPPER(TRANSLATE(r.almacen, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^A-Z0-9]', '', 'g');
        base := LEFT(base, 3);
        IF LENGTH(base) < 2 THEN
            base := RPAD(base, 2, 'X');
        END IF;
        cod := base;
        i := 1;
        WHILE EXISTS (SELECT 1 FROM bodegas WHERE codigo = cod) LOOP
            i := i + 1;
            cod := LEFT(base, 2) || i;
        END LOOP;
        INSERT INTO bodegas (nombre, codigo) VALUES (r.almacen, cod);
    END LOOP;
END $$;

UPDATE requerimientos_compra rc SET bodega_id = b.id
FROM bodegas b
WHERE rc.bodega_id IS NULL AND LOWER(b.nombre) = LOWER(TRIM(rc.almacen));

-- ============================================
-- UN REQUERIMIENTO, VARIAS COMPRAS
-- Los conceptos de un requerimiento se reparten entre compras a distintos
-- proveedores: cada concepto de la compra guarda de qué renglón del
-- requerimiento sale, y lo que aún no está en una compra queda pendiente.
-- La compra también lleva el número de factura del proveedor.
-- ============================================

DROP INDEX IF EXISTS idx_compras_requerimiento_unico;
CREATE INDEX IF NOT EXISTS idx_compras_requerimiento ON compras (requerimiento_id) WHERE requerimiento_id IS NOT NULL;

ALTER TABLE compra_items ADD COLUMN IF NOT EXISTS requerimiento_item_id INTEGER
    REFERENCES requerimiento_compra_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_compra_items_requerimiento_item ON compra_items (requerimiento_item_id)
    WHERE requerimiento_item_id IS NOT NULL;

ALTER TABLE compras ADD COLUMN IF NOT EXISTS numero_factura VARCHAR(60);

-- Compras ya generadas desde un requerimiento: cada concepto se enlaza con el renglón del mismo artículo o medicina
UPDATE compra_items ci
SET requerimiento_item_id = (
    SELECT MIN(ri.id) FROM requerimiento_compra_items ri
    WHERE ri.requerimiento_id = c.requerimiento_id
      AND (ri.medicina_id::text = ci.medicina_id::text OR ri.articulo_id::text = ci.articulo_id::text))
FROM compras c
WHERE c.id = ci.compra_id AND c.requerimiento_id IS NOT NULL AND ci.requerimiento_item_id IS NULL;

-- Permiso propio: quien pide (farmacia, cocina) no necesita ver compras
INSERT INTO permissions (nombre, descripcion, modulo, accion)
VALUES ('requerimientos_view', 'Ver requerimientos de compra', 'requerimientos', 'view'),
       ('requerimientos_edit', 'Crear requerimientos de compra', 'requerimientos', 'edit')
ON CONFLICT (nombre) DO UPDATE
SET descripcion = EXCLUDED.descripcion, modulo = EXCLUDED.modulo, accion = EXCLUDED.accion;

-- Los roles que ya manejan compras también ven y crean requerimientos
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, nuevo.id
FROM role_permissions rp
JOIN permissions actual ON actual.id = rp.permission_id
JOIN permissions nuevo ON nuevo.nombre = REPLACE(actual.nombre, 'compras_', 'requerimientos_')
WHERE actual.nombre IN ('compras_view', 'compras_edit')
ON CONFLICT DO NOTHING;

COMMIT;
