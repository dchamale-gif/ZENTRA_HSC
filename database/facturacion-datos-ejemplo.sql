-- ============================================
-- DATOS DE EJEMPLO: MÓDULO DE FACTURACIÓN
-- Fecha: 2026-06-26
-- ============================================
-- Este script inserta datos de ejemplo completos para todo el módulo de facturación
-- Incluye: pacientes, medicinas, descuentos, facturas, items, pagos y saldos

USE sistema_contable;

-- ============================================
-- 1. ASEGURAR TIPOS DE DESCUENTOS
-- ============================================

INSERT IGNORE INTO tipos_descuentos (nombre, descripcion, codigo, activo, created_at, updated_at) 
VALUES 
  ('Porcentaje', 'Descuento expresado como porcentaje', 'PCT', true, NOW(), NOW()),
  ('Cantidad Fija', 'Descuento expresado como cantidad fija', 'FIX', true, NOW(), NOW()),
  ('Copago', 'Copago para pacientes con seguro', 'COPAGO', true, NOW(), NOW());

-- ============================================
-- 2. CONFIGURACIÓN DE IMPUESTOS
-- ============================================

INSERT IGNORE INTO configuracion_impuestos (nombre, porcentaje, activo, es_predeterminado, created_at, updated_at) 
VALUES 
  ('IVA', 12.00, true, true, NOW(), NOW()),
  ('ISR Retención', 5.00, true, false, NOW(), NOW()),
  ('Impuesto Municipal', 2.00, false, false, NOW(), NOW());

-- ============================================
-- 3. DESCUENTOS PREDEFINIDOS
-- ============================================

INSERT IGNORE INTO descuentos (id, nombre, descripcion, tipo_descuento, valor, minimo_aplicable, maximo_uso, usos_realizados, codigo_promocion, activo, fecha_inicio, fecha_fin, created_at, updated_at) 
VALUES 
  ('DESC-001-VOL10', 'Descuento por Volumen 10%', 'Aplicable a compras mayores a Q500', 'porcentaje', 10.00, 500.00, NULL, 0, 'VOLUMEN10', true, '2026-06-01', '2026-12-31', NOW(), NOW()),
  ('DESC-002-VOL15', 'Descuento por Volumen 15%', 'Aplicable a compras mayores a Q1000', 'porcentaje', 15.00, 1000.00, NULL, 0, 'VOLUMEN15', true, '2026-06-01', '2026-12-31', NOW(), NOW()),
  ('DESC-003-VIP', 'Descuento Cliente VIP 20%', 'Descuento exclusivo para clientes VIP', 'porcentaje', 20.00, 0.00, NULL, 0, 'CLIENTEVIP', true, '2026-06-01', '2026-12-31', NOW(), NOW()),
  ('DESC-004-PROMO50', 'Promoción Q50 de Descuento', 'Descuento especial de Q50', 'fijo', 50.00, 200.00, 100, 0, 'PROMO50', true, '2026-06-01', '2026-07-31', NOW(), NOW()),
  ('DESC-005-PROMO100', 'Mega Descuento Q100', 'Gran descuento de Q100', 'fijo', 100.00, 500.00, 50, 0, 'MEGA100', true, '2026-06-01', '2026-07-31', NOW(), NOW()),
  ('DESC-006-AFILIADO', 'Descuento Afiliado 5%', 'Descuento para pacientes afiliados', 'porcentaje', 5.00, 0.00, NULL, 0, 'AFILIADO', true, '2026-06-01', '2026-12-31', NOW(), NOW()),
  ('DESC-007-BULK', 'Descuento Compra al Granel 25%', 'Descuento por compra importante', 'porcentaje', 25.00, 2000.00, NULL, 0, 'BULKBUY', true, '2026-06-01', '2026-12-31', NOW(), NOW());

-- ============================================
-- 4. ASEGURAR PACIENTES DE EJEMPLO
-- ============================================

INSERT IGNORE INTO pacientes (id, cedula, nombre, apellido, edad, genero, telefono, email, activo, created_at, updated_at) 
VALUES 
  ('PAC-001', '1234567890', 'Juan', 'Pérez', 45, 'M', '5551234567', 'juan.perez@email.com', true, NOW(), NOW()),
  ('PAC-002', '0987654321', 'María', 'González', 38, 'F', '5559876543', 'maria.gonzalez@email.com', true, NOW(), NOW()),
  ('PAC-003', '1122334455', 'Carlos', 'López', 52, 'M', '5552223344', 'carlos.lopez@email.com', true, NOW(), NOW()),
  ('PAC-004', '5566778899', 'Ana', 'Martínez', 29, 'F', '5556667788', 'ana.martinez@email.com', true, NOW(), NOW()),
  ('PAC-005', '1212121212', 'Roberto', 'García', 61, 'M', '5551313131', 'roberto.garcia@email.com', true, NOW(), NOW()),
  ('PAC-006', '3434343434', 'Elena', 'Rodríguez', 35, 'F', '5554545454', 'elena.rodriguez@email.com', true, NOW(), NOW());

