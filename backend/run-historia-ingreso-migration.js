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
    const { rows: [t] } = await pool.query("SELECT to_regclass('public.historias_clinicas') IS NOT NULL AS hay");
    if (!t.hay) throw new Error('Primero corra npm run migrate:historias-clinicas');
    const migration = fs.readFileSync(path.join(__dirname, '../database/historia-clinica-ingreso-migration.sql'), 'utf8');
    await pool.query(migration);
    console.log('Migración de historia clínica de ingreso completada.');
  } catch (error) {
    console.error('Error ejecutando la migración de historia clínica de ingreso:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
