-- ============================================
-- MIGRACIÓN: ESTADO DE CUENTA Y SALDO
-- Fecha: 2026-07-01
-- Descripción: Agregar campos y tablas necesarias para Estado de Cuenta
-- ============================================

-- ============================================
-- 1. MODIFICAR TABLA venta_items - Agregar campo tipo_item
-- ============================================

-- Verificar si el campo ya existe antes de agregarlo
ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS tipo_item VARCHAR(50) DEFAULT 'general';

-- Comentario sobre categorías válidas
-- Valores permitidos: internamiento, medicamentos, insumos, equipo_medico, examenes, honorarios, extras, general

-- ============================================
-- 2. MODIFICAR TABLA ventas - Agregar campos para facturación mejorada
-- ============================================

-- Agregar campos si no existen
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS total_descuentos DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS base_impuesto DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS total_impuestos DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS tipo_factura VARCHAR(50) DEFAULT 'normal';

-- Actualizar campos existentes si están NULL
UPDATE ventas SET total_descuentos = descuento WHERE total_descuentos = 0;
UPDATE ventas SET base_impuesto = (subtotal - descuento) WHERE base_impuesto = 0;
UPDATE ventas SET total_impuestos = impuesto WHERE total_impuestos = 0;

-- ============================================
-- 3. CREAR TABLA pacientes_saldo
-- ============================================

CREATE TABLE IF NOT EXISTS pacientes_saldo (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER NOT NULL UNIQUE REFERENCES pacientes(id) ON DELETE CASCADE,
    saldo_pendiente DECIMAL(15, 2) DEFAULT 0.00,
    total_deuda DECIMAL(15, 2) DEFAULT 0.00,
    ultima_transaccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_actualizo VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. CREAR TABLA movimientos_paciente (Historial de transacciones)
-- ============================================

CREATE TABLE IF NOT EXISTS movimientos_paciente (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT,
    monto DECIMAL(15, 2) NOT NULL,
    saldo_anterior DECIMAL(15, 2),
    saldo_nuevo DECIMAL(15, 2),
    referencia_id VARCHAR(50),
    usuario_id INTEGER REFERENCES users(id),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. CREAR ÍNDICES para mejor performance
-- ============================================

-- Índices para pacientes_saldo
CREATE INDEX IF NOT EXISTS idx_pacientes_saldo_paciente_id ON pacientes_saldo(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_saldo_saldo_pendiente ON pacientes_saldo(saldo_pendiente);

-- Índices para movimientos_paciente
CREATE INDEX IF NOT EXISTS idx_movimientos_paciente_id ON movimientos_paciente(paciente_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos_paciente(tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_paciente(fecha);

-- Índices para venta_items y ventas
CREATE INDEX IF NOT EXISTS idx_venta_items_tipo_item ON venta_items(tipo_item);
CREATE INDEX IF NOT EXISTS idx_venta_items_venta_id ON venta_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_ventas_paciente_id ON ventas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);

-- ============================================
-- 6. INICIALIZAR pacientes_saldo para pacientes existentes
-- ============================================

-- Insertar registros de saldo para pacientes sin saldo registrado
INSERT INTO pacientes_saldo (
    paciente_id, 
    saldo_pendiente, 
    total_deuda, 
    usuario_actualizo
)
SELECT 
    p.id,
    0.00,
    0.00,
    'SYSTEM'
FROM pacientes p
WHERE p.id NOT IN (SELECT paciente_id FROM pacientes_saldo WHERE paciente_id IS NOT NULL)
ON CONFLICT (paciente_id) DO NOTHING;

-- ============================================
-- 7. VERIFICACIÓN FINAL
-- ============================================

-- Verificar que los campos existan
SELECT 
    'venta_items' as tabla,
    COUNT(*) as registros,
    MAX(created_at) as ultimo_registro
FROM venta_items
UNION ALL
SELECT 
    'pacientes_saldo',
    COUNT(*),
    MAX(created_at)
FROM pacientes_saldo;

-- ============================================
-- FIN DE MIGRACIÓN
-- ============================================
-- Status: ✅ Listo
-- Próximo paso: Cargar datos de ejemplo con facturacion-datos-ejemplo.sql
-- ============================================