-- ============================================
-- 5. SALDO DE PACIENTES INICIAL
-- ============================================

INSERT IGNORE INTO pacientes_saldo (id, paciente_id, saldo_pendiente, total_deuda, usuario_actualizo, created_at, updated_at) 
VALUES 
  ('SALDO-001', 'PAC-001', 0.00, 0.00, 'SYSTEM', NOW(), NOW()),
  ('SALDO-002', 'PAC-002', 0.00, 0.00, 'SYSTEM', NOW(), NOW()),
  ('SALDO-003', 'PAC-003', 0.00, 0.00, 'SYSTEM', NOW(), NOW()),
  ('SALDO-004', 'PAC-004', 0.00, 0.00, 'SYSTEM', NOW(), NOW()),
  ('SALDO-005', 'PAC-005', 0.00, 0.00, 'SYSTEM', NOW(), NOW()),
  ('SALDO-006', 'PAC-006', 0.00, 0.00, 'SYSTEM', NOW(), NOW());

-- ============================================
-- 6. MEDICINAS/ARTÍCULOS DE EJEMPLO
-- ============================================

INSERT IGNORE INTO medicinas (id, nombre, descripcion, precio, stock_disponible, stock_minimo, fabricante, lote, fecha_vencimiento, activo, created_at, updated_at) 
VALUES 
  ('MED-001', 'Amoxicilina 500mg', 'Antibiótico - 30 cápsulas', 150.00, 100, 10, 'FarmaLab', 'AMOX2026', '2027-06-30', true, NOW(), NOW()),
  ('MED-002', 'Ibuprofeno 400mg', 'Analgésico - 50 tabletas', 85.00, 150, 20, 'MediCare', 'IBU2026', '2027-08-15', true, NOW(), NOW()),
  ('MED-003', 'Paracetamol 500mg', 'Antipirético - 60 tabletas', 65.00, 200, 30, 'HealthCare', 'PAR2026', '2027-10-20', true, NOW(), NOW()),
  ('MED-004', 'Vitamina D 1000UI', 'Suplemento - 100 cápsulas', 120.00, 80, 15, 'Nutragenix', 'VIT2026', '2027-12-01', true, NOW(), NOW()),
  ('MED-005', 'Metformina 500mg', 'Antidiabético - 60 tabletas', 200.00, 50, 10, 'DiabetoCare', 'MET2026', '2027-07-15', true, NOW(), NOW()),
  ('MED-006', 'Lisinopril 10mg', 'Antihipertensivo - 30 tabletas', 180.00, 60, 10, 'CardioPlus', 'LIS2026', '2027-09-30', true, NOW(), NOW()),
  ('MED-007', 'Simvastatina 20mg', 'Hipolipemiante - 30 tabletas', 220.00, 40, 8, 'LipidCare', 'SIM2026', '2027-08-20', true, NOW(), NOW()),
  ('MED-008', 'Omeprazol 20mg', 'Gastroprotector - 28 cápsulas', 140.00, 90, 15, 'GastroCare', 'OMP2026', '2027-11-10', true, NOW(), NOW()),
  ('MED-009', 'Atorvastatina 40mg', 'Antilipidémico - 30 tabletas', 240.00, 35, 8, 'CholesteroLow', 'ATV2026', '2027-09-05', true, NOW(), NOW()),
  ('MED-010', 'Fluoxetina 20mg', 'Antidepresivo - 30 cápsulas', 190.00, 55, 10, 'MindCare', 'FLU2026', '2027-10-25', true, NOW(), NOW());

-- ============================================
-- 7. USUARIO PREDETERMINADO PARA FACTURACIÓN
-- ============================================

-- Obtener el ID del primer usuario disponible (se usará para las facturas)
SET @user_id := 1;

-- ============================================
-- 8. FACTURAS DE EJEMPLO (Ventas Mejorada)
-- ============================================

