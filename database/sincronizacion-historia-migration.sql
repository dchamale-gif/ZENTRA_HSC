-- ============================================
-- ÓRDENES MÉDICAS, NOTAS DE ENFERMERÍA E HISTORIA CLÍNICA SINCRONIZADAS
-- Cada orden médica y cada nota de enfermería queda ligada a la historia clínica
-- abierta del paciente; al cerrar la historia quedan en solo lectura con ella.
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

    -- Órdenes médicas → historia clínica (las antiguas quedan sin historia)
    IF to_regclass('public.ordenes') IS NOT NULL THEN
        ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS historia_id INTEGER
            REFERENCES historias_clinicas(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_ordenes_historia ON ordenes(historia_id);
    END IF;

    -- Notas de enfermería por turno, dentro de una historia clínica
    IF to_regclass('public.notas_enfermeria') IS NULL THEN
        SELECT format_type(a.atttypid, a.atttypmod) INTO tipo_paciente
        FROM pg_attribute a
        WHERE a.attrelid = 'public.pacientes'::regclass AND a.attname = 'id' AND NOT a.attisdropped;

        EXECUTE format(
            'CREATE TABLE notas_enfermeria (
                id SERIAL PRIMARY KEY,
                historia_id INTEGER NOT NULL REFERENCES historias_clinicas(id) ON DELETE CASCADE,
                paciente_id %s NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
                orden_medica_id INTEGER,
                turno VARCHAR(10) NOT NULL CHECK (turno IN (''manana'', ''tarde'', ''noche'')),
                fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                nota TEXT NOT NULL,
                autor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                autor_nombre VARCHAR(150) NOT NULL DEFAULT '''',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )', tipo_paciente);
        CREATE INDEX idx_notas_enfermeria_historia ON notas_enfermeria(historia_id, fecha_hora DESC);

        IF to_regclass('public.ordenes') IS NOT NULL THEN
            ALTER TABLE notas_enfermeria ADD CONSTRAINT notas_enfermeria_orden_fk
                FOREIGN KEY (orden_medica_id) REFERENCES ordenes(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

COMMIT;
