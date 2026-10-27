// ============================================
// CORRELATIVOS POR ÁMBITO Y AÑO
// Cada tipo de documento (requerimiento, compra, gasto) lleva su propio contador
// por ámbito (el código de la bodega, o el del tipo) y por año:
// FAR-0001-2026, FAR-0002-2026, COC-0001-2026…
// El contador avanza dentro de la transacción del documento: si esta se revierte,
// el número no se pierde.
// ============================================

const pool = require('../db/connection');

let cache = { valor: false, hasta: 0 };
const disponible = async () => {
  if (Date.now() < cache.hasta) return cache.valor;
  const { rows } = await pool.query(
    "SELECT to_regclass('public.correlativos') IS NOT NULL AND to_regclass('public.bodegas') IS NOT NULL AS listo"
  );
  const valor = rows[0].listo;
  cache = { valor, hasta: valor ? Infinity : Date.now() + 60000 };
  return valor;
};

// Año de la fecha del documento (YYYY-MM-DD) o, sin fecha, el año actual en Guatemala
const anioDe = (fecha) => {
  if (fecha && /^\d{4}-\d{2}-\d{2}/.test(fecha)) return Number(String(fecha).slice(0, 4));
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric' }).format(new Date()));
};

// Siguiente número con formato <ÁMBITO>-<0001>-<AÑO>
const siguiente = async (client, tipo, ambito, fecha) => {
  const anio = anioDe(fecha);
  const { rows } = await client.query(
    `INSERT INTO correlativos (tipo, ambito, anio, ultimo) VALUES ($1, $2, $3, 1)
     ON CONFLICT (tipo, ambito, anio) DO UPDATE SET ultimo = correlativos.ultimo + 1
     RETURNING ultimo`,
    [tipo, ambito, anio]
  );
  return `${ambito}-${String(rows[0].ultimo).padStart(4, '0')}-${anio}`;
};

// Bodega activa por id (para asignar el número y guardar su nombre)
const bodega = async (client, id) => {
  const bodegaId = Number(id);
  if (!Number.isInteger(bodegaId)) return null;
  const { rows } = await client.query('SELECT id, nombre, codigo, activo FROM bodegas WHERE id = $1', [bodegaId]);
  return rows[0] || null;
};

module.exports = { disponible, siguiente, bodega, anioDe };
