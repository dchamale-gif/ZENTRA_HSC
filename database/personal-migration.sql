-- ============================================
-- PERSONAL MÉDICO Y PERSONAL (ADMINISTRATIVO Y DE APOYO)
-- - Personal médico: disponibilidad para emergencias, documentos y usuario del sistema.
-- - Personal: tabla nueva con lo mismo (foto, DPI, horario, emergencias, documentos,
--   usuario), pero con puesto y área en lugar de especialidad y colegiado.
-- - Un usuario del sistema se vincula a lo más a una persona.
-- Los archivos se guardan en la base (BYTEA), igual que los PDF de laboratorio.
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================

BEGIN;

-- ---------- Personal médico ----------
ALTER TABLE personal_medico ADD COLUMN IF NOT EXISTS disponible_emergencias BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE personal_medico ADD COLUMN IF NOT EXISTS telefono_emergencia VARCHAR(30);
ALTER TABLE personal_medico ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_personal_medico_emergencias
    ON personal_medico (disponible_emergencias) WHERE disponible_emergencias;
CREATE UNIQUE INDEX IF NOT EXISTS personal_medico_user_unico
    ON personal_medico (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS personal_medico_documentos (
    id SERIAL PRIMARY KEY,
    personal_medico_id INTEGER NOT NULL REFERENCES personal_medico(id) ON DELETE CASCADE,
    tipo VARCHAR(60) NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_contenido VARCHAR(40) NOT NULL
        CHECK (tipo_contenido IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
    tamano INTEGER NOT NULL,
    contenido BYTEA NOT NULL,
    fecha_vencimiento DATE,
    notas VARCHAR(300),
    subido_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
    subido_por_nombre VARCHAR(150) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_personal_medico_documentos_personal
    ON personal_medico_documentos (personal_medico_id, created_at DESC);

-- ---------- Personal (administrativo y de apoyo) ----------
CREATE TABLE IF NOT EXISTS personal_general (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100),
    puesto VARCHAR(120) NOT NULL,
    area VARCHAR(60),
    email VARCHAR(150) UNIQUE,
    telefono VARCHAR(30) NOT NULL,
    horario_inicio TIME NOT NULL DEFAULT '08:00',
    horario_fin TIME NOT NULL DEFAULT '16:00',
    dias_disponibles TEXT[] NOT NULL DEFAULT ARRAY['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'licencia')),
    dpi VARCHAR(20),
    foto_perfil TEXT CHECK (foto_perfil IS NULL OR foto_perfil ~ '^data:image/(jpeg|png|webp);base64,'),
    dpi_frente TEXT CHECK (dpi_frente IS NULL OR dpi_frente ~ '^data:image/(jpeg|png|webp);base64,'),
    dpi_reverso TEXT CHECK (dpi_reverso IS NULL OR dpi_reverso ~ '^data:image/(jpeg|png|webp);base64,'),
    disponible_emergencias BOOLEAN NOT NULL DEFAULT false,
    telefono_emergencia VARCHAR(30),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (horario_fin > horario_inicio),
    CONSTRAINT personal_general_dias_validos CHECK (
        cardinality(dias_disponibles) > 0 AND
        dias_disponibles <@ ARRAY['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']::TEXT[]
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS personal_general_dpi_unico
    ON personal_general (dpi) WHERE dpi IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS personal_general_user_unico
    ON personal_general (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_personal_general_nombre ON personal_general (apellido_paterno, nombre);

CREATE TABLE IF NOT EXISTS personal_general_documentos (
    id SERIAL PRIMARY KEY,
    personal_general_id INTEGER NOT NULL REFERENCES personal_general(id) ON DELETE CASCADE,
    tipo VARCHAR(60) NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_contenido VARCHAR(40) NOT NULL
        CHECK (tipo_contenido IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
    tamano INTEGER NOT NULL,
    contenido BYTEA NOT NULL,
    fecha_vencimiento DATE,
    notas VARCHAR(300),
    subido_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
    subido_por_nombre VARCHAR(150) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_personal_general_documentos_personal
    ON personal_general_documentos (personal_general_id, created_at DESC);

-- Permisos del módulo Personal (el admin los asigna a los roles en Configuración)
INSERT INTO permissions (nombre, descripcion, modulo, accion)
VALUES ('personal_general_view', 'Ver personal', 'personal_general', 'view'),
       ('personal_general_edit', 'Editar personal', 'personal_general', 'edit')
ON CONFLICT (nombre) DO UPDATE
SET descripcion = EXCLUDED.descripcion, modulo = EXCLUDED.modulo, accion = EXCLUDED.accion;

COMMIT;
