const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'zentra_med',
});

pool.on('error', (err) => {
  console.error('Error no esperado en cliente de Pool', err);
});

// Test conexión
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error conectando a la DB:', err);
  } else {
    console.log('✅ Conexión a PostgreSQL establecida');
  }
});

module.exports = pool;
