-- Migración: Cambiar contactos_emergencia para soportar SERIAL id y múltiples contactos
-- Problema: id VARCHAR, no hay campo para diferenciar contacto principal vs secundario

BEGIN;

-- Crear tabla nueva con estructura mejorada
CREATE TABLE contactos_emergencia_new (
    id SERIAL PRIMARY KEY,
    paciente_id VARCHAR(50) NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    nombre VARCHAR(150),
    telefono VARCHAR(20),
    parentesco VARCHAR(50),
    direccion VARCHAR(255),
    tipo VARCHAR(20) DEFAULT 'principal', -- 'principal' o 'secundario'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copiar datos existentes (si los hay)
INSERT INTO contactos_emergencia_new (paciente_id, nombre, telefono, parentesco, tipo, created_at, updated_at)
SELECT paciente_id, nombre, telefono, parentesco, 'principal', created_at, updated_at
FROM contactos_emergencia
ON CONFLICT DO NOTHING;

-- Eliminar tabla antigua
DROP TABLE contactos_emergencia;

-- Renombrar tabla nueva
ALTER TABLE contactos_emergencia_new RENAME TO contactos_emergencia;

-- Recrear índice
CREATE INDEX idx_contactos_emergencia_paciente ON contactos_emergencia(paciente_id);

COMMIT;
