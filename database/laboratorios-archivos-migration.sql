-- ============================================
-- PDF DE RESULTADOS DE LABORATORIO
-- Cada laboratorio del paciente puede tener uno o varios PDF.
-- El archivo se guarda en la base (BYTEA), igual que otros documentos del paciente.
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================

BEGIN;

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
