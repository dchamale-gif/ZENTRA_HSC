-- ============================================
-- DATOS DE EJEMPLO PARA ESTADO DE CUENTA
-- Fecha: 2026-07-01
-- Descripción: Inserta pacientes de ejemplo con saldos y movimientos
-- Idempotente: Verifica si los datos ya existen antes de insertar
-- ============================================

BEGIN;

-- ============================================
-- 1. INSERTAR PACIENTES DE EJEMPLO (si no existen)
-- ============================================

INSERT INTO pacientes (
    id, nombre, apellido_paterno, apellido_materno, edad, fecha_nacimiento,
    genero, dpi, telefono, email, direccion, colonia, zona, municipio, 
    departamento, estado_civil, profesion, ocupacion, estado, created_at, updated_at
) VALUES 
(
    'PAC_001', 'Juan', 'López', 'Rodríguez', 45, '1981-03-15',
    'M', '1234567890101', '7856-1234', 'juan.lopez@email.com', 
    'Calle Principal 123', 'Zona 10', '10', 'Guatemala', 'Guatemala',
    'Casado', 'Ingeniero', 'Empleado Público', 'activo', NOW(), NOW()
),
(
    'PAC_002', 'María', 'García', 'Morales', 38, '1988-07-22',
    'F', '2345678901012', '7865-5678', 'maria.garcia@email.com',
    'Avenida Central 456', 'Zona 12', '12', 'Guatemala', 'Guatemala',
    'Soltera', 'Médica', 'Autónoma', 'activo', NOW(), NOW()
),
(
    'PAC_003', 'Carlos', 'Pérez', 'López', 52, '1974-11-08',
    'M', '3456789012123', '7834-9012', 'carlos.perez@email.com',
    'Boulevard los Próceres 789', 'Zona 15', '15', 'Guatemala', 'Guatemala',
    'Divorciado', 'Abogado', 'Profesional Independiente', 'activo', NOW(), NOW()
),
(
    'PAC_004', 'Ana', 'Martínez', 'Díaz', 29, '1997-05-10',
    'F', '4567890123234', '7812-3456', 'ana.martinez@email.com',
    'Paseo Montufar 321', 'Zona 3', '3', 'Guatemala', 'Guatemala',
    'Casada', 'Psicóloga', 'Clínica Privada', 'activo', NOW(), NOW()
),
(
    'PAC_005', 'Roberto', 'Sánchez', 'Gómez', 61, '1965-12-25',
    'M', '5678901234345', '7843-7890', 'robert.sanchez@email.com',
    'Carrera 8 654', 'Zona 9', '9', 'Guatemala', 'Guatemala',
    'Viudo', 'Contador', 'Jubilado', 'activo', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. INSERTAR SALDOS DE PACIENTES (si no existen)
-- ============================================

INSERT INTO pacientes_saldo (
    paciente_id, saldo_pendiente, total_deuda, usuario_actualizo, created_at, updated_at
) VALUES 
('PAC_001', 1250.00, 3500.00, 'SYSTEM', NOW(), NOW()),
('PAC_002', 0.00, 850.00, 'SYSTEM', NOW(), NOW()),
('PAC_003', 3750.50, 5200.50, 'SYSTEM', NOW(), NOW()),
('PAC_004', 450.75, 1200.75, 'SYSTEM', NOW(), NOW()),
('PAC_005', 0.00, 2100.00, 'SYSTEM', NOW(), NOW())
ON CONFLICT (paciente_id) DO UPDATE SET
    saldo_pendiente = EXCLUDED.saldo_pendiente,
    total_deuda = EXCLUDED.total_deuda,
    updated_at = NOW();

-- ============================================
-- 3. INSERTAR MOVIMIENTOS DE PACIENTES (si no existen)
-- ============================================

INSERT INTO movimientos_paciente (
    paciente_id, tipo, descripcion, monto, saldo_anterior, saldo_nuevo,
    referencia_id, fecha, created_at
) VALUES 
('PAC_001', 'cargo', 'Consulta Psiquiátrica', 500.00, 750.00, 1250.00, 'FAC_001', '2026-06-28', NOW()),
('PAC_001', 'abono', 'Pago parcial', -500.00, 1250.00, 750.00, 'PAG_001', '2026-06-27', NOW()),
('PAC_003', 'cargo', 'Internamiento (3 días)', 2000.00, 1750.50, 3750.50, 'FAC_002', '2026-06-29', NOW()),
('PAC_003', 'abono', 'Abono a cuenta', -1000.00, 3750.50, 2750.50, 'PAG_002', '2026-06-24', NOW()),
('PAC_002', 'cargo', 'Medicamentos', 350.00, 500.00, 850.00, 'FAC_003', '2026-06-23', NOW()),
('PAC_002', 'abono', 'Pago completo', -850.00, 850.00, 0.00, 'PAG_003', '2026-06-25', NOW()),
('PAC_004', 'cargo', 'Consulta + Laboratorio', 450.75, 0.00, 450.75, 'FAC_004', '2026-06-26', NOW()),
('PAC_005', 'abono', 'Pago total', -2100.00, 2100.00, 0.00, 'PAG_004', '2026-06-20', NOW())
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. INSERTAR FACTURAS DE EJEMPLO CON ITEMS
-- ============================================

-- Nota: Los IDs de facturas se generan automáticamente
-- Aquí se insertan ejemplos de facturas asociadas a los pacientes

INSERT INTO ventas (
    paciente_id, subtotal, descuento, impuesto, total, 
    total_descuentos, base_impuesto, total_impuestos, tipo_factura,
    estado, created_at, updated_at
) VALUES 
('PAC_001', 500.00, 0.00, 50.00, 550.00, 0.00, 500.00, 50.00, 'normal', 'completada', NOW(), NOW()),
('PAC_003', 2000.00, 100.00, 190.00, 2090.00, 100.00, 1900.00, 190.00, 'normal', 'completada', NOW(), NOW()),
('PAC_002', 350.00, 0.00, 35.00, 385.00, 0.00, 350.00, 35.00, 'normal', 'completada', NOW(), NOW()),
('PAC_004', 450.75, 0.00, 45.08, 495.83, 0.00, 450.75, 45.08, 'normal', 'completada', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. ACTUALIZAR ITEMS DE FACTURAS CON CATEGORÍAS
-- ============================================

-- Categorizar items existentes por tipo (si no están categorizados)
UPDATE venta_items 
SET tipo_item = 'honorarios' 
WHERE tipo_item = 'general' 
  AND venta_id IN (
    SELECT id FROM ventas WHERE paciente_id IN ('PAC_001', 'PAC_002', 'PAC_004')
  );

UPDATE venta_items 
SET tipo_item = 'internamiento' 
WHERE tipo_item = 'general' 
  AND venta_id IN (
    SELECT id FROM ventas WHERE paciente_id = 'PAC_003'
  );

-- ============================================
-- 6. VERIFICACIÓN Y REPORTE
-- ============================================

DO $$
DECLARE
    v_pacientes_count INT;
    v_saldos_count INT;
    v_movimientos_count INT;
    v_facturas_count INT;
BEGIN
    SELECT COUNT(*) INTO v_pacientes_count FROM pacientes WHERE id LIKE 'PAC_%';
    SELECT COUNT(*) INTO v_saldos_count FROM pacientes_saldo;
    SELECT COUNT(*) INTO v_movimientos_count FROM movimientos_paciente;
    SELECT COUNT(*) INTO v_facturas_count FROM ventas WHERE paciente_id LIKE 'PAC_%';
    
    RAISE NOTICE '====================================';
    RAISE NOTICE 'DATOS DE EJEMPLO INSERTADOS';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Pacientes de ejemplo: % registros', v_pacientes_count;
    RAISE NOTICE 'Saldos de pacientes: % registros', v_saldos_count;
    RAISE NOTICE 'Movimientos registrados: % registros', v_movimientos_count;
    RAISE NOTICE 'Facturas de ejemplo: % registros', v_facturas_count;
    RAISE NOTICE '====================================';
    RAISE NOTICE '✅ Datos cargados exitosamente';
    RAISE NOTICE 'Ahora puedes ver estos datos en:';
    RAISE NOTICE '  • Saldo del Paciente (filtros de pacientes)';
    RAISE NOTICE '  • Estado de Cuenta (facturación mejorada)';
    RAISE NOTICE '====================================';
END $$;

COMMIT;

-- ============================================
-- FIN DE CARGA DE DATOS DE EJEMPLO
-- ============================================
-- Status: ✅ Listo para ejecutar
-- Notas:
--   - Script es seguro para ejecutar múltiples veces
--   - Solo inserta si los datos no existen
--   - Actualiza saldos si ya están registrados
--   - Incluye 5 pacientes con diferentes estados de cuenta
-- ============================================
