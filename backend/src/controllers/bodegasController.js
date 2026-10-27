// ============================================
// BODEGAS (catálogo)
// Farmacia, cocina… Cada una con un código corto que encabeza sus correlativos
// (FAR-0001-2026). La administra compras. El código no cambia después de crearla,
// para que los números ya emitidos sigan diciendo de qué bodega son.
// ============================================

const pool = require('../db/connection');
const correlativos = require('../services/correlativos');

const errorConEstado = (message, status = 400) => Object.assign(new Error(message), { status });
const MIGRACION = 'Falta preparar la base de datos para las bodegas (npm run migrate:requerimientos).';

const responderError = (res, error, accion) => {
  if (!error.status && error.code !== '23505') console.error(`Error al ${accion}:`, error);
  if (error.code === '23505') return res.status(409).json({ error: 'Ya existe una bodega con ese nombre o código' });
  res.status(error.status || 500).json({ error: error.status ? error.message : `Error al ${accion}` });
};

const leerNombre = (valor) => {
  const nombre = String(valor || '').trim().slice(0, 60);
  if (!nombre) throw errorConEstado('Escriba el nombre de la bodega');
  return nombre;
};

const bodegasController = {
  // GET /api/bodegas  (todas; las inactivas no se ofrecen en documentos nuevos)
  async listar(req, res) {
    try {
      if (!(await correlativos.disponible())) return res.json({ bodegas: [], disponible: false });
      const { rows } = await pool.query('SELECT id, nombre, codigo, activo FROM bodegas ORDER BY activo DESC, nombre');
      res.json({ bodegas: rows, disponible: true });
    } catch (error) {
      responderError(res, error, 'listar las bodegas');
    }
  },

  // POST /api/bodegas { nombre, codigo }
  async crear(req, res) {
    try {
      if (!(await correlativos.disponible())) throw errorConEstado(MIGRACION, 503);
      const nombre = leerNombre(req.body.nombre);
      const codigo = String(req.body.codigo || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{2,6}$/.test(codigo)) throw errorConEstado('El código lleva de 2 a 6 letras o números, sin espacios (ej. FAR)');
      const { rows } = await pool.query(
        'INSERT INTO bodegas (nombre, codigo) VALUES ($1, $2) RETURNING id, nombre, codigo, activo',
        [nombre, codigo]
      );
      res.status(201).json({ message: `Bodega ${nombre} (${codigo}) creada`, bodega: rows[0] });
    } catch (error) {
      responderError(res, error, 'crear la bodega');
    }
  },

  // PUT /api/bodegas/:id { nombre, activo }  (el código no se cambia)
  async actualizar(req, res) {
    try {
      if (!(await correlativos.disponible())) throw errorConEstado(MIGRACION, 503);
      const nombre = leerNombre(req.body.nombre);
      const { rows } = await pool.query(
        `UPDATE bodegas SET nombre = $1, activo = $2, updated_at = NOW()
         WHERE id = $3 RETURNING id, nombre, codigo, activo`,
        [nombre, req.body.activo !== false, req.params.id]
      );
      if (!rows.length) throw errorConEstado('Bodega no encontrada', 404);
      // El nombre guardado en los requerimientos sigue al de la bodega
      await pool.query('UPDATE requerimientos_compra SET almacen = $1 WHERE bodega_id = $2', [nombre, req.params.id]);
      res.json({ message: `Bodega ${rows[0].nombre} actualizada`, bodega: rows[0] });
    } catch (error) {
      responderError(res, error, 'actualizar la bodega');
    }
  }
};

module.exports = bodegasController;
