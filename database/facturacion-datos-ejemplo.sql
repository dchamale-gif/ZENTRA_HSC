-- ============================================
-- DATOS DE EJEMPLO: MÓDULO DE FACTURACIÓN COMPLETO
-- Fecha: 2026-07-01
-- Base de Datos: PostgreSQL
-- Descripción: Inserta datos completos para facturación
-- IMPORTANTE: Inserta medicinas, facturas Y sus items
-- ============================================

\set ON_ERROR_STOP off

-- ============================================
-- 1. MEDICINAS/ARTÍCULOS
-- ============================================

BEGIN;
INSERT INTO medicinas (id, nombre, descripcion, principio_activo, concentracion, forma_farmaceutica, cantidad, cantidad_minima, precio_costo, precio_venta, lote, fecha_vencimiento, activo, created_at, updated_at)
VALUES 
    ('MED-001', 'Amoxicilina 500mg', 'Antibiótico - 30 cápsulas', 'Amoxicilina', '500mg', 'Capsula', 100, 10, 95.00, 150.00, 'AMOX2026', '2027-06-30', true, NOW(), NOW()),
    ('MED-002', 'Ibuprofeno 400mg', 'Analgésico - 50 tabletas', 'Ibuprofeno', '400mg', 'Tableta', 150, 20, 50.00, 85.00, 'IBU2026', '2027-08-15', true, NOW(), NOW()),
    ('MED-003', 'Paracetamol 500mg', 'Antipirético - 60 tabletas', 'Paracetamol', '500mg', 'Tableta', 200, 30, 35.00, 65.00, 'PAR2026', '2027-10-20', true, NOW(), NOW()),
    ('MED-004', 'Vitamina D 1000UI', 'Suplemento - 100 cápsulas', 'Colecalciferol', '1000UI', 'Capsula', 80, 15, 75.00, 120.00, 'VIT2026', '2027-12-01', true, NOW(), NOW()),
    ('MED-005', 'Metformina 500mg', 'Antidiabético - 60 tabletas', 'Metformina', '500mg', 'Tableta', 50, 10, 125.00, 200.00, 'MET2026', '2027-07-15', true, NOW(), NOW()),
    ('MED-006', 'Lisinopril 10mg', 'Antihipertensivo - 30 tabletas', 'Lisinopril', '10mg', 'Tableta', 60, 10, 110.00, 180.00, 'LIS2026', '2027-09-30', true, NOW(), NOW()),
    ('MED-007', 'Simvastatina 20mg', 'Hipolipemiante - 30 tabletas', 'Simvastatina', '20mg', 'Tableta', 40, 8, 140.00, 220.00, 'SIM2026', '2027-08-20', true, NOW(), NOW()),
    ('MED-008', 'Omeprazol 20mg', 'Gastroprotector - 28 cápsulas', 'Omeprazol', '20mg', 'Capsula', 90, 15, 85.00, 140.00, 'OMP2026', '2027-11-10', true, NOW(), NOW()),
    ('MED-009', 'Atorvastatina 40mg', 'Antilipidémico - 30 tabletas', 'Atorvastatina', '40mg', 'Tableta', 35, 8, 150.00, 240.00, 'ATV2026', '2027-09-05', true, NOW(), NOW()),
    ('MED-010', 'Fluoxetina 20mg', 'Antidepresivo - 30 cápsulas', 'Fluoxetina', '20mg', 'Capsula', 55, 10, 115.00, 190.00, 'FLU2026', '2027-10-25', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    precio_venta = EXCLUDED.precio_venta,
    updated_at = NOW();
COMMIT;

-- ============================================
-- 2. PACIENTE ADICIONAL (si no existe)
-- ============================================

BEGIN;
INSERT INTO pacientes (id, nombre, apellido_paterno, apellido_materno, edad, fecha_nacimiento, genero, dpi, telefono, email, estado, created_at, updated_at)
VALUES (1006, 'Elena', 'Rodríguez', 'Sánchez', 35, '1991-04-12', 'F', '6789012345678', '7845-1234', 'elena.rodriguez@email.com', 'activo', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

-- ============================================
-- 3. FACTURAS (VENTAS) - SIN items aún
-- ============================================

BEGIN;
INSERT INTO ventas (id, numero_venta, paciente_id, fecha, subtotal, descuento, impuesto, total, metodo_pago, estado, created_at, updated_at)
VALUES 
    ('VEN-7001', 'FAC-7001', 1001, '2026-06-15', 500.00, 0.00, 50.00, 550.00, 'efectivo', 'completada', NOW(), NOW()),
    ('VEN-7002', 'FAC-7002', 1002, '2026-06-16', 1200.00, 120.00, 129.60, 1089.60, 'efectivo', 'completada', NOW(), NOW()),
    ('VEN-7003', 'FAC-7003', 1003, '2026-06-17', 2500.00, 375.00, 255.00, 2380.00, 'efectivo', 'completada', NOW(), NOW()),
    ('VEN-7004', 'FAC-7004', 1004, '2026-06-18', 300.00, 15.00, 34.20, 319.20, 'efectivo', 'completada', NOW(), NOW()),
    ('VEN-7005', 'FAC-7005', 1005, '2026-06-19', 3000.00, 750.00, 270.00, 2520.00, 'efectivo', 'completada', NOW(), NOW()),
    ('VEN-7006', 'FAC-7006', 1006, '2026-06-20', 800.00, 100.00, 84.00, 784.00, 'efectivo', 'completada', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

-- ============================================
-- 4. ITEMS DE LAS FACTURAS (VENTA_ITEMS) - CRÍTICO
-- ============================================

-- Factura 7001: Paciente 1001
BEGIN;
INSERT INTO venta_items (id, venta_id, descripcion, cantidad, precio_unitario, subtotal, created_at)
VALUES 
    ('ITEM-7001-01', 'VEN-7001', 'Amoxicilina 500mg', 2, 150.00, 300.00, NOW()),
    ('ITEM-7001-02', 'VEN-7001', 'Paracetamol 500mg', 4, 50.00, 200.00, NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

-- Factura 7002: Paciente 1002
BEGIN;
INSERT INTO venta_items (id, venta_id, descripcion, cantidad, precio_unitario, subtotal, created_at)
VALUES 
    ('ITEM-7002-01', 'VEN-7002', 'Ibuprofeno 400mg', 8, 85.00, 680.00, NOW()),
    ('ITEM-7002-02', 'VEN-7002', 'Vitamina D 1000UI', 5, 120.00, 600.00, NOW()),
    ('ITEM-7002-03', 'VEN-7002', 'Metformina 500mg', 2, 200.00, 400.00, NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

-- Factura 7003: Paciente 1003
BEGIN;
INSERT INTO venta_items (id, venta_id, descripcion, cantidad, precio_unitario, subtotal, created_at)
VALUES 
    ('ITEM-7003-01', 'VEN-7003', 'Lisinopril 10mg', 4, 180.00, 720.00, NOW()),
    ('ITEM-7003-02', 'VEN-7003', 'Simvastatina 20mg', 6, 220.00, 1320.00, NOW()),
    ('ITEM-7003-03', 'VEN-7003', 'Omeprazol 20mg', 8, 140.00, 1120.00, NOW()),
    ('ITEM-7003-04', 'VEN-7003', 'Atorvastatina 40mg', 3, 240.00, 720.00, NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

-- Factura 7004: Paciente 1004
BEGIN;
INSERT INTO venta_items (id, venta_id, descripcion, cantidad, precio_unitario, subtotal, created_at)
VALUES 
    ('ITEM-7004-01', 'VEN-7004', 'Paracetamol 500mg', 3, 65.00, 195.00, NOW()),
    ('ITEM-7004-02', 'VEN-7004', 'Fluoxetina 20mg', 2, 190.00, 380.00, NOW()),
    ('ITEM-7004-03', 'VEN-7004', 'Vitamina D 1000UI', 1, 120.00, 120.00, NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

-- Factura 7005: Paciente 1005
BEGIN;
INSERT INTO venta_items (id, venta_id, descripcion, cantidad, precio_unitario, subtotal, created_at)
VALUES 
    ('ITEM-7005-01', 'VEN-7005', 'Amoxicilina 500mg', 10, 150.00, 1500.00, NOW()),
    ('ITEM-7005-02', 'VEN-7005', 'Metformina 500mg', 5, 200.00, 1000.00, NOW()),
    ('ITEM-7005-03', 'VEN-7005', 'Lisinopril 10mg', 3, 180.00, 540.00, NOW()),
    ('ITEM-7005-04', 'VEN-7005', 'Fluoxetina 20mg', 4, 190.00, 760.00, NOW()),
    ('ITEM-7005-05', 'VEN-7005', 'Omeprazol 20mg', 5, 140.00, 700.00, NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

-- Factura 7006: Paciente 1006
BEGIN;
INSERT INTO venta_items (id, venta_id, descripcion, cantidad, precio_unitario, subtotal, created_at)
VALUES 
    ('ITEM-7006-01', 'VEN-7006', 'Ibuprofeno 400mg', 6, 85.00, 510.00, NOW()),
    ('ITEM-7006-02', 'VEN-7006', 'Simvastatina 20mg', 2, 220.00, 440.00, NOW()),
    ('ITEM-7006-03', 'VEN-7006', 'Atorvastatina 40mg', 1, 240.00, 240.00, NOW())
ON CONFLICT (id) DO NOTHING;
COMMIT;

-- ============================================
-- 5. ACTUALIZAR SALDOS DE PACIENTES
-- ============================================

BEGIN;
INSERT INTO pacientes_saldo (paciente_id, saldo_pendiente, total_deuda, usuario_actualizo, created_at, updated_at)
VALUES 
    (1001, 260.00, 560.00, 'FACTURACION', NOW(), NOW()),
    (1002, 0.00, 1089.60, 'FACTURACION', NOW(), NOW()),
    (1003, 880.00, 2380.00, 'FACTURACION', NOW(), NOW()),
    (1004, 0.00, 319.20, 'FACTURACION', NOW(), NOW()),
    (1005, 2520.00, 2520.00, 'FACTURACION', NOW(), NOW()),
    (1006, 284.00, 784.00, 'FACTURACION', NOW(), NOW())
ON CONFLICT (paciente_id) DO UPDATE SET
    saldo_pendiente = EXCLUDED.saldo_pendiente,
    total_deuda = EXCLUDED.total_deuda,
    usuario_actualizo = EXCLUDED.usuario_actualizo,
    updated_at = NOW();
COMMIT;

-- ============================================
-- 6. VERIFICACIÓN FINAL
-- ============================================

\set ON_ERROR_STOP on

SELECT E'\n====================================';
SELECT 'DATOS DE FACTURACIÓN CARGADOS' as status;
SELECT '====================================' as status;
SELECT COUNT(*) as "Total Medicinas" FROM medicinas WHERE id LIKE 'MED-%';
SELECT COUNT(*) as "Total Facturas" FROM ventas WHERE paciente_id BETWEEN 1001 AND 1006;
SELECT COUNT(*) as "Total Items en Facturas" FROM venta_items WHERE venta_id LIKE 'VEN-700%';
SELECT COUNT(*) as "Total Saldos Actualizados" FROM pacientes_saldo WHERE paciente_id BETWEEN 1001 AND 1006;
SELECT E'\n✅ LISTO - Los datos aparecerán en Estados de Cuenta' as resultado;
SELECT '====================================' as status;