-- Factura 1: Para PAC-001, Simple
INSERT IGNORE INTO ventas (
    id, numero_factura, paciente_id, user_id, fecha, 
    subtotal, total_descuentos, base_impuesto, total_impuestos, total, 
    metodo_pago, estado, tipo_factura, observaciones, created_at, updated_at
) VALUES (
    'FAC-001', 'FAC-001-2026-06-26-001', 'PAC-001', @user_id, '2026-06-26',
    500.00, 0.00, 500.00, 60.00, 560.00,
    'efectivo', 'completada', 'normal', 'Consulta y medicamentos', NOW(), NOW()
);

-- Factura 2: Para PAC-002, Con descuento
INSERT IGNORE INTO ventas (
    id, numero_factura, paciente_id, user_id, fecha,
    subtotal, total_descuentos, base_impuesto, total_impuestos, total,
    metodo_pago, estado, tipo_factura, observaciones, created_at, updated_at
) VALUES (
    'FAC-002', 'FAC-002-2026-06-26-002', 'PAC-002', @user_id, '2026-06-26',
    1200.00, 120.00, 1080.00, 129.60, 1089.60,
    'tarjeta', 'completada', 'normal', 'Tratamiento integral - Descuento aplicado', NOW(), NOW()
);

-- Factura 3: Para PAC-003, Cantidad alta
INSERT IGNORE INTO ventas (
    id, numero_factura, paciente_id, user_id, fecha,
    subtotal, total_descuentos, base_impuesto, total_impuestos, total,
    metodo_pago, estado, tipo_factura, observaciones, created_at, updated_at
) VALUES (
    'FAC-003', 'FAC-003-2026-06-26-003', 'PAC-003', @user_id, '2026-06-25',
    2500.00, 375.00, 2125.00, 255.00, 2380.00,
    'cheque', 'completada', 'normal', 'Compra al granel - 15% descuento por volumen', NOW(), NOW()
);

-- Factura 4: Para PAC-004, Pequeña cantidad
INSERT IGNORE INTO ventas (
    id, numero_factura, paciente_id, user_id, fecha,
    subtotal, total_descuentos, base_impuesto, total_impuestos, total,
    metodo_pago, estado, tipo_factura, observaciones, created_at, updated_at
) VALUES (
    'FAC-004', 'FAC-004-2026-06-26-004', 'PAC-004', @user_id, '2026-06-26',
    300.00, 15.00, 285.00, 34.20, 319.20,
    'efectivo', 'completada', 'normal', 'Copago - Descuento afiliado 5%', NOW(), NOW()
);

-- Factura 5: Para PAC-005, Compra importante
INSERT IGNORE INTO ventas (
    id, numero_factura, paciente_id, user_id, fecha,
    subtotal, total_descuentos, base_impuesto, total_impuestos, total,
    metodo_pago, estado, tipo_factura, observaciones, created_at, updated_at
) VALUES (
    'FAC-005', 'FAC-005-2026-06-26-005', 'PAC-005', @user_id, '2026-06-24',
    3000.00, 750.00, 2250.00, 270.00, 2520.00,
    'transferencia', 'completada', 'normal', 'Compra VIP - 25% descuento aplicado', NOW(), NOW()
);

-- Factura 6: Para PAC-006, Descuento fijo
INSERT IGNORE INTO ventas (
    id, numero_factura, paciente_id, user_id, fecha,
    subtotal, total_descuentos, base_impuesto, total_impuestos, total,
    metodo_pago, estado, tipo_factura, observaciones, created_at, updated_at
) VALUES (
    'FAC-006', 'FAC-006-2026-06-26-006', 'PAC-006', @user_id, '2026-06-23',
    800.00, 100.00, 700.00, 84.00, 784.00,
    'efectivo', 'completada', 'normal', 'Promoción especial - Q100 descuento', NOW(), NOW()
);

-- ============================================
-- 9. ITEMS DE FACTURAS
-- ============================================

-- Items Factura 1 (FAC-001)
INSERT IGNORE INTO venta_items (
    id, venta_id, descripcion, cantidad, precio_unitario, subtotal, descuento, total, tipo_item, medicina_id, created_at, updated_at
) VALUES 
  ('ITEM-001-01', 'FAC-001', 'Amoxicilina 500mg', 2, 150.00, 300.00, 0.00, 300.00, 'medicina', 'MED-001', NOW(), NOW()),
  ('ITEM-001-02', 'FAC-001', 'Ibuprofeno 400mg', 1, 85.00, 85.00, 0.00, 85.00, 'medicina', 'MED-002', NOW(), NOW()),
  ('ITEM-001-03', 'FAC-001', 'Consulta Médica', 1, 115.00, 115.00, 0.00, 115.00, 'servicio', NULL, NOW(), NOW());

