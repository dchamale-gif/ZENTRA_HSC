const pool = require('../db/connection');
const sync = require('../services/historiaSincronizada');

// Signos vitales: cada toma es un registro con fecha y hora dentro de una historia clínica.
// La registra quien edita la historia (enfermería o médico); la corrige o borra su autor o el admin,
// mientras la historia esté abierta (el admin siempre). La historia guarda su última toma.

const SIGNOS = ['pa', 'fc', 'fr', 'temp', 'sat', 'peso', 'talla'];
const MIGRACION_PENDIENTE = 'Falta preparar la base de datos para el historial de signos vitales (npm run migrate:signos-vitales).';

const responder = (res, contexto, error) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  if (error.code === '42P01' || error.code === '42703') return res.status(503).json({ success: false, message: MIGRACION_PENDIENTE });
  console.error(`Error en ${contexto}:`, error.message);
  res.status(500).json({ success: false, message: 'No se pudo completar la operación. Intente de nuevo.' });
};

// Solo los signos conocidos, como texto corto (PA lleva "/")
const signosVitales = (valor) => {
  const signos = {};
  for (const clave of SIGNOS) {
    const v = String(valor?.[clave] ?? '').trim();
    if (v.length > 20) throw sync.errorConEstado('Valor de signo vital no válido');
    if (v) signos[clave] = v;
  }
  return signos;
};

const validar = (body) => {
  const valores = signosVitales(body.valores);
  if (!Object.keys(valores).length) throw sync.errorConEstado('Escriba al menos un signo vital');
  const fecha = String(body.fecha_hora || '');
  if (fecha && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fecha)) throw sync.errorConEstado('Fecha y hora no válidas');
  const nota = String(body.nota || '').trim();
  if (nota.length > 500) throw sync.errorConEstado('La nota puede tener hasta 500 caracteres');
  return { valores, fecha: fecha || null, nota };
};

// La historia guarda su última toma (la usan la impresión y el resumen)
const actualizarUltimaToma = (db, historiaId) => db.query(
  `UPDATE historias_clinicas SET signos_vitales = COALESCE(
     (SELECT valores FROM signos_vitales WHERE historia_id = $1 ORDER BY fecha_hora DESC, id DESC LIMIT 1), '{}'::jsonb)
   WHERE id = $1`,
  [historiaId]
);

// La toma existe, quien la toca es su autor o el admin, y la historia sigue abierta (el admin siempre)
const tomaEditable = async (req, db, id) => {
  const result = await db.query(
    `SELECT s.id, s.historia_id, s.registrado_por_id, h.estado FROM signos_vitales s
     JOIN historias_clinicas h ON h.id = s.historia_id WHERE s.id = $1 FOR UPDATE OF s`,
    [id]
  );
  if (!result.rowCount) throw sync.errorConEstado('Registro de signos vitales no encontrado', 404);
  const toma = result.rows[0];
  const admin = await sync.esAdmin(req);
  if (!admin && Number(toma.registrado_por_id) !== Number(req.user.id)) {
    throw sync.errorConEstado('Solo quien registró los signos vitales puede corregirlos', 403);
  }
  if (!admin && toma.estado !== 'abierta') {
    throw sync.errorConEstado('La historia clínica está cerrada; sus signos vitales ya no se pueden modificar.', 409);
  }
  return toma;
};

// GET /api/signos-vitales?paciente_id=  (todas las tomas del paciente, la más reciente primero)
const listar = async (req, res) => {
  try {
    const pacienteId = String(req.query.paciente_id || '');
    if (!pacienteId) throw sync.errorConEstado('Indique el paciente');
    const result = await pool.query(
      `SELECT s.id, s.historia_id, s.valores, s.nota, s.registrado_por_id, s.registrado_por_nombre,
              to_char(s.fecha_hora, 'YYYY-MM-DD"T"HH24:MI') AS fecha_hora,
              to_char(h.fecha, 'YYYY-MM-DD') AS historia_fecha, h.estado AS historia_estado
       FROM signos_vitales s
       JOIN historias_clinicas h ON h.id = s.historia_id
       WHERE s.paciente_id = $1
       ORDER BY s.fecha_hora DESC, s.id DESC`,
      [pacienteId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    responder(res, 'listar signos vitales', error);
  }
};

// POST /api/signos-vitales { paciente_id, fecha_hora?, valores: { pa, fc, ... }, nota? }
const crear = async (req, res) => {
  const client = await pool.connect();
  try {
    const pacienteId = String(req.body.paciente_id || '');
    if (!pacienteId) throw sync.errorConEstado('Indique el paciente');
    const { valores, fecha, nota } = validar(req.body);
    await client.query('BEGIN');
    const historia = await sync.historiaParaOrden(req, pacienteId, client);
    const result = await client.query(
      `INSERT INTO signos_vitales (historia_id, paciente_id, fecha_hora, valores, nota, registrado_por_id, registrado_por_nombre)
       VALUES ($1, $2, COALESCE($3::timestamp, CURRENT_TIMESTAMP), $4::jsonb, $5, $6, $7) RETURNING id`,
      [historia.id, pacienteId, fecha, JSON.stringify(valores), nota, req.user.id, sync.nombreUsuario(req)]
    );
    await actualizarUltimaToma(client, historia.id);
    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      message: 'Signos vitales registrados',
      data: { id: result.rows[0].id, historia_id: historia.id, historia_abierta_automaticamente: historia.creada }
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.status === 409) error.message = 'El paciente no tiene una historia clínica abierta. El médico debe abrirla antes de registrar signos vitales.';
    responder(res, 'registrar signos vitales', error);
  } finally {
    client.release();
  }
};

// PUT /api/signos-vitales/:id { fecha_hora, valores, nota }
const actualizar = async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw sync.errorConEstado('Registro no válido');
    const { valores, fecha, nota } = validar(req.body);
    await client.query('BEGIN');
    const toma = await tomaEditable(req, client, id);
    await client.query(
      `UPDATE signos_vitales SET valores = $2::jsonb, fecha_hora = COALESCE($3::timestamp, fecha_hora), nota = $4, updated_at = NOW()
       WHERE id = $1`,
      [id, JSON.stringify(valores), fecha, nota]
    );
    await actualizarUltimaToma(client, toma.historia_id);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Signos vitales corregidos' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    responder(res, 'corregir signos vitales', error);
  } finally {
    client.release();
  }
};

// DELETE /api/signos-vitales/:id
const eliminar = async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw sync.errorConEstado('Registro no válido');
    await client.query('BEGIN');
    const toma = await tomaEditable(req, client, id);
    await client.query('DELETE FROM signos_vitales WHERE id = $1', [id]);
    await actualizarUltimaToma(client, toma.historia_id);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Registro de signos vitales eliminado' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    responder(res, 'eliminar signos vitales', error);
  } finally {
    client.release();
  }
};

module.exports = { listar, crear, actualizar, eliminar };
