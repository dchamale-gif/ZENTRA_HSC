-- ============================================
-- INVENTARIO DE MEDICINAS POR UNIDADES DE MEDIDA
-- La existencia se lleva en la unidad base (p. ej. tableta). Cada medicina puede tener
-- presentaciones (caja, blíster…) con su factor de conversión, precio y código de barras.
-- Cada entrada y salida queda en el kárdex (medicina_movimientos).
-- Ventas y compras guardan la presentación usada y su equivalente en unidades base.
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================

BEGIN;

DO $$
DECLARE
    tipo_medicina TEXT;
    tipo_paciente TEXT;
BEGIN
    IF to_regclass('public.medicinas') IS NULL THEN
        RAISE EXCEPTION 'No existe la tabla medicinas';
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod) INTO tipo_medicina
    FROM pg_attribute a
    WHERE a.attrelid = 'public.medicinas'::regclass AND a.attname = 'id' AND NOT a.attisdropped;

    ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS unidad_base VARCHAR(30) NOT NULL DEFAULT 'Unidad';

    -- Presentaciones: la unidad base no se guarda aquí (su factor es 1 y su precio es medicinas.precio_venta)
    IF to_regclass('public.medicina_presentaciones') IS NULL THEN
        EXECUTE format(
            'CREATE TABLE medicina_presentaciones (
                id SERIAL PRIMARY KEY,
                medicina_id %s NOT NULL REFERENCES medicinas(id) ON DELETE CASCADE,
                nombre VARCHAR(40) NOT NULL,
                factor INTEGER NOT NULL CHECK (factor >= 2),
                precio_venta NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
                codigo_barra VARCHAR(60),
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )', tipo_medicina);
        CREATE UNIQUE INDEX idx_presentaciones_nombre ON medicina_presentaciones(medicina_id, lower(nombre));
        CREATE INDEX idx_presentaciones_codigo ON medicina_presentaciones(codigo_barra) WHERE codigo_barra IS NOT NULL;
    END IF;

    -- Kárdex: cantidad en unidades base, positiva al entrar y negativa al salir
    IF to_regclass('public.medicina_movimientos') IS NULL THEN
        SELECT format_type(a.atttypid, a.atttypmod) INTO tipo_paciente
        FROM pg_attribute a
        WHERE a.attrelid = 'public.pacientes'::regclass AND a.attname = 'id' AND NOT a.attisdropped;

        EXECUTE format(
            'CREATE TABLE medicina_movimientos (
                id SERIAL PRIMARY KEY,
                medicina_id %s NOT NULL REFERENCES medicinas(id) ON DELETE CASCADE,
                fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                tipo VARCHAR(20) NOT NULL CHECK (tipo IN (''inicial'', ''ingreso_compra'', ''reversion_compra'', ''venta'',
                    ''devolucion_venta'', ''consumo_interno'', ''ajuste''))
                ,
                cantidad INTEGER NOT NULL CHECK (cantidad <> 0),
                existencia_resultante INTEGER NOT NULL,
                presentacion VARCHAR(40),
                cantidad_presentacion INTEGER,
                factor INTEGER NOT NULL DEFAULT 1,
                costo_unitario NUMERIC(12, 4),
                referencia VARCHAR(80),
                paciente_id %s REFERENCES pacientes(id) ON DELETE SET NULL,
                motivo TEXT NOT NULL DEFAULT '''',
                usuario_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                usuario_nombre VARCHAR(150) NOT NULL DEFAULT ''''
            )', tipo_medicina, tipo_paciente);
        CREATE INDEX idx_movimientos_medicina ON medicina_movimientos(medicina_id, fecha DESC, id DESC);

        -- Saldo inicial: la existencia que ya tenía cada medicina
        INSERT INTO medicina_movimientos (medicina_id, tipo, cantidad, existencia_resultante, motivo, usuario_nombre)
        SELECT id, 'inicial', cantidad, cantidad, 'Existencia al activar el kárdex', 'Sistema'
        FROM medicinas WHERE cantidad > 0;
    END IF;

    -- Ventas y compras: presentación usada y su equivalente en unidades base
    IF to_regclass('public.venta_items') IS NOT NULL THEN
        ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS presentacion_id INTEGER;
        ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS presentacion_nombre VARCHAR(40);
        ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS factor INTEGER NOT NULL DEFAULT 1;
    END IF;
    IF to_regclass('public.compra_items') IS NOT NULL THEN
        ALTER TABLE compra_items ADD COLUMN IF NOT EXISTS presentacion_id INTEGER;
        ALTER TABLE compra_items ADD COLUMN IF NOT EXISTS presentacion_nombre VARCHAR(40);
        ALTER TABLE compra_items ADD COLUMN IF NOT EXISTS factor INTEGER NOT NULL DEFAULT 1;
    END IF;
    -- Una compra suma al inventario al marcarse recibida; las recibidas antes de esto no habían sumado
    IF to_regclass('public.compras') IS NOT NULL THEN
        ALTER TABLE compras ADD COLUMN IF NOT EXISTS inventario_aplicado BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

COMMIT;
