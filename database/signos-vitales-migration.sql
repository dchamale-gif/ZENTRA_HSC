-- ============================================
-- SIGNOS VITALES CON HISTORIAL
-- Cada toma de signos vitales es un registro con fecha y hora dentro de una historia clínica.
-- historias_clinicas.signos_vitales queda con la última toma de esa historia.
-- Los signos que ya estaban guardados en cada historia pasan como su primera toma.
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

    IF to_regclass('public.signos_vitales') IS NULL THEN
        SELECT format_type(a.atttypid, a.atttypmod) INTO tipo_paciente
        FROM pg_attribute a
        WHERE a.attrelid = 'public.pacientes'::regclass AND a.attname = 'id' AND NOT a.attisdropped;

        EXECUTE format(
            'CREATE TABLE signos_vitales (
                id SERIAL PRIMARY KEY,
                historia_id INTEGER NOT NULL REFERENCES historias_clinicas(id) ON DELETE CASCADE,
                paciente_id %s NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
                fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                valores JSONB NOT NULL DEFAULT ''{}''::jsonb,
                nota VARCHAR(500) NOT NULL DEFAULT '''',
                registrado_por_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                registrado_por_nombre VARCHAR(150) NOT NULL DEFAULT '''',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )', tipo_paciente);
        CREATE INDEX idx_signos_vitales_paciente ON signos_vitales(paciente_id, fecha_hora DESC);
        CREATE INDEX idx_signos_vitales_historia ON signos_vitales(historia_id, fecha_hora DESC);
    END IF;

    -- Los signos guardados en la historia pasan como primera toma (solo si esa historia aún no tiene tomas)
    INSERT INTO signos_vitales (historia_id, paciente_id, fecha_hora, valores, registrado_por_nombre)
    SELECT h.id, h.paciente_id, h.updated_at, h.signos_vitales, h.actualizado_por_nombre
    FROM historias_clinicas h
    WHERE h.signos_vitales IS NOT NULL AND h.signos_vitales <> '{}'::jsonb
      AND NOT EXISTS (SELECT 1 FROM signos_vitales s WHERE s.historia_id = h.id);
END $$;

COMMIT;
