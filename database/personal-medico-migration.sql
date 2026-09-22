BEGIN;

CREATE TABLE IF NOT EXISTS especialidades_medicas (
    id INTEGER PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO especialidades_medicas (id, nombre) VALUES
    (1, 'Psiquiatría'),
    (2, 'Psiquiatría Infantil'),
    (3, 'Psicología Clínica'),
    (4, 'Terapia Cognitivo-Conductual'),
    (5, 'Adicciones y Rehabilitación'),
    (6, 'Psiquiatría Forense'),
    (7, 'Medicina Interna'),
    (8, 'Traumatología'),
    (9, 'Neuropsicología')
ON CONFLICT (id) DO UPDATE
SET nombre = EXCLUDED.nombre,
    updated_at = CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS personal_medico (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100),
    especialidad_id INTEGER NOT NULL REFERENCES especialidades_medicas(id),
    numero_colegiado VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    telefono VARCHAR(30) NOT NULL,
    horario_inicio TIME NOT NULL DEFAULT '08:00',
    horario_fin TIME NOT NULL DEFAULT '16:00',
    dias_disponibles TEXT[] NOT NULL DEFAULT ARRAY['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'licencia')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (horario_fin > horario_inicio),
    CONSTRAINT personal_medico_dias_validos CHECK (
        cardinality(dias_disponibles) > 0 AND
        dias_disponibles <@ ARRAY['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']::TEXT[]
    )
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'personal_medico'
          AND column_name = 'licencia_profesional'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'personal_medico'
          AND column_name = 'numero_colegiado'
    ) THEN
        ALTER TABLE personal_medico
            RENAME COLUMN licencia_profesional TO numero_colegiado;
    END IF;
END $$;

ALTER TABLE personal_medico
    ADD COLUMN IF NOT EXISTS numero_colegiado VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_medico_numero_colegiado
    ON personal_medico(numero_colegiado);

ALTER TABLE personal_medico
    ADD COLUMN IF NOT EXISTS dias_disponibles TEXT[] NOT NULL
    DEFAULT ARRAY['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'personal_medico_dias_validos'
          AND conrelid = 'personal_medico'::regclass
    ) THEN
        ALTER TABLE personal_medico
            ADD CONSTRAINT personal_medico_dias_validos CHECK (
                cardinality(dias_disponibles) > 0 AND
                dias_disponibles <@ ARRAY['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']::TEXT[]
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_personal_medico_especialidad ON personal_medico(especialidad_id);
CREATE INDEX IF NOT EXISTS idx_personal_medico_estado ON personal_medico(estado);
CREATE INDEX IF NOT EXISTS idx_personal_medico_nombre ON personal_medico(apellido_paterno, nombre);

COMMIT;