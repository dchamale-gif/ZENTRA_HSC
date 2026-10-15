#!/usr/bin/env node

/**
 * Migración: tabla medicinas completa.
 *
 * Deja la tabla `medicinas` con todas las columnas que usa el formulario y la API:
 *   código de barra, nombre, sección, familia, subfamilia, presentación,
 *   principio activo, dosis, unidad de dosis, lote, fecha de vencimiento,
 *   stock, stock mínimo, precio, contraindicaciones, efectos secundarios,
 *   proveedor y estado (activo).
 *
 * - Crea la tabla si no existe.
 * - Agrega solo las columnas que falten (no borra ni renombra nada).
 * - Si la tabla tiene columnas con nombres antiguos (stock, stock_minimo, precio,
 *   vencimiento, ...), copia sus datos a las columnas que usa la API.
 * - Mueve a `contraindicaciones` lo que el formulario guardaba en `descripcion`.
 *
 * Es idempotente: se puede ejecutar varias veces sin efectos secundarios.
 * Uso en el servidor:  cd backend && node run-medicinas-migration.js
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

// Columnas que necesita la API, con su tipo y valor por defecto
const COLUMNAS = [
  ['nombre', "VARCHAR(150)"],
  ['descripcion', 'TEXT'],
  ['seccion', "VARCHAR(100) DEFAULT 'SEC-001'"],
  ['familia', 'VARCHAR(100)'],
  ['subfamilia', 'VARCHAR(100)'],
  ['principio_activo', 'VARCHAR(150)'],
  ['concentracion', 'VARCHAR(50)'],
  ['dosis', 'VARCHAR(50)'],
  ['unidad_dosis', 'VARCHAR(30)'],
  ['forma_farmaceutica', 'VARCHAR(50)'],
  ['presentacion', 'VARCHAR(50)'],
  ['cantidad', 'INTEGER NOT NULL DEFAULT 0'],
  ['cantidad_minima', 'INTEGER DEFAULT 10'],
  ['precio_costo', 'DECIMAL(10, 2) NOT NULL DEFAULT 0'],
  ['precio_venta', 'DECIMAL(10, 2) NOT NULL DEFAULT 0'],
  ['lote', 'VARCHAR(50)'],
  ['fecha_vencimiento', 'DATE'],
  ['proveedor_id', 'VARCHAR(50)'],
  ['proveedor', 'VARCHAR(150)'],
  ['contraindicaciones', 'TEXT'],
  ['efectos_secundarios', 'TEXT'],
  ['codigo_externo', 'VARCHAR(50)'],
  ['codigo_barra', 'VARCHAR(50)'],
  ['activo', 'BOOLEAN DEFAULT true'],
  ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
  ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP']
];

// Columnas con nombre antiguo -> columna que usa la API
const ALIAS_ANTIGUOS = [
  ['stock', 'cantidad'],
  ['stock_minimo', 'cantidad_minima'],
  ['cantidad_minima_alerta', 'cantidad_minima'],
  ['precio', 'precio_venta'],
  ['precio_unitario', 'precio_venta'],
  ['vencimiento', 'fecha_vencimiento'],
  ['unidaddosis', 'unidad_dosis'],
  ['efectossecundarios', 'efectos_secundarios'],
  ['principioactivo', 'principio_activo']
];

const columnasActuales = async (client) => {
  const { rows } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'medicinas'
  `);
  return new Set(rows.map(row => row.column_name));
};

const run = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS medicinas (
        id VARCHAR(50) PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL
      )
    `);

    const antes = await columnasActuales(client);
    const agregadas = [];
    for (const [columna, tipo] of COLUMNAS) {
      if (!antes.has(columna)) {
        await client.query(`ALTER TABLE medicinas ADD COLUMN ${columna} ${tipo}`);
        agregadas.push(columna);
      }
    }

    // Copiar datos de columnas antiguas cuando la nueva está vacía
    const copiadas = [];
    const CASTS = {
      cantidad: 'integer',
      cantidad_minima: 'integer',
      precio_venta: 'numeric',
      fecha_vencimiento: 'date'
    };
    for (const [antigua, nueva] of ALIAS_ANTIGUOS) {
      if (!antes.has(antigua)) continue;
      // Columna recién creada: copiar todo. Ya existente: solo llenar vacíos.
      const condicion = agregadas.includes(nueva)
        ? 'TRUE'
        : CASTS[nueva] === 'integer' || CASTS[nueva] === 'numeric'
          ? `(${nueva} IS NULL OR ${nueva} = 0)`
          : `${nueva} IS NULL`;
      const cast = CASTS[nueva] === 'integer' ? '::text::numeric::integer'
        : CASTS[nueva] ? `::text::${CASTS[nueva]}`
        : '::text';
      const res = await client.query(
        `UPDATE medicinas SET ${nueva} = ${antigua}${cast}
         WHERE ${antigua} IS NOT NULL AND ${condicion}`
      );
      if (res.rowCount > 0) copiadas.push(`${antigua} → ${nueva} (${res.rowCount})`);
    }

    // El formulario guardaba las contraindicaciones en "descripcion"
    const contra = await client.query(`
      UPDATE medicinas SET contraindicaciones = descripcion
      WHERE contraindicaciones IS NULL AND descripcion IS NOT NULL AND BTRIM(descripcion) <> ''
    `);
    if (contra.rowCount > 0) copiadas.push(`descripcion → contraindicaciones (${contra.rowCount})`);

    // Sección por defecto y estado activo cuando estén vacíos
    await client.query(`UPDATE medicinas SET seccion = 'SEC-001' WHERE seccion IS NULL OR BTRIM(seccion) = ''`);
    await client.query(`UPDATE medicinas SET activo = true WHERE activo IS NULL`);

    // Índices de búsqueda
    await client.query('CREATE INDEX IF NOT EXISTS idx_medicinas_nombre ON medicinas (nombre)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_medicinas_principio_activo ON medicinas (principio_activo)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_medicinas_codigo_barra ON medicinas (codigo_barra)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_medicinas_clasificacion ON medicinas (seccion, familia, subfamilia)');

    await client.query('COMMIT');

    console.log('Migración de medicinas completada.');
    console.log(agregadas.length
      ? `  Columnas agregadas: ${agregadas.join(', ')}`
      : '  La tabla ya tenía todas las columnas.');
    if (copiadas.length) console.log(`  Datos copiados: ${copiadas.join('; ')}`);

    const despues = await columnasActuales(client);
    const faltantes = COLUMNAS.map(([c]) => c).filter(c => !despues.has(c));
    console.log(faltantes.length ? `  ⚠ Siguen faltando: ${faltantes.join(', ')}` : '  ✓ Tabla medicinas completa.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error ejecutando la migración de medicinas:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

run();
