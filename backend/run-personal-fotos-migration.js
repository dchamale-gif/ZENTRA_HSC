#!/usr/bin/env node

/**
 * Migración: fotografía y DPI del personal médico.
 *
 * Agrega a personal_medico:
 *   - dpi           Número de DPI (13 dígitos)
 *   - foto_perfil   Foto de la persona (data URL base64)
 *   - dpi_frente    Fotografía del frente del DPI (data URL base64)
 *   - dpi_reverso   Fotografía del reverso del DPI (data URL base64)
 *
 * Es idempotente: se puede ejecutar varias veces sin efectos secundarios.
 * Uso en el servidor:  cd backend && node run-personal-fotos-migration.js
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

ALTER TABLE personal_medico ADD COLUMN IF NOT EXISTS dpi VARCHAR(20);
ALTER TABLE personal_medico ADD COLUMN IF NOT EXISTS foto_perfil TEXT;
ALTER TABLE personal_medico ADD COLUMN IF NOT EXISTS dpi_frente TEXT;
ALTER TABLE personal_medico ADD COLUMN IF NOT EXISTS dpi_reverso TEXT;

-- Solo se aceptan imágenes en formato data URL base64
DO $$
DECLARE
  columna TEXT;
BEGIN
  FOREACH columna IN ARRAY ARRAY['foto_perfil', 'dpi_frente', 'dpi_reverso'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'personal_medico_' || columna || '_base64'
    ) THEN
      EXECUTE format(
        'ALTER TABLE personal_medico ADD CONSTRAINT %I CHECK (%I IS NULL OR %I ~ ''^data:image/(jpeg|png|webp);base64,'')',
        'personal_medico_' || columna || '_base64', columna, columna
      );
    END IF;
  END LOOP;
END $$;

-- Un DPI no puede repetirse entre el personal
CREATE UNIQUE INDEX IF NOT EXISTS personal_medico_dpi_unico
  ON personal_medico (dpi) WHERE dpi IS NOT NULL;

COMMIT;
`;

const run = async () => {
  try {
    await pool.query(migration);
    const { rows } = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'personal_medico'
        AND column_name IN ('dpi', 'foto_perfil', 'dpi_frente', 'dpi_reverso')
      ORDER BY column_name
    `);
    console.log('Migración de fotos del personal médico completada.');
    rows.forEach(row => console.log(`  ✓ ${row.column_name} (${row.data_type})`));
  } catch (error) {
    console.error('Error ejecutando la migración de fotos del personal médico:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
