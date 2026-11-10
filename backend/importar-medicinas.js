#!/usr/bin/env node
/**
 * Reemplaza la información de medicinas con la de un Excel exportado del sistema
 * (hoja "Medicinas", una fila por medicina con su columna ID).
 *
 *   node importar-medicinas.js ../Medicinas_2026-11-03.xlsx            -> simulación, no guarda nada
 *   node importar-medicinas.js ../Medicinas_2026-11-03.xlsx --aplicar  -> guarda los cambios
 *
 * Qué hace:
 *  - Cada fila del Excel sobrescribe la medicina con el mismo ID (o la crea si no existe).
 *  - La existencia actual se respeta. Solo cambia si la columna EXISTENCIA trae un número,
 *    y en ese caso queda el ajuste en el kárdex.
 *  - Las medicinas que no están en el Excel se eliminan; si ya tienen ventas, compras,
 *    requerimientos, kárdex u otros registros, se desactivan para no romper el historial.
 *  - Antes de guardar copia la tabla completa a medicinas_respaldo_AAAAMMDD_HHMMSS.
 * Todo corre en una transacción: si algo falla no queda nada a medias.
 * No usa librerías extra: lee el .xlsx (zip + xml) con lo que trae Node.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ---------- Lectura del .xlsx ----------

const leerZip = (buffer) => {
  let fin = buffer.length - 22;
  while (fin >= 0 && buffer.readUInt32LE(fin) !== 0x06054b50) fin--;
  if (fin < 0) throw new Error('El archivo no es un .xlsx válido');
  const total = buffer.readUInt16LE(fin + 10);
  let p = buffer.readUInt32LE(fin + 16);
  const archivos = {};
  for (let i = 0; i < total; i++) {
    const metodo = buffer.readUInt16LE(p + 10);
    const comprimido = buffer.readUInt32LE(p + 20);
    const largoNombre = buffer.readUInt16LE(p + 28);
    const largoExtra = buffer.readUInt16LE(p + 30);
    const largoComentario = buffer.readUInt16LE(p + 32);
    const local = buffer.readUInt32LE(p + 42);
    const nombre = buffer.toString('utf8', p + 46, p + 46 + largoNombre);
    archivos[nombre] = () => {
      const inicio = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const datos = buffer.subarray(inicio, inicio + comprimido);
      return (metodo === 8 ? zlib.inflateRawSync(datos) : datos).toString('utf8');
    };
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return archivos;
};

const desescapar = (texto) => texto
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');

const textoDe = (xml) => desescapar([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => m[1]).join(''));

const columnaIndice = (ref) => [...ref.match(/^[A-Z]+/)[0]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

const leerHoja = (archivo, nombreHoja) => {
  const zip = leerZip(fs.readFileSync(archivo));
  const libro = zip['xl/workbook.xml']();
  const rels = zip['xl/_rels/workbook.xml.rels']();
  const hojas = [...libro.matchAll(/<sheet\b[^>]*>/g)].map(m => ({
    nombre: desescapar(m[0].match(/name="([^"]*)"/)[1]),
    rid: m[0].match(/r:id="([^"]*)"/)[1]
  }));
  const hoja = hojas.find(h => h.nombre.trim().toLowerCase() === nombreHoja.toLowerCase()) || hojas[0];
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map(m => m[0])
    .find(r => r.includes(`Id="${hoja.rid}"`));
  const destino = rel.match(/Target="([^"]*)"/)[1].replace(/^\/?(xl\/)?/, '');
  const compartidos = zip['xl/sharedStrings.xml']
    ? [...zip['xl/sharedStrings.xml']().matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textoDe(m[1]))
    : [];

  return [...zip[`xl/${destino}`]().matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(fila => {
    const valores = [];
    for (const c of fila[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, ref, attrs, cuerpo = ''] = c;
      const tipo = (attrs.match(/t="(\w+)"/) || [])[1];
      const v = cuerpo.match(/<v>([\s\S]*?)<\/v>/);
      let valor = null;
      if (tipo === 's' && v) valor = compartidos[Number(v[1])];
      else if (tipo === 'inlineStr') valor = textoDe(cuerpo);
      else if (v) valor = desescapar(v[1]);
      valores[columnaIndice(ref)] = valor;
    }
    return valores;
  });
};

// ---------- Columnas del Excel -> columnas de la tabla ----------

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

// [encabezado del Excel, columna en medicinas, tipo]
const MAPA = [
  ['ID', 'id', 'texto'],
  ['NOMBRE', 'nombre', 'texto'],
  ['DESCRIPCION', 'descripcion', 'texto'],
  ['PRINCIPIO ACTIVO', 'principio_activo', 'texto'],
  ['CONCENTRACION', 'concentracion', 'texto'],
  ['FORMA FARMACEUTICA', 'forma_farmaceutica', 'texto'],
  ['EXISTENCIA', 'cantidad', 'entero'],
  ['EXISTENCIA MINIMA', 'cantidad_minima', 'entero'],
  ['PRECIO DE COSTO', 'precio_costo', 'dinero'],
  ['PRECIO DE VENTA', 'precio_venta', 'dinero'],
  ['LOTE', 'lote', 'texto'],
  ['FECHA DE VENCIMIENTO', 'fecha_vencimiento', 'fecha'],
  ['ID DEL PROVEEDOR', 'proveedor_id', 'texto'],
  ['ACTIVO', 'activo', 'booleano'],
  ['CREADO', 'created_at', 'fechahora'],
  ['CODIGO EXTERNO', 'codigo_externo', 'texto'],
  ['SECCION', 'seccion', 'texto'],
  ['FAMILIA', 'familia', 'texto'],
  ['SUBFAMILIA', 'subfamilia', 'texto'],
  ['PRESENTACION', 'presentacion', 'texto'],
  ['CODIGO DE BARRAS', 'codigo_barra', 'texto'],
  ['DOSIS', 'dosis', 'texto'],
  ['UNIDAD DOSIS', 'unidad_dosis', 'texto'],
  ['PROVEEDOR', 'proveedor', 'texto'],
  ['CONTRAINDICACIONES', 'contraindicaciones', 'texto'],
  ['EFECTOS SECUNDARIOS', 'efectos_secundarios', 'texto'],
  ['UNIDAD BASE', 'unidad_base', 'unidad']
];

// Las mismas unidades que ofrece el formulario de medicinas
const UNIDADES = ['Tableta', 'Cápsula', 'Ampolla', 'Vial', 'Frasco', 'Sobre', 'Supositorio', 'Parche', 'ml', 'Unidad'];

// Excel guarda fechas como días desde 1899-12-30
const fechaExcel = (n) => new Date(Date.UTC(1899, 11, 30) + n * 86400000);

const convertir = (valor, tipo) => {
  const texto = valor == null ? '' : String(valor).trim();
  if (texto === '') return null;
  const numero = Number(texto.replace(/[Q,\s]/g, ''));
  switch (tipo) {
    case 'entero':
      if (!Number.isFinite(numero)) throw new Error(`"${texto}" no es un número`);
      return Math.round(numero);
    case 'dinero':
      if (!Number.isFinite(numero) || numero < 0) throw new Error(`"${texto}" no es un precio válido`);
      return Math.round(numero * 100) / 100;
    case 'booleano':
      return !/^(NO|N|FALSE|FALSO|0|INACTIVO)$/i.test(normalizar(texto));
    case 'fecha':
      // El exportador deja la hora de Guatemala (18:00 del día anterior): se redondea al día
      if (Number.isFinite(numero)) return fechaExcel(Math.round(numero)).toISOString().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
      { const m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
      throw new Error(`"${texto}" no es una fecha`);
    case 'fechahora':
      if (Number.isFinite(numero)) return fechaExcel(numero).toISOString().replace('T', ' ').slice(0, 19);
      return null;
    case 'unidad':
      return UNIDADES.find(u => u.toLowerCase() === texto.toLowerCase()) || texto;
    default:
      return texto;
  }
};

const leerMedicinas = (archivo) => {
  const filas = leerHoja(archivo, 'Medicinas');
  const encabezados = (filas[0] || []).map(normalizar);
  const posiciones = MAPA
    .map(([encabezado, columna, tipo]) => ({ columna, tipo, i: encabezados.indexOf(encabezado) }))
    .filter(c => c.i >= 0);
  for (const requerida of ['id', 'nombre']) {
    if (!posiciones.some(c => c.columna === requerida)) {
      throw new Error(`El Excel no tiene la columna ${requerida.toUpperCase()}`);
    }
  }

  const errores = [];
  const vistos = new Map();
  const medicinas = [];
  filas.slice(1).forEach((fila, k) => {
    const numeroFila = k + 2;
    if (!fila.some(v => v != null && String(v).trim() !== '')) return;
    const m = {};
    for (const { columna, tipo, i } of posiciones) {
      try {
        m[columna] = convertir(fila[i], tipo);
      } catch (e) {
        errores.push(`Fila ${numeroFila}, ${columna}: ${e.message}`);
      }
    }
    if (!m.id) errores.push(`Fila ${numeroFila}: no tiene ID`);
    if (!m.nombre) errores.push(`Fila ${numeroFila}: no tiene NOMBRE`);
    if (m.id && vistos.has(m.id)) errores.push(`Fila ${numeroFila}: el ID ${m.id} ya está en la fila ${vistos.get(m.id)}`);
    if (m.id) vistos.set(m.id, numeroFila);
    medicinas.push(m);
  });
  return { medicinas, columnasExcel: posiciones.map(c => c.columna), errores };
};

// ---------- Carga ----------

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'zentra_med',
  ssl: process.env.DB_SSL === 'require' ? { rejectUnauthorized: false } : false
});

const ident = (s) => `"${s.replace(/"/g, '""')}"`;

const run = async () => {
  const args = process.argv.slice(2);
  const aplicar = args.includes('--aplicar');
  const archivo = args.find(a => !a.startsWith('--'));
  if (!archivo) {
    console.log('Uso: node importar-medicinas.js <archivo.xlsx> [--aplicar]');
    process.exit(1);
  }

  const { medicinas, columnasExcel, errores } = leerMedicinas(path.resolve(archivo));
  console.log(`📄 ${path.basename(archivo)}: ${medicinas.length} medicinas`);
  if (errores.length) {
    console.error(`❌ El Excel tiene ${errores.length} error(es); no se cargó nada:`);
    errores.slice(0, 50).forEach(e => console.error('   ' + e));
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: infoColumnas } = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'medicinas'`);
    if (!infoColumnas.length) throw new Error('No existe la tabla medicinas');
    const columnasTabla = new Map(infoColumnas.map(c => [c.column_name, c]));

    const sinColumna = columnasExcel.filter(c => !columnasTabla.has(c));
    if (sinColumna.length) {
      console.log(`⚠️  La tabla no tiene estas columnas y se omiten: ${sinColumna.join(', ')}`);
      console.log('    (corre npm run migrate:medicinas y migrate:inventario-medicinas si las necesitas)');
    }
    const kardex = (await client.query(`SELECT to_regclass('medicina_movimientos') AS t`)).rows[0].t !== null;

    // Textos más largos que la columna: se amplía la columna en vez de cortar el dato
    const ampliadas = [];
    for (const columna of columnasExcel) {
      const info = columnasTabla.get(columna);
      if (!info || info.data_type !== 'character varying' || !info.character_maximum_length) continue;
      const largo = Math.max(0, ...medicinas.map(m => (m[columna] == null ? 0 : String(m[columna]).length)));
      if (largo > info.character_maximum_length) {
        const nuevo = Math.max(255, Math.ceil(largo / 50) * 50);
        await client.query(`ALTER TABLE medicinas ALTER COLUMN ${ident(columna)} TYPE VARCHAR(${nuevo})`);
        ampliadas.push(`${columna} ${info.character_maximum_length} → ${nuevo}`);
      }
    }

    let respaldo = null;
    if (aplicar) {
      const ahora = new Date();
      const p2 = (n) => String(n).padStart(2, '0');
      respaldo = `medicinas_respaldo_${ahora.getFullYear()}${p2(ahora.getMonth() + 1)}${p2(ahora.getDate())}`
        + `_${p2(ahora.getHours())}${p2(ahora.getMinutes())}${p2(ahora.getSeconds())}`;
      await client.query(`CREATE TABLE ${respaldo} AS SELECT * FROM medicinas`);
    }

    const { rows: actuales } = await client.query('SELECT id::text AS id, cantidad FROM medicinas');
    const existencia = new Map(actuales.map(r => [r.id, Number(r.cantidad) || 0]));

    // Columnas que se escriben: las del Excel que existen en la tabla (la existencia va aparte)
    const escribir = columnasExcel.filter(c => columnasTabla.has(c) && !['id', 'cantidad'].includes(c));
    const conUpdatedAt = columnasTabla.has('updated_at');
    const resumen = { actualizadas: 0, nuevas: 0, ajustesExistencia: 0, eliminadas: [], desactivadas: [] };

    for (const m of medicinas) {
      const nueva = !existencia.has(m.id);
      // NOT NULL en la tabla: precios en 0 y activo en true si vienen vacíos
      if (m.precio_costo == null) m.precio_costo = 0;
      if (m.precio_venta == null) m.precio_venta = 0;
      if (m.activo == null) m.activo = true;
      if (m.unidad_base == null && columnasTabla.has('unidad_base')) m.unidad_base = 'Unidad';
      if (m.cantidad_minima == null) m.cantidad_minima = 0;

      if (nueva) {
        const cols = ['id', ...escribir.filter(c => c !== 'created_at' || m.created_at), 'cantidad'];
        const valores = cols.map(c => (c === 'cantidad' ? 0 : m[c]));
        await client.query(
          `INSERT INTO medicinas (${cols.map(ident).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
          valores
        );
        existencia.set(m.id, 0);
        resumen.nuevas++;
      } else {
        // created_at no se toca en las que ya existen
        const cols = escribir.filter(c => c !== 'created_at');
        const sets = cols.map((c, i) => `${ident(c)} = $${i + 2}`);
        if (conUpdatedAt) sets.push('updated_at = CURRENT_TIMESTAMP');
        await client.query(`UPDATE medicinas SET ${sets.join(', ')} WHERE id::text = $1`, [m.id, ...cols.map(c => m[c])]);
        resumen.actualizadas++;
      }

      // Existencia: solo si el Excel trae un número distinto al actual
      if (m.cantidad != null && m.cantidad !== existencia.get(m.id)) {
        const diferencia = m.cantidad - existencia.get(m.id);
        await client.query('UPDATE medicinas SET cantidad = $2 WHERE id::text = $1', [m.id, m.cantidad]);
        if (kardex) {
          await client.query(
            `INSERT INTO medicina_movimientos (medicina_id, tipo, cantidad, existencia_resultante, motivo, usuario_nombre)
             SELECT id, $2, $3, $4, 'Carga de medicinas desde Excel', 'Sistema' FROM medicinas WHERE id::text = $1`,
            [m.id, nueva ? 'inicial' : 'ajuste', diferencia, m.cantidad]
          );
        }
        resumen.ajustesExistencia++;
      }
    }

    // Medicinas que no vienen en el Excel
    const enExcel = new Set(medicinas.map(m => m.id));
    const sobrantes = actuales.filter(r => !enExcel.has(r.id));
    if (sobrantes.length) {
      // Cualquier tabla con una columna medicina_id cuenta como uso (las presentaciones se van con la medicina)
      const { rows: referencias } = await client.query(`
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND column_name = 'medicina_id'
          AND table_name NOT IN ('medicinas', 'medicina_presentaciones')
          AND table_name NOT LIKE 'medicinas_respaldo_%'`);
      const ids = sobrantes.map(r => r.id);
      const usadas = new Set();
      for (const { table_name: tabla } of referencias) {
        const { rows } = await client.query(
          `SELECT DISTINCT medicina_id::text AS id FROM ${ident(tabla)} WHERE medicina_id::text = ANY($1)`, [ids]);
        rows.forEach(r => usadas.add(r.id));
      }
      const desactivar = ids.filter(id => usadas.has(id));
      const eliminar = ids.filter(id => !usadas.has(id));
      if (desactivar.length) {
        const r = await client.query(
          `UPDATE medicinas SET activo = false${conUpdatedAt ? ', updated_at = CURRENT_TIMESTAMP' : ''}
           WHERE id::text = ANY($1) RETURNING id::text AS id, nombre, cantidad`, [desactivar]);
        resumen.desactivadas = r.rows;
      }
      if (eliminar.length) {
        const r = await client.query(
          'DELETE FROM medicinas WHERE id::text = ANY($1) RETURNING id::text AS id, nombre', [eliminar]);
        resumen.eliminadas = r.rows;
      }
    }

    // Si el id sale de una secuencia, que siga después del ID más alto cargado
    const { rows: [seq] } = await client.query(`SELECT pg_get_serial_sequence('medicinas', 'id') AS s`);
    if (seq.s) await client.query(`SELECT setval($1, GREATEST((SELECT MAX(id) FROM medicinas), 1))`, [seq.s]);

    console.log('');
    if (ampliadas.length) console.log(`📏 Columnas ampliadas: ${ampliadas.join(', ')}`);
    console.log(`✏️  Actualizadas: ${resumen.actualizadas}`);
    console.log(`➕ Nuevas: ${resumen.nuevas}`);
    console.log(`📦 Existencias ajustadas: ${resumen.ajustesExistencia}`
      + (resumen.ajustesExistencia ? '' : ' (el Excel no trae existencias; se dejó la actual)'));
    console.log(`🗑️  Eliminadas (no estaban en el Excel): ${resumen.eliminadas.length}`);
    resumen.eliminadas.slice(0, 30).forEach(r => console.log(`     ${r.id}  ${r.nombre}`));
    if (resumen.eliminadas.length > 30) console.log(`     … y ${resumen.eliminadas.length - 30} más`);
    console.log(`⏸️  Desactivadas (no estaban en el Excel pero tienen historial): ${resumen.desactivadas.length}`);
    resumen.desactivadas.slice(0, 30).forEach(r => console.log(`     ${r.id}  ${r.nombre}  (existencia ${r.cantidad})`));
    if (resumen.desactivadas.length > 30) console.log(`     … y ${resumen.desactivadas.length - 30} más`);

    if (aplicar) {
      await client.query('COMMIT');
      console.log(`\n✅ Cambios guardados. La tabla como estaba antes quedó copiada en ${respaldo}`);
    } else {
      await client.query('ROLLBACK');
      console.log('\n🔎 Simulación: no se guardó nada. Para guardar, repite el comando con --aplicar');
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ No se cargó nada:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

run();
