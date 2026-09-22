const pool = require('../db/connection');

const ordenesController = {
  // Obtener todas las órdenes médicas
  getAll: async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT o.*, p.nombre AS paciente_nombre,
                p.apellido_paterno AS paciente_apellido_paterno,
                p.apellido_materno AS paciente_apellido_materno,
                p.dpi AS paciente_dpi
         FROM ordenes o
         INNER JOIN pacientes p ON p.id = o.paciente_id
         WHERE o.tipo = 'medica'
         ORDER BY o.fecha_orden DESC, o.created_at DESC`
      );
      res.json({ total: result.rows.length, ordenes: result.rows });
    } catch (error) {
      console.error('❌ Error getAll órdenes:', error.message);
      res.status(500).json({ error: 'Error obteniendo órdenes médicas' });
    }
  },

  // Obtener órdenes del paciente
  getByPaciente: async (req, res) => {
    const { pacienteId } = req.params;
    try {
      const result = await pool.query(
        'SELECT * FROM ordenes WHERE paciente_id = $1 ORDER BY created_at DESC',
        [pacienteId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Error getByPaciente:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // Crear orden
  create: async (req, res) => {
    const {
      paciente_id,
      tipo = 'medica',
      doctor,
      descripcion,
      notas = '',
      servicios = [],
      estado = 'pendiente',
      fecha_orden
    } = req.body;
    
    if (!paciente_id || !doctor || !descripcion || !Array.isArray(servicios) || servicios.length === 0) {
      return res.status(400).json({ error: 'paciente_id, doctor, descripcion y servicios son requeridos' });
    }

    try {
      const pacienteCheck = await pool.query(
        'SELECT id FROM pacientes WHERE id = $1',
        [paciente_id]
      );
      
      if (pacienteCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Paciente no encontrado' });
      }

      const result = await pool.query(
        `INSERT INTO ordenes
           (paciente_id, tipo, doctor, descripcion, notas, servicios, estado, fecha_orden, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, COALESCE($8::date, CURRENT_DATE), NOW(), NOW())
         RETURNING *`,
        [paciente_id, tipo, doctor, descripcion, notas, JSON.stringify(servicios), estado, fecha_orden || null]
      );
      console.log(`✅ Orden creada para paciente ${paciente_id}`);
      return res.status(201).json({ orden: result.rows[0] });
    } catch (error) {
      console.error('❌ Error create:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // Actualizar una orden médica completa
  update: async (req, res) => {
    const { id } = req.params;
    const {
      paciente_id,
      tipo = 'medica',
      doctor,
      descripcion,
      notas = '',
      servicios = [],
      estado = 'pendiente',
      fecha_orden
    } = req.body;

    if (!paciente_id || !doctor || !descripcion || !Array.isArray(servicios) || servicios.length === 0) {
      return res.status(400).json({ error: 'paciente_id, doctor, descripcion y servicios son requeridos' });
    }

    try {
      const result = await pool.query(
        `UPDATE ordenes
         SET paciente_id = $1, tipo = $2, doctor = $3, descripcion = $4,
             notas = $5, servicios = $6::jsonb, estado = $7,
             fecha_orden = COALESCE($8::date, fecha_orden), updated_at = NOW()
         WHERE id = $9
         RETURNING *`,
        [paciente_id, tipo, doctor, descripcion, notas, JSON.stringify(servicios), estado, fecha_orden || null, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }
      res.json({ orden: result.rows[0] });
    } catch (error) {
      console.error('❌ Error update orden:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // Actualizar estado de orden
  updateEstado: async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    
    if (!estado) {
      return res.status(400).json({ error: 'estado requerido' });
    }

    try {
      const result = await pool.query(
        'UPDATE ordenes SET estado = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [estado, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }
      console.log(`✅ Orden actualizada: ${id} - Estado: ${estado}`);
      res.json(result.rows[0]);
    } catch (error) {
      console.error('❌ Error updateEstado:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // Eliminar orden
  delete: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        'DELETE FROM ordenes WHERE id = $1 RETURNING *',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }
      console.log(`✅ Orden eliminada: ${id}`);
      res.json({ message: 'Orden eliminada' });
    } catch (error) {
      console.error('❌ Error delete:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = ordenesController;
