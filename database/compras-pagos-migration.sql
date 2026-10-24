-- ============================================
-- PAGO DE LAS COMPRAS
-- - Proveedor: banco, número y tipo de cuenta (a dónde se le paga).
-- - Compra: condición (pago inmediato o crédito con sus días y vencimiento),
--   forma de pago (efectivo, tarjeta, cheque, transferencia), referencia y fecha del pago.
-- - Vouchers del pago (PDF o imagen) guardados en la base (BYTEA), como los PDF de laboratorio.
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================

BEGIN;

ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS banco VARCHAR(80);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS numero_cuenta VARCHAR(40);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS tipo_cuenta VARCHAR(20);

ALTER TABLE compras ADD COLUMN IF NOT EXISTS condicion_pago VARCHAR(10) NOT NULL DEFAULT 'contado';
ALTER TABLE compras ADD COLUMN IF NOT EXISTS dias_credito INTEGER;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS fecha_vencimiento_pago DATE;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS forma_pago VARCHAR(15);
ALTER TABLE compras ADD COLUMN IF NOT EXISTS referencia_pago VARCHAR(60);
ALTER TABLE compras ADD COLUMN IF NOT EXISTS fecha_pago DATE;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compras_pago_valido') THEN
        ALTER TABLE compras ADD CONSTRAINT compras_pago_valido CHECK (
            condicion_pago IN ('contado', 'credito')
            AND (forma_pago IS NULL OR forma_pago IN ('efectivo', 'tarjeta', 'cheque', 'transferencia'))
            AND (condicion_pago = 'contado' OR dias_credito BETWEEN 1 AND 365)
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_compras_vencimiento_pago
    ON compras (fecha_vencimiento_pago) WHERE fecha_pago IS NULL;

CREATE TABLE IF NOT EXISTS compra_vouchers (
    id SERIAL PRIMARY KEY,
    compra_id VARCHAR(50) NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_contenido VARCHAR(40) NOT NULL
        CHECK (tipo_contenido IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
    tamano INTEGER NOT NULL,
    contenido BYTEA NOT NULL,
    subido_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
    subido_por_nombre VARCHAR(150) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compra_vouchers_compra ON compra_vouchers (compra_id);

COMMIT;
