// ============================================
// REQUISICIONES A PROVEEDORES
// Junta las facturas (compras) de un proveedor de un mes en un solo documento que se
// le manda al proveedor y se paga de una vez: al pagarla, todas sus facturas quedan
// pagadas (fecha, forma y número de pago de la compra). Una factura va en una sola
// requisición, y una ya pagada por su cuenta no entra en ninguna.
// Se paga en uno o varios abonos (services/abonos): pendiente -> parcial -> pagada; o anulada
// (solo sin abonos; libera sus facturas). Sus facturas quedan pagadas cuando se completa el pago.
// ============================================

const pool = require('../db/connection');
const correlativos = require('../services/correlativos');
const { nombreUsuario } = require('../services/historiaSincronizada');
const { validarSubida, limpiarNombre, enviarArchivo } = require('../services/archivos');
const abonos = require('../services/abonos');

const MIGRACION = 'Falta preparar la base de datos para las requisiciones (npm run migrate:requisiciones).';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

const errorConEstado = (message, status = 400) => Object.assign(new Error(message), { status });

let migracionCache = { valor: false, hasta: 0 };
const disponible = async () => {
  if (Date.now() < migracionCache.hasta) return migracionCache.valor;
  const { rows } = await pool.query("SELECT to_regclass('public.requisicion_vouchers') IS NOT NULL AS listo");
  const valor = rows[0].listo;
  migracionCache = { valor, hasta: valor ? Infinity : Date.now() + 60000 };
  return valor;
};

