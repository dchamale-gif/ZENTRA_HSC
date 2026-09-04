-- ============================================
-- MIGRACIÓN: Agregar campos familia y subfamilia a medicinas
-- Fecha: 2026-09-04
-- Descripción: Agrega los campos familia y subfamilia para mejor clasificación
--              de medicamentos, y campos adicionales para códigos
-- ============================================

-- Verificar si los campos ya existen antes de agregarlos
-- Para MySQL/MariaDB:
ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS familia VARCHAR(100) AFTER descripcion;
ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS subfamilia VARCHAR(100) AFTER familia;
ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS presentacion VARCHAR(50) AFTER forma_farmaceutica;
ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS codigo_externo VARCHAR(50) AFTER proveedor_id;
ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS codigo_barra VARCHAR(50) AFTER codigo_externo;

-- Para PostgreSQL, comentar las líneas anteriores y descomentar las siguientes:
-- ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS familia VARCHAR(100);
-- ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS subfamilia VARCHAR(100);
-- ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS presentacion VARCHAR(50);
-- ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS codigo_externo VARCHAR(50);
-- ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS codigo_barra VARCHAR(50);

-- Crear índices para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_medicinas_familia ON medicinas(familia);
CREATE INDEX IF NOT EXISTS idx_medicinas_subfamilia ON medicinas(subfamilia);
CREATE INDEX IF NOT EXISTS idx_medicinas_codigo_externo ON medicinas(codigo_externo);
CREATE INDEX IF NOT EXISTS idx_medicinas_codigo_barra ON medicinas(codigo_barra);

-- Mensaje de confirmación
SELECT 'Migración completada: Campos familia, subfamilia y presentación agregados a medicinas' AS estado;
