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
    const migrationPath = path.join(__dirname, '../database/preferencias-usuario-migration.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migration);
    console.log('Migración de preferencias del usuario (tema) completada.');
  } catch (error) {
    console.error('Error ejecutando la migración de preferencias del usuario:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
