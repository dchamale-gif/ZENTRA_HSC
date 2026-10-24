#!/usr/bin/env node

/**
 * Migración: módulo de cotizaciones.
 *
 * Crea:
 *   - cotizaciones            Encabezado (cliente, estado, totales, vigencia)
 *   - cotizacion_items        Conceptos cotizados
 *   - cotizacion_plantillas   Paquetes reutilizables para precargar cotizaciones
 *
 * Numeración: COT-001, COT-002, … (crece a COT-1000 sin truncar).
 * Cada concepto guarda "qué contiene" (contenido), también dentro de las plantillas.
 *
 * Cada cotización indica la empresa que la emite (A o B) y el IVA que se suma
 * al total (12 %, 5 % o sin IVA). Las cotizaciones anteriores a este cambio
 * quedan con iva_porcentaje NULL: sus precios ya incluían el IVA del 12 %.
 *
 * Estados de una cotización:
 *   borrador  -> guardada sin generar
 *   generada  -> generada/impresa, sigue editable
 *   ingresada -> guardada en la ficha del paciente (ya no se edita; no genera cargos)
 *   anulada   -> descartada
 *
 * Es idempotente: se puede ejecutar varias veces sin efectos secundarios.
 * Uso en el servidor:  cd backend && npm run migrate:cotizaciones
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'zentra_med',
  ssl: process.env.DB_SSL === 'require' ? { rejectUnauthorized: false } : false
});

const buildMigration = (pacienteIdType) => `
BEGIN;

CREATE SEQUENCE IF NOT EXISTS cotizaciones_numero_seq START 1;

CREATE TABLE IF NOT EXISTS cotizaciones (
    id VARCHAR(50) PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    paciente_id ${pacienteIdType} REFERENCES pacientes(id) ON DELETE SET NULL,
    cliente_nombre VARCHAR(150) NOT NULL,
    cliente_telefono VARCHAR(30),
    cliente_dpi VARCHAR(20),
    cliente_email VARCHAR(150),
    cliente_responsable VARCHAR(150),
    motivo TEXT,
    notas TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador'
        CHECK (estado IN ('borrador', 'generada', 'ingresada', 'anulada')),
    vigencia_dias INTEGER NOT NULL DEFAULT 15 CHECK (vigencia_dias > 0),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    descuento NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    venta_id VARCHAR(50),
    numero_factura VARCHAR(50),
    fecha_generada TIMESTAMP,
    fecha_ingreso TIMESTAMP,
    motivo_anulacion TEXT,
    usuario_id INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON cotizaciones (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_paciente ON cotizaciones (paciente_id);

CREATE TABLE IF NOT EXISTS cotizacion_items (
    id SERIAL PRIMARY KEY,
    cotizacion_id VARCHAR(50) NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
    orden INTEGER NOT NULL DEFAULT 0,
    descripcion TEXT NOT NULL,
    contenido TEXT,
    tipo_item VARCHAR(50) NOT NULL DEFAULT 'general',
    cantidad NUMERIC(10, 2) NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(12, 2) NOT NULL CHECK (precio_unitario >= 0),
    descuento NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    total NUMERIC(12, 2) NOT NULL,
    articulo_id VARCHAR(50),
    medicina_id VARCHAR(50)
);

-- Columnas agregadas después de la primera versión (instalaciones que ya corrieron la migración)
ALTER TABLE cotizacion_items ADD COLUMN IF NOT EXISTS articulo_id VARCHAR(50);
ALTER TABLE cotizacion_items ADD COLUMN IF NOT EXISTS contenido TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS cliente_responsable VARCHAR(150);
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS empresa VARCHAR(5);
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS iva_porcentaje NUMERIC(5, 2);
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS iva_monto NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cotizacion_items_cotizacion ON cotizacion_items (cotizacion_id, orden);

CREATE TABLE IF NOT EXISTS cotizacion_plantillas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE,
    descripcion TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
`;

const run = async () => {
  try {
    // paciente_id debe tener exactamente el mismo tipo que pacientes.id (INTEGER o VARCHAR según la instalación)
    const tipo = await pool.query(`
      SELECT format_type(a.atttypid, a.atttypmod) AS tipo
      FROM pg_attribute a
      WHERE a.attrelid = 'pacientes'::regclass AND a.attname = 'id'
    `);
    if (!tipo.rows.length) throw new Error('No se encontró la columna pacientes.id');
    const pacienteIdType = tipo.rows[0].tipo;
    console.log(`Tipo de pacientes.id: ${pacienteIdType}`);

    await pool.query(buildMigration(pacienteIdType));
    const { rows } = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name IN ('cotizaciones', 'cotizacion_items', 'cotizacion_plantillas')
      ORDER BY table_name
    `);
    console.log('Migración de cotizaciones completada.');
    rows.forEach(row => console.log(`  ✓ ${row.table_name}`));
  } catch (error) {
    console.error('Error ejecutando la migración de cotizaciones:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
