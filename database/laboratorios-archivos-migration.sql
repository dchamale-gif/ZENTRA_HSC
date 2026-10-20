-- ============================================
-- PDF DE RESULTADOS DE LABORATORIO
-- Crea la tabla de laboratorios si falta y la de sus PDF.
-- Cada laboratorio del paciente puede tener uno o varios PDF.
-- El archivo se guarda en la base (BYTEA), igual que otros documentos del paciente.
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================

BEGIN;

-- Tabla de laboratorios: la usa el módulo desde antes, pero hay bases donde nunca se creó.
-- paciente_id toma el mismo tipo que pacientes.id en esta base (texto o número).
DO $$
DECLARE
    tipo_paciente TEXT;
BEGIN
    IF to_regclass('public.laboratorios') IS NULL THEN
        SELECT format_type(a.atttypid, a.atttypmod) INTO tipo_paciente
        FROM pg_attribute a
        WHERE a.attrelid = 'public.pacientes'::regclass AND a.attname = 'id' AND NOT a.attisdropped;

        EXECUTE format(
            'CREATE TABLE laboratorios (
                id SERIAL PRIMARY KEY,
                paciente_id %s NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
                tipo VARCHAR(150) NOT NULL,
                fecha DATE NOT NULL,
                resultado TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )', tipo_paciente);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_laboratorios_paciente ON laboratorios(paciente_id, fecha DESC);

CREATE TABLE IF NOT EXISTS laboratorio_archivos (
    id SERIAL PRIMARY KEY,
    laboratorio_id INTEGER NOT NULL REFERENCES laboratorios(id) ON DELETE CASCADE,
    nombre_archivo VARCHAR(255) NOT NULL,
    tamano INTEGER NOT NULL,
    contenido BYTEA NOT NULL,
    subido_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
    subido_por_nombre VARCHAR(150) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_laboratorio_archivos_lab ON laboratorio_archivos(laboratorio_id);

COMMIT;