-- Items Factura 2 (FAC-002)
INSERT IGNORE INTO venta_items (
    id, venta_id, descripcion, cantidad, precio_unitario, subtotal, descuento, total, tipo_item, medicina_id, created_at, updated_at
) VALUES 
  ('ITEM-002-01', 'FAC-002', 'Metformina 500mg', 3, 200.00, 600.00, 60.00, 540.00, 'medicina', 'MED-005', NOW(), NOW()),
  ('ITEM-002-02', 'FAC-002', 'Vitamina D 1000UI', 2, 120.00, 240.00, 24.00, 216.00, 'medicina', 'MED-004', NOW(), NOW()),
  ('ITEM-002-03', 'FAC-002', 'Análisis de Laboratorio', 1, 360.00, 360.00, 36.00, 324.00, 'servicio', NULL, NOW(), NOW());

-- Items Factura 3 (FAC-003)
INSERT IGNORE INTO venta_items (
    id, venta_id, descripcion, cantidad, precio_unitario, subtotal, descuento, total, tipo_item, medicina_id, created_at, updated_at
) VALUES 
  ('ITEM-003-01', 'FAC-003', 'Lisinopril 10mg', 5, 180.00, 900.00, 135.00, 765.00, 'medicina', 'MED-006', NOW(), NOW()),
  ('ITEM-003-02', 'FAC-003', 'Simvastatina 20mg', 4, 220.00, 880.00, 132.00, 748.00, 'medicina', 'MED-007', NOW(), NOW()),
  ('ITEM-003-03', 'FAC-003', 'Atorvastatina 40mg', 3, 240.00, 720.00, 108.00, 612.00, 'medicina', 'MED-009', NOW(), NOW());

-- Items Factura 4 (FAC-004)
INSERT IGNORE INTO venta_items (
    id, venta_id, descripcion, cantidad, precio_unitario, subtotal, descuento, total, tipo_item, medicina_id, created_at, updated_at
) VALUES 
  ('ITEM-004-01', 'FAC-004', 'Omeprazol 20mg', 1, 140.00, 140.00, 7.00, 133.00, 'medicina', 'MED-008', NOW(), NOW()),
  ('ITEM-004-02', 'FAC-004', 'Paracetamol 500mg', 1, 65.00, 65.00, 3.25, 61.75, 'medicina', 'MED-003', NOW(), NOW()),
  ('ITEM-004-03', 'FAC-004', 'Consulta Dentista', 1, 95.00, 95.00, 4.75, 90.25, 'servicio', NULL, NOW(), NOW());

-- Items Factura 5 (FAC-005)
INSERT IGNORE INTO venta_items (
    id, venta_id, descripcion, cantidad, precio_unitario, subtotal, descuento, total, tipo_item, medicina_id, created_at, updated_at
) VALUES 
  ('ITEM-005-01', 'FAC-005', 'Fluoxetina 20mg', 10, 190.00, 1900.00, 475.00, 1425.00, 'medicina', 'MED-010', NOW(), NOW()),
  ('ITEM-005-02', 'FAC-005', 'Amoxicilina 500mg', 5, 150.00, 750.00, 187.50, 562.50, 'medicina', 'MED-001', NOW(), NOW()),
  ('ITEM-005-03', 'FAC-005', 'Sesión Psicología', 2, 175.00, 350.00, 87.50, 262.50, 'servicio', NULL, NOW(), NOW());

-- Items Factura 6 (FAC-006)
INSERT IGNORE INTO venta_items (
    id, venta_id, descripcion, cantidad, precio_unitario, subtotal, descuento, total, tipo_item, medicina_id, created_at, updated_at
) VALUES 
  ('ITEM-006-01', 'FAC-006', 'Ibuprofeno 400mg', 3, 85.00, 255.00, 0.00, 255.00, 'medicina', 'MED-002', NOW(), NOW()),
  ('ITEM-006-02', 'FAC-006', 'Paracetamol 500mg', 4, 65.00, 260.00, 0.00, 260.00, 'medicina', 'MED-003', NOW(), NOW()),
  ('ITEM-006-03', 'FAC-006', 'Revisión General', 1, 285.00, 285.00, 100.00, 185.00, 'servicio', NULL, NOW(), NOW());

-- ============================================
-- 10. DESCUENTOS DE ITEMS
-- ============================================

