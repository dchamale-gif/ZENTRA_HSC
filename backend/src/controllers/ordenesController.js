const pool = require('../db/connection');

const ordenesController = {
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
    const { paciente_id, tipo, descripcion, estado } = req.body;
    
    if (!paciente_id || !tipo || !descripcion) {
      return res.status(400).json({ error: 'paciente_id, tipo y descripcion requeridos' });
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
        `INSERT INTO ordenes (paciente_id, tipo, descripcion, estado, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [paciente_id, tipo, descripcion, estado || 'pendiente']
      );
      console.log(`✅ Orden creada para paciente ${paciente_id}`);
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('❌ Error create:', error.message);
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
