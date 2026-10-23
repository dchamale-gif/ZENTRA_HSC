const pool = require('../db/connection');
const { cargarPermisos } = require('../middleware/auth');
const sync = require('../services/historiaSincronizada');

// Historias clínicas: una por consulta o ingreso. Mientras está abierta se edita;
// al cerrarla queda en solo lectura con una copia de los antecedentes de ese momento.

const TIPOS = ['consulta', 'ingreso', 'emergencia', 'control'];
const CAMPOS_TEXTO = ['motivo_consulta', 'enfermedad_actual', 'revision_sistemas', 'examen_fisico', 'impresion_clinica', 'plan'];
const SIGNOS = ['pa', 'fc', 'fr', 'temp', 'sat', 'peso', 'talla'];
const ANTECEDENTES = ['personales', 'quirurgicos', 'traumaticos', 'alergicos', 'familiares', 'habitos', 'gineco_obstetricos', 'medicamentos_habituales'];
const MAX_TEXTO = 20000;

const MIGRACION_PENDIENTE = 'Falta preparar la base de datos para las historias clínicas (npm run migrate:historias-clinicas).';

const errorConEstado = (message, status = 400) => Object.assign(new Error(message), { status });

const responder = (res, contexto, error) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message, ...(error.datos || {}) });
  if (error.code === '42P01') return res.status(503).json({ success: false, message: MIGRACION_PENDIENTE });
  console.error(`Error en ${contexto}:`, error.message);
  res.status(500).json({ success: false, message: 'No se pudo completar la operación. Intente de nuevo.' });
};

const nombreUsuario = (req) => `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email;

// Abrir y cerrar historias es del médico (permiso historia_clinica_cierre_edit o admin)
const exigirCierre = async (req) => {
  await cargarPermisos(req);
  if (req.userRoles.includes('admin') || req.userPermissions.includes('historia_clinica_cierre_edit')) return;
  throw errorConEstado('Solo el médico puede abrir o cerrar historias clínicas', 403);
};

const exigirAdmin = async (req) => {
  await cargarPermisos(req);
  if (!req.userRoles.includes('admin')) throw errorConEstado('Solo el administrador puede hacer esto', 403);
};

const texto = (valor, campo) => {
  const limpio = String(valor ?? '').trim();
  if (limpio.length > MAX_TEXTO) throw errorConEstado(`El campo "${campo}" es demasiado largo`);
  return limpio;
};

const fechaValida = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) throw errorConEstado('Fecha no válida');
  return String(valor);
};

const signosVitales = (valor) => {
  const signos = {};
  for (const clave of SIGNOS) {
    const v = String(valor?.[clave] ?? '').trim();
    if (v.length > 20) throw errorConEstado('Valor de signo vital no válido');
    if (v) signos[clave] = v;
  }
  return signos;
};

// La fecha va como texto YYYY-MM-DD: como Date se correría un día según la zona horaria del servidor.
// En COMPLETA, la segunda "fecha" reemplaza a la de * al armar la fila.
const COLUMNAS_COMPLETAS = `*, to_char(fecha, 'YYYY-MM-DD') AS fecha`;

// Columnas livianas para listas (sin los textos largos completos)
const COLUMNAS_LISTA = `h.id, h.paciente_id, to_char(h.fecha, 'YYYY-MM-DD') AS fecha, h.tipo, h.medico_nombre, h.estado,
  left(h.motivo_consulta, 200) AS motivo_consulta, left(h.impresion_clinica, 200) AS impresion_clinica`;

// GET /api/historias-clinicas/resumen?desde=&hasta=&medico=
// Por paciente: última consulta y si tiene historia abierta. Con filtros, solo los pacientes que los cumplen.
const resumen = async (req, res) => {
  try {
    const desde = fechaValida(req.query.desde);
    const hasta = fechaValida(req.query.hasta);
    const medico = String(req.query.medico || '').trim();
    const [pacientes, medicos] = await Promise.all([
      pool.query(
        `WITH coinciden AS (
           SELECT DISTINCT paciente_id FROM historias_clinicas
           WHERE ($1::date IS NULL OR fecha >= $1::date)
             AND ($2::date IS NULL OR fecha <= $2::date)
             AND ($3 = '' OR medico_nombre = $3)
         )
         SELECT h.paciente_id, to_char(MAX(h.fecha), 'YYYY-MM-DD') AS ultima_fecha, COUNT(*)::int AS total,
                BOOL_OR(h.estado = 'abierta') AS tiene_abierta
         FROM historias_clinicas h
         JOIN coinciden c ON c.paciente_id = h.paciente_id
         GROUP BY h.paciente_id`,
        [desde, hasta, medico]
      ),
      pool.query("SELECT DISTINCT medico_nombre FROM historias_clinicas WHERE medico_nombre <> '' ORDER BY medico_nombre")
    ]);
    res.json({ success: true, data: { pacientes: pacientes.rows, medicos: medicos.rows.map(r => r.medico_nombre) } });
  } catch (error) {
    responder(res, 'resumen de historias', error);
  }
};

// GET /api/historias-clinicas/paciente/:pacienteId - Historias del paciente, la más reciente primero
const listarPorPaciente = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${COLUMNAS_LISTA} FROM historias_clinicas h
       WHERE h.paciente_id::text = $1
       ORDER BY h.fecha DESC, h.id DESC`,
      [String(req.params.pacienteId)]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    responder(res, 'listar historias del paciente', error);
  }
};

