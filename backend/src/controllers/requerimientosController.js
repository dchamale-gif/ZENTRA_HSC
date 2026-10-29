// ============================================
// REQUERIMIENTOS DE COMPRA
// Una bodega (farmacia, cocina…) pide artículos o medicinas con su costo; compras lo confirma o lo
// rechaza y, confirmado, genera una o varias compras (una por proveedor) con esos conceptos.
// La compra guarda requerimiento_id y cada concepto suyo el renglón del que sale
// (compra_items.requerimiento_item_id); ver comprasController.
// ============================================

const pool = require('../db/connection');
const inventario = require('../services/inventarioMedicinas');
const { nombreUsuario } = require('../services/historiaSincronizada');
const correlativos = require('../services/correlativos');

const MIGRACION = 'Falta preparar la base de datos para los requerimientos de compra y las bodegas (npm run migrate:requerimientos).';
const ESTADOS = ['pendiente', 'confirmada', 'rechazada'];
const FORMAS_PAGO = ['efectivo', 'tarjeta', 'cheque', 'transferencia'];
const CATEGORIAS = ['medicinas', 'descartables'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const errorConEstado = (message, status = 400) => Object.assign(new Error(message), { status });

let migracionCache = { valor: false, hasta: 0 };
const disponible = async () => {
  if (Date.now() < migracionCache.hasta) return migracionCache.valor;
  // El reparto en varias compras es lo último de la migración
  const { rows } = await pool.query(
    `SELECT to_regclass('public.requerimientos_compra') IS NOT NULL
        AND EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'compra_items' AND column_name = 'requerimiento_item_id') AS listo`);
  const valor = rows[0].listo && await correlativos.disponible();
  migracionCache = { valor, hasta: valor ? Infinity : Date.now() + 60000 };
  return valor;
};

// Confirmar, rechazar y editar requerimientos ajenos es de compras (o del administrador)
const esDeCompras = (req) => req.userRoles?.includes('admin') || req.userPermissions?.includes('compras_edit');

// La farmacia indica si compra medicinas o descartables
const esFarmacia = (bodega) => bodega.codigo === 'FAR' || /farmacia/i.test(bodega.nombre);

const leerDatos = async (client, body) => {
  const bodega = await correlativos.bodega(client, body.bodega_id);
  if (!bodega) throw errorConEstado('Elija la bodega que hace el requerimiento');
  const fecha = body.fecha || null;
  if (fecha && !FECHA.test(fecha)) throw errorConEstado('Fecha no válida');
  // Ya no se pide; se conserva en los requerimientos que la tienen
  const categoria = esFarmacia(bodega) && CATEGORIAS.includes(body.categoria) ? body.categoria : null;
  const formaPago = body.forma_pago || null;
  if (formaPago && !FORMAS_PAGO.includes(formaPago)) throw errorConEstado('Forma de pago no válida');
  return {
    bodega,
    almacen: bodega.nombre,
    fecha,
    categoria,
    formaPago,
    observaciones: String(body.observaciones || '').trim() || null
  };
};

// conPrecios: compras escribe el costo; quien pide no lo ve y se toma del catálogo (precio null)
const leerItems = (items, conPrecios = true) => {
  if (!Array.isArray(items) || items.length === 0) throw errorConEstado('Agregue al menos un artículo o medicina');
  return items.map((item, index) => {
    const tipo = item.tipo;
    const conceptoId = String(item.concepto_id || '').trim();
    const cantidad = Number(item.cantidad);
    const precio = conPrecios ? Number(item.precio_unitario) : null;
    if (!['articulo', 'medicina'].includes(tipo) || !conceptoId) throw errorConEstado(`Concepto ${index + 1}: elija el artículo o la medicina`);
    if (!Number.isInteger(cantidad) || cantidad <= 0) throw errorConEstado(`Concepto ${index + 1}: la cantidad debe ser un entero mayor a cero`);
    if (conPrecios && (!Number.isFinite(precio) || precio < 0)) throw errorConEstado(`Concepto ${index + 1}: el costo no es válido`);
    const presentacionId = tipo === 'medicina' && item.presentacion_id ? Number(item.presentacion_id) : null;
    if (presentacionId !== null && !Number.isInteger(presentacionId)) throw errorConEstado(`Concepto ${index + 1}: presentación no válida`);
    return { orden: index, tipo, conceptoId, cantidad, precio, presentacionId };
  });
};

// Guarda los conceptos y devuelve el total. Sin costo (lo pidió una bodega) se usa el del catálogo:
// el de la medicina es por unidad base, así que se multiplica por la presentación.
const guardarItems = async (client, requerimientoId, items) => {
  await client.query('DELETE FROM requerimiento_compra_items WHERE requerimiento_id = $1', [requerimientoId]);
  const conPresentaciones = await inventario.disponible();
  let total = 0;
  for (const item of items) {
    const pres = item.tipo === 'medicina' && conPresentaciones
      ? await inventario.presentacion(client, item.conceptoId, item.presentacionId)
      : { id: null, nombre: null, factor: 1 };
    if (item.precio === null) {
      const { rows } = await client.query(
        item.tipo === 'medicina' ? 'SELECT precio_costo FROM medicinas WHERE id = $1' : 'SELECT precio_costo FROM codigos_articulos WHERE id = $1',
        [item.conceptoId]);
      item.precio = Number(((Number(rows[0]?.precio_costo) || 0) * (item.tipo === 'medicina' ? pres.factor : 1)).toFixed(2));
    }
    item.subtotal = Number((item.cantidad * item.precio).toFixed(2));
    total += item.subtotal;
    await client.query(
      `INSERT INTO requerimiento_compra_items
         (requerimiento_id, orden, medicina_id, articulo_id, presentacion_id, presentacion_nombre, factor, cantidad, precio_unitario, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [requerimientoId, item.orden, item.tipo === 'medicina' ? item.conceptoId : null, item.tipo === 'articulo' ? item.conceptoId : null,
        pres.id, pres.nombre, pres.factor, item.cantidad, item.precio, item.subtotal]
    );
  }
  total = Number(total.toFixed(2));
  await client.query('UPDATE requerimientos_compra SET total = $1 WHERE id = $2', [total, requerimientoId]);
  return total;
};

// Quien solo pide (no es de compras) no recibe costos, totales ni forma de pago
const sinPrecios = (req, requerimiento) => {
  if (!requerimiento || esDeCompras(req)) return requerimiento;
  const { total, forma_pago: formaPago, ...resto } = requerimiento;
  return {
    ...resto,
    items: (requerimiento.items || []).map(({ precio_unitario: precio, subtotal, ...item }) => item),
    compras: (requerimiento.compras || []).map(({ total: totalCompra, ...compra }) => compra)
  };
};

// Compra (no cancelada) en la que va un renglón del requerimiento; sin ella, el renglón está pendiente
const compraDelRenglon = (renglon) => `
  SELECT c.numero_compra FROM compra_items ci JOIN compras c ON c.id = ci.compra_id
  WHERE ci.requerimiento_item_id = ${renglon} AND c.estado <> 'cancelada'
  ORDER BY c.created_at LIMIT 1`;

const SELECT_REQUERIMIENTO = `
  SELECT r.*, to_char(r.fecha, 'YYYY-MM-DD') AS fecha,
         (SELECT codigo FROM bodegas WHERE id = r.bodega_id) AS bodega_codigo,
         COALESCE((SELECT json_agg(json_build_object(
                     'id', c.id, 'numero_compra', c.numero_compra, 'proveedor', p.nombre,
                     'numero_factura', c.numero_factura, 'estado', c.estado, 'total', c.total
                   ) ORDER BY c.created_at)
                   FROM compras c JOIN proveedores p ON p.id = c.proveedor_id
                   WHERE c.requerimiento_id = r.id), '[]'::json) AS compras,
         COALESCE((SELECT json_agg(json_build_object(
                     'id', i.id,
                     'compra', (${compraDelRenglon('i.id')}),
                     'tipo', CASE WHEN i.medicina_id IS NOT NULL THEN 'medicina' ELSE 'articulo' END,
                     'concepto_id', COALESCE(i.medicina_id::text, i.articulo_id::text),
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
  FROM requerimientos_compra r`;

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
  // (confirmados_sin_compra: confirmados con algún concepto que aún no está en una compra)
  async listar(req, res) {
    try {
      if (!(await disponible())) return res.json({ requerimientos: [], disponible: false });
      const { estado, bodega_id: bodegaId, q } = req.query;
      const valores = [];
      const condiciones = [];
      if (ESTADOS.includes(estado)) {
        valores.push(estado);
        condiciones.push(`r.estado = $${valores.length}`);
      }
      if (bodegaId) {
        valores.push(Number(bodegaId));
        condiciones.push(`r.bodega_id = $${valores.length}`);
      }
      if (req.query.confirmados_sin_compra) {
        condiciones.push(`r.estado = 'confirmada' AND EXISTS (
          SELECT 1 FROM requerimiento_compra_items i
          WHERE i.requerimiento_id = r.id AND NOT EXISTS (${compraDelRenglon('i.id')}))`);
      }
      if (String(q || '').trim()) {
        valores.push(`%${String(q).trim()}%`);
        condiciones.push(`(r.numero ILIKE $${valores.length} OR r.solicitado_por_nombre ILIKE $${valores.length} OR r.almacen ILIKE $${valores.length})`);
      }
      const { rows } = await pool.query(
        `${SELECT_REQUERIMIENTO}
         ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
         ORDER BY r.fecha DESC, r.id DESC
         LIMIT 500`, valores);
      res.json({ requerimientos: rows.map(r => sinPrecios(req, r)), puedeRevisar: esDeCompras(req), disponible: true });
    } catch (error) {
      responderError(res, error, 'listar los requerimientos');
    }
  },

  async obtener(req, res) {
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const requerimiento = await obtener(pool, req.params.id);
      if (!requerimiento) throw errorConEstado('Requerimiento no encontrado', 404);
      res.json({ requerimiento: sinPrecios(req, requerimiento) });
    } catch (error) {
      responderError(res, error, 'obtener el requerimiento');
    }
  },

  // POST /api/requerimientos-compra
  async crear(req, res) {
    let client;
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const conPrecios = esDeCompras(req);
      const items = leerItems(req.body.items, conPrecios);
      client = await pool.connect();
      await client.query('BEGIN');
      const datos = await leerDatos(client, req.body);
      if (!datos.bodega.activo) throw errorConEstado(`La bodega ${datos.bodega.nombre} está desactivada`);
      // Correlativo propio de la bodega y del año del requerimiento: FAR-0001-2026
      const numero = await correlativos.siguiente(client, 'requerimiento', datos.bodega.codigo, datos.fecha);
      const { rows } = await client.query(
        `INSERT INTO requerimientos_compra
           (numero, fecha, almacen, bodega_id, categoria, forma_pago, observaciones, total, solicitado_por, solicitado_por_nombre)
         VALUES ($1, COALESCE($2::date, (NOW() AT TIME ZONE 'America/Guatemala')::date), $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [numero, datos.fecha, datos.almacen, datos.bodega.id, datos.categoria, conPrecios ? datos.formaPago : null, datos.observaciones,
          0, req.user.id, nombreUsuario(req)]
      );
      await guardarItems(client, rows[0].id, items);
      const requerimiento = await obtener(client, rows[0].id);
      await client.query('COMMIT');
      res.status(201).json({ message: `Requerimiento ${requerimiento.numero} registrado`, requerimiento: sinPrecios(req, requerimiento) });
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
      // Quien pide no ve costos ni forma de pago: los costos salen del catálogo y la forma de pago no cambia
      const conPrecios = esDeCompras(req);
      const items = leerItems(req.body.items, conPrecios);
      client = await pool.connect();
      await client.query('BEGIN');
      const actual = await client.query('SELECT * FROM requerimientos_compra WHERE id = $1 FOR UPDATE', [req.params.id]);
      exigirEditable(req, actual.rows[0]);
      const datos = await leerDatos(client, req.body);
      // El número lleva el código de la bodega: cambiarla exige otro requerimiento
      if (actual.rows[0].bodega_id && Number(actual.rows[0].bodega_id) !== datos.bodega.id) {
        throw errorConEstado(`El requerimiento ${actual.rows[0].numero} es de ${actual.rows[0].almacen}; para otra bodega cree uno nuevo`);
      }
      await client.query(
        `UPDATE requerimientos_compra
         SET fecha = COALESCE($1::date, fecha), almacen = $2, bodega_id = $7, categoria = COALESCE($3, categoria),
             forma_pago = CASE WHEN $8 THEN $4 ELSE forma_pago END, observaciones = $5, updated_at = NOW()
         WHERE id = $6`,
        [datos.fecha, datos.almacen, datos.categoria, datos.formaPago, datos.observaciones, req.params.id, datos.bodega.id, conPrecios]
      );
      await guardarItems(client, req.params.id, items);
      const requerimiento = await obtener(client, req.params.id);
      await client.query('COMMIT');
      res.json({ message: `Requerimiento ${requerimiento.numero} actualizado`, requerimiento: sinPrecios(req, requerimiento) });
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
      const compras = actual.compras.filter(c => c.estado !== 'cancelada');
      if (compras.length && estado !== 'confirmada') {
        throw errorConEstado(`El requerimiento ya generó ${compras.length === 1 ? 'la compra' : 'las compras'} ${compras.map(c => c.numero_compra).join(', ')}; no puede cambiar de estado`, 409);
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
