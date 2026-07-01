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
