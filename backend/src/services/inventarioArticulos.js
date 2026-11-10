// ============================================
// INVENTARIO DE ARTÍCULOS CON KÁRDEX
// Toda entrada o salida de un artículo pasa por mover(): actualiza la existencia y,
// si ya se corrió npm run migrate:regulaciones, la deja en articulo_movimientos.
// Mismos tipos que el kárdex de medicinas.
// ============================================

const pool = require('../db/connection');
const { errorConEstado, nombreUsuario } = require('./inventarioMedicinas');

const TIPOS = ['inicial', 'ingreso_compra', 'reversion_compra', 'venta', 'devolucion_venta', 'consumo_interno', 'ajuste'];

// Una vez creada la tabla queda en caché; mientras no exista se vuelve a revisar cada minuto
let cache = { valor: false, hasta: 0 };
const disponible = async () => {
  if (Date.now() < cache.hasta) return cache.valor;
  const { rows } = await pool.query("SELECT to_regclass('public.articulo_movimientos') IS NOT NULL AS listo");
  const valor = rows[0].listo;
  cache = { valor, hasta: valor ? Infinity : Date.now() + 60000 };
  return valor;
};

/**
 * datos: { articuloId, cantidad (+ entra, - sale), tipo, costoUnitario, referencia, motivo, req, mensajeFaltante }
 * Devuelve la existencia resultante. Lanza 409 si la salida deja la existencia en negativo.
 */
const mover = async (db, datos) => {
  const cantidad = Number(datos.cantidad);
  if (!Number.isInteger(cantidad) || cantidad === 0) throw errorConEstado('Cantidad de inventario no válida');
  if (!TIPOS.includes(datos.tipo)) throw errorConEstado('Tipo de movimiento no válido');

  const actual = await db.query(
    'SELECT nombre_articulo AS nombre, cantidad_disponible FROM codigos_articulos WHERE id = $1 FOR UPDATE',
    [datos.articuloId]
  );
  if (!actual.rowCount) throw errorConEstado(`El artículo ${datos.articuloId} no existe`);
  const { nombre } = actual.rows[0];
  const existencia = Number(actual.rows[0].cantidad_disponible) || 0;
  const resultante = existencia + cantidad;
  if (resultante < 0) {
    throw errorConEstado(
      `${datos.mensajeFaltante ? `${datos.mensajeFaltante} ` : ''}Existencia insuficiente de ${nombre}: hay ${existencia} y se necesitan ${-cantidad}.`,
      409
    );
  }

  await db.query('UPDATE codigos_articulos SET cantidad_disponible = $1, updated_at = NOW() WHERE id = $2',
    [resultante, datos.articuloId]);

  if (await disponible()) {
    await db.query(
      `INSERT INTO articulo_movimientos
         (articulo_id, tipo, cantidad, existencia_resultante, costo_unitario, referencia, motivo, usuario_id, usuario_nombre)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        datos.articuloId, datos.tipo, cantidad, resultante,
        datos.costoUnitario ?? null,
        datos.referencia ? String(datos.referencia).slice(0, 80) : null,
        String(datos.motivo || '').slice(0, 1000),
        datos.req?.user?.id || null,
        nombreUsuario(datos.req)
      ]
    );
  }
  return resultante;
};

// Cambio directo de la existencia (formulario de Códigos de artículos): queda como ajuste
const fijar = async (db, articuloId, nueva, req, motivo) => {
  const valor = Number(nueva);
  if (!Number.isInteger(valor) || valor < 0) throw errorConEstado('La cantidad disponible debe ser un entero de 0 o más');
  const actual = await db.query('SELECT cantidad_disponible FROM codigos_articulos WHERE id = $1 FOR UPDATE', [articuloId]);
  if (!actual.rowCount) return null;
  const diferencia = valor - (Number(actual.rows[0].cantidad_disponible) || 0);
  if (diferencia === 0) return valor;
  return mover(db, { articuloId, cantidad: diferencia, tipo: 'ajuste', motivo, req });
};

module.exports = { disponible, mover, fijar, TIPOS };
