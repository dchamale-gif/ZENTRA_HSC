// ============================================
// SCRIPT DE MIGRACIÓN DE BASE DE DATOS
// ============================================

const fs = require('fs');
const path = require('path');
const pool = require('./connection');

/**
 * Ejecutar migraciones de la base de datos
 */
async function runMigrations() {
  console.log('\n📊 Iniciando verificación de esquema de base de datos...\n');
  
  try {
    const medicinasTable = await pool.query("SELECT to_regclass('medicinas') AS table_name");
    if (medicinasTable.rows[0].table_name) {
      await pool.query(`
        ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS seccion VARCHAR(100);
        ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS familia VARCHAR(100);
        ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS subfamilia VARCHAR(100);
        ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS presentacion VARCHAR(50);
        ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS codigo_externo VARCHAR(50);
        ALTER TABLE medicinas ADD COLUMN IF NOT EXISTS codigo_barra VARCHAR(50);
        ALTER TABLE medicinas ALTER COLUMN seccion SET DEFAULT 'SEC-001';
        UPDATE medicinas SET seccion = 'SEC-001' WHERE seccion IS NULL OR BTRIM(seccion) = '';
        CREATE INDEX IF NOT EXISTS idx_medicinas_clasificacion
          ON medicinas(seccion, familia, subfamilia);
      `);
      console.log('  ✅ Clasificación de medicinas verificada');
    }

    const cajaTable = await pool.query("SELECT to_regclass('caja') AS table_name");
    if (cajaTable.rows[0].table_name) {
      await pool.query(`
        ALTER TABLE caja ADD COLUMN IF NOT EXISTS tipo_movimiento VARCHAR(50);
        ALTER TABLE caja ADD COLUMN IF NOT EXISTS paciente_id VARCHAR(50);
        ALTER TABLE caja ADD COLUMN IF NOT EXISTS referencia VARCHAR(100);
        ALTER TABLE caja ADD COLUMN IF NOT EXISTS categoria VARCHAR(100);
        ALTER TABLE caja ADD COLUMN IF NOT EXISTS descripcion TEXT;
        ALTER TABLE caja ADD COLUMN IF NOT EXISTS user_id INTEGER;
        ALTER TABLE caja ADD COLUMN IF NOT EXISTS hora TIME;
        ALTER TABLE caja ADD COLUMN IF NOT EXISTS saldo_anterior DECIMAL(12, 2);
        ALTER TABLE caja ADD COLUMN IF NOT EXISTS saldo_posterior DECIMAL(12, 2);
        ALTER TABLE caja ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'activo';
        ALTER TABLE caja ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE caja ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        CREATE INDEX IF NOT EXISTS idx_caja_paciente ON caja(paciente_id);
        CREATE INDEX IF NOT EXISTS idx_caja_tipo_movimiento ON caja(tipo_movimiento);
        CREATE INDEX IF NOT EXISTS idx_caja_fecha_creacion ON caja(fecha DESC, created_at DESC);
      `);
      console.log('  ✅ Persistencia de movimientos de caja verificada');
    }

    // Leer el archivo schema.sql (buscar en rutas posibles)
    let schemaPath;
    let schema;
    
    // Intentar rutas en orden de probabilidad
    const possiblePaths = [
      path.join(__dirname, '../../database/schema.sql'),      // Local: backend/src/db -> ../../database
      path.join(__dirname, '../../../database/schema.sql'),   // Producción: backend/src/db -> ../../../database
      path.join(process.cwd(), 'database/schema.sql'),        // Desde directorio de trabajo
      path.join(process.cwd(), 'backend/database/schema.sql') // Alt
    ];
    
    for (const possiblePath of possiblePaths) {
      try {
        if (fs.existsSync(possiblePath)) {
          schemaPath = possiblePath;
          schema = fs.readFileSync(schemaPath, 'utf8');
          console.log(`📂 Schema encontrado en: ${schemaPath}`);
          break;
        }
      } catch (e) {
        // Continuar a la siguiente ruta
        continue;
      }
    }
    
    // Si no encuentra el archivo, solo advertir (el schema ya está en la BD)
    if (!schema) {
      console.warn('⚠️  No se pudo encontrar schema.sql, continuando...');
      console.log('✅ Base de datos ya está configurada en el servidor');
      return true;
    }
    
    // Separar las queries por punto y coma (simple parser)
    const queries = schema
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0 && !q.startsWith('--'));
    
    console.log(`📄 Total de queries a ejecutar: ${queries.length}`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const query of queries) {
      try {
        // Skip comentarios y líneas vacías
        if (!query || query.startsWith('--')) {
          continue;
        }
        
        await pool.query(query);
        successCount++;
        
        // Extraer nombre de tabla si es CREATE TABLE
        if (query.includes('CREATE TABLE')) {
          const match = query.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
          if (match) {
            console.log(`  ✅ Tabla "${match[1]}" verificada/creada`);
          }
        }
      } catch (error) {
        // Si es "already exists", skipear
        if (error.message && error.message.includes('already exists')) {
          skipCount++;
        } else {
          console.error(`  ⚠️  Error ejecutando query:`, error.message.substring(0, 100));
          errorCount++;
        }
      }
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS habitaciones (
        id VARCHAR(50) PRIMARY KEY,
        numero INTEGER NOT NULL,
        piso VARCHAR(20) DEFAULT 'Plano',
        tipo VARCHAR(50),
        orden INTEGER DEFAULT 0,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS camas (
        id VARCHAR(50) PRIMARY KEY,
        habitacion_id VARCHAR(50) NOT NULL REFERENCES habitaciones(id),
        numero_cama INTEGER NOT NULL,
        estado VARCHAR(20) DEFAULT 'libre',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(habitacion_id, numero_cama)
      );
      ALTER TABLE hospitalizaciones ADD COLUMN IF NOT EXISTS cama_id VARCHAR(50) REFERENCES camas(id);
      CREATE TABLE IF NOT EXISTS traslados_camas (
        id VARCHAR(50) PRIMARY KEY,
        hospitalizacion_id VARCHAR(50) NOT NULL REFERENCES hospitalizaciones(id) ON DELETE CASCADE,
        cama_origen_id VARCHAR(50) NOT NULL REFERENCES camas(id),
        cama_destino_id VARCHAR(50) NOT NULL REFERENCES camas(id),
        fecha_traslado DATE NOT NULL DEFAULT CURRENT_DATE,
        hora_traslado TIME NOT NULL DEFAULT CURRENT_TIME,
        razon TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_hospitalizaciones_cama_estado ON hospitalizaciones(cama_id, estado);
      CREATE INDEX IF NOT EXISTS idx_hospitalizaciones_paciente_estado ON hospitalizaciones(paciente_id, estado);
    `);

    const habitaciones = [
      ['hab-1', 2, 'COEX', 1, 2], ['hab-2', 4, 'COEX', 2, 1],
      ['hab-3', 2, 'Sala Común', 3, 1], ['hab-4', 9, 'Sala Común', 4, 1],
      ['hab-5', 5, 'Sala Común', 5, 1], ['hab-6', 4, 'Sala Común', 6, 1],
      ['hab-7', 2, null, 7, 1], ['hab-8', 1, null, 8, 1],
      ['hab-9', 2, null, 9, 1], ['hab-10', 2, null, 10, 2],
      ['hab-11', 9, null, 11, 1], ['hab-12', 3, null, 12, 1]
    ];
    for (const [id, numero, tipo, orden, cantidadCamas] of habitaciones) {
      await pool.query(`
        INSERT INTO habitaciones (id, numero, tipo, orden)
        VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING
      `, [id, numero, tipo, orden]);
      for (let cama = 1; cama <= cantidadCamas; cama++) {
        await pool.query(`
          INSERT INTO camas (id, habitacion_id, numero_cama)
          VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING
        `, [`${id}-${cama}`, id, cama]);
      }
    }
    console.log('  ✅ Habitaciones y camas verificadas');
    
    console.log(`\n📊 Resumen de migración:`);
    console.log(`  ✅ Exitosas: ${successCount}`);
    console.log(`  ⏭️  Saltadas (ya existen): ${skipCount}`);
    if (errorCount > 0) {
      console.log(`  ❌ Errores: ${errorCount}`);
    }
    
    // Verificar que al menos la tabla pacientes existe
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'pacientes'
      );
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('\n✅ Base de datos está lista para usar');
      return true;
    } else {
      console.log('\n⚠️  Tabla pacientes no encontrada - La migración podría haber fallado');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Error crítico en migración:', error);
    return false;
  }
}

module.exports = { runMigrations };
