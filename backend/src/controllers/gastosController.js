// ============================================
// GASTOS (luz, agua, internet, teléfono…)
// Flujo: pendiente (se registró la requisición) -> cargado (se procesó y espera
// que el dueño pague) -> parcial -> pagado. También puede anularse (sin abonos).
// El pago es del administrador, en uno o varios abonos (services/abonos), cada uno con
// el número de pago que da el banco y el de autorización (en efectivo no aplican).
// Los días en espera se cuentan desde la fecha de carga hasta hoy o hasta el pago.
// ============================================

const pool = require('../db/connection');
const correlativos = require('../services/correlativos');
const { nombreUsuario } = require('../services/historiaSincronizada');
const { validarSubida, limpiarNombre, enviarArchivo } = require('../services/archivos');
const abonos = require('../services/abonos');

const MIGRACION = 'Falta preparar la base de datos para los gastos (npm run migrate:gastos).';
const ESTADOS = ['pendiente', 'cargado', 'parcial', 'pagado', 'anulado'];
const FORMAS_PAGO = ['efectivo', 'tarjeta', 'cheque', 'transferencia'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HOY_GT = "(NOW() AT TIME ZONE 'America/Guatemala')::date";

const errorConEstado = (message, status = 400) => Object.assign(new Error(message), { status });

// Lo que se borra al regresar un gasto a pendiente o a esperando pago
const SIN_PAGO = {
  fecha_pago: null, forma_pago: null, referencia_pago: null, numero_pago_banco: null,
  numero_autorizacion: null, pagado_por_nombre: null, motivo_anulacion: null
};

let migracionCache = { valor: false, hasta: 0 };
const disponible = async () => {
  if (Date.now() < migracionCache.hasta) return migracionCache.valor;
  const { rows } = await pool.query("SELECT to_regclass('public.gastos') IS NOT NULL AS listo");
  const valor = rows[0].listo;
  migracionCache = { valor, hasta: valor ? Infinity : Date.now() + 60000 };
  return valor;
};

// Los vouchers llegaron después: sin su tabla el resto de gastos sigue funcionando
let vouchersCache = { valor: false, hasta: 0 };
const vouchersDisponibles = async () => {
  if (Date.now() < vouchersCache.hasta) return vouchersCache.valor;
  const { rows } = await pool.query("SELECT to_regclass('public.gasto_vouchers') IS NOT NULL AS listo");
  const valor = rows[0].listo;
  vouchersCache = { valor, hasta: valor ? Infinity : Date.now() + 60000 };
  return valor;
};

// Agrega a cada gasto la lista de sus vouchers (sin el contenido)
const agregarVouchers = async (gastos) => {
  gastos.forEach(g => { g.vouchers = []; });
  if (!gastos.length || !(await vouchersDisponibles())) return;
  const { rows } = await pool.query(
    `SELECT id, gasto_id, nombre_archivo AS nombre, tipo_contenido, tamano, subido_por_nombre AS subido_por, created_at AS fecha
     FROM gasto_vouchers WHERE gasto_id = ANY($1::int[]) ORDER BY created_at, id`,
    [gastos.map(g => g.id)]
  );
  const porGasto = new Map(gastos.map(g => [g.id, g]));
  rows.forEach(({ gasto_id: gastoId, ...voucher }) => porGasto.get(gastoId)?.vouchers.push(voucher));
};

const texto = (valor, max) => String(valor ?? '').trim().slice(0, max) || null;

const leerFecha = (valor, nombre) => {
  if (!valor) return null;
  if (!FECHA.test(valor)) throw errorConEstado(`${nombre} no válida`);
  return valor;
};

const leerDatos = (body) => {
  const categoria = texto(body.categoria, 60);
  if (!categoria) throw errorConEstado('Indique qué gasto es (luz, internet, teléfono…)');
  const monto = Number(body.monto);
  if (!Number.isFinite(monto) || monto <= 0) throw errorConEstado('El monto debe ser mayor a cero');
  return {
    categoria,
    proveedor: texto(body.proveedor, 150),
    descripcion: texto(body.descripcion, 2000),
    numeroFactura: texto(body.numero_factura, 60),
    fechaFactura: leerFecha(body.fecha_factura, 'Fecha de la factura'),
    monto: Number(monto.toFixed(2))
  };
};

// Días de espera: desde la carga hasta hoy (cargado) o hasta el pago (pagado)
// (con pago parcial sigue esperando el resto)
const selectGasto = (conAbonos) => `
  SELECT g.*, to_char(g.fecha_factura, 'YYYY-MM-DD') AS fecha_factura,
         to_char(g.fecha_cargo, 'YYYY-MM-DD') AS fecha_cargo, to_char(g.fecha_pago, 'YYYY-MM-DD') AS fecha_pago,
         CASE WHEN g.estado IN ('cargado', 'parcial') THEN ${HOY_GT} - g.fecha_cargo
              WHEN g.estado = 'pagado' THEN g.fecha_pago - g.fecha_cargo END AS dias_espera,
         ${HOY_GT} - (g.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Guatemala')::date AS dias_desde_creacion${conAbonos ? `,
         ${abonos.columnas('gasto', 'g.id', 'gasto_vouchers')}` : ''}
  FROM gastos g`;

const obtener = async (db, id) =>
  db.query(`${selectGasto(await abonos.disponible())} WHERE g.id = $1`, [id]).then(r => r.rows[0] || null);

const esAdmin = (req) => Boolean(req.userRoles?.includes('admin'));

// Estado según lo abonado. Sin abonos vuelve a esperar el pago (o a pendiente si no se había cargado);
// el primer abono fija la carga si faltaba; completo queda pagado con la fecha y forma del último.
const recalcular = async (client, id, req) => {
  const { rows: [g] } = await client.query(
    "SELECT estado, monto, to_char(fecha_cargo, 'YYYY-MM-DD') AS fecha_cargo FROM gastos WHERE id = $1", [id]);
  if (!g || g.estado === 'anulado') return;
  const ultimo = await abonos.resumen(client, 'gasto', id);
  const segun = abonos.estado(ultimo.pagado, g.monto);
  let campos;
  if (segun === 'pendiente') {
    campos = { estado: g.fecha_cargo ? 'cargado' : 'pendiente', ...SIN_PAGO };
  } else {
    const { rows: [primero] } = await client.query(
      "SELECT to_char(MIN(fecha), 'YYYY-MM-DD') AS fecha FROM abonos WHERE documento = 'gasto' AND documento_id = $1::text", [String(id)]);
    const fechaCargo = g.fecha_cargo && g.fecha_cargo <= primero.fecha ? g.fecha_cargo : primero.fecha;
    campos = segun === 'parcial'
      ? { estado: 'parcial', fecha_cargo: fechaCargo, ...SIN_PAGO }
      : {
          estado: 'pagado', fecha_cargo: fechaCargo, fecha_pago: ultimo.fecha, forma_pago: ultimo.forma_pago,
          referencia_pago: ultimo.referencia, numero_pago_banco: ultimo.numero_pago_banco,
          numero_autorizacion: ultimo.numero_autorizacion, pagado_por_nombre: ultimo.registrado_por_nombre, motivo_anulacion: null
        };
  }
  const nombres = Object.keys(campos);
  await client.query(
    `UPDATE gastos SET ${nombres.map((n, i) => `${n} = $${i + 1}`).join(', ')},
            actualizado_por_nombre = $${nombres.length + 1}, updated_at = NOW()
     WHERE id = $${nombres.length + 2}`,
    [...Object.values(campos), nombreUsuario(req), id]);
};

const responderError = (res, error, accion) => {
  if (!error.status) console.error(`Error al ${accion}:`, error);
  res.status(error.status || 500).json({ error: error.status ? error.message : `Error al ${accion}` });
};

const gastosController = {
  // GET /api/gastos?estado=&q=
  async listar(req, res) {
    try {
      if (!(await disponible())) return res.json({ gastos: [], disponible: false });
      const valores = [];
      const condiciones = [];
      if (ESTADOS.includes(req.query.estado)) {
        valores.push(req.query.estado);
        condiciones.push(`g.estado = $${valores.length}`);
      }
      if (String(req.query.q || '').trim()) {
        valores.push(`%${String(req.query.q).trim()}%`);
        const p = `$${valores.length}`;
        condiciones.push(`(g.numero ILIKE ${p} OR g.categoria ILIKE ${p} OR g.proveedor ILIKE ${p}
          OR g.descripcion ILIKE ${p} OR g.numero_factura ILIKE ${p} OR g.registrado_por_nombre ILIKE ${p})`);
      }
      const conAbonos = await abonos.disponible();
      const { rows } = await pool.query(
        `${selectGasto(conAbonos)}
         ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
         ORDER BY g.created_at DESC, g.id DESC
         LIMIT 500`, valores);
      await agregarVouchers(rows);
      // Lo que el dueño aún debe pagar: los cargados y el saldo de los pagados en parte
      const resumen = await pool.query(
        `SELECT COUNT(*)::int AS cantidad,
                COALESCE(SUM(g.monto ${conAbonos ? `- COALESCE((SELECT SUM(a.monto) FROM abonos a
                                                           WHERE a.documento = 'gasto' AND a.documento_id = g.id::text), 0)` : ''}), 0) AS total,
                COALESCE(MAX(${HOY_GT} - g.fecha_cargo), 0) AS dias_mas_antiguo
         FROM gastos g WHERE g.estado IN ('cargado', 'parcial')`);
      const categorias = await pool.query('SELECT DISTINCT categoria FROM gastos ORDER BY categoria');
      res.json({
        gastos: rows, resumen: resumen.rows[0], categorias: categorias.rows.map(r => r.categoria),
        esAdmin: Boolean(req.userRoles?.includes('admin')), disponible: true
      });
    } catch (error) {
      responderError(res, error, 'listar los gastos');
    }
  },

  // POST /api/gastos
  async crear(req, res) {
    let client;
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const datos = leerDatos(req.body);
      client = await pool.connect();
      await client.query('BEGIN');
      const numero = await correlativos.siguiente(client, 'gasto', 'GAS', null);
      const { rows } = await client.query(
        `INSERT INTO gastos (numero, categoria, proveedor, descripcion, numero_factura, fecha_factura, monto,
                             registrado_por, registrado_por_nombre)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [numero, datos.categoria, datos.proveedor, datos.descripcion, datos.numeroFactura, datos.fechaFactura,
          datos.monto, req.user.id, nombreUsuario(req)]
      );
      const gasto = await obtener(client, rows[0].id);
      await client.query('COMMIT');
      res.status(201).json({ message: `Gasto ${gasto.numero} registrado`, gasto });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      responderError(res, error, 'registrar el gasto');
    } finally {
      if (client) client.release();
    }
  },

  // PUT /api/gastos/:id (mientras no esté pagado ni anulado)
  async actualizar(req, res) {
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const datos = leerDatos(req.body);
      const { rows } = await pool.query(
        `UPDATE gastos SET categoria = $1, proveedor = $2, descripcion = $3, numero_factura = $4, fecha_factura = $5,
                monto = $6, actualizado_por_nombre = $7, updated_at = NOW()
         WHERE id = $8 AND estado IN ('pendiente', 'cargado') RETURNING id`,
        [datos.categoria, datos.proveedor, datos.descripcion, datos.numeroFactura, datos.fechaFactura, datos.monto,
          nombreUsuario(req), req.params.id]
      );
      if (!rows.length) {
        const actual = await obtener(pool, req.params.id);
        if (!actual) throw errorConEstado('Gasto no encontrado', 404);
        throw errorConEstado(`El gasto ${actual.numero} ya está ${actual.estado} y no se modifica`, 409);
      }
      const gasto = await obtener(pool, req.params.id);
      res.json({ message: `Gasto ${gasto.numero} actualizado`, gasto });
    } catch (error) {
      responderError(res, error, 'actualizar el gasto');
    }
  },

  // PUT /api/gastos/:id/estado { estado, fecha, forma_pago, numero_pago_banco, numero_autorizacion, motivo }
  // cargado: fecha de carga. pagado: fecha de pago y forma (la carga, si faltaba, es el mismo día).
  async cambiarEstado(req, res) {
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const estado = req.body.estado;
      if (!ESTADOS.includes(estado)) throw errorConEstado('Estado no válido');
      const actual = await obtener(pool, req.params.id);
      if (!actual) throw errorConEstado('Gasto no encontrado', 404);
      if (['parcial', 'pagado'].includes(actual.estado) && !esAdmin(req)) {
        throw errorConEstado('Solo el administrador cambia un gasto con pagos', 403);
      }
      const conAbonos = await abonos.disponible();
      if (conAbonos && ['pagado', 'parcial'].includes(estado)) throw errorConEstado('El pago se registra con abonos');
      if (conAbonos && estado === 'anulado' && ['parcial', 'pagado'].includes(actual.estado)) {
        throw errorConEstado(`El gasto ${actual.numero} tiene pagos: quítelos antes de anularlo`, 409);
      }
      // Volver a pendiente o a esperando pago quita sus abonos
      if (conAbonos && ['pendiente', 'cargado'].includes(estado)) await abonos.eliminarTodos(pool, 'gasto', actual.id);
      const fecha = leerFecha(req.body.fecha, 'Fecha');
      let campos;
      if (estado === 'pendiente') {
        campos = { fecha_cargo: null, ...SIN_PAGO };
      } else if (estado === 'cargado') {
        if (!fecha) throw errorConEstado('Indique la fecha en que se cargó el gasto');
        campos = { fecha_cargo: fecha, ...SIN_PAGO };
      } else if (estado === 'pagado') {
        if (!req.userRoles?.includes('admin')) throw errorConEstado('Solo el administrador marca un gasto como pagado', 403);
        if (!fecha) throw errorConEstado('Indique la fecha del pago');
        if (!FORMAS_PAGO.includes(req.body.forma_pago)) throw errorConEstado('Indique la forma de pago');
        const numeroBanco = texto(req.body.numero_pago_banco, 60);
        const autorizacion = texto(req.body.numero_autorizacion, 60);
        if (req.body.forma_pago !== 'efectivo' && (!numeroBanco || !autorizacion)) {
          throw errorConEstado('Registre el número de pago que da el banco y el número de autorización');
        }
        const fechaCargo = actual.fecha_cargo || fecha;
        if (fecha < fechaCargo) throw errorConEstado('El pago no puede ser anterior a la fecha de carga');
        campos = {
          fecha_cargo: fechaCargo, fecha_pago: fecha, forma_pago: req.body.forma_pago,
          numero_pago_banco: numeroBanco, numero_autorizacion: autorizacion,
          pagado_por_nombre: nombreUsuario(req), motivo_anulacion: null
        };
      } else {
        const motivo = texto(req.body.motivo, 500);
        if (!motivo) throw errorConEstado('Indique el motivo de la anulación');
        campos = { motivo_anulacion: motivo };
      }
      const nombres = Object.keys(campos);
      await pool.query(
        `UPDATE gastos SET estado = $1, ${nombres.map((n, i) => `${n} = $${i + 2}`).join(', ')},
                actualizado_por_nombre = $${nombres.length + 2}, updated_at = NOW()
         WHERE id = $${nombres.length + 3}`,
        [estado, ...Object.values(campos), nombreUsuario(req), req.params.id]
      );
      const textos = { pendiente: 'vuelve a pendiente', cargado: 'cargado: queda en espera del pago', pagado: 'pagado', anulado: 'anulado' };
      res.json({ message: `Gasto ${actual.numero} ${textos[estado]}`, gasto: await obtener(pool, req.params.id) });
    } catch (error) {
      responderError(res, error, 'cambiar el estado del gasto');
    }
  },

  // POST /api/gastos/:id/vouchers?nombre=&abono_id= (cuerpo: el PDF o la imagen del voucher tal cual)
  async subirVoucher(req, res) {
    try {
      const { tipoContenido, status, error: errorArchivo } = validarSubida(req.body);
      if (errorArchivo) throw errorConEstado(errorArchivo, status);
      if (!(await vouchersDisponibles())) throw errorConEstado(MIGRACION, 503);
      const abonoId = await abonos.abonoDelVoucher(pool, 'gasto', req.params.id, req.query.abono_id);
      const { rows } = await pool.query(
        `INSERT INTO gasto_vouchers (gasto_id, nombre_archivo, tipo_contenido, tamano, contenido, subido_por, subido_por_nombre
                                     ${abonoId ? ', abono_id' : ''})
         SELECT g.id, $2, $3, $4, $5, $6, $7 ${abonoId ? ', $8' : ''} FROM gastos g WHERE g.id = $1
         RETURNING id, nombre_archivo AS nombre, tipo_contenido, tamano, subido_por_nombre AS subido_por, created_at AS fecha`,
        [req.params.id, limpiarNombre(req.query.nombre, tipoContenido, 'voucher'), tipoContenido,
          req.body.length, req.body, req.user.id, nombreUsuario(req), ...(abonoId ? [abonoId] : [])]
      );
      if (!rows.length) throw errorConEstado('Gasto no encontrado', 404);
      res.status(201).json({ message: 'Voucher guardado', voucher: rows[0] });
    } catch (error) {
      responderError(res, error, 'guardar el voucher');
    }
  },

  // GET /api/gastos/vouchers/:voucherId - el voucher para verlo o descargarlo
  async verVoucher(req, res) {
    try {
      if (!Number.isInteger(Number(req.params.voucherId))) throw errorConEstado('Voucher no válido');
      if (!(await vouchersDisponibles())) throw errorConEstado(MIGRACION, 503);
      const { rows } = await pool.query(
        'SELECT nombre_archivo, tipo_contenido, contenido FROM gasto_vouchers WHERE id = $1', [req.params.voucherId]);
      if (!rows.length) throw errorConEstado('Voucher no encontrado', 404);
      const { nombre_archivo: nombre, tipo_contenido: tipoContenido, contenido } = rows[0];
      enviarArchivo(res, { nombre, tipoContenido, contenido });
    } catch (error) {
      responderError(res, error, 'abrir el voucher');
    }
  },

  // POST /api/gastos/:id/abonos { fecha, monto, forma_pago, numero_pago_banco, numero_autorizacion } (administrador)
  async registrarAbono(req, res) {
    let client;
    try {
      await abonos.exigirDisponible();
      if (!esAdmin(req)) throw errorConEstado('Solo el administrador registra el pago de un gasto', 403);
      const abono = abonos.leer(req.body, { exigirBanco: true });
      client = await pool.connect();
      await client.query('BEGIN');
      const { rows: [actual] } = await client.query(
        "SELECT id, numero, estado, monto, to_char(fecha_cargo, 'YYYY-MM-DD') AS fecha_cargo FROM gastos WHERE id = $1 FOR UPDATE", [req.params.id]);
      if (!actual) throw errorConEstado('Gasto no encontrado', 404);
      if (!['pendiente', 'cargado', 'parcial'].includes(actual.estado)) throw errorConEstado(`El gasto ${actual.numero} ya está ${actual.estado}`, 409);
      if (actual.fecha_cargo && abono.fecha < actual.fecha_cargo) throw errorConEstado('El pago no puede ser anterior a la fecha de carga');
      const abonoId = await abonos.registrar(client, 'gasto', actual.id, abono, actual.monto, req);
      await recalcular(client, actual.id, req);
      const gasto = await obtener(client, actual.id);
      await client.query('COMMIT');
      const saldo = Number(gasto.monto) - Number(gasto.pagado);
      res.status(201).json({
        message: saldo > abonos.CENTAVO ? `Abono registrado en ${gasto.numero}: queda un saldo de Q ${saldo.toFixed(2)}` : `Gasto ${gasto.numero} pagado`,
        gasto, abono_id: abonoId
      });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      responderError(res, error, 'registrar el abono');
    } finally {
      if (client) client.release();
    }
  },

  // DELETE /api/gastos/abonos/:abonoId (administrador)
  async eliminarAbono(req, res) {
    let client;
    try {
      await abonos.exigirDisponible();
      if (!esAdmin(req)) throw errorConEstado('Solo el administrador quita pagos de un gasto', 403);
      client = await pool.connect();
      await client.query('BEGIN');
      const id = await abonos.eliminar(client, 'gasto', req.params.abonoId);
      if (id === null) throw errorConEstado('Abono no encontrado', 404);
      await recalcular(client, id, req);
      const gasto = await obtener(client, id);
      await client.query('COMMIT');
      res.json({ message: `Abono quitado de ${gasto.numero}`, gasto });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      responderError(res, error, 'quitar el abono');
    } finally {
      if (client) client.release();
    }
  },

  // DELETE /api/gastos/:id (solo pendientes; los demás se anulan para que quede registro)
  async eliminar(req, res) {
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const actual = await obtener(pool, req.params.id);
      if (!actual) throw errorConEstado('Gasto no encontrado', 404);
      if (actual.estado !== 'pendiente') throw errorConEstado(`El gasto ${actual.numero} ya está ${actual.estado}: anúlelo en lugar de eliminarlo`, 409);
      await pool.query('DELETE FROM gastos WHERE id = $1', [req.params.id]);
      res.json({ message: `Gasto ${actual.numero} eliminado` });
    } catch (error) {
      responderError(res, error, 'eliminar el gasto');
    }
  }
};

module.exports = gastosController;
