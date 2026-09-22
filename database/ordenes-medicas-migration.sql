BEGIN;

CREATE TABLE IF NOT EXISTS ordenes (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL DEFAULT 'medica',
    descripcion TEXT NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS doctor VARCHAR(150);
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS notas TEXT NOT NULL DEFAULT '';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS servicios JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS fecha_orden DATE NOT NULL DEFAULT CURRENT_DATE;

UPDATE ordenes
SET fecha_orden = COALESCE(fecha_orden, created_at::date),
    servicios = COALESCE(servicios, '[]'::jsonb),
    notas = COALESCE(notas, '')
WHERE fecha_orden IS NULL OR servicios IS NULL OR notas IS NULL;

CREATE INDEX IF NOT EXISTS idx_ordenes_paciente ON ordenes(paciente_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_tipo_fecha ON ordenes(tipo, fecha_orden DESC);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes(estado);

COMMIT;