-- Descuentos Factura 2 (Items)
INSERT IGNORE INTO venta_item_descuentos (
    id, venta_item_id, tipo_descuento, valor, monto_descuento, motivo, usuario_id, created_at
) VALUES 
  ('IDESC-001', 'ITEM-002-01', 'porcentaje', 10.00, 60.00, 'Descuento volumen - Metformina', @user_id, NOW()),
  ('IDESC-002', 'ITEM-002-02', 'porcentaje', 10.00, 24.00, 'Descuento volumen - Vitamina D', @user_id, NOW()),
  ('IDESC-003', 'ITEM-002-03', 'porcentaje', 10.00, 36.00, 'Descuento análisis múltiple', @user_id, NOW());

-- Descuentos Factura 3 (Items)
INSERT IGNORE INTO venta_item_descuentos (
    id, venta_item_id, tipo_descuento, valor, monto_descuento, motivo, usuario_id, created_at
) VALUES 
  ('IDESC-004', 'ITEM-003-01', 'porcentaje', 15.00, 135.00, 'Descuento volumen 15%', @user_id, NOW()),
  ('IDESC-005', 'ITEM-003-02', 'porcentaje', 15.00, 132.00, 'Descuento volumen 15%', @user_id, NOW()),
  ('IDESC-006', 'ITEM-003-03', 'porcentaje', 15.00, 108.00, 'Descuento volumen 15%', @user_id, NOW());

-- Descuentos Factura 4 (Items)
INSERT IGNORE INTO venta_item_descuentos (
    id, venta_item_id, tipo_descuento, valor, monto_descuento, motivo, usuario_id, created_at
) VALUES 
  ('IDESC-007', 'ITEM-004-01', 'porcentaje', 5.00, 7.00, 'Descuento afiliado 5%', @user_id, NOW()),
  ('IDESC-008', 'ITEM-004-02', 'porcentaje', 5.00, 3.25, 'Descuento afiliado 5%', @user_id, NOW()),
  ('IDESC-009', 'ITEM-004-03', 'porcentaje', 5.00, 4.75, 'Descuento afiliado 5%', @user_id, NOW());

-- Descuentos Factura 5 (Items)
INSERT IGNORE INTO venta_item_descuentos (
    id, venta_item_id, tipo_descuento, valor, monto_descuento, motivo, usuario_id, created_at
) VALUES 
  ('IDESC-010', 'ITEM-005-01', 'porcentaje', 25.00, 475.00, 'Descuento cliente VIP 25%', @user_id, NOW()),
  ('IDESC-011', 'ITEM-005-02', 'porcentaje', 25.00, 187.50, 'Descuento cliente VIP 25%', @user_id, NOW()),
  ('IDESC-012', 'ITEM-005-03', 'porcentaje', 25.00, 87.50, 'Descuento cliente VIP 25%', @user_id, NOW());

-- Descuentos Factura 6 (Items)
INSERT IGNORE INTO venta_item_descuentos (
    id, venta_item_id, tipo_descuento, valor, monto_descuento, motivo, usuario_id, created_at
) VALUES 
  ('IDESC-013', 'ITEM-006-03', 'fijo', 100.00, 100.00, 'Promoción especial Q100 descuento', @user_id, NOW());

-- ============================================
-- 11. DESCUENTOS A NIVEL DE FACTURA
-- ============================================

-- Factura 2: Descuento general
INSERT IGNORE INTO venta_descuentos (
    id, venta_id, descuento_id, tipo_descuento, valor, monto_descuento, codigo_aplicado, motivo, usuario_id, created_at
) VALUES 
  ('VDESC-001', 'FAC-002', 'DESC-001-VOL10', 'porcentaje', 10.00, 120.00, 'VOLUMEN10', 'Descuento por volumen compra', @user_id, NOW());

-- Factura 3: Descuento volumen
INSERT IGNORE INTO venta_descuentos (
    id, venta_id, descuento_id, tipo_descuento, valor, monto_descuento, codigo_aplicado, motivo, usuario_id, created_at
) VALUES 
  ('VDESC-002', 'FAC-003', 'DESC-002-VOL15', 'porcentaje', 15.00, 375.00, 'VOLUMEN15', 'Descuento volumen superior', @user_id, NOW());

-- Factura 4: Descuento afiliado
INSERT IGNORE INTO venta_descuentos (
    id, venta_id, descuento_id, tipo_descuento, valor, monto_descuento, codigo_aplicado, motivo, usuario_id, created_at
) VALUES 
  ('VDESC-003', 'FAC-004', 'DESC-006-AFILIADO', 'porcentaje', 5.00, 15.00, 'AFILIADO', 'Descuento para paciente afiliado', @user_id, NOW());

