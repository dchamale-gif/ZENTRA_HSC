-- Migración: Cambiar datos_familia y responsables_paciente id de VARCHAR a SERIAL

BEGIN;

-- ============================================
-- 1. DATOS_FAMILIA - Cambiar id a SERIAL
-- ============================================

-- Crear tabla temporal
CREATE TABLE datos_familia_new (
    id SERIAL PRIMARY KEY,
    paciente_id VARCHAR(50) NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    padre_nombre VARCHAR(150),
    padre_vivo BOOLEAN,
    padre_ocupacion VARCHAR(100),
    padre_telefono VARCHAR(20),
    madre_nombre VARCHAR(150),
    madre_vivo BOOLEAN,
    madre_ocupacion VARCHAR(100),
    madre_telefono VARCHAR(20),
    pareja_nombre VARCHAR(150),
    pareja_vivo BOOLEAN,
    pareja_ocupacion VARCHAR(100),
    pareja_telefono VARCHAR(20),
    hermanos_numero INTEGER,
    hermanos_observaciones TEXT,
    hijos_numero INTEGER,
    hijos_observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copiar datos
INSERT INTO datos_familia_new (paciente_id, padre_nombre, padre_vivo, padre_ocupacion, padre_telefono, 
                               madre_nombre, madre_vivo, madre_ocupacion, madre_telefono,
                               pareja_nombre, pareja_vivo, pareja_ocupacion, pareja_telefono,
                               hermanos_numero, hermanos_observaciones, hijos_numero, hijos_observaciones,
                               created_at, updated_at)
SELECT paciente_id, padre_nombre, padre_vivo, padre_ocupacion, padre_telefono,
       madre_nombre, madre_vivo, madre_ocupacion, madre_telefono,
       pareja_nombre, pareja_vivo, pareja_ocupacion, pareja_telefono,
       hermanos_numero, hermanos_observaciones, hijos_numero, hijos_observaciones,
       created_at, updated_at
FROM datos_familia
ON CONFLICT DO NOTHING;

-- Eliminar tabla antigua
DROP TABLE datos_familia CASCADE;

-- Renombrar tabla nueva
ALTER TABLE datos_familia_new RENAME TO datos_familia;

-- ============================================
-- 2. RESPONSABLES_PACIENTE - Cambiar id a SERIAL
-- ============================================

-- Crear tabla temporal
CREATE TABLE responsables_paciente_new (
    id SERIAL PRIMARY KEY,
    paciente_id VARCHAR(50) NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    relacion VARCHAR(100),
    telefono VARCHAR(20),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copiar datos
INSERT INTO responsables_paciente_new (paciente_id, nombre, relacion, telefono, email, created_at, updated_at)
SELECT paciente_id, nombre, relacion, telefono, email, created_at, updated_at
FROM responsables_paciente
ON CONFLICT DO NOTHING;

-- Eliminar tabla antigua
DROP TABLE responsables_paciente CASCADE;

-- Renombrar tabla nueva
ALTER TABLE responsables_paciente_new RENAME TO responsables_paciente;

-- Recrear índices
CREATE INDEX idx_datos_familia_paciente ON datos_familia(paciente_id);
CREATE INDEX idx_responsables_paciente ON responsables_paciente(paciente_id);

COMMIT;
