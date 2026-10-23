const pool = require('../db/connection');
const sync = require('../services/historiaSincronizada');

// Evolución médica. Cada evolución queda en la historia clínica abierta del paciente y la firma
// el médico que la escribe (siempre a su nombre). Solo el admin puede modificarla —incluido el
// médico— o eliminarla, y siempre con un motivo que queda registrado.

const TIPOS = ['Seguimiento', 'Observación', 'Diagnóstico', 'Control', 'Indicaciones', 'Evaluación', 'Contraindicación', 'Procedimiento'];
const MAX_CONTENIDO = 10000;
const MIGRACION_PENDIENTE = 'Falta preparar la base de datos para la evolución médica (npm run migrate:evoluciones-medicas).';

const responder = (res, contexto, error) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  if (error.code === '42P01' || error.code === '42703') return res.status(503).json({ success: false, message: MIGRACION_PENDIENTE });
  console.error(`Error en ${contexto}:`, error.message);
  res.status(500).json({ success: false, message: 'No se pudo completar la operación. Intente de nuevo.' });
};

// Médicos que se pueden elegir: los usuarios con un rol (no admin) que abre y cierra historias y el
// Personal médico activo. Cuando el correo coincide son la misma persona y se unen (la especialidad
// sale de Personal médico). Clave: 'u:<id de usuario>' o 'p:<id de personal médico>'.
const consultaMedicos = async (db) => {
  const usuarios = (await db.query(
    `SELECT DISTINCT u.id, u.email, trim(concat(u.nombre, ' ', u.apellido)) AS nombre
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE p.nombre = 'historia_clinica_cierre_edit' AND r.nombre <> 'admin' AND u.activo = true`
  )).rows;

  const conPersonal = (await db.query("SELECT to_regclass('public.personal_medico') IS NOT NULL AS hay")).rows[0].hay;
  const personal = conPersonal ? (await db.query(
    `SELECT pm.id, pm.email, trim(concat_ws(' ', pm.nombre, pm.apellido_paterno, pm.apellido_materno)) AS nombre,
            COALESCE(e.nombre, '') AS especialidad
     FROM personal_medico pm
     LEFT JOIN especialidades_medicas e ON e.id = pm.especialidad_id
     WHERE pm.estado = 'activo'`
  )).rows : [];

  const porCorreo = new Map(personal.filter(pm => pm.email).map(pm => [pm.email.toLowerCase(), pm]));
  const unidos = new Set();
  const lista = usuarios.map(u => {
    const pm = porCorreo.get(String(u.email || '').toLowerCase());
    if (pm) unidos.add(pm.id);
    return { clave: `u:${u.id}`, usuario_id: u.id, nombre: u.nombre || u.email, especialidad: pm?.especialidad || '' };
  });
  personal.filter(pm => !unidos.has(pm.id)).forEach(pm => {
    lista.push({ clave: `p:${pm.id}`, usuario_id: null, nombre: pm.nombre, especialidad: pm.especialidad });
  });
  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
};

// El médico de la evolución: el usuario mismo; el admin puede elegir a otro médico (medico_clave)
const resolverMedico = async (req, db, admin) => {
  const clave = String(req.body.medico_clave || '');
  const lista = await consultaMedicos(db);
  if (!admin || !clave || clave === `u:${req.user.id}`) {
    const propio = lista.find(m => m.clave === `u:${req.user.id}`);
    return { id: req.user.id, nombre: sync.nombreUsuario(req), especialidad: propio?.especialidad || '' };
  }
  const medico = lista.find(m => m.clave === clave);
  if (!medico) throw sync.errorConEstado('El médico elegido no existe o no está activo');
  return { id: medico.usuario_id, nombre: medico.nombre, especialidad: medico.especialidad };
};

const validar = (body) => {
  const tipo = String(body.tipo || 'Seguimiento');
  if (!TIPOS.includes(tipo)) throw sync.errorConEstado('Tipo de evolución no válido');
  const contenido = String(body.contenido || '').trim();
  if (!contenido) throw sync.errorConEstado('Escriba la evolución');
  if (contenido.length > MAX_CONTENIDO) throw sync.errorConEstado(`La evolución puede tener hasta ${MAX_CONTENIDO} caracteres`);
  const fecha = String(body.fecha_hora || '');
  if (fecha && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fecha)) throw sync.errorConEstado('Fecha y hora no válidas');
  return { tipo, contenido, fecha: fecha || null };
};

const exigirMotivo = (body) => {
  const motivo = String(body.motivo || '').trim();
  if (motivo.length < 5) throw sync.errorConEstado('Escriba el motivo del cambio (al menos 5 caracteres)');
  if (motivo.length > 1000) throw sync.errorConEstado('El motivo puede tener hasta 1000 caracteres');
  return motivo;
};

const exigirAdmin = async (req) => {
  if (!(await sync.esAdmin(req))) throw sync.errorConEstado('Solo un administrador puede modificar o eliminar evoluciones', 403);
};

// GET /api/evoluciones/medicos
const medicos = async (req, res) => {
  try {
    res.json({ success: true, data: await consultaMedicos(pool) });
  } catch (error) {
    responder(res, 'listar médicos', error);
  }
};

