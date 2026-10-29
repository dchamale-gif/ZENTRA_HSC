// ============================================
// ABONOS: PAGOS EN PARTES
// Requisiciones, gastos y compras sueltas se pagan en uno o varios abonos (tabla abonos,
// por documento y su id como texto). Cada módulo recalcula su estado con lo abonado:
// nada -> pendiente, menos que el total -> parcial, el total -> pagado.
// ============================================

const pool = require('../db/connection');
const { nombreUsuario } = require('./historiaSincronizada');

const MIGRACION = 'Falta preparar la base de datos para los pagos en partes (npm run migrate:abonos).';
const FORMAS_PAGO = ['efectivo', 'tarjeta', 'cheque', 'transferencia'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
// Medio centavo de tolerancia al comparar montos
const CENTAVO = 0.005;

const errorConEstado = (message, status = 400) => Object.assign(new Error(message), { status });

let cache = { valor: false, hasta: 0 };
const disponible = async () => {
  if (Date.now() < cache.hasta) return cache.valor;
  const { rows } = await pool.query("SELECT to_regclass('public.abonos') IS NOT NULL AS listo");
  const valor = rows[0].listo;
  cache = { valor, hasta: valor ? Infinity : Date.now() + 60000 };
  return valor;
};

const exigirDisponible = async () => {
  if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
};

const texto = (valor, max) => String(valor ?? '').trim().slice(0, max) || null;

// exigirBanco: fuera de efectivo se piden el número de pago del banco y el de autorización
// (requisiciones y gastos); las compras guardan solo una referencia
const leer = (body, { exigirBanco }) => {
  const fecha = body.fecha;
  if (!FECHA.test(String(fecha || ''))) throw errorConEstado('Indique la fecha del pago');
  const monto = Number(body.monto);
  if (!Number.isFinite(monto) || monto <= 0) throw errorConEstado('El monto del abono debe ser mayor a cero');
  const forma = body.forma_pago;
  if (!FORMAS_PAGO.includes(forma)) throw errorConEstado('Indique la forma de pago');
  const abono = {
    fecha,
    monto: Number(monto.toFixed(2)),
    forma,
    numeroBanco: texto(body.numero_pago_banco, 60),
    autorizacion: texto(body.numero_autorizacion, 60),
    referencia: texto(body.referencia, 60)
  };
  if (exigirBanco && forma !== 'efectivo' && (!abono.numeroBanco || !abono.autorizacion)) {
    throw errorConEstado('Registre el número de pago que da el banco y el número de autorización');
  }
  return abono;
};

// Lo abonado y el último abono (el que completa el pago le da su fecha y forma al documento)
const resumen = async (db, documento, id) => {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(monto) OVER (), 0) AS pagado, to_char(fecha, 'YYYY-MM-DD') AS fecha, forma_pago,
            numero_pago_banco, numero_autorizacion, referencia, registrado_por_nombre
     FROM abonos WHERE documento = $1 AND documento_id = $2::text
     ORDER BY fecha DESC, id DESC LIMIT 1`, [documento, String(id)]);
  return rows[0] ? { ...rows[0], pagado: Number(rows[0].pagado) } : { pagado: 0 };
};

// Registra un abono si cabe en el saldo; devuelve su id
const registrar = async (client, documento, id, abono, total, req) => {
  const { pagado } = await resumen(client, documento, id);
  const saldo = Number((Number(total) - pagado).toFixed(2));
  if (saldo <= 0) throw errorConEstado('Ya está pagado por completo', 409);
  if (abono.monto > saldo + CENTAVO) throw errorConEstado(`El abono pasa del saldo pendiente (Q ${saldo.toFixed(2)})`);
  const { rows } = await client.query(
    `INSERT INTO abonos (documento, documento_id, fecha, monto, forma_pago, numero_pago_banco, numero_autorizacion,
                         referencia, registrado_por, registrado_por_nombre)
     VALUES ($1, $2::text, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [documento, String(id), abono.fecha, abono.monto, abono.forma, abono.numeroBanco, abono.autorizacion,
      abono.referencia, req.user.id, nombreUsuario(req)]);
  return rows[0].id;
};

// Quita un abono; devuelve el id de su documento (null si no existe)
const eliminar = async (client, documento, abonoId) => {
  if (!Number.isInteger(Number(abonoId))) throw errorConEstado('Abono no válido');
  const { rows } = await client.query(
    'DELETE FROM abonos WHERE id = $1 AND documento = $2 RETURNING documento_id', [abonoId, documento]);
  return rows[0]?.documento_id ?? null;
};

const eliminarTodos = (client, documento, id) =>
  client.query('DELETE FROM abonos WHERE documento = $1 AND documento_id = $2::text', [documento, String(id)]);

// Estado según lo abonado
const estado = (pagado, total) => {
  if (pagado <= 0) return 'pendiente';
  return pagado + CENTAVO < Number(total) ? 'parcial' : 'pagado';
};

// Columnas para el SELECT de cada módulo: sus abonos (con los vouchers de cada uno) y lo abonado
const columnas = (documento, idSql, tablaVouchers) => `
  COALESCE((SELECT json_agg(json_build_object(
              'id', a.id, 'fecha', to_char(a.fecha, 'YYYY-MM-DD'), 'monto', a.monto, 'forma_pago', a.forma_pago,
              'numero_pago_banco', a.numero_pago_banco, 'numero_autorizacion', a.numero_autorizacion,
              'referencia', a.referencia, 'registrado_por', a.registrado_por_nombre,
              'vouchers', ${tablaVouchers ? `COALESCE((SELECT json_agg(json_build_object('id', v.id, 'nombre', v.nombre_archivo) ORDER BY v.id)
                                     FROM ${tablaVouchers} v WHERE v.abono_id = a.id), '[]'::json)` : `'[]'::json`}
            ) ORDER BY a.fecha, a.id)
            FROM abonos a WHERE a.documento = '${documento}' AND a.documento_id = (${idSql})::text), '[]'::json) AS abonos,
  COALESCE((SELECT SUM(a.monto) FROM abonos a WHERE a.documento = '${documento}' AND a.documento_id = (${idSql})::text), 0) AS pagado`;

// abono_id de un voucher subido junto con un abono (debe ser de ese documento)
const abonoDelVoucher = async (db, documento, id, valor) => {
  if (!valor || !(await disponible())) return null;
  const { rows } = await db.query(
    'SELECT id FROM abonos WHERE id = $1 AND documento = $2 AND documento_id = $3::text',
    [Number(valor) || 0, documento, String(id)]);
  return rows[0]?.id || null;
};

module.exports = {
  MIGRACION, CENTAVO, disponible, exigirDisponible, leer, resumen, registrar, eliminar, eliminarTodos,
  estado, columnas, abonoDelVoucher
};
