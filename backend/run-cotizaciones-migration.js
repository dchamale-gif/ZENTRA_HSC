#!/usr/bin/env node

/**
 * Migración: módulo de cotizaciones.
 *
 * Crea:
 *   - cotizaciones            Encabezado (cliente, estado, totales, vigencia)
 *   - cotizacion_items        Conceptos cotizados
 *   - cotizacion_plantillas   Paquetes reutilizables para precargar cotizaciones
 *
 * Estados de una cotización:
 *   borrador  -> guardada sin generar
 *   generada  -> generada/impresa, sigue editable
 *   ingresada -> el paciente ingresó y la cotización pasó a su estado de cuenta (ya no se edita)
 *   anulada   -> descartada
 *
 * Es idempotente: se puede ejecutar varias veces sin efectos secundarios.
 * Uso en el servidor:  cd backend && node run-cotizaciones-migration.js
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

const migration = `
BEGIN;

CREATE SEQUENCE IF NOT EXISTS cotizaciones_numero_seq START 1;

CREATE TABLE IF NOT EXISTS cotizaciones (
    id VARCHAR(50) PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    paciente_id VARCHAR(50) REFERENCES pacientes(id) ON DELETE SET NULL,
    cliente_nombre VARCHAR(150) NOT NULL,
    cliente_telefono VARCHAR(30),
    cliente_dpi VARCHAR(20),
    cliente_email VARCHAR(150),
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
    tipo_item VARCHAR(50) NOT NULL DEFAULT 'general',
    cantidad NUMERIC(10, 2) NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(12, 2) NOT NULL CHECK (precio_unitario >= 0),
    descuento NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    total NUMERIC(12, 2) NOT NULL,
    medicina_id VARCHAR(50)
);

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
    await pool.query(migration);
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
