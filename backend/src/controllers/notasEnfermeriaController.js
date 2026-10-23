const pool = require('../db/connection');
const sync = require('../services/historiaSincronizada');

// Notas de enfermería por turno. Siempre pertenecen a una historia clínica: se escriben mientras
// está abierta y quedan en solo lectura al cerrarla. Cada nota la edita o borra su autor (o el admin).

const TURNOS = ['manana', 'tarde', 'noche'];
const MAX_NOTA = 5000;
const MIGRACION_PENDIENTE = 'Falta preparar la base de datos para las notas de enfermería (npm run migrate:sincronizacion-historia).';

const responder = (res, contexto, error) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  if (error.code === '42P01' || error.code === '42703') return res.status(503).json({ success: false, message: MIGRACION_PENDIENTE });
  console.error(`Error en ${contexto}:`, error.message);
  res.status(500).json({ success: false, message: 'No se pudo completar la operación. Intente de nuevo.' });
};

const COLUMNAS = `n.id, n.historia_id, n.paciente_id, n.orden_medica_id, n.turno, n.fecha_hora, n.nota,
  n.autor_id, n.autor_nombre, n.created_at, n.updated_at, left(o.descripcion, 160) AS orden_descripcion`;

const validar = (body) => {
  const turno = String(body.turno || '');
  if (!TURNOS.includes(turno)) throw sync.errorConEstado('Elija el turno');
  const nota = String(body.nota || '').trim();
  if (!nota) throw sync.errorConEstado('Escriba la nota');
  if (nota.length > MAX_NOTA) throw sync.errorConEstado(`La nota puede tener hasta ${MAX_NOTA} caracteres`);
  const ordenId = body.orden_medica_id ? Number(body.orden_medica_id) : null;
  if (ordenId !== null && !Number.isInteger(ordenId)) throw sync.errorConEstado('Orden médica no válida');
  return { turno, nota, ordenId };
};

// La historia debe existir y estar abierta; la orden (si se indica) debe ser de esa misma historia
const exigirHistoriaAbierta = async (historiaId, ordenId) => {
  const historia = await pool.query('SELECT id, paciente_id, estado FROM historias_clinicas WHERE id = $1', [historiaId]);
  if (!historia.rowCount) throw sync.errorConEstado('Historia clínica no encontrada', 404);
  if (historia.rows[0].estado !== 'abierta') {
    throw sync.errorConEstado('La historia clínica está cerrada; sus notas de enfermería ya no se pueden modificar.', 409);
  }
  if (ordenId !== null) {
    const orden = await pool.query('SELECT 1 FROM ordenes WHERE id = $1 AND historia_id = $2', [ordenId, historiaId]);
    if (!orden.rowCount) throw sync.errorConEstado('La orden indicada no pertenece a esta historia clínica');
  }
  return historia.rows[0];
};

// La nota existe y quien la toca es su autor o el admin
const notaPropia = async (req, notaId) => {
  const result = await pool.query('SELECT id, historia_id, autor_id FROM notas_enfermeria WHERE id = $1', [notaId]);
  if (!result.rowCount) throw sync.errorConEstado('Nota no encontrada', 404);
  const nota = result.rows[0];
  const admin = await sync.esAdmin(req);
  if (!admin && Number(nota.autor_id) !== Number(req.user.id)) {
    throw sync.errorConEstado('Solo quien escribió la nota puede modificarla', 403);
  }
  return { nota, admin };
};

// GET /api/notas-enfermeria?historia_id=
const listar = async (req, res) => {
  try {
    const historiaId = Number(req.query.historia_id);
    if (!Number.isInteger(historiaId)) throw sync.errorConEstado('Indique la historia clínica');
    const result = await pool.query(
      `SELECT ${COLUMNAS} FROM notas_enfermeria n
       LEFT JOIN ordenes o ON o.id = n.orden_medica_id
       WHERE n.historia_id = $1
       ORDER BY n.fecha_hora DESC, n.id DESC`,
      [historiaId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    responder(res, 'listar notas de enfermería', error);
  }
};

// POST /api/notas-enfermeria { historia_id, turno, nota, orden_medica_id? }
const crear = async (req, res) => {
  try {
    const historiaId = Number(req.body.historia_id);
    if (!Number.isInteger(historiaId)) throw sync.errorConEstado('Indique la historia clínica');
    const { turno, nota, ordenId } = validar(req.body);
    const historia = await exigirHistoriaAbierta(historiaId, ordenId);
    const result = await pool.query(
      `INSERT INTO notas_enfermeria (historia_id, paciente_id, orden_medica_id, turno, nota, autor_id, autor_nombre)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [historiaId, historia.paciente_id, ordenId, turno, nota, req.user.id, sync.nombreUsuario(req)]
    );
    res.status(201).json({ success: true, message: 'Nota de enfermería guardada', data: { id: result.rows[0].id } });
  } catch (error) {
    responder(res, 'crear nota de enfermería', error);
  }
};

// PUT /api/notas-enfermeria/:id { turno, nota, orden_medica_id? }
const actualizar = async (req, res) => {
  try {
    const notaId = Number(req.params.id);
    if (!Number.isInteger(notaId)) throw sync.errorConEstado('Nota no válida');
    const { nota: actual } = await notaPropia(req, notaId);
    const { turno, nota, ordenId } = validar(req.body);
    await exigirHistoriaAbierta(actual.historia_id, ordenId);
    await pool.query(
      `UPDATE notas_enfermeria SET turno = $2, nota = $3, orden_medica_id = $4, updated_at = NOW() WHERE id = $1`,
      [notaId, turno, nota, ordenId]
    );
    res.json({ success: true, message: 'Nota de enfermería actualizada' });
  } catch (error) {
    responder(res, 'actualizar nota de enfermería', error);
  }
};

// DELETE /api/notas-enfermeria/:id
const eliminar = async (req, res) => {
  try {
    const notaId = Number(req.params.id);
    if (!Number.isInteger(notaId)) throw sync.errorConEstado('Nota no válida');
    const { nota, admin } = await notaPropia(req, notaId);
    if (!admin) await exigirHistoriaAbierta(nota.historia_id, null);
    await pool.query('DELETE FROM notas_enfermeria WHERE id = $1', [notaId]);
    res.json({ success: true, message: 'Nota de enfermería eliminada' });
  } catch (error) {
    responder(res, 'eliminar nota de enfermería', error);
  }
};

module.exports = { listar, crear, actualizar, eliminar };
