// ============================================
// REQUERIMIENTOS DE COMPRA
// Un almacén pide artículos o medicinas con su costo; compras lo confirma o lo
// rechaza y, confirmado, genera la compra con esos conceptos (la compra guarda
// requerimiento_id; ver comprasController).
// ============================================

const pool = require('../db/connection');
const inventario = require('../services/inventarioMedicinas');
const { nombreUsuario } = require('../services/historiaSincronizada');

const MIGRACION = 'Falta preparar la base de datos para los requerimientos de compra (npm run migrate:requerimientos).';
const ESTADOS = ['pendiente', 'confirmada', 'rechazada'];
const FORMAS_PAGO = ['efectivo', 'tarjeta', 'cheque', 'transferencia'];
const CATEGORIAS = ['medicinas', 'descartables'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const errorConEstado = (message, status = 400) => Object.assign(new Error(message), { status });

let migracionCache = { valor: false, hasta: 0 };
const disponible = async () => {
  if (Date.now() < migracionCache.hasta) return migracionCache.valor;
  const { rows } = await pool.query("SELECT to_regclass('public.requerimientos_compra') IS NOT NULL AS listo");
  const valor = rows[0].listo;
  migracionCache = { valor, hasta: valor ? Infinity : Date.now() + 60000 };
  return valor;
};

// Confirmar, rechazar y editar requerimientos ajenos es de compras (o del administrador)
const esDeCompras = (req) => req.userRoles?.includes('admin') || req.userPermissions?.includes('compras_edit');

const leerDatos = (body) => {
  const almacen = String(body.almacen || '').trim().slice(0, 60);
  if (!almacen) throw errorConEstado('Indique el almacén que hace el requerimiento');
  const fecha = body.fecha || null;
  if (fecha && !FECHA.test(fecha)) throw errorConEstado('Fecha no válida');
  // En farmacia se indica si se compran medicinas o descartables; en los demás almacenes no aplica
  const categoria = /farmacia/i.test(almacen) ? (body.categoria || null) : null;
  if (/farmacia/i.test(almacen) && !CATEGORIAS.includes(categoria)) throw errorConEstado('Indique si en farmacia se compran medicinas o descartables');
  const formaPago = body.forma_pago || null;
  if (formaPago && !FORMAS_PAGO.includes(formaPago)) throw errorConEstado('Forma de pago no válida');
  return {
    almacen,
    fecha,
    categoria,
    formaPago,
    observaciones: String(body.observaciones || '').trim() || null
  };
};

const leerItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) throw errorConEstado('Agregue al menos un artículo o medicina');
  return items.map((item, index) => {
    const tipo = item.tipo;
    const conceptoId = String(item.concepto_id || '').trim();
    const cantidad = Number(item.cantidad);
    const precio = Number(item.precio_unitario);
    if (!['articulo', 'medicina'].includes(tipo) || !conceptoId) throw errorConEstado(`Concepto ${index + 1}: elija el artículo o la medicina`);
    if (!Number.isInteger(cantidad) || cantidad <= 0) throw errorConEstado(`Concepto ${index + 1}: la cantidad debe ser un entero mayor a cero`);
    if (!Number.isFinite(precio) || precio < 0) throw errorConEstado(`Concepto ${index + 1}: el costo no es válido`);
    const presentacionId = tipo === 'medicina' && item.presentacion_id ? Number(item.presentacion_id) : null;
    if (presentacionId !== null && !Number.isInteger(presentacionId)) throw errorConEstado(`Concepto ${index + 1}: presentación no válida`);
    return { orden: index, tipo, conceptoId, cantidad, precio, presentacionId, subtotal: Number((cantidad * precio).toFixed(2)) };
  });
};

