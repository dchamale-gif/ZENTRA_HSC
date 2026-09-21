const pool = require('../db/connection');

const laboratoriosController = {
  // Obtener laboratorios del paciente
  getByPaciente: async (req, res) => {
    const { pacienteId } = req.params;
    try {
      const result = await pool.query(
        'SELECT * FROM laboratorios WHERE paciente_id = $1 ORDER BY fecha DESC',
        [pacienteId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Error getByPaciente:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // Crear laboratorio
  create: async (req, res) => {
    const { paciente_id, tipo, fecha, resultado } = req.body;
    
    if (!paciente_id || !tipo || !fecha) {
      return res.status(400).json({ error: 'paciente_id, tipo y fecha requeridos' });
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
        `INSERT INTO laboratorios (paciente_id, tipo, fecha, resultado, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [paciente_id, tipo, fecha, resultado || null]
      );
      console.log(`✅ Laboratorio creado para paciente ${paciente_id}`);
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('❌ Error create:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // Eliminar laboratorio
  delete: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        'DELETE FROM laboratorios WHERE id = $1 RETURNING *',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Laboratorio no encontrado' });
      }
      console.log(`✅ Laboratorio eliminado: ${id}`);
      res.json({ message: 'Laboratorio eliminado' });
    } catch (error) {
      console.error('❌ Error delete:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = laboratoriosController;
