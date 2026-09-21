const pool = require('../db/connection');

const alertasController = {
  // Obtener alertas del paciente
  getByPaciente: async (req, res) => {
    const { pacienteId } = req.params;
    try {
      const result = await pool.query(
        'SELECT * FROM alertas WHERE paciente_id = $1 ORDER BY created_at DESC',
        [pacienteId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Error getByPaciente:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // Crear alerta
  create: async (req, res) => {
    const { paciente_id, tipo, descripcion } = req.body;
    
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
        `INSERT INTO alertas (paciente_id, tipo, descripcion, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING *`,
        [paciente_id, tipo, descripcion]
      );
      console.log(`✅ Alerta creada para paciente ${paciente_id}`);
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('❌ Error create:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // Eliminar alerta
  delete: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        'DELETE FROM alertas WHERE id = $1 RETURNING *',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Alerta no encontrada' });
      }
      console.log(`✅ Alerta eliminada: ${id}`);
      res.json({ message: 'Alerta eliminada' });
    } catch (error) {
      console.error('❌ Error delete:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = alertasController;
