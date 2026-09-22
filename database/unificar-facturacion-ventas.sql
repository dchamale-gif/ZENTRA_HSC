BEGIN;

ALTER TABLE ventas
    ADD COLUMN IF NOT EXISTS numero_factura VARCHAR(50),
    ADD COLUMN IF NOT EXISTS subtotal_original DECIMAL(12, 2),
    ADD COLUMN IF NOT EXISTS total_descuentos DECIMAL(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_impuestos DECIMAL(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS base_impuesto DECIMAL(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tipo_factura VARCHAR(50) DEFAULT 'normal';

CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_numero_factura_unique
    ON ventas(numero_factura) WHERE numero_factura IS NOT NULL;

ALTER TABLE venta_items
    ADD COLUMN IF NOT EXISTS descripcion TEXT,
    ADD COLUMN IF NOT EXISTS descuento DECIMAL(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total DECIMAL(12, 2),
    ADD COLUMN IF NOT EXISTS tipo_item VARCHAR(50) DEFAULT 'general';

CREATE TABLE IF NOT EXISTS pacientes_saldo (
    id SERIAL PRIMARY KEY,
    paciente_id VARCHAR(50) NOT NULL UNIQUE REFERENCES pacientes(id) ON DELETE CASCADE,
    saldo_pendiente DECIMAL(15, 2) DEFAULT 0,
    total_deuda DECIMAL(15, 2) DEFAULT 0,
    ultima_transaccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_actualizo VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movimientos_paciente (
    id SERIAL PRIMARY KEY,
    paciente_id VARCHAR(50) NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT,
    monto DECIMAL(15, 2) NOT NULL,
    saldo_anterior DECIMAL(15, 2),
    saldo_nuevo DECIMAL(15, 2),
    referencia_id VARCHAR(50),
    usuario_id INTEGER,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMIT;