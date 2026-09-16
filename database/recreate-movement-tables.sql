-- ============================================
-- Recreate movement tables with correct schema
-- ============================================

-- Drop dependent views first
DROP VIEW IF EXISTS v_facturas_detalle CASCADE;

-- Drop tables in order
DROP TABLE IF EXISTS movimientos_paciente CASCADE;
DROP TABLE IF EXISTS pagos_paciente CASCADE;

-- Recreate movimientos_paciente with BIGSERIAL id
CREATE TABLE IF NOT EXISTS movimientos_paciente (
    id BIGSERIAL PRIMARY KEY,
    paciente_id INTEGER NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT,
    monto DECIMAL(15, 2) NOT NULL,
    saldo_anterior DECIMAL(15, 2),
    saldo_nuevo DECIMAL(15, 2),
    referencia_id VARCHAR(50),
    usuario_id INTEGER,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES users(id)
);

-- Recreate pagos_paciente with BIGSERIAL id
CREATE TABLE IF NOT EXISTS pagos_paciente (
    id BIGSERIAL PRIMARY KEY,
    paciente_id INTEGER NOT NULL,
    monto DECIMAL(15, 2) NOT NULL,
    metodo_pago VARCHAR(50) DEFAULT 'efectivo',
    referencia VARCHAR(100),
    observaciones TEXT,
    usuario_id INTEGER,
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES users(id)
);

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_movimientos_paciente_paciente_id ON movimientos_paciente(paciente_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_paciente_tipo ON movimientos_paciente(tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_paciente_fecha ON movimientos_paciente(fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_paciente_referencia_id ON movimientos_paciente(referencia_id);

CREATE INDEX IF NOT EXISTS idx_pagos_paciente_paciente_id ON pagos_paciente(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_paciente_fecha_pago ON pagos_paciente(fecha_pago);

-- Recreate dependent views if they existed
CREATE OR REPLACE VIEW v_facturas_detalle AS
SELECT 
    v.id, v.numero_factura, v.fecha, v.paciente_id,
    p.nombre AS paciente_nombre,
    v.subtotal, v.total_descuentos, v.total_impuestos, v.total,
    COUNT(vi.id) AS cantidad_items,
    v.metodo_pago, v.estado
FROM ventas_mejorada v
LEFT JOIN pacientes p ON v.paciente_id = p.id
LEFT JOIN venta_items_mejorada vi ON v.id = vi.venta_id
GROUP BY v.id, v.numero_factura, v.fecha, v.paciente_id, p.nombre, 
         v.subtotal, v.total_descuentos, v.total_impuestos, v.total,
         v.metodo_pago, v.estado
ORDER BY v.fecha DESC;