-- Factura 5: Descuento VIP
INSERT IGNORE INTO venta_descuentos (
    id, venta_id, descuento_id, tipo_descuento, valor, monto_descuento, codigo_aplicado, motivo, usuario_id, created_at
) VALUES 
  ('VDESC-004', 'FAC-005', 'DESC-007-BULK', 'porcentaje', 25.00, 750.00, 'BULKBUY', 'Descuento compra importante cliente VIP', @user_id, NOW());

-- Factura 6: Descuento promocional
INSERT IGNORE INTO venta_descuentos (
    id, venta_id, descuento_id, tipo_descuento, valor, monto_descuento, codigo_aplicado, motivo, usuario_id, created_at
) VALUES 
  ('VDESC-005', 'FAC-006', 'DESC-005-PROMO100', 'fijo', 100.00, 100.00, 'MEGA100', 'Promoción especial vigente', @user_id, NOW());

-- ============================================
-- 12. ACTUALIZAR SALDOS DE PACIENTES
-- ============================================

UPDATE pacientes_saldo 
SET saldo_pendiente = 560.00, total_deuda = 560.00, usuario_actualizo = 'FACTURACION', updated_at = NOW()
WHERE paciente_id = 'PAC-001';

UPDATE pacientes_saldo 
SET saldo_pendiente = 1089.60, total_deuda = 1089.60, usuario_actualizo = 'FACTURACION', updated_at = NOW()
WHERE paciente_id = 'PAC-002';

UPDATE pacientes_saldo 
SET saldo_pendiente = 2380.00, total_deuda = 2380.00, usuario_actualizo = 'FACTURACION', updated_at = NOW()
WHERE paciente_id = 'PAC-003';

UPDATE pacientes_saldo 
SET saldo_pendiente = 319.20, total_deuda = 319.20, usuario_actualizo = 'FACTURACION', updated_at = NOW()
WHERE paciente_id = 'PAC-004';

UPDATE pacientes_saldo 
SET saldo_pendiente = 2520.00, total_deuda = 2520.00, usuario_actualizo = 'FACTURACION', updated_at = NOW()
WHERE paciente_id = 'PAC-005';

UPDATE pacientes_saldo 
SET saldo_pendiente = 784.00, total_deuda = 784.00, usuario_actualizo = 'FACTURACION', updated_at = NOW()
WHERE paciente_id = 'PAC-006';

-- ============================================
-- 13. HISTORIAL DE MOVIMIENTOS
-- ============================================

-- Movimientos PAC-001
INSERT IGNORE INTO movimientos_paciente (
    id, paciente_id, tipo, descripcion, monto, saldo_anterior, saldo_nuevo, referencia_id, usuario_id, fecha, created_at
) VALUES 
  ('MOV-001-01', 'PAC-001', 'factura', 'Factura FAC-001-2026-06-26-001 creada', 560.00, 0.00, 560.00, 'FAC-001', @user_id, NOW(), NOW());

-- Movimientos PAC-002
INSERT IGNORE INTO movimientos_paciente (
    id, paciente_id, tipo, descripcion, monto, saldo_anterior, saldo_nuevo, referencia_id, usuario_id, fecha, created_at
) VALUES 
  ('MOV-002-01', 'PAC-002', 'factura', 'Factura FAC-002-2026-06-26-002 creada', 1089.60, 0.00, 1089.60, 'FAC-002', @user_id, NOW(), NOW());

-- Movimientos PAC-003
INSERT IGNORE INTO movimientos_paciente (
    id, paciente_id, tipo, descripcion, monto, saldo_anterior, saldo_nuevo, referencia_id, usuario_id, fecha, created_at
) VALUES 
  ('MOV-003-01', 'PAC-003', 'factura', 'Factura FAC-003-2026-06-26-003 creada', 2380.00, 0.00, 2380.00, 'FAC-003', @user_id, NOW(), NOW());

-- Movimientos PAC-004
INSERT IGNORE INTO movimientos_paciente (
    id, paciente_id, tipo, descripcion, monto, saldo_anterior, saldo_nuevo, referencia_id, usuario_id, fecha, created_at
) VALUES 
  ('MOV-004-01', 'PAC-004', 'factura', 'Factura FAC-004-2026-06-26-004 creada', 319.20, 0.00, 319.20, 'FAC-004', @user_id, NOW(), NOW());

-- Movimientos PAC-005
INSERT IGNORE INTO movimientos_paciente (
    id, paciente_id, tipo, descripcion, monto, saldo_anterior, saldo_nuevo, referencia_id, usuario_id, fecha, created_at
) VALUES 
  ('MOV-005-01', 'PAC-005', 'factura', 'Factura FAC-005-2026-06-26-005 creada', 2520.00, 0.00, 2520.00, 'FAC-005', @user_id, NOW(), NOW());

