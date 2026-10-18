-- ============================================
-- ROLES Y PERMISOS POR MÓDULO
-- Idempotente: se puede ejecutar varias veces.
--
-- Cada módulo tiene dos permisos:
--   <modulo>_view  -> lectura (GET)
--   <modulo>_edit  -> crear / editar / eliminar (POST, PUT, PATCH, DELETE)
-- El rol admin tiene acceso total (además se valida en código).
-- ============================================

BEGIN;

-- 1. Roles
INSERT INTO roles (nombre, descripcion) VALUES
('admin',           'Administrador - acceso total al sistema'),
('recepcionista',   'Recepción'),
('doctor',          'Médico'),
('enfermera',       'Enfermería'),
('gerente_compras', 'Compras')
ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion, updated_at = NOW();

-- 2. Permisos por módulo
-- Módulos de una versión anterior de esta migración que ya no se usan
DELETE FROM permissions WHERE nombre ~ '^(clinica|facturacion|cargos|pacientes)_(view|edit)$';

INSERT INTO permissions (nombre, descripcion, modulo, accion)
SELECT m.modulo || '_' || a.accion,
       CASE a.accion WHEN 'view' THEN 'Ver ' ELSE 'Editar ' END || m.etiqueta,
       m.modulo, a.accion
FROM (VALUES
    -- Módulo médico
    ('caratula',             'carátula (gestión de pacientes)'),
    ('historia_clinica',     'historia clínica'),
    ('ordenes_medicas',      'órdenes médicas'),
    ('evolucion',            'evolución'),
    ('control_medicamentos', 'control de medicamentos'),
    ('extras',               'extras (dentro del hospital)'),
    ('control_signos',       'control de signos'),
    ('notas_enfermeria',     'notas de enfermería'),
    ('laboratorios',         'laboratorios'),
    ('recepcion_articulos',  'recepción de artículos'),
    ('cotizacion_paciente',  'cotización del paciente'),
    ('contrato_ingreso',     'contrato de ingreso'),
    ('hospitalizaciones',    'hospitalizaciones'),
    ('saldo_paciente',       'saldo del paciente'),
    ('medicinas',            'catálogo de medicinas'),
    ('personal',             'personal médico'),
    -- Módulo contable
    ('codigos_articulos',    'códigos de artículos'),
    ('compras',              'compras y proveedores'),
    ('ventas',               'ventas'),
    ('cotizaciones',         'cotizaciones'),
    ('caja',                 'caja'),
    ('cxc',                  'cuentas por cobrar'),
    ('gastos',               'gastos y servicios'),
    ('dashboard_ejecutivo',  'dashboard ejecutivo'),
    -- Administrativo y finanzas
    ('inventario',           'inventario'),
    ('transacciones',        'transacciones'),
    ('reportes',             'reportes'),
    -- Agenda (agenda, reservaciones web, confirmaciones y Google Calendar)
    ('agenda',               'agenda médica'),
    -- Sistema
    ('alertas',              'alertas'),
    ('usuarios',             'usuarios y roles')
) AS m(modulo, etiqueta)
CROSS JOIN (VALUES ('view'), ('edit')) AS a(accion)
ON CONFLICT (nombre) DO UPDATE
SET descripcion = EXCLUDED.descripcion, modulo = EXCLUDED.modulo, accion = EXCLUDED.accion;

