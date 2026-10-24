-- ============================================
-- INVENTARIO DE BIENES (MOBILIARIO Y EQUIPO)
-- - Cada bien con su área, ubicación, estado y la fecha de ese estado.
-- - Historial de cada bien: alta, cambios de estado y bajas (con fecha y motivo).
-- - Si un paciente daña un bien, el cargo queda en su estado de cuenta (venta_id de la factura).
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS inventario_activos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    categoria VARCHAR(60),
    area VARCHAR(80) NOT NULL,
    ubicacion VARCHAR(120),
    marca VARCHAR(80),
    modelo VARCHAR(80),
    serie VARCHAR(80),
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad >= 0),
    valor_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
    fecha_adquisicion DATE,
    estado VARCHAR(20) NOT NULL DEFAULT 'bueno'
        CHECK (estado IN ('bueno', 'regular', 'malo', 'en_reparacion', 'dado_de_baja')),
    fecha_estado DATE NOT NULL DEFAULT CURRENT_DATE,
    notas TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventario_activos_area ON inventario_activos (area);
CREATE INDEX IF NOT EXISTS idx_inventario_activos_estado ON inventario_activos (estado);

CREATE TABLE IF NOT EXISTS inventario_activos_movimientos (
    id SERIAL PRIMARY KEY,
    activo_id INTEGER NOT NULL REFERENCES inventario_activos(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('alta', 'cambio_estado', 'baja', 'traslado')),
    fecha DATE NOT NULL,
    estado_anterior VARCHAR(20),
    estado_nuevo VARCHAR(20),
    area_anterior VARCHAR(80),
    area_nueva VARCHAR(80),
    cantidad INTEGER,
    motivo VARCHAR(40),
    detalle TEXT,
    paciente_id VARCHAR(50),
    paciente_nombre VARCHAR(200),
    venta_id VARCHAR(50),
    monto_cargado NUMERIC(12, 2),
    usuario_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    usuario_nombre VARCHAR(150) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventario_activos_mov_activo
    ON inventario_activos_movimientos (activo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventario_activos_mov_paciente
    ON inventario_activos_movimientos (paciente_id) WHERE paciente_id IS NOT NULL;

COMMIT;
