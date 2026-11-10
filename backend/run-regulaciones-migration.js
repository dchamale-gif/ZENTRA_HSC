#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
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

const run = async () => {
  try {
    const { rows: [bodegas] } = await pool.query("SELECT to_regclass('public.bodegas') IS NOT NULL AS hay");
    if (!bodegas.hay) throw new Error('Primero corra npm run migrate:requerimientos (crea las bodegas)');

    const migrationPath = path.join(__dirname, '../database/regulaciones-inventario-migration.sql');
    let migration = fs.readFileSync(migrationPath, 'utf8');
    // Cada llave foránea usa el tipo real de la columna que referencia (INTEGER o VARCHAR según la instalación)
    for (const [marcador, tabla] of [
      ['__TIPO_ARTICULO_ID__', 'codigos_articulos'],
      ['__TIPO_MEDICINA_ID__', 'medicinas'],
      ['__TIPO_USUARIO_ID__', 'users']
    ]) {
      const { rows } = await pool.query(
        `SELECT format_type(a.atttypid, a.atttypmod) AS tipo FROM pg_attribute a
         WHERE a.attrelid = $1::regclass AND a.attname = 'id'`, [tabla]);
      if (!rows.length) throw new Error(`No se encontró la columna ${tabla}.id`);
      migration = migration.split(marcador).join(rows[0].tipo);
    }
    await pool.query(migration);
    const { rows: [k] } = await pool.query('SELECT COUNT(*)::int AS n FROM articulo_movimientos');
    console.log('Migración de regulaciones de inventario completada.');
    console.log(`  Kárdex de artículos: ${k.n} movimiento(s) (saldo inicial de los que tienen existencia).`);
  } catch (error) {
    console.error('Error ejecutando la migración de regulaciones:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
