const pool = require('../db/connection');

const LIMITE_NOTIFICACIONES = 30;
const LIMITE_MENSAJES = 100;
const MAX_CARACTERES = 2000;

const errorServidor = (res, contexto, error) => {
  console.error(`Error en ${contexto}:`, error.message);
  res.status(500).json({ success: false, message: 'No se pudo completar la operación. Intente de nuevo.' });
};

// GET /api/comunicacion/resumen - Contadores para los íconos del encabezado
const getResumen = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM notificaciones WHERE user_id = $1 AND leida = false) AS notificaciones,
         (SELECT COUNT(*)::int FROM mensajes WHERE destinatario_id = $1 AND leido_en IS NULL) AS mensajes`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    errorServidor(res, 'getResumen', error);
  }
};

// ---------- Notificaciones ----------

// GET /api/comunicacion/notificaciones
const getNotificaciones = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, tipo, titulo, mensaje, enlace, leida, created_at
       FROM notificaciones
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, LIMITE_NOTIFICACIONES]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    errorServidor(res, 'getNotificaciones', error);
  }
};

// PUT /api/comunicacion/notificaciones/:id/leida
const marcarNotificacionLeida = async (req, res) => {
  try {
    await pool.query(
      'UPDATE notificaciones SET leida = true WHERE id = $1 AND user_id = $2',
      [Number(req.params.id), req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    errorServidor(res, 'marcarNotificacionLeida', error);
  }
};

// PUT /api/comunicacion/notificaciones/leidas
const marcarTodasLeidas = async (req, res) => {
  try {
    await pool.query('UPDATE notificaciones SET leida = true WHERE user_id = $1 AND leida = false', [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    errorServidor(res, 'marcarTodasLeidas', error);
  }
};

// ---------- Chat ----------

// GET /api/comunicacion/usuarios - Con quién se puede conversar
const getUsuariosChat = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.apellido,
              COALESCE(string_agg(DISTINCT COALESCE(NULLIF(r.descripcion, ''), r.nombre), ', '), '') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.activo = true AND u.id <> $1
       GROUP BY u.id
       ORDER BY u.nombre, u.apellido`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    errorServidor(res, 'getUsuariosChat', error);
  }
};

// GET /api/comunicacion/conversaciones - Último mensaje y no leídos por persona
const getConversaciones = async (req, res) => {
  try {
    const result = await pool.query(
      `WITH mios AS (
         SELECT m.*,
                CASE WHEN m.remitente_id = $1 THEN m.destinatario_id ELSE m.remitente_id END AS otro_id
         FROM mensajes m
         WHERE m.remitente_id = $1 OR m.destinatario_id = $1
       ),
       ultimos AS (
         SELECT DISTINCT ON (otro_id) otro_id, id, contenido, remitente_id, created_at
         FROM mios
         ORDER BY otro_id, id DESC
       )
       SELECT u.id AS usuario_id, u.nombre, u.apellido, u.activo,
              l.contenido AS ultimo_mensaje, l.created_at AS ultimo_en,
              (l.remitente_id = $1) AS ultimo_es_mio,
              (SELECT COUNT(*)::int FROM mensajes m
               WHERE m.remitente_id = u.id AND m.destinatario_id = $1 AND m.leido_en IS NULL) AS no_leidos
       FROM ultimos l
       JOIN users u ON u.id = l.otro_id
       ORDER BY l.id DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    errorServidor(res, 'getConversaciones', error);
  }
};

// GET /api/comunicacion/mensajes/:usuarioId?despues=<id>
// Devuelve la conversación con ese usuario y marca como leídos los recibidos.
const getMensajes = async (req, res) => {
  const otroId = Number(req.params.usuarioId);
  const despues = Number(req.query.despues) || 0;
  if (!Number.isInteger(otroId) || otroId === req.user.id) {
    return res.status(400).json({ success: false, message: 'Conversación no válida' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM (
         SELECT id, remitente_id, destinatario_id, contenido, leido_en, created_at
         FROM mensajes
         WHERE ((remitente_id = $1 AND destinatario_id = $2) OR (remitente_id = $2 AND destinatario_id = $1))
           AND id > $3
         ORDER BY id DESC
         LIMIT $4
       ) recientes
       ORDER BY id ASC`,
      [req.user.id, otroId, despues, LIMITE_MENSAJES]
    );

    await pool.query(
      `UPDATE mensajes SET leido_en = NOW()
       WHERE remitente_id = $1 AND destinatario_id = $2 AND leido_en IS NULL`,
      [otroId, req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    errorServidor(res, 'getMensajes', error);
  }
};

// POST /api/comunicacion/mensajes { destinatario_id, contenido }
const enviarMensaje = async (req, res) => {
  const destinatarioId = Number(req.body.destinatario_id);
  const contenido = String(req.body.contenido || '').trim();

  if (!contenido) {
    return res.status(400).json({ success: false, message: 'Escriba un mensaje antes de enviarlo' });
  }
  if (contenido.length > MAX_CARACTERES) {
    return res.status(400).json({ success: false, message: `El mensaje puede tener hasta ${MAX_CARACTERES} caracteres` });
  }
  if (!Number.isInteger(destinatarioId) || destinatarioId === req.user.id) {
    return res.status(400).json({ success: false, message: 'Elija a quién enviar el mensaje' });
  }

  try {
    const destinatario = await pool.query('SELECT activo FROM users WHERE id = $1', [destinatarioId]);
    if (destinatario.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'El usuario ya no existe' });
    }
    if (!destinatario.rows[0].activo) {
      return res.status(400).json({ success: false, message: 'Este usuario está desactivado y no puede recibir mensajes' });
    }

    const result = await pool.query(
      `INSERT INTO mensajes (remitente_id, destinatario_id, contenido)
       VALUES ($1, $2, $3)
       RETURNING id, remitente_id, destinatario_id, contenido, leido_en, created_at`,
      [req.user.id, destinatarioId, contenido]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    errorServidor(res, 'enviarMensaje', error);
  }
};

module.exports = {
  getResumen,
  getNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  getUsuariosChat,
  getConversaciones,
  getMensajes,
  enviarMensaje
};
