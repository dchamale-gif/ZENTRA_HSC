#!/usr/bin/env node
/**
 * Deja el sistema listo para empezar a operar: borra los datos de prueba y
 * conserva solo el listado de medicinas y artículos (con su existencia actual).
 *
 *   node limpiar-datos.js            -> simulación: muestra qué se borraría, no toca nada
 *   node limpiar-datos.js --aplicar  -> borra
 *
 * Se borra:
 *  - Pacientes con su historia clínica, hospitalizaciones, laboratorios, órdenes y agenda.
 *  - Cargos y estados de cuenta (facturas, abonos, saldos de pacientes).
 *  - Cotizaciones, compras, ventas, caja, cuentas por cobrar.
 *  - Requerimientos, requisiciones, regulaciones de inventario y gastos.
 *  - Proveedores y clientes.
 *  - La numeración de documentos vuelve a empezar (compras, cotizaciones, gastos…).
 *
 * Se conserva:
 *  - Medicinas (con presentaciones) y artículos, con la existencia que tienen hoy.
 *    El kárdex se reinicia: cada producto con existencia queda con un solo movimiento
 *    de "saldo inicial".
 *  - Usuarios, roles y permisos, bodegas, configuración, habitaciones y camas (quedan libres),
 *    personal, activos fijos y cualquier otra tabla que no esté en la lista de abajo.
 *
 * Si otra tabla apunta a algo que se borra: cuando la referencia es opcional se deja vacía;
 * cuando es obligatoria, esas filas también se borran (y la simulación las muestra).
 * Todo corre en una transacción: si algo falla no se borra nada.
 * RECOMENDADO: sacar un respaldo completo antes (pg_dump) — el borrado no se puede deshacer.
 */

const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const GRUPOS = [
  ['Pacientes, historia clínica, hospitalizaciones y agenda', [
    'pacientes', 'paciente_cliente', 'antecedentes_paciente', 'diagnosticos_paciente',
    'contactos_emergencia', 'contactos_emergencia_new', 'datos_familia', 'datos_familia_new',
    'responsables_paciente', 'responsables_paciente_new', 'empresas', 'empresas_new',
    'documentos_paciente', 'historia_clinica', 'historias_clinicas', 'historial_medico', 'historial_medico_new',
    'evoluciones_medicas', 'evoluciones_medicas_cambios', 'signos_vitales', 'alertas',
    'laboratorios', 'laboratorio_archivos', 'ordenes', 'ordenes_enfermeria', 'notas_enfermeria',
    'medicamentos_paciente', 'administracion_medicamentos', 'hospitalizaciones', 'traslados_camas',
    'agenda', 'reservas'
  ]],
  ['Cargos y estados de cuenta', [
    'ventas', 'venta_items', 'venta_descuentos', 'venta_item_descuentos', 'venta_historial_cambios',
    'ventas_mejorada', 'venta_items_mejorada', 'venta_descuentos_mejorada', 'venta_item_descuentos_mejorada',
    'servicios_facturados', 'movimientos_paciente', 'pacientes_saldo', 'pagos_paciente', 'abonos'
  ]],
  ['Caja y cuentas por cobrar', ['caja', 'cuentas_por_cobrar', 'pagos_cuentas']],
  ['Cotizaciones', ['cotizaciones', 'cotizacion_items']],
  ['Compras', ['compras', 'compra_items', 'compra_vouchers']],
  ['Requerimientos, requisiciones y regulaciones', [
    'requerimientos_compra', 'requerimiento_compra_items', 'requisiciones', 'requisicion_vouchers',
    'regulaciones_inventario', 'regulacion_inventario_items'
  ]],
  ['Gastos', ['gastos', 'gasto_vouchers']],
  ['Proveedores y clientes', ['proveedores', 'clientes']],
  ['Kárdex (se reinicia con la existencia actual)', ['medicina_movimientos', 'articulo_movimientos']],
  ['Numeración de documentos', ['correlativos']]
];

// Nunca se vacían: si algo obligara a borrarlas, el script se detiene
const INTOCABLES = new Set([
  'medicinas', 'medicina_presentaciones', 'codigos_articulos', 'bodegas',
  'users', 'roles', 'permissions', 'role_permissions', 'user_roles', 'configuracion'
]);

// Secuencias de numeración que no pertenecen a una columna (se reinician aparte)
const SECUENCIAS_NUMERACION = ['cotizaciones_numero_seq', 'requerimientos_compra_numero_seq'];

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'zentra_med',
  ssl: process.env.DB_SSL === 'require' ? { rejectUnauthorized: false } : false
});

const id = (nombre) => `"${String(nombre).replace(/"/g, '""')}"`;
const miles = (n) => Number(n).toLocaleString('es-GT');

