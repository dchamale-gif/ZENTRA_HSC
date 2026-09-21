-- ============================================
-- MIGRACIÓN: Agregar Tabla Documentos del Paciente
-- Fecha: 2026-09-21
-- ============================================

-- Crear tabla documentos_paciente si no existe
CREATE TABLE IF NOT EXISTS documentos_paciente (
    id VARCHAR(50) PRIMARY KEY,
    paciente_id VARCHAR(50) NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    categoria VARCHAR(100),
    nombre_archivo VARCHAR(255),
    contenido TEXT,
    timestamp_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices si no existen (PostgreSQL 9.1+)
CREATE INDEX IF NOT EXISTS idx_documentos_paciente ON documentos_paciente(paciente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_categoria ON documentos_paciente(categoria);
CREATE INDEX IF NOT EXISTS idx_documentos_paciente_categoria ON documentos_paciente(paciente_id, categoria);

-- Comentario de la tabla
COMMENT ON TABLE documentos_paciente IS 'Documentos y fotografías del paciente (DPI, pasaporte, etc)';
COMMENT ON COLUMN documentos_paciente.id IS 'ID único del documento (UUID)';
COMMENT ON COLUMN documentos_paciente.paciente_id IS 'ID del paciente propietario del documento';
COMMENT ON COLUMN documentos_paciente.categoria IS 'Categoría: DPI_Paciente, Pasaporte_Paciente, DPI_Responsable, Pasaporte_Responsable, Foto_Perfil_Responsable, Documentos_Medicos, Otros';
COMMENT ON COLUMN documentos_paciente.nombre_archivo IS 'Nombre original del archivo/documento';
COMMENT ON COLUMN documentos_paciente.contenido IS 'Contenido en base64 del documento/fotografía';
COMMENT ON COLUMN documentos_paciente.timestamp_carga IS 'Fecha y hora de carga del documento';

-- ============================================
-- FIN DE MIGRACIÓN
-- ============================================
