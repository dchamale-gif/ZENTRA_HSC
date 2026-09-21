const pool = require('../db/connection');

const contactosEmergenciaController = {
  // Obtener contactos de emergencia del paciente
  getByPaciente: async (req, res) => {
    const { pacienteId } = req.params;
    try {
      const result = await pool.query(
        'SELECT * FROM contactos_emergencia WHERE paciente_id = $1 ORDER BY tipo DESC',
        [pacienteId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No hay contactos de emergencia' });
      }
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Error getByPaciente:', error.message);
      console.error('Stack:', error.stack);
      res.status(500).json({ error: error.message });
    }
  },

  // Crear o actualizar contacto de emergencia
  save: async (req, res) => {
    const { paciente_id, nombre, telefono, parentesco, direccion, tipo } = req.body;
    
    if (!paciente_id || !tipo) {
      return res.status(400).json({ error: 'paciente_id y tipo requeridos' });
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

      // Verificar si existe contacto del mismo tipo
      const check = await pool.query(
        'SELECT id FROM contactos_emergencia WHERE paciente_id = $1 AND tipo = $2',
        [paciente_id, tipo]
      );

      if (check.rows.length > 0) {
        // Actualizar
        const result = await pool.query(
          `UPDATE contactos_emergencia 
           SET nombre = COALESCE($2, nombre),
               telefono = COALESCE($3, telefono),
               parentesco = COALESCE($4, parentesco),
               direccion = COALESCE($5, direccion),
               updated_at = NOW()
           WHERE paciente_id = $1 AND tipo = $6
           RETURNING *`,
          [paciente_id, nombre || null, telefono || null, parentesco || null, direccion || null, tipo]
        );
        console.log(`✅ Contacto de emergencia (${tipo}) actualizado para paciente ${paciente_id}`);
        return res.json(result.rows[0]);
      } else {
        // Insertar
        const result = await pool.query(
          `INSERT INTO contactos_emergencia (paciente_id, nombre, telefono, parentesco, direccion, tipo, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING *`,
          [paciente_id, nombre || null, telefono || null, parentesco || null, direccion || null, tipo]
        );
        console.log(`✅ Contacto de emergencia (${tipo}) creado para paciente ${paciente_id}`);
        return res.status(201).json(result.rows[0]);
      }
    } catch (error) {
      console.error('❌ Error save:', error.message);
      console.error('Stack:', error.stack);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = contactosEmergenciaController;