// El pago de cada compra (fecha_pago…) llega con la migración del pago de compras
let pagosCache = { valor: false, hasta: 0 };
const pagosCompras = async () => {
  if (Date.now() < pagosCache.hasta) return pagosCache.valor;
  const { rows } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'compras' AND column_name = 'fecha_pago') AS listo`);
  const valor = rows[0].listo;
  pagosCache = { valor, hasta: valor ? Infinity : Date.now() + 60000 };
  return valor;
};

const texto = (valor, max) => String(valor ?? '').trim().slice(0, max) || null;

const leerFecha = (valor, nombre) => {
  if (!valor) return null;
  if (!FECHA.test(valor)) throw errorConEstado(`${nombre} no válida`);
  return valor;
};

const leerDatos = (body) => {
  const proveedorId = texto(body.proveedor_id, 60);
  if (!proveedorId) throw errorConEstado('Elija el proveedor');
  if (!MES.test(String(body.periodo || ''))) throw errorConEstado('Elija el mes de la requisición');
  const facturas = [...new Set((Array.isArray(body.facturas) ? body.facturas : []).map(id => String(id).trim()).filter(Boolean))];
  if (!facturas.length) throw errorConEstado('Elija al menos una factura');
  return {
    proveedorId,
    periodo: `${body.periodo}-01`,
    fecha: leerFecha(body.fecha, 'Fecha'),
    observaciones: texto(body.observaciones, 2000),
    facturas
  };
};

// El total es la suma de sus facturas no canceladas (cambia si se edita una factura)
const selectRequisicion = (conAbonos) => `
  SELECT r.id, r.numero, r.proveedor_id, p.nombre AS proveedor_nombre,
         to_char(r.periodo, 'YYYY-MM') AS periodo, to_char(r.fecha, 'YYYY-MM-DD') AS fecha,
         r.observaciones, r.estado, to_char(r.fecha_pago, 'YYYY-MM-DD') AS fecha_pago, r.forma_pago,
         r.numero_pago_banco, r.numero_autorizacion, r.pagado_por_nombre, r.motivo_anulacion,
         r.creado_por_nombre, r.created_at, r.updated_at,
         COALESCE((SELECT SUM(c.total) FROM compras c WHERE c.requisicion_id = r.id AND c.estado <> 'cancelada'), 0) AS total,
         COALESCE((SELECT json_agg(json_build_object(
                     'id', c.id, 'numero_compra', c.numero_compra, 'numero_factura', c.numero_factura,
                     'fecha', to_char(c.fecha, 'YYYY-MM-DD'), 'total', c.total, 'estado', c.estado
                   ) ORDER BY c.fecha, c.numero_compra)
                   FROM compras c WHERE c.requisicion_id = r.id), '[]'::json) AS facturas,
         COALESCE((SELECT json_agg(json_build_object(
                     'id', v.id, 'nombre', v.nombre_archivo, 'subido_por', v.subido_por_nombre, 'fecha', v.created_at
                   ) ORDER BY v.created_at)
                   FROM requisicion_vouchers v WHERE v.requisicion_id = r.id), '[]'::json) AS vouchers${conAbonos ? `,
         ${abonos.columnas('requisicion', 'r.id', 'requisicion_vouchers')}` : ''}
  FROM requisiciones r
  JOIN proveedores p ON p.id = r.proveedor_id`;

const obtener = async (db, id) =>
  db.query(`${selectRequisicion(await abonos.disponible())} WHERE r.id = $1`, [id]).then(r => r.rows[0] || null);

const totalDe = async (db, id) => {
  const { rows } = await db.query(
    "SELECT COALESCE(SUM(total), 0) AS total FROM compras WHERE requisicion_id = $1 AND estado <> 'cancelada'", [id]);
  return Number(rows[0].total);
};

// Estado según lo abonado. Completa: queda pagada con la fecha y forma del último abono y sus
// facturas quedan pagadas; si no, sus facturas vuelven a quedar pendientes de pago.
const recalcular = async (client, id, req) => {
  const { rows: [actual] } = await client.query('SELECT estado FROM requisiciones WHERE id = $1', [id]);
  if (!actual || actual.estado === 'anulada') return;
  const total = await totalDe(client, id);
  const ultimo = await abonos.resumen(client, 'requisicion', id);
  const estado = { pendiente: 'pendiente', parcial: 'parcial', pagado: 'pagada' }[abonos.estado(ultimo.pagado, total)];
  const pagada = estado === 'pagada';
  await client.query(
    `UPDATE requisiciones SET estado = $1, fecha_pago = $2, forma_pago = $3, numero_pago_banco = $4, numero_autorizacion = $5,
            pagado_por_nombre = $6, actualizado_por_nombre = $7, updated_at = NOW()
     WHERE id = $8`,
    [estado, pagada ? ultimo.fecha : null, pagada ? ultimo.forma_pago : null, pagada ? ultimo.numero_pago_banco : null,
      pagada ? ultimo.numero_autorizacion : null, pagada ? ultimo.registrado_por_nombre : null, nombreUsuario(req), id]);
  if (await pagosCompras()) {
    if (pagada) {
      await client.query(
        `UPDATE compras SET fecha_pago = $1, forma_pago = $2, referencia_pago = COALESCE($3, referencia_pago), updated_at = NOW()
         WHERE requisicion_id = $4 AND estado <> 'cancelada'`,
        [ultimo.fecha, ultimo.forma_pago, ultimo.numero_pago_banco || ultimo.numero_autorizacion || ultimo.referencia, id]);
    } else {
      await client.query('UPDATE compras SET fecha_pago = NULL, updated_at = NOW() WHERE requisicion_id = $1', [id]);
    }
  }
};

const responderError = (res, error, accion) => {
  if (!error.status) console.error(`Error al ${accion}:`, error);
  res.status(error.status || 500).json({ error: error.status ? error.message : `Error al ${accion}` });
};

// Deja en la requisición exactamente las facturas elegidas: del mismo proveedor, no canceladas,
// sin otra requisición y sin pago propio
const asignarFacturas = async (client, requisicionId, proveedorId, ids) => {
  const conPagos = await pagosCompras();
  const { rows } = await client.query(
    `SELECT id, numero_compra, numero_factura, proveedor_id::text AS proveedor_id, estado, requisicion_id
            ${conPagos ? ', fecha_pago' : ''}
     FROM compras WHERE id::text = ANY($1::text[]) FOR UPDATE`, [ids]);
  if (rows.length !== ids.length) throw errorConEstado('Una de las facturas ya no existe');
  for (const c of rows) {
    const nombre = c.numero_factura ? `La factura ${c.numero_factura}` : `La compra ${c.numero_compra}`;
    if (c.proveedor_id !== String(proveedorId)) throw errorConEstado(`${nombre} es de otro proveedor`);
    if (c.estado === 'cancelada') throw errorConEstado(`${nombre} está cancelada`);
    if (c.requisicion_id && c.requisicion_id !== requisicionId) throw errorConEstado(`${nombre} ya va en otra requisición`, 409);
    if (c.fecha_pago && c.requisicion_id !== requisicionId) throw errorConEstado(`${nombre} ya se pagó por su cuenta`, 409);
  }
  await client.query(
    'UPDATE compras SET requisicion_id = NULL WHERE requisicion_id = $1 AND NOT (id::text = ANY($2::text[]))',
    [requisicionId, ids]);
  await client.query('UPDATE compras SET requisicion_id = $1 WHERE id::text = ANY($2::text[])', [requisicionId, ids]);
};

// Con la requisición: transacción, bloqueo de la fila y respuesta con la requisición al día
const enTransaccion = async (res, accion, id, trabajo) => {
  let client;
  try {
    if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
    client = await pool.connect();
    await client.query('BEGIN');
    const { rows: [actual] } = await client.query('SELECT * FROM requisiciones WHERE id = $1 FOR UPDATE', [id]);
    if (!actual) throw errorConEstado('Requisición no encontrada', 404);
    const resultado = await trabajo(client, actual);
    const { mensaje, ...extra } = typeof resultado === 'string' ? { mensaje: resultado } : resultado;
    const requisicion = await obtener(client, id);
    await client.query('COMMIT');
    res.json({ message: mensaje, requisicion, ...extra });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    responderError(res, error, accion);
  } finally {
    if (client) client.release();
  }
};

const requisicionesController = {
  disponible,

  // GET /api/requisiciones?estado=&proveedor_id=&q=
  async listar(req, res) {
    try {
      if (!(await disponible())) return res.json({ requisiciones: [], disponible: false });
      const valores = [];
      const condiciones = [];
      if (['pendiente', 'parcial', 'pagada', 'anulada'].includes(req.query.estado)) {
        valores.push(req.query.estado);
        condiciones.push(`r.estado = $${valores.length}`);
      }
      if (req.query.proveedor_id) {
        valores.push(String(req.query.proveedor_id));
        condiciones.push(`r.proveedor_id::text = $${valores.length}`);
      }
      if (String(req.query.q || '').trim()) {
        valores.push(`%${String(req.query.q).trim()}%`);
        const p = `$${valores.length}`;
        condiciones.push(`(r.numero ILIKE ${p} OR p.nombre ILIKE ${p} OR EXISTS (
          SELECT 1 FROM compras c WHERE c.requisicion_id = r.id AND (c.numero_factura ILIKE ${p} OR c.numero_compra ILIKE ${p})))`);
      }
      const { rows } = await pool.query(
        `${selectRequisicion(await abonos.disponible())}
         ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
         ORDER BY r.periodo DESC, r.created_at DESC
         LIMIT 500`, valores);
      res.json({ requisiciones: rows, disponible: true });
    } catch (error) {
      responderError(res, error, 'listar las requisiciones');
    }
  },

  // GET /api/requisiciones/facturas?proveedor_id=&requisicion_id=
  // Facturas del proveedor que pueden ir en la requisición (y las que ya lleva)
  async facturasDisponibles(req, res) {
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const proveedorId = texto(req.query.proveedor_id, 60);
      if (!proveedorId) throw errorConEstado('Elija el proveedor');
      const requisicionId = Number(req.query.requisicion_id) || 0;
      const conPagos = await pagosCompras();
      const { rows } = await pool.query(
        `SELECT c.id, c.numero_compra, c.numero_factura, to_char(c.fecha, 'YYYY-MM-DD') AS fecha, c.total, c.estado, c.requisicion_id
         FROM compras c
         WHERE c.proveedor_id::text = $1 AND c.estado <> 'cancelada'
           AND (c.requisicion_id IS NULL OR c.requisicion_id = $2)
           ${conPagos ? 'AND (c.fecha_pago IS NULL OR c.requisicion_id = $2)' : ''}
         ORDER BY c.fecha, c.numero_compra`, [proveedorId, requisicionId]);
      res.json({ facturas: rows });
    } catch (error) {
      responderError(res, error, 'buscar las facturas del proveedor');
    }
  },

  // POST /api/requisiciones { proveedor_id, periodo: 'YYYY-MM', fecha, observaciones, facturas: [ids] }
  async crear(req, res) {
    let client;
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const datos = leerDatos(req.body);
      client = await pool.connect();
      await client.query('BEGIN');
      const numero = await correlativos.siguiente(client, 'requisicion', 'RQS', datos.fecha || datos.periodo);
      const { rows } = await client.query(
        `INSERT INTO requisiciones (numero, proveedor_id, periodo, fecha, observaciones, creado_por, creado_por_nombre)
         VALUES ($1, $2, $3, COALESCE($4::date, (NOW() AT TIME ZONE 'America/Guatemala')::date), $5, $6, $7)
         RETURNING id`,
        [numero, datos.proveedorId, datos.periodo, datos.fecha, datos.observaciones, req.user.id, nombreUsuario(req)]
      );
      await asignarFacturas(client, rows[0].id, datos.proveedorId, datos.facturas);
      const requisicion = await obtener(client, rows[0].id);
      await client.query('COMMIT');
      res.status(201).json({ message: `Requisición ${numero} registrada`, requisicion });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      responderError(res, error, 'registrar la requisición');
    } finally {
      if (client) client.release();
    }
  },

  // PUT /api/requisiciones/:id (solo pendientes)
  async actualizar(req, res) {
    await enTransaccion(res, 'actualizar la requisición', req.params.id, async (client, actual) => {
      if (actual.estado !== 'pendiente') throw errorConEstado(`La requisición ${actual.numero} ya está ${actual.estado} y no se modifica`, 409);
      const datos = leerDatos(req.body);
      await client.query(
        `UPDATE requisiciones SET proveedor_id = $1, periodo = $2, fecha = COALESCE($3::date, fecha), observaciones = $4,
                actualizado_por_nombre = $5, updated_at = NOW()
         WHERE id = $6`,
        [datos.proveedorId, datos.periodo, datos.fecha, datos.observaciones, nombreUsuario(req), actual.id]);
      await asignarFacturas(client, actual.id, datos.proveedorId, datos.facturas);
      return `Requisición ${actual.numero} actualizada`;
    });
  },

  // POST /api/requisiciones/:id/abonos { fecha, monto, forma_pago, numero_pago_banco, numero_autorizacion }
  // Un abono al pago; al completar el total, la requisición y sus facturas quedan pagadas
  async registrarAbono(req, res) {
    await enTransaccion(res, 'registrar el abono', req.params.id, async (client, actual) => {
      await abonos.exigirDisponible();
      if (!['pendiente', 'parcial'].includes(actual.estado)) throw errorConEstado(`La requisición ${actual.numero} ya está ${actual.estado}`, 409);
      const abono = abonos.leer(req.body, { exigirBanco: true });
      const total = await totalDe(client, actual.id);
      if (total <= 0) throw errorConEstado('La requisición no tiene facturas por pagar');
      const abonoId = await abonos.registrar(client, 'requisicion', actual.id, abono, total, req);
      await recalcular(client, actual.id, req);
      const { pagado } = await abonos.resumen(client, 'requisicion', actual.id);
      const saldo = total - pagado;
      return {
        mensaje: saldo > abonos.CENTAVO
          ? `Abono registrado en ${actual.numero}: queda un saldo de Q ${saldo.toFixed(2)}`
          : `Requisición ${actual.numero} pagada: sus facturas quedan pagadas`,
        abono_id: abonoId
      };
    });
  },

  // DELETE /api/requisiciones/abonos/:abonoId
  async eliminarAbono(req, res) {
    let id;
    try {
      await abonos.exigirDisponible();
      const { rows } = await pool.query("SELECT documento_id FROM abonos WHERE id = $1 AND documento = 'requisicion'", [Number(req.params.abonoId) || 0]);
      if (!rows.length) throw errorConEstado('Abono no encontrado', 404);
      id = rows[0].documento_id;
    } catch (error) {
      return responderError(res, error, 'quitar el abono');
    }
    await enTransaccion(res, 'quitar el abono', id, async (client, actual) => {
      if (actual.estado === 'anulada') throw errorConEstado(`La requisición ${actual.numero} está anulada`, 409);
      await abonos.eliminar(client, 'requisicion', req.params.abonoId);
      await recalcular(client, actual.id, req);
      return `Abono quitado de ${actual.numero}`;
    });
  },

  // PUT /api/requisiciones/:id/estado { estado: 'pendiente' | 'anulada', motivo }
  // pendiente: quita todos sus abonos (y el pago de sus facturas). anulada: solo sin abonos; libera sus facturas.
  async cambiarEstado(req, res) {
    await enTransaccion(res, 'cambiar el estado de la requisición', req.params.id, async (client, actual) => {
      const estado = req.body.estado;
      if (estado === 'pendiente') {
        // Quita todos sus abonos
        if (!['parcial', 'pagada'].includes(actual.estado)) throw errorConEstado(`La requisición ${actual.numero} no tiene pagos`, 409);
        await abonos.exigirDisponible();
        await abonos.eliminarTodos(client, 'requisicion', actual.id);
        await recalcular(client, actual.id, req);
        return `Requisición ${actual.numero} vuelve a pendiente de pago`;
      }
      if (estado === 'anulada') {
        if (actual.estado !== 'pendiente') throw errorConEstado('Solo se anula una requisición sin pagos; quite primero sus abonos', 409);
        const motivo = texto(req.body.motivo, 500);
        if (!motivo) throw errorConEstado('Indique el motivo de la anulación');
        await client.query(
          `UPDATE requisiciones SET estado = 'anulada', motivo_anulacion = $1, actualizado_por_nombre = $2, updated_at = NOW()
           WHERE id = $3`, [motivo, nombreUsuario(req), actual.id]);
        await client.query('UPDATE compras SET requisicion_id = NULL WHERE requisicion_id = $1', [actual.id]);
        return `Requisición ${actual.numero} anulada: sus facturas quedan libres`;
      }
      throw errorConEstado('Estado no válido');
    });
  },

  // DELETE /api/requisiciones/:id (solo pendientes; sus facturas quedan libres)
  async eliminar(req, res) {
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const { rows } = await pool.query(
        "DELETE FROM requisiciones WHERE id = $1 AND estado = 'pendiente' RETURNING numero", [req.params.id]);
      if (!rows.length) {
        const actual = await obtener(pool, req.params.id);
        if (!actual) throw errorConEstado('Requisición no encontrada', 404);
        throw errorConEstado(`La requisición ${actual.numero} ya está ${actual.estado}: no se elimina`, 409);
      }
      res.json({ message: `Requisición ${rows[0].numero} eliminada` });
    } catch (error) {
      responderError(res, error, 'eliminar la requisición');
    }
  },

  // POST /api/requisiciones/:id/vouchers?nombre=&abono_id= (cuerpo: el PDF o la imagen del voucher tal cual)
  async subirVoucher(req, res) {
    try {
      const { tipoContenido, status, error: errorArchivo } = validarSubida(req.body);
      if (errorArchivo) throw errorConEstado(errorArchivo, status);
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const abonoId = await abonos.abonoDelVoucher(pool, 'requisicion', req.params.id, req.query.abono_id);
      const { rows } = await pool.query(
        `INSERT INTO requisicion_vouchers (requisicion_id, nombre_archivo, tipo_contenido, tamano, contenido, subido_por, subido_por_nombre
                                           ${abonoId ? ', abono_id' : ''})
         SELECT r.id, $2, $3, $4, $5, $6, $7 ${abonoId ? ', $8' : ''} FROM requisiciones r WHERE r.id = $1
         RETURNING id, nombre_archivo AS nombre, subido_por_nombre AS subido_por, created_at AS fecha`,
        [req.params.id, limpiarNombre(req.query.nombre, tipoContenido, 'voucher'), tipoContenido,
          req.body.length, req.body, req.user.id, nombreUsuario(req), ...(abonoId ? [abonoId] : [])]
      );
      if (!rows.length) throw errorConEstado('Requisición no encontrada', 404);
      res.status(201).json({ message: 'Voucher guardado', voucher: rows[0] });
    } catch (error) {
      responderError(res, error, 'guardar el voucher');
    }
  },

  // GET /api/requisiciones/vouchers/:voucherId
  async verVoucher(req, res) {
    try {
      if (!Number.isInteger(Number(req.params.voucherId))) throw errorConEstado('Voucher no válido');
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const { rows } = await pool.query(
        'SELECT nombre_archivo, tipo_contenido, contenido FROM requisicion_vouchers WHERE id = $1', [req.params.voucherId]);
      if (!rows.length) throw errorConEstado('Voucher no encontrado', 404);
      const { nombre_archivo: nombre, tipo_contenido: tipoContenido, contenido } = rows[0];
      enviarArchivo(res, { nombre, tipoContenido, contenido });
    } catch (error) {
      responderError(res, error, 'abrir el voucher');
    }
  }
};

module.exports = requisicionesController;
