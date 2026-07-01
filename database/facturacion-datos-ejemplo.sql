-- ============================================
-- DATOS DE EJEMPLO: MÓDULO DE FACTURACIÓN
-- Fecha: 2026-07-01
-- Base de Datos: PostgreSQL
-- Descripción: Inserta datos completos para facturación
-- ============================================

\set ON_ERROR_STOP off

-- ============================================
-- 1. MEDICINAS/ARTÍCULOS
-- ============================================

BEGIN;
INSERT INTO medicinas (id, nombre, descripcion, precio, stock_disponible, stock_minimo, fabricante, lote, fecha_vencimiento, activo, created_at, updated_at)
VALUES ('MED-001', 'Amoxicilina 500mg', 'Antibiótico - 30 cápsulas', 150.00, 100, 10, 'FarmaLab', 'AMOX2026', '2027-06-30', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO medicinas (id, nombre, descripcion, precio, stock_disponible, stock_minimo, fabricante, lote, fecha_vencimiento, activo, created_at, updated_at)
VALUES ('MED-002', 'Ibuprofeno 400mg', 'Analgésico - 50 tabletas', 85.00, 150, 20, 'MediCare', 'IBU2026', '2027-08-15', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO medicinas (id, nombre, descripcion, precio, stock_disponible, stock_minimo, fabricante, lote, fecha_vencimiento, activo, created_at, updated_at)
VALUES ('MED-003', 'Paracetamol 500mg', 'Antipirético - 60 tabletas', 65.00, 200, 30, 'HealthCare', 'PAR2026', '2027-10-20', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO medicinas (id, nombre, descripcion, precio, stock_disponible, stock_minimo, fabricante, lote, fecha_vencimiento, activo, created_at, updated_at)
VALUES ('MED-004', 'Vitamina D 1000UI', 'Suplemento - 100 cápsulas', 120.00, 80, 15, 'Nutragenix', 'VIT2026', '2027-12-01', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO medicinas (id, nombre, descripcion, precio, stock_disponible, stock_minimo, fabricante, lote, fecha_vencimiento, activo, created_at, updated_at)
VALUES ('MED-005', 'Metformina 500mg', 'Antidiabético - 60 tabletas', 200.00, 50, 10, 'DiabetoCare', 'MET2026', '2027-07-15', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO medicinas (id, nombre, descripcion, precio, stock_disponible, stock_minimo, fabricante, lote, fecha_vencimiento, activo, created_at, updated_at)
VALUES ('MED-006', 'Lisinopril 10mg', 'Antihipertensivo - 30 tabletas', 180.00, 60, 10, 'CardioPlus', 'LIS2026', '2027-09-30', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO medicinas (id, nombre, descripcion, precio, stock_disponible, stock_minimo, fabricante, lote, fecha_vencimiento, activo, created_at, updated_at)
VALUES ('MED-007', 'Simvastatina 20mg', 'Hipolipemiante - 30 tabletas', 220.00, 40, 8, 'LipidCare', 'SIM2026', '2027-08-20', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO medicinas (id, nombre, descripcion, precio, stock_disponible, stock_minimo, fabricante, lote, fecha_vencimiento, activo, created_at, updated_at)
VALUES ('MED-008', 'Omeprazol 20mg', 'Gastroprotector - 28 cápsulas', 140.00, 90, 15, 'GastroCare', 'OMP2026', '2027-11-10', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO medicinas (id, nombre, descripcion, precio, stock_disponible, stock_minimo, fabricante, lote, fecha_vencimiento, activo, created_at, updated_at)
VALUES ('MED-009', 'Atorvastatina 40mg', 'Antilipidémico - 30 tabletas', 240.00, 35, 8, 'CholesteroLow', 'ATV2026', '2027-09-05', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO medicinas (id, nombre, descripcion, precio, stock_disponible, stock_minimo, fabricante, lote, fecha_vencimiento, activo, created_at, updated_at)
VALUES ('MED-010', 'Fluoxetina 20mg', 'Antidepresivo - 30 cápsulas', 190.00, 55, 10, 'MindCare', 'FLU2026', '2027-10-25', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

-- ============================================
-- 2. DESCUENTOS PREDEFINIDOS
-- ============================================

BEGIN;
INSERT INTO descuentos (id, nombre, descripcion, tipo_descuento, valor, minimo_aplicable, maximo_uso, usos_realizados, codigo_promocion, activo, fecha_inicio, fecha_fin, created_at, updated_at)
VALUES ('DESC-001-VOL10', 'Descuento por Volumen 10%', 'Aplicable a compras mayores a Q500', 'porcentaje', 10.00, 500.00, NULL, 0, 'VOLUMEN10', true, '2026-06-01', '2026-12-31', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO descuentos (id, nombre, descripcion, tipo_descuento, valor, minimo_aplicable, maximo_uso, usos_realizados, codigo_promocion, activo, fecha_inicio, fecha_fin, created_at, updated_at)
VALUES ('DESC-002-VOL15', 'Descuento por Volumen 15%', 'Aplicable a compras mayores a Q1000', 'porcentaje', 15.00, 1000.00, NULL, 0, 'VOLUMEN15', true, '2026-06-01', '2026-12-31', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO descuentos (id, nombre, descripcion, tipo_descuento, valor, minimo_aplicable, maximo_uso, usos_realizados, codigo_promocion, activo, fecha_inicio, fecha_fin, created_at, updated_at)
VALUES ('DESC-003-VIP', 'Descuento Cliente VIP 20%', 'Descuento exclusivo para clientes VIP', 'porcentaje', 20.00, 0.00, NULL, 0, 'CLIENTEVIP', true, '2026-06-01', '2026-12-31', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO descuentos (id, nombre, descripcion, tipo_descuento, valor, minimo_aplicable, maximo_uso, usos_realizados, codigo_promocion, activo, fecha_inicio, fecha_fin, created_at, updated_at)
VALUES ('DESC-004-PROMO50', 'Promoción Q50 de Descuento', 'Descuento especial de Q50', 'fijo', 50.00, 200.00, 100, 0, 'PROMO50', true, '2026-06-01', '2026-07-31', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO descuentos (id, nombre, descripcion, tipo_descuento, valor, minimo_aplicable, maximo_uso, usos_realizados, codigo_promocion, activo, fecha_inicio, fecha_fin, created_at, updated_at)
VALUES ('DESC-005-PROMO100', 'Mega Descuento Q100', 'Gran descuento de Q100', 'fijo', 100.00, 500.00, 50, 0, 'MEGA100', true, '2026-06-01', '2026-07-31', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO descuentos (id, nombre, descripcion, tipo_descuento, valor, minimo_aplicable, maximo_uso, usos_realizados, codigo_promocion, activo, fecha_inicio, fecha_fin, created_at, updated_at)
VALUES ('DESC-006-AFILIADO', 'Descuento Afiliado 5%', 'Descuento para pacientes afiliados', 'porcentaje', 5.00, 0.00, NULL, 0, 'AFILIADO', true, '2026-06-01', '2026-12-31', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO descuentos (id, nombre, descripcion, tipo_descuento, valor, minimo_aplicable, maximo_uso, usos_realizados, codigo_promocion, activo, fecha_inicio, fecha_fin, created_at, updated_at)
VALUES ('DESC-007-BULK', 'Descuento Compra al Granel 25%', 'Descuento por compra importante', 'porcentaje', 25.00, 2000.00, NULL, 0, 'BULKBUY', true, '2026-06-01', '2026-12-31', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

-- ============================================
-- 3. PACIENTE ADICIONAL
-- ============================================

BEGIN;
INSERT INTO pacientes (id, nombre, apellido_paterno, apellido_materno, edad, fecha_nacimiento, genero, dpi, telefono, email, estado, created_at, updated_at)
VALUES (1006, 'Elena', 'Rodríguez', 'Sánchez', 35, '1991-04-12', 'F', '6789012345678', '7845-1234', 'elena.rodriguez@email.com', 'activo', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

-- ============================================
-- 4. FACTURAS DE EJEMPLO (1001-1005 del setup anterior)
-- ============================================

BEGIN;
INSERT INTO ventas (paciente_id, subtotal, descuento, impuesto, total, total_descuentos, base_impuesto, total_impuestos, tipo_factura, estado, created_at, updated_at)
VALUES (1001, 500.00, 0.00, 50.00, 550.00, 0.00, 500.00, 50.00, 'normal', 'completada', NOW(), NOW())
ON CONFLICT DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO ventas (paciente_id, subtotal, descuento, impuesto, total, total_descuentos, base_impuesto, total_impuestos, tipo_factura, estado, created_at, updated_at)
VALUES (1002, 1200.00, 120.00, 129.60, 1089.60, 120.00, 1080.00, 129.60, 'normal', 'completada', NOW(), NOW())
ON CONFLICT DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO ventas (paciente_id, subtotal, descuento, impuesto, total, total_descuentos, base_impuesto, total_impuestos, tipo_factura, estado, created_at, updated_at)
VALUES (1003, 2500.00, 375.00, 255.00, 2380.00, 375.00, 2125.00, 255.00, 'normal', 'completada', NOW(), NOW())
ON CONFLICT DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO ventas (paciente_id, subtotal, descuento, impuesto, total, total_descuentos, base_impuesto, total_impuestos, tipo_factura, estado, created_at, updated_at)
VALUES (1004, 300.00, 15.00, 34.20, 319.20, 15.00, 285.00, 34.20, 'normal', 'completada', NOW(), NOW())
ON CONFLICT DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO ventas (paciente_id, subtotal, descuento, impuesto, total, total_descuentos, base_impuesto, total_impuestos, tipo_factura, estado, created_at, updated_at)
VALUES (1005, 3000.00, 750.00, 270.00, 2520.00, 750.00, 2250.00, 270.00, 'normal', 'completada', NOW(), NOW())
ON CONFLICT DO NOTHING;
COMMIT;

BEGIN;
INSERT INTO ventas (paciente_id, subtotal, descuento, impuesto, total, total_descuentos, base_impuesto, total_impuestos, tipo_factura, estado, created_at, updated_at)
VALUES (1006, 800.00, 100.00, 84.00, 784.00, 100.00, 700.00, 84.00, 'normal', 'completada', NOW(), NOW())
ON CONFLICT DO NOTHING;
COMMIT;

-- ============================================
-- 5. ACTUALIZAR SALDOS DESPUÉS DE PAGOS
-- ============================================

BEGIN;
UPDATE pacientes_saldo SET saldo_pendiente = 260.00, total_deuda = 560.00, usuario_actualizo = 'FACTURACION', updated_at = NOW() WHERE paciente_id = 1001;
COMMIT;

BEGIN;
UPDATE pacientes_saldo SET saldo_pendiente = 0.00, total_deuda = 1089.60, usuario_actualizo = 'FACTURACION', updated_at = NOW() WHERE paciente_id = 1002;
COMMIT;

BEGIN;
UPDATE pacientes_saldo SET saldo_pendiente = 880.00, total_deuda = 2380.00, usuario_actualizo = 'FACTURACION', updated_at = NOW() WHERE paciente_id = 1003;
COMMIT;

BEGIN;
UPDATE pacientes_saldo SET saldo_pendiente = 0.00, total_deuda = 319.20, usuario_actualizo = 'FACTURACION', updated_at = NOW() WHERE paciente_id = 1004;
COMMIT;

BEGIN;
UPDATE pacientes_saldo SET saldo_pendiente = 2520.00, total_deuda = 2520.00, usuario_actualizo = 'FACTURACION', updated_at = NOW() WHERE paciente_id = 1005;
COMMIT;

BEGIN;
INSERT INTO pacientes_saldo (paciente_id, saldo_pendiente, total_deuda, usuario_actualizo, created_at, updated_at)
VALUES (1006, 284.00, 784.00, 'FACTURACION', NOW(), NOW())
ON CONFLICT (paciente_id) DO UPDATE SET saldo_pendiente = EXCLUDED.saldo_pendiente, total_deuda = EXCLUDED.total_deuda, updated_at = NOW();
COMMIT;

-- ============================================
-- 6. VERIFICACIÓN FINAL
-- ============================================

\set ON_ERROR_STOP on

SELECT E'\n====================================';
SELECT 'DATOS DE FACTURACIÓN CARGADOS' as status;
SELECT '====================================' as status;
SELECT COUNT(*) as "Medicinas" FROM medicinas WHERE id LIKE 'MED-%';
SELECT COUNT(*) as "Descuentos" FROM descuentos WHERE id LIKE 'DESC-%';
SELECT COUNT(*) as "Facturas" FROM ventas WHERE paciente_id BETWEEN 1001 AND 1006;
SELECT COUNT(*) as "Saldos Actualizados" FROM pacientes_saldo WHERE paciente_id BETWEEN 1001 AND 1006;
SELECT E'\n✅ Datos de facturación cargados exitosamente' as resultado;
SELECT '====================================' as status;
