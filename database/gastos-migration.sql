-- ============================================
-- GASTOS (luz, agua, internet, teléfono…)
-- Se registran como una requisición (fecha de creación), se cargan para que
-- el dueño los pague (fecha de carga) y quedan en espera hasta el pago.
-- El listado muestra cuántos días lleva cada gasto esperando.
-- Correlativo por año: GAS-0001-2026.
-- Idempotente: se puede ejecutar varias veces.
-- Uso: cd backend && npm run migrate:gastos
-- ============================================

BEGIN;

-- Mismo contador que usan requerimientos y compras (ver requerimientos-compra-migration.sql)
CREATE TABLE IF NOT EXISTS correlativos (
    tipo VARCHAR(20) NOT NULL,
    ambito VARCHAR(10) NOT NULL,
    anio INTEGER NOT NULL,
    ultimo INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tipo, ambito, anio)
);

CREATE TABLE IF NOT EXISTS gastos (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    categoria VARCHAR(60) NOT NULL,
    proveedor VARCHAR(150),
    descripcion TEXT,
    numero_factura VARCHAR(60),
    fecha_factura DATE,
    monto NUMERIC(12, 2) NOT NULL,
    estado VARCHAR(12) NOT NULL DEFAULT 'pendiente',
    fecha_cargo DATE,
    fecha_pago DATE,
    forma_pago VARCHAR(15),
    referencia_pago VARCHAR(60),
    motivo_anulacion TEXT,
    registrado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
    registrado_por_nombre VARCHAR(150) NOT NULL DEFAULT '',
    actualizado_por_nombre VARCHAR(150),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT gastos_monto_valido CHECK (monto > 0),
    CONSTRAINT gastos_estado_valido CHECK (estado IN ('pendiente', 'cargado', 'pagado', 'anulado')),
    CONSTRAINT gastos_forma_pago_valida CHECK (forma_pago IS NULL OR forma_pago IN ('efectivo', 'tarjeta', 'cheque', 'transferencia')),
    -- Cargado lleva su fecha de carga; pagado, además, su fecha y forma de pago
    CONSTRAINT gastos_fechas_validas CHECK (
        (estado <> 'cargado' OR fecha_cargo IS NOT NULL)
        AND (estado <> 'pagado' OR (fecha_cargo IS NOT NULL AND fecha_pago IS NOT NULL AND forma_pago IS NOT NULL))
    )
);

CREATE INDEX IF NOT EXISTS idx_gastos_estado ON gastos (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gastos_creado ON gastos (created_at DESC);

COMMIT;