const guardarItems = async (client, requerimientoId, items) => {
  await client.query('DELETE FROM requerimiento_compra_items WHERE requerimiento_id = $1', [requerimientoId]);
  const conPresentaciones = await inventario.disponible();
  for (const item of items) {
    const pres = item.tipo === 'medicina' && conPresentaciones
      ? await inventario.presentacion(client, item.conceptoId, item.presentacionId)
      : { id: null, nombre: null, factor: 1 };
    await client.query(
      `INSERT INTO requerimiento_compra_items
         (requerimiento_id, orden, medicina_id, articulo_id, presentacion_id, presentacion_nombre, factor, cantidad, precio_unitario, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [requerimientoId, item.orden, item.tipo === 'medicina' ? item.conceptoId : null, item.tipo === 'articulo' ? item.conceptoId : null,
        pres.id, pres.nombre, pres.factor, item.cantidad, item.precio, item.subtotal]
    );
  }
};

const SELECT_REQUERIMIENTO = `
  SELECT r.*, to_char(r.fecha, 'YYYY-MM-DD') AS fecha,
         c.id AS compra_id, c.numero_compra,
         COALESCE((SELECT json_agg(json_build_object(
                     'tipo', CASE WHEN i.medicina_id IS NOT NULL THEN 'medicina' ELSE 'articulo' END,
                     'concepto_id', COALESCE(i.medicina_id, i.articulo_id),
                     'concepto_nombre', COALESCE(m.nombre, a.nombre_articulo),
                     'presentacion_id', i.presentacion_id,
                     'presentacion_nombre', i.presentacion_nombre,
                     'cantidad', i.cantidad,
                     'precio_unitario', i.precio_unitario,
                     'subtotal', i.subtotal
                   ) ORDER BY i.orden, i.id)
                   FROM requerimiento_compra_items i
                   LEFT JOIN medicinas m ON m.id = i.medicina_id
                   LEFT JOIN codigos_articulos a ON a.id = i.articulo_id
                   WHERE i.requerimiento_id = r.id), '[]'::json) AS items
  FROM requerimientos_compra r
  LEFT JOIN compras c ON c.requerimiento_id = r.id`;

const obtener = (db, id) => db.query(`${SELECT_REQUERIMIENTO} WHERE r.id = $1`, [id]).then(r => r.rows[0] || null);

const responderError = (res, error, accion) => {
  if (!error.status) console.error(`Error al ${accion}:`, error);
  const status = error.status || (error.code === '23503' ? 400 : 500);
  res.status(status).json({
    error: error.status ? error.message : error.code === '23503' ? 'Un artículo o medicina ya no existe' : `Error al ${accion}`
  });
};

// Solo se edita o elimina un requerimiento pendiente, y lo hace quien lo pidió o compras
const exigirEditable = (req, requerimiento) => {
  if (!requerimiento) throw errorConEstado('Requerimiento no encontrado', 404);
  if (requerimiento.estado !== 'pendiente') {
    const estado = { confirmada: 'confirmado', rechazada: 'rechazado' }[requerimiento.estado] || requerimiento.estado;
    throw errorConEstado(`El requerimiento ${requerimiento.numero} ya está ${estado}`, 409);
  }
  if (!esDeCompras(req) && Number(requerimiento.solicitado_por) !== Number(req.user.id)) {
    throw errorConEstado('Solo quien hizo el requerimiento o compras puede modificarlo', 403);
  }
};

const requerimientosController = {
  disponible,

  // GET /api/requerimientos-compra?estado=&almacen=&q=&confirmados_sin_compra=1
  async listar(req, res) {
    try {
      if (!(await disponible())) return res.json({ requerimientos: [], disponible: false });
      const { estado, almacen, q } = req.query;
      const valores = [];
      const condiciones = [];
      if (ESTADOS.includes(estado)) {
        valores.push(estado);
        condiciones.push(`r.estado = $${valores.length}`);
      }
      if (almacen) {
        valores.push(almacen);
        condiciones.push(`r.almacen = $${valores.length}`);
      }
      if (req.query.confirmados_sin_compra) condiciones.push(`r.estado = 'confirmada' AND c.id IS NULL`);
      if (String(q || '').trim()) {
        valores.push(`%${String(q).trim()}%`);
        condiciones.push(`(r.numero ILIKE $${valores.length} OR r.solicitado_por_nombre ILIKE $${valores.length} OR r.almacen ILIKE $${valores.length})`);
      }
      const { rows } = await pool.query(
        `${SELECT_REQUERIMIENTO}
         ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
         ORDER BY r.fecha DESC, r.id DESC
         LIMIT 500`, valores);
      const almacenes = await pool.query('SELECT DISTINCT almacen FROM requerimientos_compra ORDER BY almacen');
      res.json({ requerimientos: rows, almacenes: almacenes.rows.map(r => r.almacen), puedeRevisar: esDeCompras(req), disponible: true });
    } catch (error) {
      responderError(res, error, 'listar los requerimientos');
    }
  },

  async obtener(req, res) {
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const requerimiento = await obtener(pool, req.params.id);
      if (!requerimiento) throw errorConEstado('Requerimiento no encontrado', 404);
      res.json({ requerimiento });
    } catch (error) {
      responderError(res, error, 'obtener el requerimiento');
    }
  },

  // POST /api/requerimientos-compra
  async crear(req, res) {
    let client;
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const datos = leerDatos(req.body);
      const items = leerItems(req.body.items);
      const total = Number(items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
      client = await pool.connect();
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO requerimientos_compra
           (numero, fecha, almacen, categoria, forma_pago, observaciones, total, solicitado_por, solicitado_por_nombre)
         SELECT 'REQ-' || LPAD(n::text, GREATEST(4, LENGTH(n::text)), '0'),
                COALESCE($1::date, (NOW() AT TIME ZONE 'America/Guatemala')::date), $2, $3, $4, $5, $6, $7, $8
         FROM (SELECT nextval('requerimientos_compra_numero_seq') AS n) s
         RETURNING id`,
        [datos.fecha, datos.almacen, datos.categoria, datos.formaPago, datos.observaciones, total, req.user.id, nombreUsuario(req)]
      );
      await guardarItems(client, rows[0].id, items);
      const requerimiento = await obtener(client, rows[0].id);
      await client.query('COMMIT');
      res.status(201).json({ message: `Requerimiento ${requerimiento.numero} registrado`, requerimiento });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      responderError(res, error, 'crear el requerimiento');
    } finally {
      if (client) client.release();
    }
  },

  // PUT /api/requerimientos-compra/:id (solo pendientes)
  async actualizar(req, res) {
    let client;
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const datos = leerDatos(req.body);
      const items = leerItems(req.body.items);
      const total = Number(items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
      client = await pool.connect();
      await client.query('BEGIN');
      const actual = await client.query('SELECT * FROM requerimientos_compra WHERE id = $1 FOR UPDATE', [req.params.id]);
      exigirEditable(req, actual.rows[0]);
      await client.query(
        `UPDATE requerimientos_compra
         SET fecha = COALESCE($1::date, fecha), almacen = $2, categoria = $3, forma_pago = $4, observaciones = $5,
             total = $6, updated_at = NOW()
         WHERE id = $7`,
        [datos.fecha, datos.almacen, datos.categoria, datos.formaPago, datos.observaciones, total, req.params.id]
      );
      await guardarItems(client, req.params.id, items);
      const requerimiento = await obtener(client, req.params.id);
      await client.query('COMMIT');
      res.json({ message: `Requerimiento ${requerimiento.numero} actualizado`, requerimiento });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      responderError(res, error, 'actualizar el requerimiento');
    } finally {
      if (client) client.release();
    }
  },

  // PUT /api/requerimientos-compra/:id/estado { estado, motivo } (compras o administrador)
  async cambiarEstado(req, res) {
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      if (!esDeCompras(req)) throw errorConEstado('Solo compras puede confirmar o rechazar requerimientos', 403);
      const estado = req.body.estado;
      if (!ESTADOS.includes(estado)) throw errorConEstado('Estado no válido');
      const motivo = String(req.body.motivo || '').trim() || null;
      if (estado === 'rechazada' && !motivo) throw errorConEstado('Indique el motivo del rechazo');
      const actual = await obtener(pool, req.params.id);
      if (!actual) throw errorConEstado('Requerimiento no encontrado', 404);
      if (actual.compra_id && estado !== 'confirmada') {
        throw errorConEstado(`El requerimiento ya generó la compra ${actual.numero_compra}; no puede cambiar de estado`, 409);
      }
      await pool.query(
        `UPDATE requerimientos_compra
         SET estado = $1::varchar, motivo_rechazo = $2,
             revisado_por_nombre = CASE WHEN $1::varchar = 'pendiente' THEN NULL ELSE $3 END,
             revisado_en = CASE WHEN $1::varchar = 'pendiente' THEN NULL ELSE NOW() END,
             updated_at = NOW()
         WHERE id = $4`,
        [estado, estado === 'rechazada' ? motivo : null, nombreUsuario(req), req.params.id]
      );
      const textos = { pendiente: 'vuelve a pendiente', confirmada: 'confirmado', rechazada: 'rechazado' };
      res.json({ message: `Requerimiento ${actual.numero} ${textos[estado]}`, requerimiento: await obtener(pool, req.params.id) });
    } catch (error) {
      responderError(res, error, 'cambiar el estado del requerimiento');
    }
  },

  // DELETE /api/requerimientos-compra/:id (pendientes; los demás quedan como registro)
  async eliminar(req, res) {
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const actual = await obtener(pool, req.params.id);
      exigirEditable(req, actual);
      await pool.query('DELETE FROM requerimientos_compra WHERE id = $1', [req.params.id]);
      res.json({ message: `Requerimiento ${actual.numero} eliminado` });
    } catch (error) {
      responderError(res, error, 'eliminar el requerimiento');
    }
  }
};

module.exports = requerimientosController;
