const pool = require('../db/connection');

// Inventario de medicinas por unidades de medida.
// La existencia (medicinas.cantidad) se lleva en la unidad base (p. ej. tableta); las
// presentaciones (caja, blíster…) se convierten con su factor. Toda entrada o salida pasa
// por mover(), que valida la existencia y deja el movimiento en el kárdex.
// Si la base aún no tiene la migración (npm run migrate:inventario-medicinas), todo sigue
// como antes: una sola unidad y sin kárdex.

const TIPOS = ['inicial', 'ingreso_compra', 'reversion_compra', 'venta', 'devolucion_venta', 'consumo_interno', 'ajuste'];

let disponibleCache = { valor: false, hasta: 0 };

const disponible = async () => {
  if (Date.now() < disponibleCache.hasta) return disponibleCache.valor;
  const result = await pool.query(
    `SELECT to_regclass('public.medicina_movimientos') IS NOT NULL
        AND to_regclass('public.medicina_presentaciones') IS NOT NULL
        AND EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'venta_items' AND column_name = 'factor') AS listo`
  );
  const valor = result.rows[0].listo;
  // Una vez lista no cambia; si falta, se vuelve a revisar al minuto
  disponibleCache = { valor, hasta: valor ? Infinity : Date.now() + 60000 };
  return valor;
};

const errorConEstado = (message, status = 400) => Object.assign(new Error(message), { status });

const nombreUsuario = (req) => req?.user
  ? `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email
  : 'Sistema';

// Presentación de una medicina: sin id es la unidad base (factor 1)
const presentacion = async (db, medicinaId, presentacionId) => {
  if (!(await disponible())) return { id: null, nombre: null, factor: 1 };
  if (presentacionId === null || presentacionId === undefined || presentacionId === '') {
    const result = await db.query('SELECT unidad_base FROM medicinas WHERE id = $1', [medicinaId]);
    return { id: null, nombre: result.rows[0]?.unidad_base || 'Unidad', factor: 1 };
  }
  const result = await db.query(
    'SELECT id, nombre, factor FROM medicina_presentaciones WHERE id = $1 AND medicina_id = $2',
    [Number(presentacionId), medicinaId]
  );
  if (!result.rowCount) throw errorConEstado('La presentación elegida no corresponde a la medicina');
  return { id: result.rows[0].id, nombre: result.rows[0].nombre, factor: Number(result.rows[0].factor) };
};

// Texto de una cantidad en unidades base, en plural sencillo: "1 tableta", "899 tabletas"
const textoUnidades = (cantidad, unidad) => {
  const u = String(unidad || 'unidad').toLowerCase();
  if (Math.abs(cantidad) === 1 || u.length <= 3) return `${cantidad} ${u}`; // abreviaturas (ml, g) sin plural
  if (/[aeiouáéó]$/.test(u)) return `${cantidad} ${u}s`;
  return `${cantidad} ${/[lnrd]$/.test(u) ? `${u}es` : u}`;
};

/**
 * Mueve la existencia de una medicina y lo registra en el kárdex.
 * datos: { medicinaId, cantidad (unidades base; + entra, - sale), tipo, presentacion: { nombre, factor },
 *          cantidadPresentacion, costoUnitario, referencia, pacienteId, motivo, req }
 * Devuelve la existencia resultante. Lanza 409 si la salida deja la existencia en negativo.
 */
const mover = async (db, datos) => {
  const cantidad = Number(datos.cantidad);
  if (!Number.isInteger(cantidad) || cantidad === 0) throw errorConEstado('Cantidad de inventario no válida');
  if (!TIPOS.includes(datos.tipo)) throw errorConEstado('Tipo de movimiento no válido');

  const conKardex = await disponible();
  const actual = await db.query(
    `SELECT nombre, cantidad${conKardex ? ', unidad_base' : ''} FROM medicinas WHERE id = $1 FOR UPDATE`,
    [datos.medicinaId]
  );
  if (!actual.rowCount) throw errorConEstado(`La medicina ${datos.medicinaId} no existe`);
  const { nombre, unidad_base: unidad } = actual.rows[0];
  const existencia = Number(actual.rows[0].cantidad) || 0;
  const resultante = existencia + cantidad;
  if (resultante < 0) {
    throw errorConEstado(
      `Existencia insuficiente de ${nombre}: hay ${textoUnidades(existencia, unidad)} y se necesitan ${textoUnidades(-cantidad, unidad)}.`,
      409
    );
  }

  await db.query('UPDATE medicinas SET cantidad = $1, updated_at = NOW() WHERE id = $2', [resultante, datos.medicinaId]);

  if (conKardex) {
    await db.query(
      `INSERT INTO medicina_movimientos
         (medicina_id, tipo, cantidad, existencia_resultante, presentacion, cantidad_presentacion, factor,
          costo_unitario, referencia, paciente_id, motivo, usuario_id, usuario_nombre)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        datos.medicinaId, datos.tipo, cantidad, resultante,
        datos.presentacion?.nombre || unidad || null,
        datos.cantidadPresentacion ?? Math.abs(cantidad),
        datos.presentacion?.factor || 1,
        datos.costoUnitario ?? null,
        datos.referencia || null,
        datos.pacienteId || null,
        String(datos.motivo || '').slice(0, 1000),
        datos.req?.user?.id || null,
        nombreUsuario(datos.req)
      ]
    );
  }
  return resultante;
};

module.exports = { disponible, presentacion, mover, textoUnidades, errorConEstado, nombreUsuario, TIPOS };
