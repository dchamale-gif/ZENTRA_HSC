-- ============================================
-- ALTER TABLE - Documentos del Paciente
-- Instrucciones para modificar tabla existente
-- ============================================

-- Si la tabla ya existe y necesitas agregar campos:

-- 1. Agregar columna 'categoria' si no existe
ALTER TABLE documentos_paciente 
ADD COLUMN IF NOT EXISTS categoria VARCHAR(100);

-- 2. Agregar columna 'nombre_archivo' si no existe
ALTER TABLE documentos_paciente 
ADD COLUMN IF NOT EXISTS nombre_archivo VARCHAR(255);

-- 3. Agregar columna 'timestamp_carga' si no existe
ALTER TABLE documentos_paciente 
ADD COLUMN IF NOT EXISTS timestamp_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 4. Agregar columna 'contenido' si no existe
ALTER TABLE documentos_paciente 
ADD COLUMN IF NOT EXISTS contenido TEXT;

-- 5. Agregar columna 'created_at' si no existe
ALTER TABLE documentos_paciente 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================================
-- CREAR ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

-- Índice simple para búsqueda por paciente
CREATE INDEX IF NOT EXISTS idx_documentos_paciente 
ON documentos_paciente(paciente_id);

-- Índice simple para búsqueda por categoría
CREATE INDEX IF NOT EXISTS idx_documentos_categoria 
ON documentos_paciente(categoria);

-- Índice compuesto para búsquedas combinadas (MÁS RÁPIDO)
CREATE INDEX IF NOT EXISTS idx_documentos_paciente_categoria 
ON documentos_paciente(paciente_id, categoria);

-- ============================================
-- AGREGAR CONSTRAINT SI NO EXISTE
-- ============================================

-- Foreign key a pacientes (si no existe)
ALTER TABLE documentos_paciente 
ADD CONSTRAINT IF NOT EXISTS fk_documentos_paciente 
FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE;

-- ============================================
-- VERIFICAR ESTADO ACTUAL
-- ============================================

-- Ver estructura de la tabla
-- \d+ documentos_paciente

-- Ver índices
-- \di idx_documentos*

-- Ver constraints
-- \d documentos_paciente

-- Contar registros
-- SELECT COUNT(*) FROM documentos_paciente;

-- Ver documentos por paciente
-- SELECT id, paciente_id, categoria, nombre_archivo, timestamp_carga 
-- FROM documentos_paciente 
-- WHERE paciente_id = 'PAC-001'
-- ORDER BY categoria, timestamp_carga DESC;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

-- 1. Si la tabla NO EXISTE, ejecuta: fix-documentos-paciente.sql
-- 2. Si la tabla EXISTE y está incompleta, ejecuta este archivo (ALTER TABLE)
-- 3. Los índices son idempotentes (IF NOT EXISTS) - seguro ejecutar múltiples veces
-- 4. Los CONSTRAINT también son idempotentes
-- 5. Backup antes de ejecutar ALTER TABLE en producción

-- ============================================
-- FIN DE SCRIPT ALTER
-- ============================================
