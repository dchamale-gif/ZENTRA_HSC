-- ============================================
-- EXTENSIÓN SCHEMA: FACTURACIÓN ROBUSTA
-- Descuentos por Porcentaje y Cantidad Fija
-- ============================================

-- ============================================
-- TABLA DE TIPOS DE DESCUENTOS
-- ============================================
CREATE TABLE IF NOT EXISTS tipos_descuentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    codigo VARCHAR(50) UNIQUE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA DE DESCUENTOS (Configuraciones predefinidas)
-- ============================================
CREATE TABLE IF NOT EXISTS descuentos (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    tipo_descuento VARCHAR(20) NOT NULL, -- 'porcentaje' o 'fijo'
    valor DECIMAL(10, 2) NOT NULL, -- Porcentaje (0-100) o cantidad fija
    minimo_aplicable DECIMAL(12, 2) DEFAULT 0, -- Monto mínimo para aplicar el descuento
    maximo_uso INTEGER DEFAULT NULL, -- NULL = sin límite
    usos_realizados INTEGER DEFAULT 0,
    codigo_promocion VARCHAR(50), -- Código para aplicar el descuento
    activo BOOLEAN DEFAULT true,
    fecha_inicio DATE,
    fecha_fin DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA DE DESCUENTOS POR ITEM EN VENTA
-- ============================================
CREATE TABLE IF NOT EXISTS venta_item_descuentos (
    id VARCHAR(50) PRIMARY KEY,
    venta_item_id VARCHAR(50) NOT NULL REFERENCES venta_items(id) ON DELETE CASCADE,
    tipo_descuento VARCHAR(20) NOT NULL, -- 'porcentaje' o 'fijo'
    valor DECIMAL(10, 2) NOT NULL,
    monto_descuento DECIMAL(12, 2) NOT NULL,
    motivo VARCHAR(255),
    usuario_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA DE DESCUENTOS EN NIVEL DE VENTA
-- ============================================
CREATE TABLE IF NOT EXISTS venta_descuentos (
    id VARCHAR(50) PRIMARY KEY,
    venta_id VARCHAR(50) NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    descuento_id VARCHAR(50) REFERENCES descuentos(id),
    tipo_descuento VARCHAR(20) NOT NULL, -- 'porcentaje' o 'fijo'
    valor DECIMAL(10, 2) NOT NULL,
    monto_descuento DECIMAL(12, 2) NOT NULL,
    codigo_aplicado VARCHAR(50),
    motivo VARCHAR(255),
    usuario_id INTEGER REFERENCES users(id),
    aplicado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- EXTENDER TABLA VENTAS
-- ============================================
-- Se agrega campo para subtotal antes de descuentos e impuestos
ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS subtotal_original DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS total_descuentos DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_impuestos DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS numero_factura VARCHAR(50),
ADD COLUMN IF NOT EXISTS referencia VARCHAR(255),
ADD COLUMN IF NOT EXISTS tipo_factura VARCHAR(20) DEFAULT 'normal'; -- normal, nota_credito, nota_debito

-- ============================================
-- TABLA DE CONFIGURACIÓN DE IMPUESTOS
-- ============================================
CREATE TABLE IF NOT EXISTS configuracion_impuestos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    porcentaje DECIMAL(5, 2) NOT NULL,
    activo BOOLEAN DEFAULT true,
    es_predeterminado BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA DE HISTORIAL DE CAMBIOS DE PRECIOS
-- ============================================
CREATE TABLE IF NOT EXISTS venta_historial_cambios (
    id VARCHAR(50) PRIMARY KEY,
    venta_id VARCHAR(50) NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    campo_modificado VARCHAR(100),
    valor_anterior TEXT,
    valor_nuevo TEXT,
    motivo VARCHAR(255),
    usuario_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================
CREATE INDEX IF NOT EXISTS idx_descuentos_activo ON descuentos(activo);
CREATE INDEX IF NOT EXISTS idx_descuentos_codigo ON descuentos(codigo_promocion);
CREATE INDEX IF NOT EXISTS idx_descuentos_fecha ON descuentos(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_venta_descuentos_venta ON venta_descuentos(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_descuentos_descuento ON venta_descuentos(descuento_id);
CREATE INDEX IF NOT EXISTS idx_venta_item_descuentos_item ON venta_item_descuentos(venta_item_id);
CREATE INDEX IF NOT EXISTS idx_venta_historial_cambios_venta ON venta_historial_cambios(venta_id);
CREATE INDEX IF NOT EXISTS idx_configuracion_impuestos_activo ON configuracion_impuestos(activo);