-- Movimientos PAC-006
INSERT IGNORE INTO movimientos_paciente (
    id, paciente_id, tipo, descripcion, monto, saldo_anterior, saldo_nuevo, referencia_id, usuario_id, fecha, created_at
) VALUES 
  ('MOV-006-01', 'PAC-006', 'factura', 'Factura FAC-006-2026-06-26-006 creada', 784.00, 0.00, 784.00, 'FAC-006', @user_id, NOW(), NOW());

-- ============================================
-- 14. PAGOS/ABONOS DE EJEMPLO
-- ============================================

-- Pago PAC-001: Abono parcial
INSERT IGNORE INTO pagos_paciente (
    id, paciente_id, monto, metodo_pago, referencia, observaciones, usuario_id, fecha_pago, created_at
) VALUES 
  ('PAG-001', 'PAC-001', 300.00, 'efectivo', 'ABONO-001-2026-06-26', 'Abono a cuenta', @user_id, NOW(), NOW());

-- Pago PAC-002: Pago completo
INSERT IGNORE INTO pagos_paciente (
    id, paciente_id, monto, metodo_pago, referencia, observaciones, usuario_id, fecha_pago, created_at
) VALUES 
  ('PAG-002', 'PAC-002', 1089.60, 'tarjeta', 'PAGO-002-2026-06-26', 'Pago completo tarjeta crédito', @user_id, NOW(), NOW());

-- Pago PAC-003: Abono parcial
INSERT IGNORE INTO pagos_paciente (
    id, paciente_id, monto, metodo_pago, referencia, observaciones, usuario_id, fecha_pago, created_at
) VALUES 
  ('PAG-003', 'PAC-003', 1500.00, 'cheque', 'CHEQUE-003-2026-06-26', 'Primer abono, quedan Q880', @user_id, NOW(), NOW());

-- Pago PAC-004: Pago completo
INSERT IGNORE INTO pagos_paciente (
    id, paciente_id, monto, metodo_pago, referencia, observaciones, usuario_id, fecha_pago, created_at
) VALUES 
  ('PAG-004', 'PAC-004', 319.20, 'efectivo', 'PAGO-004-2026-06-26', 'Pago completo en efectivo', @user_id, NOW(), NOW());

-- Pago PAC-005: Sin pagos aún (pendiente)
-- Pago PAC-006: Abono parcial
INSERT IGNORE INTO pagos_paciente (
    id, paciente_id, monto, metodo_pago, referencia, observaciones, usuario_id, fecha_pago, created_at
) VALUES 
  ('PAG-006', 'PAC-006', 500.00, 'transferencia', 'TRANSF-006-2026-06-26', 'Abono inicial de compra', @user_id, NOW(), NOW());

-- ============================================
-- 15. ACTUALIZAR SALDOS DESPUÉS DE PAGOS
-- ============================================

-- PAC-001: Tenía 560, pagó 300, quedan 260
UPDATE pacientes_saldo 
SET saldo_pendiente = 260.00, usuario_actualizo = 'PAGOS', updated_at = NOW()
WHERE paciente_id = 'PAC-001';

-- PAC-002: Tenía 1089.60, pagó 1089.60, quedan 0
UPDATE pacientes_saldo 
SET saldo_pendiente = 0.00, usuario_actualizo = 'PAGOS', updated_at = NOW()
WHERE paciente_id = 'PAC-002';

-- PAC-003: Tenía 2380, pagó 1500, quedan 880
UPDATE pacientes_saldo 
SET saldo_pendiente = 880.00, usuario_actualizo = 'PAGOS', updated_at = NOW()
WHERE paciente_id = 'PAC-003';

-- PAC-004: Tenía 319.20, pagó 319.20, quedan 0
UPDATE pacientes_saldo 
SET saldo_pendiente = 0.00, usuario_actualizo = 'PAGOS', updated_at = NOW()
WHERE paciente_id = 'PAC-004';

-- PAC-005: Sin pagos, mantiene 2520
-- PAC-006: Tenía 784, pagó 500, quedan 284
UPDATE pacientes_saldo 
SET saldo_pendiente = 284.00, usuario_actualizo = 'PAGOS', updated_at = NOW()
WHERE paciente_id = 'PAC-006';

-- ============================================
-- 16. MOVIMIENTOS ADICIONALES DE PAGOS
-- ============================================

