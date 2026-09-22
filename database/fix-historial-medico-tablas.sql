-- Migración: Actualizar historial_medico y crear tablas laboratorios, ordenes, alertas
-- Fecha: 2026-09-21
-- Descripción: Agregar campos COEX a historial_medico, cambiar id a SERIAL, crear tablas para laboratorios, órdenes y alertas

BEGIN;

-- ===== TABLA HISTORIAL_MEDICO =====
-- Crear tabla temporal con la nueva estructura
CREATE TABLE historial_medico_new (
    id SERIAL PRIMARY KEY,
    paciente_id VARCHAR(50) NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    padece_cronica BOOLEAN,
    especificacion_cronica TEXT,
    toma_medicamento BOOLEAN,
    especificacion_medicamento TEXT,
    padece_alergia BOOLEAN,
    especificacion_alergia TEXT,
    utiliza_protesis BOOLEAN,
    especificacion_protesis TEXT,
    ha_convulsionado BOOLEAN,
    ultimo_procedimiento VARCHAR(255),
    fecha_procedimiento DATE,
    examenes_lab VARCHAR(255),
    fecha_examenes DATE,
    ultimo_periodo DATE,
    edad_primera_menstruacion INTEGER,
    cantidad_gestas INTEGER,
    cantidad_partos INTEGER,
    tuvo_embarazos BOOLEAN,
    cantidad_embarazos_hist INTEGER,
    dias_periodo_hist INTEGER,
    tratamiento_psiquiatrico BOOLEAN,
    tipo_sustancia VARCHAR(255),
    tiempo_consumo VARCHAR(100),
    frecuencia_consumo VARCHAR(50),
    via_administracion VARCHAR(100),
    intentos_rehabilitacion INTEGER,
    ultimo_tratamiento DATE,
    motivacion_tratamiento TEXT,
    comorbilidad BOOLEAN,
    especificacion_comorbilidad TEXT,
    antecedentes_legales BOOLEAN,
    especificacion_legales TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copiar datos existentes
INSERT INTO historial_medico_new (
    paciente_id, padece_cronica, especificacion_cronica, toma_medicamento, 
    especificacion_medicamento, padece_alergia, especificacion_alergia,
    utiliza_protesis, especificacion_protesis, ha_convulsionado,
    ultimo_procedimiento, fecha_procedimiento, examenes_lab, fecha_examenes,
    ultimo_periodo, edad_primera_menstruacion, cantidad_gestas, cantidad_partos,
    tratamiento_psiquiatrico, created_at, updated_at
)
SELECT 
    paciente_id, padece_cronica, especificacion_cronica, toma_medicamento,
    especificacion_medicamento, padece_alergia, especificacion_alergia,
    utiliza_protesis, especificacion_protesis, ha_convulsionado,
    ultimo_procedimiento, fecha_procedimiento, examenes_lab, fecha_examenes,
    ultimo_periodo, edad_primera_menstruacion, cantidad_gestas, cantidad_partos,
    tratamiento_psiquiatrico, created_at, updated_at
FROM historial_medico
ON CONFLICT DO NOTHING;

-- Eliminar tabla antigua
DROP TABLE IF EXISTS historial_medico;

-- Renombrar tabla nueva
ALTER TABLE historial_medico_new RENAME TO historial_medico;

-- ===== TABLA LABORATORIOS =====
CREATE TABLE IF NOT EXISTS laboratorios (
    id SERIAL PRIMARY KEY,
    paciente_id VARCHAR(50) NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    tipo VARCHAR(150) NOT NULL,
    fecha DATE NOT NULL,
    resultado TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== TABLA ÓRDENES =====
CREATE TABLE IF NOT EXISTS ordenes (
    id SERIAL PRIMARY KEY,
    paciente_id VARCHAR(50) NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT NOT NULL,
    estado VARCHAR(50) DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== TABLA ALERTAS =====
CREATE TABLE IF NOT EXISTS alertas (
    id SERIAL PRIMARY KEY,
    paciente_id VARCHAR(50) NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== ÍNDICES =====
CREATE INDEX IF NOT EXISTS idx_historial_medico_paciente ON historial_medico(paciente_id);
CREATE INDEX IF NOT EXISTS idx_laboratorios_paciente ON laboratorios(paciente_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_paciente ON ordenes(paciente_id);
CREATE INDEX IF NOT EXISTS idx_alertas_paciente ON alertas(paciente_id);

COMMIT;
