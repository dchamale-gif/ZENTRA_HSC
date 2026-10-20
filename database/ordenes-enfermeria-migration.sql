-- ============================================
-- ÓRDENES DE ENFERMERÍA
-- La enfermera traduce cada orden del médico en indicaciones concretas
-- (medicamento, dosis, vía, frecuencia, horario). Una por orden médica.
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS ordenes_enfermeria (
    id SERIAL PRIMARY KEY,
    orden_medica_id INTEGER NOT NULL UNIQUE REFERENCES ordenes(id) ON DELETE CASCADE,
    indicaciones JSONB NOT NULL DEFAULT '[]'::jsonb,
    observaciones TEXT NOT NULL DEFAULT '',
    -- Huella del contenido de la orden médica al guardar; si el médico la cambia después, se avisa
    orden_medica_firma TEXT,
    creado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
    creado_por_nombre VARCHAR(150) NOT NULL DEFAULT '',
    actualizado_por_nombre VARCHAR(150) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Permisos del nuevo módulo
INSERT INTO permissions (nombre, descripcion, modulo, accion) VALUES
    ('ordenes_enfermeria_view', 'Ver órdenes de enfermería', 'ordenes_enfermeria', 'view'),
    ('ordenes_enfermeria_edit', 'Editar órdenes de enfermería', 'ordenes_enfermeria', 'edit')
ON CONFLICT (nombre) DO NOTHING;

-- Admin y enfermería: ver y editar. Médico: solo ver.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.nombre IN ('ordenes_enfermeria_view', 'ordenes_enfermeria_edit')
WHERE r.nombre IN ('admin', 'enfermera')
   OR (r.nombre = 'doctor' AND p.nombre = 'ordenes_enfermeria_view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Las órdenes médicas las escribe el médico: enfermería pasa a solo verlas
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE nombre = 'enfermera')
  AND permission_id = (SELECT id FROM permissions WHERE nombre = 'ordenes_medicas_edit');

COMMIT;
