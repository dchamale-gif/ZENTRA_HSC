-- ============================================
-- MIGRACIÓN: FACTURACIÓN MEJORADA E INTEGRACIÓN CON SALDO
-- Fecha: 2026-06-26
-- ============================================

-- Tabla de saldo de pacientes
CREATE TABLE IF NOT EXISTS pacientes_saldo (
    id VARCHAR(50) PRIMARY KEY,
    paciente_id INTEGER NOT NULL UNIQUE,
    saldo_pendiente DECIMAL(15, 2) DEFAULT 0.00,
    total_deuda DECIMAL(15, 2) DEFAULT 0.00,
    ultima_transaccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_actualizo VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pacientes_saldo_paciente_id ON pacientes_saldo(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_saldo_saldo_pendiente ON pacientes_saldo(saldo_pendiente);

-- Tabla mejorada de ventas (facturas)
CREATE TABLE IF NOT EXISTS ventas_mejorada (
    id VARCHAR(50) PRIMARY KEY,
    numero_factura VARCHAR(50) UNIQUE NOT NULL,
    paciente_id INTEGER,
    cliente_id VARCHAR(50),
    user_id INTEGER NOT NULL,
    fecha DATE NOT NULL,
    subtotal DECIMAL(15, 2) DEFAULT 0.00,
    total_descuentos DECIMAL(15, 2) DEFAULT 0.00,
    base_impuesto DECIMAL(15, 2) DEFAULT 0.00,
    total_impuestos DECIMAL(15, 2) DEFAULT 0.00,
    total DECIMAL(15, 2) DEFAULT 0.00,
    metodo_pago VARCHAR(50) DEFAULT 'efectivo',
    estado VARCHAR(50) DEFAULT 'completada',
    tipo_factura VARCHAR(50) DEFAULT 'normal',
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_ventas_mejorada_paciente_id ON ventas_mejorada(paciente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_mejorada_numero_factura ON ventas_mejorada(numero_factura);
CREATE INDEX IF NOT EXISTS idx_ventas_mejorada_fecha ON ventas_mejorada(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_mejorada_estado ON ventas_mejorada(estado);
CREATE INDEX IF NOT EXISTS idx_ventas_mejorada_fecha_paciente ON ventas_mejorada(fecha, paciente_id);

-- Tabla de items de ventas
CREATE TABLE IF NOT EXISTS venta_items_mejorada (
    id VARCHAR(50) PRIMARY KEY,
    venta_id VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    cantidad DECIMAL(10, 2) NOT NULL,
    precio_unitario DECIMAL(15, 2) NOT NULL,
    subtotal DECIMAL(15, 2) NOT NULL,
    descuento DECIMAL(15, 2) DEFAULT 0.00,
    total DECIMAL(15, 2) NOT NULL,
    tipo_item VARCHAR(50) DEFAULT 'general',
    medicina_id VARCHAR(50),
    articulo_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (venta_id) REFERENCES ventas_mejorada(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_venta_items_mejorada_venta_id ON venta_items_mejorada(venta_id);

-- Tabla de descuentos de items
CREATE TABLE IF NOT EXISTS venta_item_descuentos_mejorada (
    id VARCHAR(50) PRIMARY KEY,
    venta_item_id VARCHAR(50) NOT NULL,
    tipo_descuento VARCHAR(20),
    valor DECIMAL(10, 2),
    monto_descuento DECIMAL(15, 2),
    motivo TEXT,
    usuario_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (venta_item_id) REFERENCES venta_items_mejorada(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_venta_item_descuentos_mejorada_venta_item_id ON venta_item_descuentos_mejorada(venta_item_id);

-- Tabla de descuentos de factura
CREATE TABLE IF NOT EXISTS venta_descuentos_mejorada (
    id VARCHAR(50) PRIMARY KEY,
    venta_id VARCHAR(50) NOT NULL,
    tipo_descuento VARCHAR(20),
    valor DECIMAL(10, 2),
    monto_descuento DECIMAL(15, 2),
    motivo TEXT,
    usuario_id INTEGER,
    codigo_aplicado VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (venta_id) REFERENCES ventas_mejorada(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_venta_descuentos_mejorada_venta_id ON venta_descuentos_mejorada(venta_id);

-- Tabla de movimientos de paciente (historial de saldo)
CREATE TABLE IF NOT EXISTS movimientos_paciente (
    id VARCHAR(50) PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS idx_movimientos_paciente_paciente_id ON movimientos_paciente(paciente_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_paciente_tipo ON movimientos_paciente(tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_paciente_fecha ON movimientos_paciente(fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_paciente_referencia_id ON movimientos_paciente(referencia_id);

-- Tabla de pagos (abonos a saldo)
CREATE TABLE IF NOT EXISTS pagos_paciente (
    id VARCHAR(50) PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS idx_pagos_paciente_paciente_id ON pagos_paciente(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_paciente_fecha_pago ON pagos_paciente(fecha_pago);

-- ============================================
-- ACTUALIZAR TABLA VENTAS EXISTENTE
-- ============================================

-- Agregar columnas a la tabla ventas si no existen
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS subtotal_original DECIMAL(15, 2) DEFAULT 0.00;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS total_descuentos DECIMAL(15, 2) DEFAULT 0.00;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS total_impuestos DECIMAL(15, 2) DEFAULT 0.00;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS tipo_factura VARCHAR(50) DEFAULT 'normal';

-- ============================================
-- VISTAS ÚTILES
-- ============================================

-- Vista de resumen de saldos
CREATE OR REPLACE VIEW v_saldo_pacientes_resumen AS
SELECT 
    ps.id,
    ps.paciente_id,
    p.nombre,
    p.apellidoPaterno,
    p.apellidoMaterno,
    p.dpi,
    p.telefono,
    ps.saldo_pendiente,
    ps.total_deuda,
    ps.ultima_transaccion,
    CASE 
        WHEN ps.saldo_pendiente = 0 THEN 'Pagado'
        WHEN ps.saldo_pendiente > 0 THEN 'Deudor'
        ELSE 'Acreedor'
    END AS estado,
    EXTRACT(DAY FROM CURRENT_DATE - DATE(ps.ultima_transaccion))::int AS dias_desde_transaccion
FROM pacientes_saldo ps
LEFT JOIN pacientes p ON ps.paciente_id = p.id
ORDER BY ps.saldo_pendiente DESC;

-- Vista de detalles de facturas
CREATE OR REPLACE VIEW v_facturas_detalle AS
SELECT 
    v.id,
    v.numero_factura,
    v.paciente_id,
    (p.nombre || ' ' || p.apellidoPaterno) AS paciente_nombre,
    v.fecha,
    v.subtotal,
    v.total_descuentos,
    v.base_impuesto,
    v.total_impuestos,
    v.total,
    v.metodo_pago,
    v.estado,
    u.nombre AS usuario_nombre
FROM ventas_mejorada v
LEFT JOIN pacientes p ON v.paciente_id = p.id
LEFT JOIN users u ON v.user_id = u.id
ORDER BY v.fecha DESC;

-- ============================================
-- TRIGGERS PARA AUTO-UPDATE DE TIMESTAMP
-- ============================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para pacientes_saldo
CREATE TRIGGER update_pacientes_saldo_updated_at BEFORE UPDATE
    ON pacientes_saldo FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para ventas_mejorada
CREATE TRIGGER update_ventas_mejorada_updated_at BEFORE UPDATE
    ON ventas_mejorada FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INSERCIONES DE DATOS DE PRUEBA (OPCIONAL)
-- ============================================

-- Insertar datos de prueba (comentar si no es necesario)
/*
INSERT INTO pacientes_saldo (id, paciente_id, saldo_pendiente, total_deuda, usuario_actualizo)
SELECT 'SALDO-' || p.id, p.id, 0, 0, 'SYSTEM'
FROM pacientes p
WHERE NOT EXISTS (SELECT 1 FROM pacientes_saldo ps WHERE ps.paciente_id = p.id);
*/

-- ============================================
-- FIN DE MIGRACIÓN
-- ============================================