-- Registro de pago PAC-001
INSERT IGNORE INTO movimientos_paciente (
    id, paciente_id, tipo, descripcion, monto, saldo_anterior, saldo_nuevo, referencia_id, usuario_id, fecha, created_at
) VALUES 
  ('MOV-001-02', 'PAC-001', 'pago', 'Pago recibido - Q300', -300.00, 560.00, 260.00, 'PAG-001', @user_id, NOW(), NOW());

-- Registro de pago PAC-002
INSERT IGNORE INTO movimientos_paciente (
    id, paciente_id, tipo, descripcion, monto, saldo_anterior, saldo_nuevo, referencia_id, usuario_id, fecha, created_at
) VALUES 
  ('MOV-002-02', 'PAC-002', 'pago', 'Pago recibido - Q1089.60 (Saldo pago)', -1089.60, 1089.60, 0.00, 'PAG-002', @user_id, NOW(), NOW());

-- Registro de pago PAC-003
INSERT IGNORE INTO movimientos_paciente (
    id, paciente_id, tipo, descripcion, monto, saldo_anterior, saldo_nuevo, referencia_id, usuario_id, fecha, created_at
) VALUES 
  ('MOV-003-02', 'PAC-003', 'pago', 'Pago recibido - Q1500 (Parcial)', -1500.00, 2380.00, 880.00, 'PAG-003', @user_id, NOW(), NOW());

-- Registro de pago PAC-004
INSERT IGNORE INTO movimientos_paciente (
    id, paciente_id, tipo, descripcion, monto, saldo_anterior, saldo_nuevo, referencia_id, usuario_id, fecha, created_at
) VALUES 
  ('MOV-004-02', 'PAC-004', 'pago', 'Pago recibido - Q319.20 (Saldo pago)', -319.20, 319.20, 0.00, 'PAG-004', @user_id, NOW(), NOW());

-- Registro de pago PAC-006
INSERT IGNORE INTO movimientos_paciente (
    id, paciente_id, tipo, descripcion, monto, saldo_anterior, saldo_nuevo, referencia_id, usuario_id, fecha, created_at
) VALUES 
  ('MOV-006-02', 'PAC-006', 'pago', 'Pago recibido - Q500 (Parcial)', -500.00, 784.00, 284.00, 'PAG-006', @user_id, NOW(), NOW());

-- ============================================
-- RESUMEN DE DATOS INSERTADOS
-- ============================================
/*
RESUMEN DE FACTURACIÓN DE EJEMPLO INSERTADA:

1. PACIENTES: 6 pacientes de ejemplo
2. MEDICINAS: 10 medicinas disponibles
3. DESCUENTOS: 7 tipos de descuentos predefinidos
4. IMPUESTOS: 3 configuraciones de impuestos (IVA 12%, ISR 5%, Municipal 2%)

FACTURAS CREADAS: 6 facturas completas

Factura 1 (FAC-001): Q560.00 (PAC-001 - Juan Pérez)
  - Saldo actual: Q260.00 (pagó Q300 de Q560)
  
Factura 2 (FAC-002): Q1,089.60 (PAC-002 - María González) 
  - Saldo actual: Q0.00 (Pagada completamente)
  - Con descuento 10% por volumen
  
Factura 3 (FAC-003): Q2,380.00 (PAC-003 - Carlos López)
  - Saldo actual: Q880.00 (pagó Q1,500 de Q2,380)
  - Con descuento 15% por volumen importante
  
Factura 4 (FAC-004): Q319.20 (PAC-004 - Ana Martínez)
  - Saldo actual: Q0.00 (Pagada completamente)
  - Con descuento 5% afiliado
  
Factura 5 (FAC-005): Q2,520.00 (PAC-005 - Roberto García)
  - Saldo actual: Q2,520.00 (Pendiente de pago)
  - Con descuento 25% cliente VIP
  
Factura 6 (FAC-006): Q784.00 (PAC-006 - Elena Rodríguez)
  - Saldo actual: Q284.00 (pagó Q500 de Q784)
  - Con descuento promocional Q100

TOTAL FACTURADO: Q7,652.80
TOTAL PAGADO: Q3,188.80
SALDO PENDIENTE: Q4,464.00

TIPOS DE DESCUENTOS APLICADOS:
- Descuentos por Porcentaje (5%, 10%, 15%, 25%)
- Descuentos por Cantidad Fija (Q50, Q100)
- Descuentos a nivel de item
- Descuentos a nivel de factura

MÉTODOS DE PAGO DOCUMENTADOS:
- Efectivo
- Tarjeta
- Cheque
- Transferencia
*/

-- ============================================
-- FIN: DATOS DE EJEMPLO FACTURACIÓN
-- ============================================