// GET /api/historias-clinicas/:id
const obtener = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw errorConEstado('Historia no válida');
    const result = await pool.query(`SELECT ${COLUMNAS_COMPLETAS} FROM historias_clinicas WHERE id = $1`, [id]);
    if (!result.rowCount) throw errorConEstado('Historia clínica no encontrada', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    responder(res, 'obtener historia', error);
  }
};

// POST /api/historias-clinicas { paciente_id, tipo, fecha } - Abre una historia nueva (médico)
const crear = async (req, res) => {
  try {
    await exigirCierre(req);
    const pacienteId = String(req.body.paciente_id || '').trim();
    if (!pacienteId) throw errorConEstado('Elija un paciente');
    const tipo = TIPOS.includes(req.body.tipo) ? req.body.tipo : 'consulta';
    const fecha = fechaValida(req.body.fecha);

    const paciente = await pool.query('SELECT id FROM pacientes WHERE id::text = $1', [pacienteId]);
    if (!paciente.rowCount) throw errorConEstado('Paciente no encontrado', 404);

    const autor = nombreUsuario(req);
    const result = await pool.query(
      `INSERT INTO historias_clinicas (paciente_id, tipo, fecha, medico_id, medico_nombre, actualizado_por_nombre)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5, $5)
       RETURNING ${COLUMNAS_COMPLETAS}`,
      [paciente.rows[0].id, tipo, fecha, req.user.id, autor]
    );
    res.status(201).json({ success: true, message: 'Historia clínica abierta', data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Este paciente ya tiene una historia abierta. Ciérrela antes de abrir otra.' });
    }
    responder(res, 'crear historia', error);
  }
};

// PUT /api/historias-clinicas/:id - Edita una historia abierta (médico o enfermería)
const actualizar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw errorConEstado('Historia no válida');
    const valores = CAMPOS_TEXTO.map(campo => texto(req.body[campo], campo.replace('_', ' ')));
    const tipo = TIPOS.includes(req.body.tipo) ? req.body.tipo : null;
    const fecha = fechaValida(req.body.fecha);
    const signos = signosVitales(req.body.signos_vitales);

    const result = await pool.query(
      `UPDATE historias_clinicas SET
         motivo_consulta = $2, enfermedad_actual = $3, revision_sistemas = $4,
         examen_fisico = $5, impresion_clinica = $6, plan = $7,
         signos_vitales = $8::jsonb, tipo = COALESCE($9, tipo), fecha = COALESCE($10::date, fecha),
         actualizado_por_nombre = $11, updated_at = NOW()
       WHERE id = $1 AND estado = 'abierta'
       RETURNING ${COLUMNAS_COMPLETAS}`,
      [id, ...valores, JSON.stringify(signos), tipo, fecha, nombreUsuario(req)]
    );
    if (!result.rowCount) {
      const existe = await pool.query('SELECT estado FROM historias_clinicas WHERE id = $1', [id]);
      if (!existe.rowCount) throw errorConEstado('Historia clínica no encontrada', 404);
      throw errorConEstado('Esta historia está cerrada y ya no se puede editar', 409);
    }
    res.json({ success: true, message: 'Historia clínica guardada', data: result.rows[0] });
  } catch (error) {
    responder(res, 'actualizar historia', error);
  }
};

