const pool = require('../db/connection');

const responsablesController = {
  // Obtener responsable del paciente
  getByPaciente: async (req, res) => {
    const { pacienteId } = req.params;
    try {
      const result = await pool.query(
        'SELECT * FROM responsables_paciente WHERE paciente_id = $1',
        [pacienteId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No hay responsable asignado' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('❌ Error getByPaciente:', error.message);
      console.error('Stack:', error.stack);
      res.status(500).json({ error: error.message });
    }
  },

  // Crear o actualizar responsable
  save: async (req, res) => {
    const { paciente_id, nombre, relacion, telefono, email } = req.body;
    
    if (!paciente_id) {
      return res.status(400).json({ error: 'paciente_id requerido' });
    }

    try {
      // Verificar si el paciente existe
      const pacienteCheck = await pool.query(
        'SELECT id FROM pacientes WHERE id = $1',
        [paciente_id]
      );
      
      if (pacienteCheck.rows.length === 0) {
        console.warn(`⚠️ Paciente ${paciente_id} no existe`);
        return res.status(404).json({ error: 'Paciente no encontrado' });
      }

      // Verificar si existe responsable
      const check = await pool.query(
        'SELECT id FROM responsables_paciente WHERE paciente_id = $1',
        [paciente_id]
      );

      if (check.rows.length > 0) {
        // Actualizar
        const result = await pool.query(
          `UPDATE responsables_paciente 
           SET nombre = COALESCE($2, nombre),
               relacion = COALESCE($3, relacion),
               telefono = COALESCE($4, telefono),
               email = COALESCE($5, email),
               updated_at = NOW()
           WHERE paciente_id = $1
           RETURNING *`,
          [paciente_id, nombre || null, relacion || null, telefono || null, email || null]
        );
        console.log(`✅ Responsable actualizado para paciente ${paciente_id}`);
        return res.json(result.rows[0]);
      } else {
        // Insertar
        const result = await pool.query(
          `INSERT INTO responsables_paciente (paciente_id, nombre, relacion, telefono, email, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           RETURNING *`,
          [paciente_id, nombre || null, relacion || null, telefono || null, email || null]
        );
        console.log(`✅ Responsable creado para paciente ${paciente_id}`);
        return res.status(201).json(result.rows[0]);
      }
    } catch (error) {
      console.error('❌ Error save:', error.message);
      console.error('Stack:', error.stack);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = responsablesController;