-- 3. Matriz de acceso (se reemplaza completa para los roles operativos)
--    acceso 'E' = ver y editar, 'V' = solo ver
DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE nombre IN ('recepcionista', 'doctor', 'enfermera', 'gerente_compras'));

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
    -- RECEPCIÓN
    ('recepcionista', 'caratula', 'E'),
    ('recepcionista', 'historia_clinica', 'E'),
    ('recepcionista', 'ordenes_medicas', 'E'),
    ('recepcionista', 'evolucion', 'E'),
    ('recepcionista', 'control_medicamentos', 'E'),
    ('recepcionista', 'extras', 'E'),
    ('recepcionista', 'control_signos', 'E'),
    ('recepcionista', 'notas_enfermeria', 'E'),
    ('recepcionista', 'laboratorios', 'E'),
    ('recepcionista', 'recepcion_articulos', 'E'),
    ('recepcionista', 'cotizacion_paciente', 'V'),
    ('recepcionista', 'contrato_ingreso', 'E'),
    ('recepcionista', 'hospitalizaciones', 'E'),
    ('recepcionista', 'saldo_paciente', 'E'),
    ('recepcionista', 'codigos_articulos', 'E'),
    ('recepcionista', 'compras', 'E'),
    ('recepcionista', 'ventas', 'E'),
    ('recepcionista', 'cotizaciones', 'E'),
    ('recepcionista', 'caja', 'E'),
    ('recepcionista', 'cxc', 'E'),
    ('recepcionista', 'inventario', 'E'),
    ('recepcionista', 'transacciones', 'E'),
    ('recepcionista', 'reportes', 'E'),
    ('recepcionista', 'agenda', 'E'),
    ('recepcionista', 'alertas', 'E'),

    -- MÉDICO
    ('doctor', 'caratula', 'E'),
    ('doctor', 'historia_clinica', 'E'),
    ('doctor', 'ordenes_medicas', 'E'),
    ('doctor', 'evolucion', 'E'),
    ('doctor', 'control_medicamentos', 'E'),
    ('doctor', 'extras', 'E'),
    ('doctor', 'control_signos', 'E'),
    ('doctor', 'notas_enfermeria', 'E'),
    ('doctor', 'laboratorios', 'E'),
    ('doctor', 'hospitalizaciones', 'E'),
    ('doctor', 'agenda', 'E'),
    ('doctor', 'alertas', 'E'),

    -- ENFERMERÍA
    ('enfermera', 'caratula', 'E'),
    ('enfermera', 'historia_clinica', 'E'),
    ('enfermera', 'ordenes_medicas', 'E'),
    ('enfermera', 'control_medicamentos', 'E'),
    ('enfermera', 'extras', 'E'),
    ('enfermera', 'control_signos', 'E'),
    ('enfermera', 'notas_enfermeria', 'E'),
    ('enfermera', 'laboratorios', 'E'),
    ('enfermera', 'recepcion_articulos', 'E'),
    ('enfermera', 'contrato_ingreso', 'E'),
    ('enfermera', 'hospitalizaciones', 'E'),
    ('enfermera', 'alertas', 'E'),

    -- COMPRAS
    ('gerente_compras', 'extras', 'E'),
    ('gerente_compras', 'laboratorios', 'E'),
    ('gerente_compras', 'cotizacion_paciente', 'V'),
    ('gerente_compras', 'saldo_paciente', 'E'),
    ('gerente_compras', 'medicinas', 'E'),
    ('gerente_compras', 'codigos_articulos', 'E'),
    ('gerente_compras', 'compras', 'E'),
    ('gerente_compras', 'ventas', 'E'),
    ('gerente_compras', 'cotizaciones', 'E'),
    ('gerente_compras', 'caja', 'E'),
    ('gerente_compras', 'cxc', 'E'),
    ('gerente_compras', 'gastos', 'E'),
    ('gerente_compras', 'inventario', 'E'),
    ('gerente_compras', 'transacciones', 'E'),
    ('gerente_compras', 'reportes', 'E'),
    ('gerente_compras', 'agenda', 'E'),
    ('gerente_compras', 'alertas', 'E')
) AS m(rol, modulo, acceso)
JOIN roles r ON r.nombre = m.rol
JOIN permissions p ON p.nombre = m.modulo || '_view'
    OR (m.acceso = 'E' AND p.nombre = m.modulo || '_edit')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Admin: todos los permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.nombre = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;

-- Verificación
SELECT r.nombre AS rol, COUNT(rp.id) AS permisos
FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id
GROUP BY r.nombre ORDER BY r.nombre;