// POST /api/historias-clinicas/:id/cerrar { ordenes_pendientes?: 'completada' | 'cancelada' }
// La deja en solo lectura con sus órdenes y notas, y guarda los antecedentes de hoy.
// Si tiene órdenes médicas pendientes, hay que decir cómo quedan (si no, responde 409 con la lista).
const cerrar = async (req, res) => {
  const client = await pool.connect();
  try {
    await exigirCierre(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw errorConEstado('Historia no válida');
    const actual = await client.query('SELECT * FROM historias_clinicas WHERE id = $1', [id]);
    if (!actual.rowCount) throw errorConEstado('Historia clínica no encontrada', 404);
    const historia = actual.rows[0];
    if (historia.estado === 'cerrada') throw errorConEstado('Esta historia ya está cerrada', 409);
    if (!historia.motivo_consulta.trim() || !historia.impresion_clinica.trim()) {
      throw errorConEstado('Para cerrar la historia escriba y guarde el motivo de consulta y la impresión clínica');
    }

    const conOrdenes = await sync.disponible();
    const destinoPendientes = ['completada', 'cancelada'].includes(req.body?.ordenes_pendientes) ? req.body.ordenes_pendientes : null;
    if (conOrdenes) {
      const pendientes = await client.query(
        `SELECT id, left(descripcion, 160) AS descripcion FROM ordenes
         WHERE historia_id = $1 AND estado = 'pendiente' ORDER BY id`,
        [id]
      );
      if (pendientes.rowCount && !destinoPendientes) {
        throw Object.assign(errorConEstado(`La historia tiene ${pendientes.rowCount} orden(es) médica(s) pendiente(s). Indique si se marcan como completadas o canceladas.`, 409),
          { datos: { code: 'ORDENES_PENDIENTES', pendientes: pendientes.rows } });
      }
    }

    const antecedentes = await client.query(
      `SELECT ${ANTECEDENTES.join(', ')} FROM antecedentes_paciente WHERE paciente_id = $1`,
      [historia.paciente_id]
    );

    await client.query('BEGIN');
    if (conOrdenes && destinoPendientes) {
      await client.query(
        "UPDATE ordenes SET estado = $2, updated_at = NOW() WHERE historia_id = $1 AND estado = 'pendiente'",
        [id, destinoPendientes]
      );
    }
    const result = await client.query(
      `UPDATE historias_clinicas
       SET estado = 'cerrada', cerrada_en = NOW(), cerrada_por_nombre = $2,
           antecedentes_al_cierre = $3::jsonb, updated_at = NOW()
       WHERE id = $1 AND estado = 'abierta'
       RETURNING ${COLUMNAS_COMPLETAS}`,
      [id, nombreUsuario(req), JSON.stringify(antecedentes.rows[0] || {})]
    );
    if (!result.rowCount) throw errorConEstado('Esta historia ya está cerrada', 409);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Historia clínica cerrada', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    responder(res, 'cerrar historia', error);
  } finally {
    client.release();
  }
};

// POST /api/historias-clinicas/:id/reabrir - Solo administrador
const reabrir = async (req, res) => {
  try {
    await exigirAdmin(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw errorConEstado('Historia no válida');
    const result = await pool.query(
      `UPDATE historias_clinicas
       SET estado = 'abierta', cerrada_en = NULL, cerrada_por_nombre = NULL, antecedentes_al_cierre = NULL,
           actualizado_por_nombre = $2, updated_at = NOW()
       WHERE id = $1 AND estado = 'cerrada'
       RETURNING ${COLUMNAS_COMPLETAS}`,
      [id, `${nombreUsuario(req)} (reabrió)`]
    );
    if (!result.rowCount) throw errorConEstado('La historia no existe o ya está abierta', 404);
    res.json({ success: true, message: 'Historia clínica reabierta', data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'El paciente ya tiene otra historia abierta. Ciérrela antes de reabrir esta.' });
    }
    responder(res, 'reabrir historia', error);
  }
};

// DELETE /api/historias-clinicas/:id - Solo administrador
const eliminar = async (req, res) => {
  try {
    await exigirAdmin(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw errorConEstado('Historia no válida');
    const result = await pool.query('DELETE FROM historias_clinicas WHERE id = $1', [id]);
    if (!result.rowCount) throw errorConEstado('Historia clínica no encontrada', 404);
    res.json({ success: true, message: 'Historia clínica eliminada' });
  } catch (error) {
    responder(res, 'eliminar historia', error);
  }
};

// GET /api/historias-clinicas/antecedentes/:pacienteId
const obtenerAntecedentes = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM antecedentes_paciente WHERE paciente_id::text = $1',
      [String(req.params.pacienteId)]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    responder(res, 'obtener antecedentes', error);
  }
};

// PUT /api/historias-clinicas/antecedentes/:pacienteId
const guardarAntecedentes = async (req, res) => {
  try {
    const valores = ANTECEDENTES.map(campo => texto(req.body[campo], campo.replace('_', ' ')));
    const paciente = await pool.query('SELECT id FROM pacientes WHERE id::text = $1', [String(req.params.pacienteId)]);
    if (!paciente.rowCount) throw errorConEstado('Paciente no encontrado', 404);

    const columnas = ANTECEDENTES.join(', ');
    const parametros = ANTECEDENTES.map((_, i) => `$${i + 2}`).join(', ');
    const actualizaciones = ANTECEDENTES.map(c => `${c} = EXCLUDED.${c}`).join(', ');
    const result = await pool.query(
      `INSERT INTO antecedentes_paciente (paciente_id, ${columnas}, actualizado_por_nombre)
       VALUES ($1, ${parametros}, $${ANTECEDENTES.length + 2})
       ON CONFLICT (paciente_id) DO UPDATE SET ${actualizaciones},
         actualizado_por_nombre = EXCLUDED.actualizado_por_nombre, updated_at = NOW()
       RETURNING *`,
      [paciente.rows[0].id, ...valores, nombreUsuario(req)]
    );
    res.json({ success: true, message: 'Antecedentes guardados', data: result.rows[0] });
  } catch (error) {
    responder(res, 'guardar antecedentes', error);
  }
};

module.exports = {
  resumen, listarPorPaciente, obtener, crear, actualizar, cerrar, reabrir, eliminar,
  obtenerAntecedentes, guardarAntecedentes
};
