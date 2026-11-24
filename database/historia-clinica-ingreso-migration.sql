-- ============================================
-- HISTORIA CLÍNICA CON EL FORMATO DE INGRESO DEL HOSPITAL
-- (plantilla "Historia Clínica Ingreso"):
--  - Ficha: nombre preferido, religión, lateralidad e idioma (el resto sale del paciente)
--  - Historia: examen mental y datos complementarios
--  - Antecedentes: psiquiátricos personales, psiquiátricos familiares y toxicológicos
--  - Tipo de historia "reingreso"
-- Y en el paciente con internamiento: si es reingreso y su fecha (la del primer
-- internamiento sigue en fecha_primer_consulta).
-- Las columnas anteriores se conservan; la pantalla las muestra solo si traen datos.
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================

BEGIN;

ALTER TABLE historias_clinicas
    ADD COLUMN IF NOT EXISTS examen_mental TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS datos_complementarios TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS datos_generales JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE antecedentes_paciente
    ADD COLUMN IF NOT EXISTS psiquiatricos_personales TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS psiquiatricos_familiares TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS toxicologicos TEXT NOT NULL DEFAULT '';

ALTER TABLE pacientes
    ADD COLUMN IF NOT EXISTS es_reingreso BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fecha_reingreso DATE;

-- Tipos de historia: se agrega "reingreso" (se reemplaza la regla anterior, tenga el nombre que tenga)
DO $$
DECLARE
    regla TEXT;
BEGIN
    FOR regla IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.historias_clinicas'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%tipo%' AND pg_get_constraintdef(oid) LIKE '%consulta%'
    LOOP
        EXECUTE format('ALTER TABLE historias_clinicas DROP CONSTRAINT %I', regla);
    END LOOP;
END $$;

ALTER TABLE historias_clinicas ADD CONSTRAINT historias_clinicas_tipo_check
    CHECK (tipo IN ('consulta', 'ingreso', 'reingreso', 'emergencia', 'control'));

COMMIT;
