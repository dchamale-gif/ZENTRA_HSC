#!/usr/bin/env node

/**
 * Script para ejecutar la migración de facturación mejorada
 * Uso: node run-billing-migration.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Crear pool de conexión
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'zentra_med',
  ssl: process.env.DB_SSL === 'require' ? { rejectUnauthorized: false } : false,
});

/**
 * Parser inteligente de statements SQL que respeta dollar quotes y comentarios
 */
function parseSQLStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarQuoteDelimiter = '';
  let inBlockComment = false;
  let i = 0;
  
  while (i < sql.length) {
    const char = sql[i];
    
    // Detectar inicio de comentario de bloque
    if (!inDollarQuote && !inBlockComment && char === '/' && sql[i + 1] === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }
    
    // Detectar fin de comentario de bloque
    if (inBlockComment && char === '*' && sql[i + 1] === '/') {
      inBlockComment = false;
      i += 2;
      continue;
    }
    
    // Si estamos en un comentario de bloque, skip
    if (inBlockComment) {
      i++;
      continue;
    }
    
    // Detectar comentario de línea
    if (!inDollarQuote && char === '-' && sql[i + 1] === '-') {
      // Saltar hasta el final de la línea
      while (i < sql.length && sql[i] !== '\n') {
        i++;
      }
      continue;
    }
    
    // Detectar inicio/fin de dollar quote
    if (char === '$' && !inDollarQuote) {
      // Buscar el delimitador de dollar quote (puede ser $$, $tag$, etc)
      const match = sql.substring(i).match(/^\$([a-zA-Z0-9_]*)\$/);
      if (match) {
        inDollarQuote = true;
        dollarQuoteDelimiter = match[0];
        current += match[0];
        i += match[0].length;
        continue;
      }
    } else if (inDollarQuote && sql.substring(i).startsWith(dollarQuoteDelimiter)) {
      // Fin del dollar quote
      inDollarQuote = false;
      current += dollarQuoteDelimiter;
      i += dollarQuoteDelimiter.length;
      continue;
    }
    
    // Si encontramos un punto y coma y no estamos en dollar quote
    if (char === ';' && !inDollarQuote) {
      current = current.trim();
      
      // Filtrar comentarios y líneas vacías
      if (current.length > 0 && !current.startsWith('--') && !current.startsWith('/*')) {
        statements.push(current);
      }
      current = '';
      i++;
      continue;
    }
    
    current += char;
    i++;
  }
  
  // Agregar el último statement si existe
  current = current.trim();
  if (current.length > 0 && !current.startsWith('--') && !current.startsWith('/*')) {
    statements.push(current);
  }
  
  return statements;
}

/**
 * Ejecutar la migración
 */
async function runBillingMigration() {
  console.log('\n💳 Ejecutando migración de FACTURACIÓN MEJORADA...\n');
  
  try {
    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, '../database/facturacion-mejorada-migration.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Archivo de migración no encontrado: ${migrationPath}`);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`📂 Migración leída desde: ${migrationPath}\n`);
    
    // Separar las queries de forma inteligente (respetando dollar quotes)
    const queries = parseSQLStatements(migrationSQL);
    
    console.log(`📊 Total de comandos a ejecutar: ${queries.length}\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      
      try {
        const result = await pool.query(query);
        successCount++;
        
        // Extraer nombre de tabla si es CREATE TABLE
        if (query.includes('CREATE TABLE')) {
          const match = query.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
          if (match) {
            console.log(`  ✅ Tabla "${match[1]}" creada/verificada`);
          }
        }
        // Extraer nombre de índice si es CREATE INDEX
        else if (query.includes('CREATE INDEX')) {
          const match = query.match(/CREATE INDEX\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
          if (match) {
            console.log(`  ✅ Índice "${match[1]}" creado`);
          }
        }
        // Extraer nombre de vista si es CREATE VIEW
        else if (query.includes('CREATE OR REPLACE VIEW') || query.includes('CREATE VIEW')) {
          const match = query.match(/VIEW\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
          if (match) {
            console.log(`  ✅ Vista "${match[1]}" creada/actualizada`);
          }
        }
        // Extraer nombre de función si es CREATE FUNCTION
        else if (query.includes('CREATE OR REPLACE FUNCTION') || query.includes('CREATE FUNCTION')) {
          const match = query.match(/FUNCTION\s+(\w+)/i);
          if (match) {
            console.log(`  ✅ Función "${match[1]}" creada/actualizada`);
          }
        }
        // Extraer nombre de trigger si es CREATE TRIGGER
        else if (query.includes('CREATE TRIGGER')) {
          const match = query.match(/TRIGGER\s+(\w+)/i);
          if (match) {
            console.log(`  ✅ Trigger "${match[1]}" creado`);
          }
        }
        // Mostrar ALTER TABLE
        else if (query.includes('ALTER TABLE')) {
          const match = query.match(/ALTER TABLE\s+(\w+)/i);
          if (match) {
            console.log(`  ✅ Tabla "${match[1]}" alterada`);
          }
        }
        
      } catch (error) {
        // Si es "already exists", skipear
        if (error.message && (error.message.includes('already exists') || error.message.includes('does not exist'))) {
          skipCount++;
          // No mostrar error para índices/vistas que ya existen
          if (!error.message.includes('already exists')) {
            console.log(`  ⚠️  ${error.message.substring(0, 80)}...`);
          }
        } else {
          errorCount++;
          errors.push({
            query: query.substring(0, 100),
            error: error.message.substring(0, 150)
          });
          console.error(`  ❌ Error: ${error.message.substring(0, 100)}`);
        }
      }
    }
    
    // Resumen final
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 RESUMEN DE MIGRACIÓN:`);
    console.log(`${'='.repeat(60)}`);
    console.log(`  ✅ Exitosas:     ${successCount}`);
    console.log(`  ⏭️  Saltadas:     ${skipCount}`);
    if (errorCount > 0) {
      console.log(`  ❌ Errores:      ${errorCount}`);
      console.log(`\n📋 Detalles de errores:`);
      errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. Query: ${err.query}`);
        console.log(`     Error: ${err.error}\n`);
      });
    }
    console.log(`${'='.repeat(60)}\n`);
    
    if (errorCount === 0) {
      console.log('✅ ¡Migración completada exitosamente!\n');
      process.exit(0);
    } else {
      console.log('⚠️  Migración completada con errores. Revisa los detalles arriba.\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error fatal durante la migración:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar migración
runBillingMigration();
