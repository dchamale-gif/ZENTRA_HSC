-- ============================================
-- REGULACIONES DE INVENTARIO
-- Todo lo que sale (o entra) del inventario sin ser venta ni compra: consumo interno,
-- merma o daño, vencimiento, donación, ajuste por conteo físico. Las registra solo el
-- administrador; se aplican al guardarlas y al anularlas se devuelve lo movido.
-- Número por bodega y año: REG-FAR-0001-2026.
-- También crea el kárdex de artículos (articulo_movimientos), igual al de medicinas,
-- con la existencia actual como saldo inicial.
-- Idempotente: se puede ejecutar varias veces.
-- Uso: cd backend && npm run migrate:regulaciones
-- Los __TIPO_…__ los reemplaza el script con el tipo real de cada id en esta base.
-- ============================================

BEGIN;

-- Mismo contador que usan requerimientos, compras y gastos
CREATE TABLE IF NOT EXISTS correlativos (
    tipo VARCHAR(20) NOT NULL,
    ambito VARCHAR(10) NOT NULL,
    anio INTEGER NOT NULL,
    ultimo INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tipo, ambito, anio)
);

-- ---------- Kárdex de artículos: cantidad positiva entra, negativa sale ----------
CREATE TABLE IF NOT EXISTS articulo_movimientos (
    id SERIAL PRIMARY KEY,
    articulo_id __TIPO_ARTICULO_ID__ NOT NULL REFERENCES codigos_articulos(id) ON DELETE CASCADE,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('inicial', 'ingreso_compra', 'reversion_compra', 'venta',
        'devolucion_venta', 'consumo_interno', 'ajuste')),
    cantidad INTEGER NOT NULL CHECK (cantidad <> 0),
    existencia_resultante INTEGER NOT NULL,
    costo_unitario NUMERIC(12, 4),
    referencia VARCHAR(80),
    motivo TEXT NOT NULL DEFAULT '',
    usuario_id __TIPO_USUARIO_ID__ REFERENCES users(id) ON DELETE SET NULL,
    usuario_nombre VARCHAR(150) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_articulo_movimientos ON articulo_movimientos (articulo_id, fecha DESC, id DESC);

-- Saldo inicial: la existencia que ya tenía cada artículo (solo la primera vez)
INSERT INTO articulo_movimientos (articulo_id, tipo, cantidad, existencia_resultante, motivo, usuario_nombre)
SELECT a.id, 'inicial', a.cantidad_disponible, a.cantidad_disponible, 'Existencia al activar el kárdex', 'Sistema'
FROM codigos_articulos a
WHERE COALESCE(a.cantidad_disponible, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM articulo_movimientos m WHERE m.articulo_id = a.id);

-- ---------- Regulaciones ----------
CREATE TABLE IF NOT EXISTS regulaciones_inventario (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    bodega_id INTEGER NOT NULL REFERENCES bodegas(id),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    motivo VARCHAR(20) NOT NULL CHECK (motivo IN ('consumo_interno', 'merma', 'vencimiento', 'donacion',
        'ajuste_conteo', 'otro')),
    observaciones TEXT,
    estado VARCHAR(10) NOT NULL DEFAULT 'aplicada' CHECK (estado IN ('aplicada', 'anulada')),
    total_costo NUMERIC(12, 2) NOT NULL DEFAULT 0,      -- salidas menos entradas, al costo del momento
    creado_por __TIPO_USUARIO_ID__ REFERENCES users(id) ON DELETE SET NULL,
    creado_por_nombre VARCHAR(150) NOT NULL DEFAULT '',
    motivo_anulacion TEXT,
    anulado_por_nombre VARCHAR(150),
    anulado_en TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_regulaciones_fecha ON regulaciones_inventario (fecha DESC, id DESC);

CREATE TABLE IF NOT EXISTS regulacion_inventario_items (
    id SERIAL PRIMARY KEY,
    regulacion_id INTEGER NOT NULL REFERENCES regulaciones_inventario(id) ON DELETE CASCADE,
    medicina_id __TIPO_MEDICINA_ID__ REFERENCES medicinas(id),
    articulo_id __TIPO_ARTICULO_ID__ REFERENCES codigos_articulos(id),
    concepto_nombre VARCHAR(200) NOT NULL DEFAULT '',
    sentido VARCHAR(7) NOT NULL DEFAULT 'salida' CHECK (sentido IN ('salida', 'entrada')),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),        -- en la presentación elegida
    presentacion_id INTEGER,
    presentacion_nombre VARCHAR(40),
    factor INTEGER NOT NULL DEFAULT 1,
    unidades INTEGER NOT NULL,                             -- cantidad × factor, en unidad base
    costo_unitario NUMERIC(12, 4) NOT NULL DEFAULT 0,      -- por unidad base
    existencia_antes INTEGER,
    CONSTRAINT regulacion_item_un_concepto CHECK ((medicina_id IS NULL) <> (articulo_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_regulacion_items ON regulacion_inventario_items (regulacion_id);

COMMIT;
