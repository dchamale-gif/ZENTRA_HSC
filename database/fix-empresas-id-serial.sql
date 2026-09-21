-- Migración: Cambiar id de empresas de VARCHAR a SERIAL
-- Problema: INSERT fallaba porque id no tenía valor por defecto

-- Si la tabla tiene datos, necesitamos hacer backup y reconstruir
BEGIN;

-- Crear tabla temporal con la nueva estructura
CREATE TABLE empresas_new (
    id SERIAL PRIMARY KEY,
    paciente_id VARCHAR(50) NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    nombre VARCHAR(150),
    telefono VARCHAR(20),
    direccion VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copiar datos si existen (sin id, se regenerarán)
INSERT INTO empresas_new (paciente_id, nombre, telefono, direccion, created_at, updated_at)
SELECT paciente_id, nombre, telefono, direccion, created_at, updated_at
FROM empresas
ON CONFLICT DO NOTHING;

-- Eliminar tabla antigua
DROP TABLE empresas;

-- Renombrar tabla nueva
ALTER TABLE empresas_new RENAME TO empresas;

COMMIT;