const llavesForaneas = async (db) => (await db.query(`
  SELECT c.conname AS nombre, ch.relname AS hija, pa.relname AS padre, c.confdeltype AS al_borrar,
         array_agg(a.attname::text ORDER BY k.n) AS columnas, bool_and(NOT a.attnotnull) AS anulable
  FROM pg_constraint c
  JOIN pg_class ch ON ch.oid = c.conrelid
  JOIN pg_class pa ON pa.oid = c.confrelid
  CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, n)
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
  WHERE c.contype = 'f' AND ch.relnamespace = 'public'::regnamespace AND pa.relnamespace = 'public'::regnamespace
  GROUP BY c.oid, c.conname, ch.relname, pa.relname, c.confdeltype`)).rows;

// Qué se borra y qué referencias se dejan vacías
const planificar = (existentes, fks) => {
  const borrar = new Set();
  const grupos = GRUPOS.map(([nombre, tablas]) => {
    const presentes = tablas.filter(t => existentes.has(t));
    presentes.forEach(t => borrar.add(t));
    return { nombre, tablas: presentes };
  });
  for (const t of borrar) {
    if (INTOCABLES.has(t)) throw new Error(`La tabla ${t} está marcada para conservarse`);
  }

  const dependientes = [];
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const fk of fks) {
      if (!borrar.has(fk.padre) || borrar.has(fk.hija) || fk.anulable) continue;
      // Referencia obligatoria a algo que se borra: esas filas no pueden quedar
      if (INTOCABLES.has(fk.hija)) {
        throw new Error(`${fk.hija}.${fk.columnas.join(', ')} apunta obligatoriamente a ${fk.padre}; no se puede borrar sin perder ${fk.hija}. Revise antes de continuar.`);
      }
      borrar.add(fk.hija);
      dependientes.push({ tabla: fk.hija, por: fk.padre });
      cambio = true;
    }
  }
  const anular = fks.filter(fk => borrar.has(fk.padre) && !borrar.has(fk.hija) && fk.anulable);
  return { borrar, grupos, dependientes, anular };
};

// Orden de borrado: primero las tablas que apuntan a otras (hijas antes que padres)
const ordenar = (borrar, fks) => {
  const aristas = fks.filter(fk => borrar.has(fk.hija) && borrar.has(fk.padre) && fk.hija !== fk.padre
    && !['c', 'n'].includes(fk.al_borrar)); // CASCADE / SET NULL no necesitan orden
  const pendientes = new Set(borrar);
  const orden = [];
  while (pendientes.size) {
    const libres = [...pendientes].filter(t => !aristas.some(fk => fk.padre === t && pendientes.has(fk.hija)));
    if (!libres.length) throw new Error(`Referencias circulares entre: ${[...pendientes].join(', ')}`);
    libres.sort().forEach(t => { orden.push(t); pendientes.delete(t); });
  }
  return orden;
};

const contar = async (db, tabla) => Number((await db.query(`SELECT COUNT(*) AS n FROM ${id(tabla)}`)).rows[0].n);

