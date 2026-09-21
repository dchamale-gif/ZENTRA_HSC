const pool = require('../db');

const empresasController = {
  // Obtener empresa del paciente
  getByPaciente: async (req, res) => {
    const { pacienteId } = req.params;
    try {
      const result = await pool.query(
        'SELECT * FROM empresas WHERE paciente_id = $1',
        [pacienteId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No hay información de empresa' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('❌ Error getByPaciente:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Crear o actualizar empresa
  save: async (req, res) => {
    const { paciente_id, nombre, telefono, direccion } = req.body;
    if (!paciente_id) {
      return res.status(400).json({ error: 'paciente_id requerido' });
    }

    try {
      // Verificar si existe
      const check = await pool.query(
        'SELECT id FROM empresas WHERE paciente_id = $1',
        [paciente_id]
      );

      if (check.rows.length > 0) {
        // Actualizar
        const result = await pool.query(
          `UPDATE empresas 
           SET nombre = COALESCE($2, nombre),
               telefono = COALESCE($3, telefono),
               direccion = COALESCE($4, direccion),
               updated_at = NOW()
           WHERE paciente_id = $1
           RETURNING *`,
          [paciente_id, nombre || null, telefono || null, direccion || null]
        );
        return res.json(result.rows[0]);
      } else {
        // Insertar
        const result = await pool.query(
          `INSERT INTO empresas (paciente_id, nombre, telefono, direccion, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           RETURNING *`,
          [paciente_id, nombre || null, telefono || null, direccion || null]
        );
        return res.status(201).json(result.rows[0]);
      }
    } catch (error) {
      console.error('❌ Error save:', error);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = empresasController;
