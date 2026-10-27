-- ============================================
-- REQUERIMIENTOS DE COMPRA
-- Un almacén (farmacia, cocina…) pide artículos o medicinas; compras lo
-- confirma o lo rechaza y, confirmado, genera la compra a partir de él.
-- Una compra también puede anotar a mano el número y la fecha de un
-- requerimiento hecho en papel.
-- Idempotente: se puede ejecutar varias veces.
-- Uso: cd backend && npm run migrate:requerimientos
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
    solicitado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
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
    medicina_id VARCHAR(50) REFERENCES medicinas(id),
    articulo_id VARCHAR(50) REFERENCES codigos_articulos(id),
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
-- Un requerimiento genera una sola compra
CREATE UNIQUE INDEX IF NOT EXISTS idx_compras_requerimiento_unico ON compras (requerimiento_id) WHERE requerimiento_id IS NOT NULL;

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
