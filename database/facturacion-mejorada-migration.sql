-- ============================================
-- MIGRACIÓN: FACTURACIÓN MEJORADA E INTEGRACIÓN CON SALDO
-- Fecha: 2026-06-26
-- ============================================

-- Tabla de saldo de pacientes
CREATE TABLE IF NOT EXISTS pacientes_saldo (
    id VARCHAR(50) PRIMARY KEY,
    paciente_id VARCHAR(50) NOT NULL UNIQUE,
    saldo_pendiente DECIMAL(15, 2) DEFAULT 0.00,
    total_deuda DECIMAL(15, 2) DEFAULT 0.00,
    ultima_transaccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_actualizo VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    INDEX idx_paciente_id (paciente_id),
    INDEX idx_saldo_pendiente (saldo_pendiente)
);

-- Tabla mejorada de ventas (facturas)
CREATE TABLE IF NOT EXISTS ventas_mejorada (
    id VARCHAR(50) PRIMARY KEY,
    numero_factura VARCHAR(50) UNIQUE NOT NULL,
    paciente_id VARCHAR(50),
    cliente_id VARCHAR(50),
    user_id VARCHAR(50) NOT NULL,
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_paciente_id (paciente_id),
    INDEX idx_numero_factura (numero_factura),
    INDEX idx_fecha (fecha),
    INDEX idx_estado (estado)
);

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
    FOREIGN KEY (venta_id) REFERENCES ventas_mejorada(id) ON DELETE CASCADE,
    INDEX idx_venta_id (venta_id)
);

-- Tabla de descuentos de items
CREATE TABLE IF NOT EXISTS venta_item_descuentos_mejorada (
    id VARCHAR(50) PRIMARY KEY,
    venta_item_id VARCHAR(50) NOT NULL,
    tipo_descuento VARCHAR(20),
    valor DECIMAL(10, 2),
    monto_descuento DECIMAL(15, 2),
    motivo TEXT,
    usuario_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (venta_item_id) REFERENCES venta_items_mejorada(id) ON DELETE CASCADE,
    INDEX idx_venta_item_id (venta_item_id)
);

-- Tabla de descuentos de factura
CREATE TABLE IF NOT EXISTS venta_descuentos_mejorada (
    id VARCHAR(50) PRIMARY KEY,
    venta_id VARCHAR(50) NOT NULL,
    tipo_descuento VARCHAR(20),
    valor DECIMAL(10, 2),
    monto_descuento DECIMAL(15, 2),
    motivo TEXT,
    usuario_id VARCHAR(50),
    codigo_aplicado VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (venta_id) REFERENCES ventas_mejorada(id) ON DELETE CASCADE,
    INDEX idx_venta_id (venta_id)
);

-- Tabla de movimientos de paciente (historial de saldo)
CREATE TABLE IF NOT EXISTS movimientos_paciente (
    id VARCHAR(50) PRIMARY KEY,
    paciente_id VARCHAR(50) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT,
    monto DECIMAL(15, 2) NOT NULL,
    saldo_anterior DECIMAL(15, 2),
    saldo_nuevo DECIMAL(15, 2),
    referencia_id VARCHAR(50),
    usuario_id VARCHAR(50),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES users(id),
    INDEX idx_paciente_id (paciente_id),
    INDEX idx_tipo (tipo),
    INDEX idx_fecha (fecha),
    INDEX idx_referencia_id (referencia_id)
);

-- Tabla de pagos (abonos a saldo)
CREATE TABLE IF NOT EXISTS pagos_paciente (
    id VARCHAR(50) PRIMARY KEY,
    paciente_id VARCHAR(50) NOT NULL,
    monto DECIMAL(15, 2) NOT NULL,
    metodo_pago VARCHAR(50) DEFAULT 'efectivo',
    referencia VARCHAR(100),
    observaciones TEXT,
    usuario_id VARCHAR(50),
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES users(id),
    INDEX idx_paciente_id (paciente_id),
    INDEX idx_fecha_pago (fecha_pago)
);

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
    DATEDIFF(CURDATE(), DATE(ps.ultima_transaccion)) AS dias_desde_transaccion
FROM pacientes_saldo ps
LEFT JOIN pacientes p ON ps.paciente_id = p.id
ORDER BY ps.saldo_pendiente DESC;

-- Vista de detalles de facturas
CREATE OR REPLACE VIEW v_facturas_detalle AS
SELECT 
    v.id,
    v.numero_factura,
    v.paciente_id,
    CONCAT(p.nombre, ' ', p.apellidoPaterno) AS paciente_nombre,
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
-- ÍNDICES ADICIONALES PARA RENDIMIENTO
-- ============================================

CREATE INDEX IF NOT EXISTS idx_movimientos_paciente_fecha ON movimientos_paciente(fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_paciente_tipo ON movimientos_paciente(tipo);
CREATE INDEX IF NOT EXISTS idx_pagos_paciente_fecha ON pagos_paciente(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha_paciente ON ventas_mejorada(fecha, paciente_id);

-- ============================================
-- INSERCIONES DE DATOS DE PRUEBA (OPCIONAL)
-- ============================================

-- Insertar datos de prueba (comentar si no es necesario)
/*
INSERT INTO pacientes_saldo (id, paciente_id, saldo_pendiente, total_deuda, usuario_actualizo)
SELECT CONCAT('SALDO-', p.id), p.id, 0, 0, 'SYSTEM'
FROM pacientes p
WHERE NOT EXISTS (SELECT 1 FROM pacientes_saldo ps WHERE ps.paciente_id = p.id);
*/

-- ============================================
-- FIN DE MIGRACIÓN
-- ============================================
