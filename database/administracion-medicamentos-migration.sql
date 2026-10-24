-- ============================================
-- CONTROL DE MEDICAMENTOS (registro de administración)
-- Cada dosis dada de un medicamento transcrito por enfermería: orden médica, medicamento,
-- día y número de aplicación del día. Las dosis por dar se calculan con la frecuencia y el
-- horario de la transcripción; aquí solo se guardan las que ya se dieron.
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================

BEGIN;

DO $$
DECLARE
    tipo_paciente TEXT;
BEGIN
    IF to_regclass('public.ordenes') IS NULL OR to_regclass('public.ordenes_enfermeria') IS NULL THEN
        RAISE EXCEPTION 'Primero ejecute las migraciones de órdenes médicas y de órdenes de enfermería';
    END IF;

    IF to_regclass('public.administracion_medicamentos') IS NULL THEN
        SELECT format_type(a.atttypid, a.atttypmod) INTO tipo_paciente
        FROM pg_attribute a
        WHERE a.attrelid = 'public.pacientes'::regclass AND a.attname = 'id' AND NOT a.attisdropped;

        EXECUTE format(
            'CREATE TABLE administracion_medicamentos (
                id SERIAL PRIMARY KEY,
                orden_medica_id INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
                paciente_id %s NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
                medicina_clave VARCHAR(160) NOT NULL,
                medicina_nombre VARCHAR(200) NOT NULL DEFAULT '''',
                fecha DATE NOT NULL,
                aplicacion SMALLINT NOT NULL CHECK (aplicacion BETWEEN 1 AND 48),
                hora VARCHAR(5),
                registrado_por_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                registrado_por_nombre VARCHAR(150) NOT NULL DEFAULT '''',
                registrado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (orden_medica_id, medicina_clave, fecha, aplicacion)
            )', tipo_paciente);
        CREATE INDEX idx_administracion_fecha ON administracion_medicamentos(fecha, paciente_id);
    END IF;
END $$;

COMMIT;
