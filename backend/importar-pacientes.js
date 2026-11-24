#!/usr/bin/env node
/**
 * Carga pacientes desde un Excel con el formato de "Exportar a Excel" de Pacientes
 * (hojas Pacientes, Lugar de trabajo, Contactos de emergencia, Familiares, Responsables).
 *
 *   node importar-pacientes.js ../database/Pacientes_2026-10-24.xlsx            -> simulación, no guarda nada
 *   node importar-pacientes.js ../database/Pacientes_2026-10-24.xlsx --aplicar  -> guarda
 *
 * Qué hace:
 *  - Cada encabezado se convierte a su campo (el inverso de la exportación) y cada valor al tipo
 *    de la columna: fechas seriales de Excel, Sí/No, números de teléfono y DPI sin notación científica.
 *  - La columna ID del Excel es el número de expediente: se guarda como código alternativo
 *    (si no trae uno) y sirve para unir las demás hojas. El paciente recibe el ID del sistema.
 *  - Filas vacías se ignoran. Pacientes repetidos (mismo expediente o DPI) se cargan una sola vez:
 *    se queda el registro con DPI válido (13 dígitos) o, si no, el más reciente.
 *  - Si el paciente ya existe (mismo código alternativo o DPI) se actualiza y sus contactos,
 *    lugar de trabajo, familiares y responsables se reemplazan por los del Excel.
 *  - Los valores de listas se pasan a los del formulario (MASCULINO -> M, SOLTERA -> soltero…);
 *    "NO INDICA" / "SIN INFORMACIÓN" quedan vacíos.
 * Todo corre en una transacción: si algo falla no queda nada a medias.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { leerLibro } = require('./leer-xlsx');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ---------- Encabezado -> campo (inverso de js/exportar-excel.js) ----------

const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const clave = (s) => sinAcentos(s).trim().toLowerCase().replace(/\s+/g, ' ');

const TITULOS = {
  'id': 'id', 'id del paciente': 'paciente_id', 'paciente': null,
  'nombre': 'nombre', 'apellido paterno': 'apellido_paterno', 'apellido materno': 'apellido_materno',
  'fecha de nacimiento': 'fecha_nacimiento', 'genero': 'genero', 'dpi': 'dpi', 'telefono': 'telefono',
  'email': 'email', 'direccion': 'direccion', 'estado': 'estado', 'estado civil': 'estado_civil',
  'grado academico': 'grado_academico', 'tipo de servicio': 'tipo_servicio', 'segmento coex': 'segmento_coex',
  'es cliente': 'is_cliente', 'fecha de registro': 'fecha_registro', 'primera consulta': 'fecha_primer_consulta',
  'motivo de consulta': 'motivo_consulta', 'parentesco': 'parentesco', 'relacion': 'relacion',
  'codigo alternativo': 'codigo_alternativo', 'creado': 'created_at', 'actualizado': 'updated_at'
};
const campoDe = (encabezado) => {
  const k = clave(encabezado);
  return k in TITULOS ? TITULOS[k] : k.replace(/ /g, '_');
};

// ---------- Listas del formulario de pacientes ----------

const opcionesDe = (idSelect) => {
  try {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const bloque = html.match(new RegExp(`<select[^>]*id="${idSelect}"[^>]*>([\\s\\S]*?)</select>`));
    return bloque ? [...bloque[1].matchAll(/<option value="([^"]+)"[^>]*>([^<]*)</g)].map(m => ({ valor: m[1], texto: m[2] })) : [];
  } catch {
    return [];
  }
};
const PROFESIONES = opcionesDe('profesion');

const SIN_DATO = new Set(['no indica', 'sin informacion', 'sin informacio', 'n/a', 'na', 'no aplica', 'ninguno', '-', '.']);

const CORRECCIONES = {
  nacionalidad: { GUATEMLATECA: 'GUATEMALTECA', GUATEMLATECO: 'GUATEMALTECO' },
  municipio: { GUAATEMALA: 'GUATEMALA' },
  departamento: { GUAATEMALA: 'GUATEMALA' },
  motivo_consulta: { 'INTERNAMIENTO PSIQUATRICO': 'INTERNAMIENTO PSIQUIATRICO' }
};

const genero = (v) => {
  const k = clave(v);
  if (/^m(asc|$)/.test(k)) return 'M';
  if (/^f(em|$)/.test(k)) return 'F';
  if (k) return 'O';
  return null;
};
const estadoCivil = (v) => {
  const k = clave(v);
  if (/^so[l]?te/.test(k)) return 'soltero';
  if (/^casad/.test(k)) return 'casado';
  if (/^divorc/.test(k)) return 'divorciado';
  if (/^viud/.test(k)) return 'viudo';
  if (/^uni/.test(k)) return 'union';
  return v;
};
const gradoAcademico = (v) => {
  const k = clave(v);
  if (/primaria/.test(k)) return 'primaria';
  if (/basico|secundaria/.test(k)) return 'secundaria';
  if (/bachill|bachiler|perito|diversificado|high school|preparatoria|magisterio|maestr[ao] de/.test(k)) return 'preparatoria';
  if (/tecnic/.test(k)) return 'tecnico';
  if (/universit|licenci|ingenier/.test(k)) return 'licenciatura';
  if (/postgrado|maestria|doctorado/.test(k)) return 'postgrado';
  return v;
};
const profesion = (v) => {
  const k = clave(v);
  const opcion = PROFESIONES.find(o => clave(o.valor) === k || clave(o.texto) === k
    || clave(o.texto).split('/').some(t => t.trim() === k));
  return opcion ? opcion.valor : v;
};

// ---------- Conversión por tipo de columna ----------

const pad = (n) => String(n).padStart(2, '0');
const serialAFecha = (serial, conHora) => {
  const ms = Math.round((Number(serial) - 25569) * 86400000);
  const d = new Date(ms);
  const fecha = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return conHora ? `${fecha} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` : fecha;
};

const esNumeroExcel = (s) => /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(s);

const convertir = (valor, col, avisos, contexto) => {
  if (valor === null || valor === undefined) return null;
  let v = String(valor).trim();
  if (!v || SIN_DATO.has(clave(v))) return null;
  const tipo = col.data_type;

  if (tipo === 'boolean') {
    const k = clave(v);
    if (['si', 'yes', 'true', '1', 'x', 'vivo', 'viva'].includes(k)) return true;
    if (['no', 'false', '0', 'fallecido', 'fallecida'].includes(k)) return false;
    avisos.push(`${contexto}: "${v}" no es Sí/No, queda vacío`);
    return null;
  }
  if (tipo === 'integer' || tipo === 'smallint' || tipo === 'bigint') {
    if (!esNumeroExcel(v)) { avisos.push(`${contexto}: "${v}" no es número, queda vacío`); return null; }
    return Math.round(Number(v));
  }
  if (tipo === 'numeric' || tipo === 'double precision' || tipo === 'real') {
    if (!esNumeroExcel(v)) { avisos.push(`${contexto}: "${v}" no es número, queda vacío`); return null; }
    return Number(v);
  }
  if (tipo === 'date' || tipo.startsWith('timestamp')) {
    const conHora = tipo.startsWith('timestamp');
    if (esNumeroExcel(v)) {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 1900 && n <= 2100) {
        avisos.push(`${contexto}: solo trae el año ${n}, se guarda 01/01/${n}`);
        return conHora ? `${n}-01-01 00:00:00` : `${n}-01-01`;
      }
      if (n < 1 || n > 80000) { avisos.push(`${contexto}: "${v}" no es una fecha, queda vacía`); return null; }
      return serialAFecha(n, conHora);
    }
    let m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return conHora ? `${m[1]}-${m[2]}-${m[3]} ${m[4] || '00'}:${m[5] || '00'}:${m[6] || '00'}` : `${m[1]}-${m[2]}-${m[3]}`;
    m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}${conHora ? ' 00:00:00' : ''}`;
    avisos.push(`${contexto}: "${v}" no es una fecha, queda vacía`);
    return null;
  }
  // Texto: los números que Excel guardó como número (teléfonos, DPI, zona) vuelven a texto sin ".0" ni "E+"
  if (esNumeroExcel(v) && /[.e]/i.test(v)) {
    const n = Number(v);
    if (Number.isInteger(n) && Math.abs(n) < Number.MAX_SAFE_INTEGER) v = BigInt(n).toString();
  }
  const correccion = CORRECCIONES[col.column_name]?.[v.toUpperCase()];
  if (correccion) v = correccion;
  if (col.character_maximum_length && v.length > col.character_maximum_length) {
    avisos.push(`${contexto}: texto de ${v.length} caracteres, se recorta a ${col.character_maximum_length}`);
    v = v.slice(0, col.character_maximum_length);
  }
  return v;
};

// ---------- Hojas ----------

const HOJAS_RELACIONADAS = [
  { hoja: 'Lugar de trabajo', tabla: 'empresas', unaPorPaciente: true },
  { hoja: 'Contactos de emergencia', tabla: 'contactos_emergencia', unaPorPaciente: false },
  { hoja: 'Familiares', tabla: 'datos_familia', unaPorPaciente: true },
  { hoja: 'Responsables', tabla: 'responsables_paciente', unaPorPaciente: false }
];

const filasConDatos = (filas) => {
  if (!filas?.length) return { encabezados: [], datos: [] };
  const encabezados = filas[0].map(h => (h == null ? '' : String(h)));
  const datos = filas.slice(1)
    .map((fila, i) => ({ numero: i + 2, celdas: encabezados.map((_, c) => fila[c]) }))
    .filter(f => f.celdas.some(v => v !== null && v !== undefined && String(v).trim() !== ''));
  return { encabezados, datos };
};

const columnasDe = async (db, tabla) => {
  const r = await db.query(
    `SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
     FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [tabla]);
  return new Map(r.rows.map(c => [c.column_name, c]));
};

const id = (n) => `"${String(n).replace(/"/g, '""')}"`;

// Las secuencias no se deshacen con ROLLBACK: tras una simulación vuelven al último ID guardado
const devolverNumeracion = async (db) => {
  for (const tabla of ['pacientes', ...HOJAS_RELACIONADAS.map(h => h.tabla)]) {
    const seq = (await db.query("SELECT pg_get_serial_sequence($1, 'id') AS s", [`public.${tabla}`]).catch(() => ({ rows: [{}] }))).rows[0]?.s
      || (await db.query(
        `SELECT substring(column_default from 'nextval\\(''([^'']+)''') AS s FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id'`, [tabla])).rows[0]?.s;
    if (!seq) continue;
    const { rows: [{ maximo }] } = await db.query(
      `SELECT COALESCE(MAX(id::text::bigint), 0) AS maximo FROM ${id(tabla)} WHERE id::text ~ '^[0-9]+$'`);
    await db.query('SELECT setval($1, $2, $3)', [seq, Math.max(Number(maximo), 1), Number(maximo) > 0]);
  }
};
const expediente = (v) => (v == null ? '' : String(v).trim().replace(/\.0+$/, ''));

const main = async () => {
  const args = process.argv.slice(2);
  const archivo = args.find(a => !a.startsWith('--'));
  const aplicar = args.includes('--aplicar');
  if (!archivo || !fs.existsSync(archivo)) {
    console.error('Uso: node importar-pacientes.js <archivo.xlsx> [--aplicar]');
    process.exitCode = 1;
    return;
  }
  const libro = leerLibro(archivo);
  if (!libro.Pacientes) throw new Error('El Excel no tiene la hoja "Pacientes"');

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'zentra_med',
    ssl: process.env.DB_SSL === 'require' ? { rejectUnauthorized: false } : false
  });
  const db = await pool.connect();
  const avisos = [];
  try {
    console.log(`Base de datos: ${process.env.DB_NAME || 'zentra_med'} en ${process.env.DB_HOST || 'localhost'}`);
    console.log(`Archivo: ${path.basename(archivo)}`);
    console.log(aplicar ? 'MODO APLICAR: se guardarán los cambios\n' : 'Simulación: no se guarda nada (agregue --aplicar para guardar)\n');
    await db.query('BEGIN');

    // ---- Pacientes ----
    const colsPac = await columnasDe(db, 'pacientes');
    const { encabezados, datos } = filasConDatos(libro.Pacientes);
    const campos = encabezados.map(campoDe);
    const ignorados = encabezados.filter((h, i) => h && campos[i] && campos[i] !== 'id' && !colsPac.has(campos[i]));
    if (ignorados.length) console.log(`Columnas sin campo en la base (se ignoran): ${ignorados.join(', ')}`);

    const leidos = datos.map(({ numero, celdas }) => {
      const valores = {};
      const nombre = [celdas[campos.indexOf('nombre')], celdas[campos.indexOf('apellido_paterno')]].filter(Boolean).join(' ');
      campos.forEach((campo, i) => {
        if (!campo || campo === 'id' || campo === 'foto' || !colsPac.has(campo)) return;
        valores[campo] = convertir(celdas[i], colsPac.get(campo), avisos, `Fila ${numero} (${nombre}) · ${encabezados[i]}`);
      });
      if (valores.genero) valores.genero = genero(valores.genero);
      if (valores.estado_civil) valores.estado_civil = estadoCivil(valores.estado_civil);
      if (valores.grado_academico) valores.grado_academico = gradoAcademico(valores.grado_academico);
      if (valores.profesion) valores.profesion = profesion(valores.profesion);
      valores.estado = valores.estado ? valores.estado.toLowerCase() : 'activo';
      valores.cliente_id = null; // los clientes no se cargan desde aquí
      if (valores.dpi) valores.dpi = valores.dpi.replace(/\D/g, '') || null;
      const exp = expediente(celdas[campos.indexOf('id')]);
      // El ID del Excel es el expediente cuando no es un número del sistema
      if (!valores.codigo_alternativo && exp && !/^\d+$/.test(exp)) valores.codigo_alternativo = exp;
      return { numero, nombre, valores, claves: new Set([exp, valores.codigo_alternativo].filter(Boolean)) };
    });

    // Obligatorios
    const validos = leidos.filter(p => {
      const falta = ['nombre', 'apellido_paterno'].filter(c => !p.valores[c]);
      if (falta.length) avisos.push(`Fila ${p.numero}: falta ${falta.join(' y ')}, no se carga`);
      return !falta.length;
    });

    // Repetidos: mismo expediente o mismo DPI
    const grupos = [];
    for (const p of validos) {
      const grupo = grupos.find(g => g.some(o => [...p.claves].some(k => o.claves.has(k))
        || (p.valores.dpi && o.valores.dpi === p.valores.dpi)));
      if (grupo) grupo.push(p); else grupos.push([p]);
    }
    const dpiValido = (p) => /^\d{13}$/.test(p.valores.dpi || '');
    const pacientes = grupos.map(g => {
      if (g.length === 1) return g[0];
      const elegido = [...g].sort((a, b) => (dpiValido(b) - dpiValido(a))
        || String(b.valores.updated_at || '').localeCompare(String(a.valores.updated_at || '')))[0];
      g.forEach(o => o.claves.forEach(k => elegido.claves.add(k)));
      avisos.push(`${elegido.nombre}: aparece ${g.length} veces (filas ${g.map(o => o.numero).join(', ')}); se carga una vez con la fila ${elegido.numero}`
        + ` (DPI ${elegido.valores.dpi || '—'}; descartados: ${g.filter(o => o !== elegido).map(o => o.valores.dpi || '—').join(', ')})`);
      return elegido;
    });
    pacientes.forEach(p => {
      if (p.valores.dpi && !dpiValido(p)) avisos.push(`${p.nombre}: DPI ${p.valores.dpi} no tiene 13 dígitos (se guarda igual)`);
      if (p.valores.fecha_nacimiento && p.valores.fecha_nacimiento > new Date().toISOString().slice(0, 10)) {
        avisos.push(`${p.nombre}: fecha de nacimiento ${p.valores.fecha_nacimiento} está en el futuro`);
      }
      if (p.valores.fecha_nacimiento && p.valores.edad) {
        const calculada = new Date().getFullYear() - Number(p.valores.fecha_nacimiento.slice(0, 4));
        if (Math.abs(calculada - p.valores.edad) > 1) {
          avisos.push(`${p.nombre}: edad ${p.valores.edad} no cuadra con la fecha de nacimiento ${p.valores.fecha_nacimiento}`);
        }
      }
    });

    // ---- Guardar pacientes ----
    let nuevos = 0;
    let actualizados = 0;
    const idPorClave = new Map();
    for (const p of pacientes) {
      const codigos = [...p.claves];
      const existente = (await db.query(
        `SELECT id FROM pacientes WHERE codigo_alternativo = ANY($1::text[]) OR ($2::text IS NOT NULL AND dpi = $2) LIMIT 1`,
        [codigos, p.valores.dpi || null])).rows[0];
      const cols = Object.keys(p.valores).filter(c => !(c === 'fecha_registro' && p.valores[c] === null));
      let pacienteId;
      if (existente) {
        await db.query(
          `UPDATE pacientes SET ${cols.map((c, i) => `${id(c)} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1}`,
          [...cols.map(c => p.valores[c]), existente.id]);
        pacienteId = existente.id;
        actualizados++;
      } else {
        const r = await db.query(
          `INSERT INTO pacientes (${cols.map(id).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
          cols.map(c => p.valores[c]));
        pacienteId = r.rows[0].id;
        nuevos++;
      }
      p.id = pacienteId;
      codigos.forEach(k => idPorClave.set(k, pacienteId));
    }

    // ---- Hojas relacionadas ----
    const resumenRelacionadas = [];
    for (const { hoja, tabla, unaPorPaciente } of HOJAS_RELACIONADAS) {
      const existe = (await db.query('SELECT to_regclass($1) IS NOT NULL AS e', [`public.${tabla}`])).rows[0].e;
      const { encabezados: enc, datos: filas } = filasConDatos(libro[hoja]);
      if (!existe || !filas.length || enc[0] === 'Sin registros') {
        resumenRelacionadas.push(`${hoja}: 0`);
        continue;
      }
      const cols = await columnasDe(db, tabla);
      const cmp = enc.map(campoDe);
      const iPaciente = cmp.indexOf('paciente_id');
      const porPaciente = new Map();
      let sinPaciente = 0;
      for (const { numero, celdas } of filas) {
        const pid = idPorClave.get(expediente(celdas[iPaciente]));
        if (!pid) {
          sinPaciente++;
          avisos.push(`${hoja}, fila ${numero}: el paciente "${expediente(celdas[iPaciente])}" no está en la hoja Pacientes, no se carga`);
          continue;
        }
        const valores = {};
        cmp.forEach((campo, i) => {
          if (!campo || campo === 'paciente_id' || campo === 'id' || !cols.has(campo)) return;
          valores[campo] = convertir(celdas[i], cols.get(campo), avisos, `${hoja}, fila ${numero} · ${enc[i]}`);
        });
        const lista = porPaciente.get(pid) || [];
        // Copias idénticas (pacientes repetidos) se cargan una vez
        const firma = JSON.stringify(Object.entries(valores).filter(([c]) => !['created_at', 'updated_at'].includes(c)));
        if (!lista.some(x => x.firma === firma)) lista.push({ firma, valores, numero });
        porPaciente.set(pid, lista);
      }
      let insertadas = 0;
      for (const [pid, lista] of porPaciente) {
        await db.query(`DELETE FROM ${id(tabla)} WHERE paciente_id = $1`, [pid]);
        const elegidas = unaPorPaciente
          ? [lista.sort((a, b) => String(b.valores.updated_at || '').localeCompare(String(a.valores.updated_at || '')))[0]]
          : lista;
        // El formulario muestra los contactos según su tipo, en minúsculas: principal y secundario
        if (tabla === 'contactos_emergencia') {
          const usados = new Set();
          elegidas.forEach(({ valores }) => {
            const tipo = clave(valores.tipo);
            valores.tipo = ['principal', 'secundario'].includes(tipo) && !usados.has(tipo) ? tipo
              : (usados.has('principal') ? 'secundario' : 'principal');
            usados.add(valores.tipo);
          });
        }
        if (unaPorPaciente && lista.length > 1) {
          avisos.push(`${hoja}: el paciente ${pid} trae ${lista.length} registros distintos; se guarda el más reciente (fila ${elegidas[0].numero})`);
        }
        for (const { valores } of elegidas) {
          const obligatorioSinDato = [...cols.values()].find(c => c.is_nullable === 'NO' && !c.column_default
            && !['id', 'paciente_id'].includes(c.column_name) && valores[c.column_name] == null);
          if (obligatorioSinDato) {
            avisos.push(`${hoja}: registro del paciente ${pid} sin ${obligatorioSinDato.column_name}, no se carga`);
            continue;
          }
          const fila = { paciente_id: pid, ...valores };
          // responsables_paciente.id es texto sin valor por defecto
          if (cols.get('id') && !cols.get('id').column_default) fila.id = `RESP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
          const c = Object.keys(fila);
          await db.query(`INSERT INTO ${id(tabla)} (${c.map(id).join(', ')}) VALUES (${c.map((_, i) => `$${i + 1}`).join(', ')})`,
            c.map(k => fila[k]));
          insertadas++;
        }
      }
      resumenRelacionadas.push(`${hoja}: ${insertadas}${sinPaciente ? ` (${sinPaciente} sin paciente)` : ''}`);
    }

    // ---- Resumen ----
    console.log(`Filas con datos en "Pacientes": ${datos.length} (filas vacías ignoradas: ${libro.Pacientes.length - 1 - datos.length})`);
    console.log(`Pacientes: ${nuevos} nuevo(s), ${actualizados} actualizado(s)`);
    console.log(`Relacionados: ${resumenRelacionadas.join(' · ')}`);
    const muestra = pacientes.slice(0, 5).map(p => `  ${p.id} · ${p.nombre} · exp. ${p.valores.codigo_alternativo || '—'} · DPI ${p.valores.dpi || '—'}`
      + ` · ${p.valores.genero || '—'} · nac. ${p.valores.fecha_nacimiento || '—'} · tel. ${p.valores.telefono || '—'}`);
    console.log(`Ejemplo:\n${muestra.join('\n')}`);
    if (avisos.length) {
      console.log(`\nAvisos (${avisos.length}):`);
      avisos.forEach(a => console.log(`  - ${a}`));
    }

    if (!aplicar) {
      await db.query('ROLLBACK');
      await devolverNumeracion(db);
      console.log('\nSimulación terminada. Nada fue guardado.');
      return;
    }
    await db.query('COMMIT');
    console.log(`\n✅ Pacientes cargados: ${nuevos} nuevo(s), ${actualizados} actualizado(s).`);
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    console.error(`\n❌ ${error.message}\nNo se guardó nada.`);
    process.exitCode = 1;
  } finally {
    db.release();
    await pool.end();
  }
};

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
