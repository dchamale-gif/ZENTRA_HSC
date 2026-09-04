-- ============================================
-- DATOS DE EJEMPLO: Familias y Subfamilias de Medicamentos
-- Fecha: 2026-09-04
-- Descripción: Carga de datos de ejemplo con medicamentos 
--              incluyendo familia y subfamilia
-- ============================================

-- Ejemplos de medicamentos con familias y subfamilias

INSERT INTO medicinas (
    id, nombre, descripcion, familia, subfamilia, 
    principio_activo, concentracion, forma_farmaceutica, presentacion,
    cantidad, cantidad_minima, precio_costo, precio_venta,
    lote, fecha_vencimiento, codigo_externo, codigo_barra, activo
) VALUES
    -- ANTIINFLAMATORIOS
    ('MED-001', 'Ibuprofeno 400mg', 'Analgésico antiinflamatorio', 'Antiinflamatorios', 'AINES', 'Ibuprofeno', '400mg', 'Tableta', 'Tabletas', 100, 10, 0.50, 2.00, 'LOT001', '2027-06-30', 'IBU400', '7501001234500', true),
    ('MED-002', 'Diclofenaco 50mg', 'Antiinflamatorio potente', 'Antiinflamatorios', 'AINES', 'Diclofenaco', '50mg', 'Tableta', 'Tabletas', 80, 10, 1.20, 3.50, 'LOT002', '2027-12-31', 'DIC50', '7501001234501', true),
    ('MED-003', 'Naproxeno 500mg', 'Antiinflamatorio de larga duración', 'Antiinflamatorios', 'AINES', 'Naproxeno', '500mg', 'Tableta', 'Tabletas', 60, 5, 2.00, 5.00, 'LOT003', '2027-09-15', 'NAP500', '7501001234502', true),
    ('MED-004', 'Acetaminofén 500mg', 'Analgésico y antipirético', 'Analgésicos', 'No AINES', 'Acetaminofén', '500mg', 'Tableta', 'Tabletas', 150, 20, 0.30, 1.50, 'LOT004', '2027-11-20', 'ACE500', '7501001234503', true),

    -- ANTIBIÓTICOS
    ('MED-005', 'Amoxicilina 500mg', 'Antibiótico de amplio espectro', 'Antibióticos', 'Penicilinas', 'Amoxicilina', '500mg', 'Cápsula', 'Cápsulas', 120, 15, 0.80, 2.50, 'LOT005', '2027-08-10', 'AMX500', '7501001234504', true),
    ('MED-006', 'Ciprofloxacino 500mg', 'Antibiótico fluoroquinolona', 'Antibióticos', 'Fluoroquinolonas', 'Ciprofloxacino', '500mg', 'Tableta', 'Tabletas', 90, 10, 3.50, 8.00, 'LOT006', '2027-10-05', 'CIP500', '7501001234505', true),
    ('MED-007', 'Azitromicina 500mg', 'Antibiótico macrólido', 'Antibióticos', 'Macrólidos', 'Azitromicina', '500mg', 'Tableta', 'Tabletas', 50, 8, 2.20, 6.50, 'LOT007', '2027-07-25', 'AZI500', '7501001234506', true),

    -- ANTIHIPERTENSIVOS
    ('MED-008', 'Lisinopril 10mg', 'Inhibidor de ACE', 'Antihipertensivos', 'Inhibidores de ACE', 'Lisinopril', '10mg', 'Tableta', 'Tabletas', 110, 15, 0.90, 3.00, 'LOT008', '2027-12-15', 'LIS10', '7501001234507', true),
    ('MED-009', 'Atenolol 50mg', 'Bloqueador beta', 'Antihipertensivos', 'Bloqueadores Beta', 'Atenolol', '50mg', 'Tableta', 'Tabletas', 95, 12, 1.10, 3.50, 'LOT009', '2027-11-30', 'ATE50', '7501001234508', true),
    ('MED-010', 'Nifedipino 20mg', 'Bloqueador de calcio', 'Antihipertensivos', 'Bloqueadores de Calcio', 'Nifedipino', '20mg', 'Cápsula', 'Cápsulas', 70, 10, 1.50, 4.50, 'LOT010', '2027-09-20', 'NIF20', '7501001234509', true),

    -- ANTIHISTAMÍNICOS
    ('MED-011', 'Loratadina 10mg', 'Antihistamínico no sedante', 'Antihistamínicos', 'Antihistamínicos H1', 'Loratadina', '10mg', 'Tableta', 'Tabletas', 140, 20, 0.40, 1.80, 'LOT011', '2027-08-30', 'LOR10', '7501001234510', true),
    ('MED-012', 'Difenhidramina 25mg', 'Antihistamínico sedante', 'Antihistamínicos', 'Antihistamínicos H1', 'Difenhidramina', '25mg', 'Tableta', 'Tabletas', 100, 15, 0.50, 2.00, 'LOT012', '2027-10-10', 'DIF25', '7501001234511', true),

    -- VITAMINAS Y SUPLEMENTOS
    ('MED-013', 'Vitamina C 500mg', 'Suplemento vitamínico', 'Vitaminas', 'Vitaminas Hidrosolubles', 'Ácido Ascórbico', '500mg', 'Tableta', 'Tabletas', 200, 30, 0.20, 1.00, 'LOT013', '2027-06-15', 'VIT-C', '7501001234512', true),
    ('MED-014', 'Vitamina D3 1000IU', 'Suplemento vitamínico', 'Vitaminas', 'Vitaminas Liposolubles', 'Colecalciferol', '1000IU', 'Cápsula', 'Cápsulas', 80, 15, 0.60, 2.50, 'LOT014', '2027-12-20', 'VIT-D3', '7501001234513', true),
    ('MED-015', 'Complejo B', 'Suplemento multivitamínico B', 'Vitaminas', 'Vitaminas Hidrosolubles', 'Complejo B', 'Variada', 'Tableta', 'Tabletas', 120, 20, 0.35, 1.50, 'LOT015', '2027-11-05', 'VIT-B', '7501001234514', true),

    -- CORTICOSTEROIDES
    ('MED-016', 'Prednisona 5mg', 'Corticosteroide oral', 'Corticosteroides', 'Corticosteroides Sistémicos', 'Prednisona', '5mg', 'Tableta', 'Tabletas', 60, 8, 2.50, 7.00, 'LOT016', '2027-07-10', 'PRED5', '7501001234515', true),
    ('MED-017', 'Hidrocortisona Crema', 'Corticosteroide tópico', 'Corticosteroides', 'Corticosteroides Tópicos', 'Hidrocortisona', '1%', 'Crema', 'Crema', 40, 5, 3.00, 8.50, 'LOT017', '2027-09-30', 'HIDRO-CR', '7501001234516', true),

    -- ANTIFÚNGICOS
    ('MED-018', 'Fluconazol 150mg', 'Antifúngico sistémico', 'Antifúngicos', 'Azoles', 'Fluconazol', '150mg', 'Cápsula', 'Cápsulas', 50, 8, 4.50, 12.00, 'LOT018', '2027-08-25', 'FLU150', '7501001234517', true),
    ('MED-019', 'Miconazol Crema', 'Antifúngico tópico', 'Antifúngicos', 'Imidazoles', 'Miconazol', '2%', 'Crema', 'Crema', 35, 5, 2.00, 6.50, 'LOT019', '2027-10-12', 'MIC-CR', '7501001234518', true),

    -- ANTIÁCIDOS Y PROTECTORES GÁSTRICOS
    ('MED-020', 'Omeprazol 20mg', 'Inhibidor de bomba de protones', 'Antiácidos', 'Inhibidores de Bomba de Protones', 'Omeprazol', '20mg', 'Cápsula', 'Cápsulas', 85, 12, 1.80, 5.00, 'LOT020', '2027-11-18', 'OMP20', '7501001234519', true),
    ('MED-021', 'Ranitidina 150mg', 'Antagonista de receptor H2', 'Antiácidos', 'Antagonistas H2', 'Ranitidina', '150mg', 'Tableta', 'Tabletas', 70, 10, 0.90, 3.50, 'LOT021', '2027-12-01', 'RAN150', '7501001234520', true);

-- Crear índices para mejorar búsquedas por familia y subfamilia
CREATE INDEX IF NOT EXISTS idx_medicinas_nombre ON medicinas(nombre);
CREATE INDEX IF NOT EXISTS idx_medicinas_familia ON medicinas(familia);
CREATE INDEX IF NOT EXISTS idx_medicinas_subfamilia ON medicinas(subfamilia);
CREATE INDEX IF NOT EXISTS idx_medicinas_activo ON medicinas(activo);

-- Mensaje de confirmación
SELECT 'Carga de datos completada: 21 medicamentos con familias y subfamilias' AS estado;
