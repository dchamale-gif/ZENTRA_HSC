-- ============================================
-- HISTORIAS CLÍNICAS EN EL SERVIDOR
-- Una historia por consulta o ingreso (las anteriores quedan guardadas) y los
-- antecedentes del paciente, compartidos por todas sus historias.
-- paciente_id toma el mismo tipo que pacientes.id en esta base (texto o número).
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================

BEGIN;

DO $$
DECLARE
    tipo_paciente TEXT;
BEGIN
    SELECT format_type(a.atttypid, a.atttypmod) INTO tipo_paciente
    FROM pg_attribute a
    WHERE a.attrelid = 'public.pacientes'::regclass AND a.attname = 'id' AND NOT a.attisdropped;

    IF to_regclass('public.historias_clinicas') IS NULL THEN
        EXECUTE format(
            'CREATE TABLE historias_clinicas (
                id SERIAL PRIMARY KEY,
                paciente_id %s NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
                fecha DATE NOT NULL DEFAULT CURRENT_DATE,
                tipo VARCHAR(20) NOT NULL DEFAULT ''consulta''
                    CHECK (tipo IN (''consulta'', ''ingreso'', ''emergencia'', ''control'')),
                medico_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                medico_nombre VARCHAR(150) NOT NULL DEFAULT '''',
                motivo_consulta TEXT NOT NULL DEFAULT '''',
                enfermedad_actual TEXT NOT NULL DEFAULT '''',
                revision_sistemas TEXT NOT NULL DEFAULT '''',
                signos_vitales JSONB NOT NULL DEFAULT ''{}''::jsonb,
                examen_fisico TEXT NOT NULL DEFAULT '''',
                impresion_clinica TEXT NOT NULL DEFAULT '''',
                plan TEXT NOT NULL DEFAULT '''',
                estado VARCHAR(10) NOT NULL DEFAULT ''abierta'' CHECK (estado IN (''abierta'', ''cerrada'')),
                -- Copia de los antecedentes al cerrar: una historia vieja los muestra como estaban
                antecedentes_al_cierre JSONB,
                cerrada_en TIMESTAMP,
                cerrada_por_nombre VARCHAR(150),
                actualizado_por_nombre VARCHAR(150) NOT NULL DEFAULT '''',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )', tipo_paciente);
    END IF;

    IF to_regclass('public.antecedentes_paciente') IS NULL THEN
        EXECUTE format(
            'CREATE TABLE antecedentes_paciente (
                paciente_id %s PRIMARY KEY REFERENCES pacientes(id) ON DELETE CASCADE,
                personales TEXT NOT NULL DEFAULT '''',
                quirurgicos TEXT NOT NULL DEFAULT '''',
                traumaticos TEXT NOT NULL DEFAULT '''',
                alergicos TEXT NOT NULL DEFAULT '''',
                familiares TEXT NOT NULL DEFAULT '''',
                habitos TEXT NOT NULL DEFAULT '''',
                gineco_obstetricos TEXT NOT NULL DEFAULT '''',
                medicamentos_habituales TEXT NOT NULL DEFAULT '''',
                actualizado_por_nombre VARCHAR(150) NOT NULL DEFAULT '''',
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )', tipo_paciente);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_historias_clinicas_paciente ON historias_clinicas(paciente_id, fecha DESC, id DESC);
-- Una sola historia abierta por paciente
CREATE UNIQUE INDEX IF NOT EXISTS uq_historias_clinicas_abierta ON historias_clinicas(paciente_id) WHERE estado = 'abierta';

-- Permiso para abrir y cerrar historias (el médico); editar una abierta sigue con historia_clinica_edit
INSERT INTO permissions (nombre, descripcion, modulo, accion) VALUES
    ('historia_clinica_cierre_view', 'Ver abrir y cerrar historias clínicas', 'historia_clinica_cierre', 'view'),
    ('historia_clinica_cierre_edit', 'Abrir y cerrar historias clínicas', 'historia_clinica_cierre', 'edit')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.nombre IN ('historia_clinica_cierre_view', 'historia_clinica_cierre_edit')
WHERE r.nombre IN ('admin', 'doctor')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Recepción pasa a solo ver la historia clínica (confidencialidad)
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE nombre = 'recepcionista')
  AND permission_id = (SELECT id FROM permissions WHERE nombre = 'historia_clinica_edit');

COMMIT;