const main = async () => {
  const aplicar = process.argv.includes('--aplicar');
  const db = await pool.connect();
  try {
    console.log(`Base de datos: ${process.env.DB_NAME || 'zentra_med'} en ${process.env.DB_HOST || 'localhost'}`);
    console.log(aplicar ? '⚠️  MODO APLICAR: se borrarán los datos\n' : 'Simulación: no se borra nada (agregue --aplicar para borrar)\n');

    await db.query('BEGIN');
    const existentes = new Set((await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).rows.map(r => r.tablename));
    if (!existentes.has('medicinas') || !existentes.has('codigos_articulos')) {
      throw new Error('No se encontraron las tablas medicinas y codigos_articulos: ¿es la base correcta?');
    }
    const fks = await llavesForaneas(db);
    const { borrar, grupos, dependientes, anular } = planificar(existentes, fks);
    const orden = ordenar(borrar, fks);

    const filas = {};
    for (const t of borrar) filas[t] = await contar(db, t);

    let totalFilas = 0;
    for (const grupo of grupos) {
      if (!grupo.tablas.length) continue;
      const suma = grupo.tablas.reduce((s, t) => s + filas[t], 0);
      totalFilas += suma;
      console.log(`• ${grupo.nombre}: ${miles(suma)} registro(s)`);
      grupo.tablas.filter(t => filas[t]).forEach(t => console.log(`    ${t}: ${miles(filas[t])}`));
    }
    if (dependientes.length) {
      console.log('\n• También se borran (dependen de lo anterior):');
      for (const d of dependientes) {
        totalFilas += filas[d.tabla];
        console.log(`    ${d.tabla}: ${miles(filas[d.tabla])} (apunta a ${d.por})`);
      }
    }

    const anulaciones = [];
    for (const fk of anular) {
      const condicion = fk.columnas.map(c => `${id(c)} IS NOT NULL`).join(' OR ');
      const n = Number((await db.query(`SELECT COUNT(*) AS n FROM ${id(fk.hija)} WHERE ${condicion}`)).rows[0].n);
      if (n) anulaciones.push({ fk, n, condicion });
    }
    if (anulaciones.length) {
      console.log('\n• Se conservan, pero se les quita la referencia a lo que se borra:');
      anulaciones.forEach(({ fk, n }) => console.log(`    ${fk.hija}.${fk.columnas.join(', ')} → ${fk.padre}: ${miles(n)} fila(s)`));
    }

    const conserva = async (tabla, condicion = 'TRUE') => existentes.has(tabla)
      ? Number((await db.query(`SELECT COUNT(*) AS n FROM ${id(tabla)} WHERE ${condicion}`)).rows[0].n) : 0;
    const medicinas = await conserva('medicinas');
    const articulos = await conserva('codigos_articulos');
    const presentaciones = await conserva('medicina_presentaciones');
    const medConExistencia = await conserva('medicinas', 'cantidad > 0');
    const artConExistencia = await conserva('codigos_articulos', 'cantidad_disponible > 0');
    console.log(`\nSe conservan: ${miles(medicinas)} medicina(s) (${miles(presentaciones)} presentación(es)) y ${miles(articulos)} artículo(s).`);
    console.log(`Kárdex nuevo: saldo inicial para ${miles(medConExistencia)} medicina(s) y ${miles(artConExistencia)} artículo(s) con existencia.`);
    console.log(`Total a borrar: ${miles(totalFilas)} registro(s) en ${borrar.size} tabla(s).`);

    if (!aplicar) {
      await db.query('ROLLBACK');
      console.log('\nSimulación terminada. Nada fue borrado.');
      return;
    }

    // 1. Quitar referencias opcionales en tablas que se conservan
    for (const { fk, condicion } of anulaciones) {
      await db.query(`UPDATE ${id(fk.hija)} SET ${fk.columnas.map(c => `${id(c)} = NULL`).join(', ')} WHERE ${condicion}`);
    }
    // 2. Borrar en orden (hijas antes que padres)
    for (const t of orden) await db.query(`DELETE FROM ${id(t)}`);
    // 3. Camas: sin hospitalizaciones, todas quedan libres
    if (borrar.has('hospitalizaciones') && existentes.has('camas')) {
      await db.query("UPDATE camas SET estado = 'libre', updated_at = CURRENT_TIMESTAMP WHERE estado IS DISTINCT FROM 'libre'");
    }
    // 4. Numeración desde 1
    const secuencias = (await db.query(`
      SELECT format('%I.%I', n.nspname, s.relname) AS nombre
      FROM pg_class s
      JOIN pg_namespace n ON n.oid = s.relnamespace
      JOIN pg_depend d ON d.classid = 'pg_class'::regclass AND d.objid = s.oid AND d.deptype IN ('a', 'i')
      JOIN pg_class t ON t.oid = d.refobjid
      WHERE s.relkind = 'S' AND t.relnamespace = 'public'::regnamespace AND t.relname = ANY($1)
      UNION
      SELECT format('%I.%I', n.nspname, s.relname)
      FROM pg_class s JOIN pg_namespace n ON n.oid = s.relnamespace
      WHERE s.relkind = 'S' AND n.nspname = 'public' AND s.relname = ANY($2)`,
    [[...borrar], SECUENCIAS_NUMERACION])).rows;
    for (const s of secuencias) await db.query(`ALTER SEQUENCE ${s.nombre} RESTART`);
    // 5. Kárdex: saldo inicial con la existencia actual
    if (borrar.has('medicina_movimientos')) {
      await db.query(`INSERT INTO medicina_movimientos (medicina_id, tipo, cantidad, existencia_resultante, motivo, usuario_nombre)
        SELECT id, 'inicial', cantidad, cantidad, 'Existencia al iniciar operaciones', 'Sistema'
        FROM medicinas WHERE cantidad > 0`);
    }
    if (borrar.has('articulo_movimientos')) {
      await db.query(`INSERT INTO articulo_movimientos (articulo_id, tipo, cantidad, existencia_resultante, motivo, usuario_nombre)
        SELECT id, 'inicial', cantidad_disponible, cantidad_disponible, 'Existencia al iniciar operaciones', 'Sistema'
        FROM codigos_articulos WHERE cantidad_disponible > 0`);
    }

    // Comprobación final antes de confirmar
    if (await conserva('medicinas') !== medicinas || await conserva('codigos_articulos') !== articulos) {
      throw new Error('El listado de medicinas o artículos cambió durante el borrado; no se guardó nada');
    }
    await db.query('COMMIT');
    console.log(`\n✅ Listo. Se borraron ${miles(totalFilas)} registro(s); ${secuencias.length} numeración(es) reiniciadas.`);
    console.log(`   Quedan ${miles(medicinas)} medicina(s) y ${miles(articulos)} artículo(s) con su existencia.`);
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    console.error(`\n❌ ${error.message}\nNo se borró nada.`);
    process.exitCode = 1;
  } finally {
    db.release();
    await pool.end();
  }
};

main();
