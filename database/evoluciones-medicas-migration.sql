-- ============================================
-- EVOLUCIÓN MÉDICA
-- Cada evolución queda dentro de una historia clínica, con fecha, médico y especialidad.
-- La escribe el médico (a su nombre); solo el admin la modifica o elimina, siempre con motivo,
-- y cada cambio queda registrado en evoluciones_medicas_cambios.
-- Requiere la migración de historias clínicas (npm run migrate:historias-clinicas).
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================

BEGIN;

DO $$
DECLARE
    tipo_paciente TEXT;
BEGIN
    IF to_regclass('public.historias_clinicas') IS NULL THEN
        RAISE EXCEPTION 'Primero ejecute: npm run migrate:historias-clinicas';
    END IF;

    IF to_regclass('public.evoluciones_medicas') IS NULL THEN
        SELECT format_type(a.atttypid, a.atttypmod) INTO tipo_paciente
        FROM pg_attribute a
        WHERE a.attrelid = 'public.pacientes'::regclass AND a.attname = 'id' AND NOT a.attisdropped;

        EXECUTE format(
            'CREATE TABLE evoluciones_medicas (
                id SERIAL PRIMARY KEY,
                historia_id INTEGER NOT NULL REFERENCES historias_clinicas(id) ON DELETE CASCADE,
                paciente_id %s NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
                tipo VARCHAR(30) NOT NULL DEFAULT ''Seguimiento'',
                fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                contenido TEXT NOT NULL,
                medico_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                medico_nombre VARCHAR(150) NOT NULL DEFAULT '''',
                especialidad VARCHAR(120) NOT NULL DEFAULT '''',
                creado_por_nombre VARCHAR(150) NOT NULL DEFAULT '''',
                eliminada_en TIMESTAMP,
                eliminada_por_nombre VARCHAR(150),
                eliminada_motivo TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )', tipo_paciente);
        CREATE INDEX idx_evoluciones_paciente ON evoluciones_medicas(paciente_id, fecha_hora DESC);
        CREATE INDEX idx_evoluciones_historia ON evoluciones_medicas(historia_id);
    END IF;

    CREATE TABLE IF NOT EXISTS evoluciones_medicas_cambios (
        id SERIAL PRIMARY KEY,
        evolucion_id INTEGER NOT NULL REFERENCES evoluciones_medicas(id) ON DELETE CASCADE,
        accion VARCHAR(12) NOT NULL CHECK (accion IN ('editada', 'eliminada')),
        motivo TEXT NOT NULL,
        antes JSONB NOT NULL,
        usuario_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        usuario_nombre VARCHAR(150) NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_evoluciones_cambios ON evoluciones_medicas_cambios(evolucion_id, created_at);
END $$;

COMMIT;
