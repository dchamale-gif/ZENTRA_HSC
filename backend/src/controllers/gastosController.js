// ============================================
// GASTOS (luz, agua, internet, teléfono…)
// Flujo: pendiente (se registró la requisición) -> cargado (se procesó y espera
// que el dueño pague) -> pagado. También puede anularse.
// Marcar como pagado es del administrador, con el número de pago que da el banco
// y el número de autorización (en efectivo no aplican).
// Los días en espera se cuentan desde la fecha de carga hasta hoy o hasta el pago.
// ============================================

const pool = require('../db/connection');
const correlativos = require('../services/correlativos');
const { nombreUsuario } = require('../services/historiaSincronizada');

const MIGRACION = 'Falta preparar la base de datos para los gastos (npm run migrate:gastos).';
const ESTADOS = ['pendiente', 'cargado', 'pagado', 'anulado'];
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
const SELECT_GASTO = `
  SELECT g.*, to_char(g.fecha_factura, 'YYYY-MM-DD') AS fecha_factura,
         to_char(g.fecha_cargo, 'YYYY-MM-DD') AS fecha_cargo, to_char(g.fecha_pago, 'YYYY-MM-DD') AS fecha_pago,
         CASE WHEN g.estado = 'cargado' THEN ${HOY_GT} - g.fecha_cargo
              WHEN g.estado = 'pagado' THEN g.fecha_pago - g.fecha_cargo END AS dias_espera,
         ${HOY_GT} - (g.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Guatemala')::date AS dias_desde_creacion
  FROM gastos g`;

const obtener = (db, id) => db.query(`${SELECT_GASTO} WHERE g.id = $1`, [id]).then(r => r.rows[0] || null);

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
      const { rows } = await pool.query(
        `${SELECT_GASTO}
         ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
         ORDER BY g.created_at DESC, g.id DESC
         LIMIT 500`, valores);
      // Lo que el dueño aún debe pagar: los cargados
      const resumen = await pool.query(
        `SELECT COUNT(*)::int AS cantidad, COALESCE(SUM(monto), 0) AS total,
                COALESCE(MAX(${HOY_GT} - fecha_cargo), 0) AS dias_mas_antiguo
         FROM gastos WHERE estado = 'cargado'`);
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
      if (actual.estado === 'pagado' && !req.userRoles?.includes('admin')) {
        throw errorConEstado('Solo el administrador cambia un gasto ya pagado', 403);
      }
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