// GET /api/evoluciones?paciente_id=  (todas las del paciente, la más reciente primero)
const listar = async (req, res) => {
  try {
    const pacienteId = String(req.query.paciente_id || '');
    if (!pacienteId) throw sync.errorConEstado('Indique el paciente');
    const result = await pool.query(
      `SELECT e.id, e.historia_id, e.tipo, e.contenido, e.medico_id, e.medico_nombre, e.especialidad,
              e.creado_por_nombre, to_char(e.fecha_hora, 'YYYY-MM-DD"T"HH24:MI') AS fecha_hora,
              to_char(h.fecha, 'YYYY-MM-DD') AS historia_fecha, h.estado AS historia_estado,
              COALESCE((SELECT json_agg(json_build_object('motivo', c.motivo, 'usuario', c.usuario_nombre,
                          'fecha', to_char(c.created_at AT TIME ZONE current_setting('TimeZone') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) ORDER BY c.created_at)
                        FROM evoluciones_medicas_cambios c WHERE c.evolucion_id = e.id), '[]') AS cambios
       FROM evoluciones_medicas e
       JOIN historias_clinicas h ON h.id = e.historia_id
       WHERE e.paciente_id = $1 AND e.eliminada_en IS NULL
       ORDER BY e.fecha_hora DESC, e.id DESC`,
      [pacienteId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    responder(res, 'listar evoluciones', error);
  }
};

// POST /api/evoluciones { paciente_id, tipo, fecha_hora?, contenido, medico_clave? (solo admin) }
const crear = async (req, res) => {
  const client = await pool.connect();
  try {
    const pacienteId = String(req.body.paciente_id || '');
    if (!pacienteId) throw sync.errorConEstado('Indique el paciente');
    const { tipo, contenido, fecha } = validar(req.body);
    const admin = await sync.esAdmin(req);
    await client.query('BEGIN');
    const historia = await sync.historiaParaOrden(req, pacienteId, client);
    const medico = await resolverMedico(req, client, admin);
    const result = await client.query(
      `INSERT INTO evoluciones_medicas (historia_id, paciente_id, tipo, fecha_hora, contenido, medico_id, medico_nombre, especialidad, creado_por_nombre)
       VALUES ($1, $2, $3, COALESCE($4::timestamp, CURRENT_TIMESTAMP), $5, $6, $7, $8, $9) RETURNING id`,
      [historia.id, pacienteId, tipo, fecha, contenido, medico.id, medico.nombre, medico.especialidad, sync.nombreUsuario(req)]
    );
    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      message: 'Evolución guardada',
      data: { id: result.rows[0].id, historia_id: historia.id, historia_abierta_automaticamente: historia.creada }
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.status === 409) error.message = 'El paciente no tiene una historia clínica abierta. El médico debe abrirla antes de escribir la evolución.';
    responder(res, 'crear evolución', error);
  } finally {
    client.release();
  }
};

const evolucionActual = async (db, id) => {
  const result = await db.query(
    `SELECT id, tipo, contenido, medico_id, medico_nombre, especialidad, fecha_hora FROM evoluciones_medicas
     WHERE id = $1 AND eliminada_en IS NULL FOR UPDATE`,
    [id]
  );
  if (!result.rowCount) throw sync.errorConEstado('Evolución no encontrada', 404);
  return result.rows[0];
};

// PUT /api/evoluciones/:id { tipo, fecha_hora, contenido, medico_clave, motivo }  (admin)
const actualizar = async (req, res) => {
  const client = await pool.connect();
  try {
    await exigirAdmin(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw sync.errorConEstado('Evolución no válida');
    const motivo = exigirMotivo(req.body);
    const { tipo, contenido, fecha } = validar(req.body);
    await client.query('BEGIN');
    const antes = await evolucionActual(client, id);
    // 'actual' (o sin clave) conserva el médico registrado, aunque ya no esté en la lista
    const medico = req.body.medico_clave && req.body.medico_clave !== 'actual'
      ? await resolverMedico(req, client, true)
      : { id: antes.medico_id, nombre: antes.medico_nombre, especialidad: antes.especialidad };
    await client.query(
      `INSERT INTO evoluciones_medicas_cambios (evolucion_id, accion, motivo, antes, usuario_id, usuario_nombre)
       VALUES ($1, 'editada', $2, $3, $4, $5)`,
      [id, motivo, JSON.stringify(antes), req.user.id, sync.nombreUsuario(req)]
    );
    await client.query(
      `UPDATE evoluciones_medicas SET tipo = $2, contenido = $3, fecha_hora = COALESCE($4::timestamp, fecha_hora),
              medico_id = $5, medico_nombre = $6, especialidad = $7, updated_at = NOW()
       WHERE id = $1`,
      [id, tipo, contenido, fecha, medico.id, medico.nombre, medico.especialidad]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: 'Evolución modificada' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    responder(res, 'modificar evolución', error);
  } finally {
    client.release();
  }
};

// DELETE /api/evoluciones/:id { motivo }  (admin; queda registrada, no se borra de la base)
const eliminar = async (req, res) => {
  const client = await pool.connect();
  try {
    await exigirAdmin(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw sync.errorConEstado('Evolución no válida');
    const motivo = exigirMotivo(req.body);
    await client.query('BEGIN');
    const antes = await evolucionActual(client, id);
    await client.query(
      `INSERT INTO evoluciones_medicas_cambios (evolucion_id, accion, motivo, antes, usuario_id, usuario_nombre)
       VALUES ($1, 'eliminada', $2, $3, $4, $5)`,
      [id, motivo, JSON.stringify(antes), req.user.id, sync.nombreUsuario(req)]
    );
    await client.query(
      `UPDATE evoluciones_medicas SET eliminada_en = NOW(), eliminada_por_nombre = $2, eliminada_motivo = $3 WHERE id = $1`,
      [id, sync.nombreUsuario(req), motivo]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: 'Evolución eliminada' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    responder(res, 'eliminar evolución', error);
  } finally {
    client.release();
  }
};

module.exports = { medicos, listar, crear, actualizar, eliminar, TIPOS };
