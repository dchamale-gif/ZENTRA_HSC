const pool = require('../db/connection');

const datosFamiliaController = {
  // Obtener datos familiares del paciente
  getByPaciente: async (req, res) => {
    const { pacienteId } = req.params;
    try {
      const result = await pool.query(
        'SELECT * FROM datos_familia WHERE paciente_id = $1',
        [pacienteId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No hay datos familiares' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('❌ Error getByPaciente:', error.message);
      console.error('Stack:', error.stack);
      res.status(500).json({ error: error.message });
    }
  },

  // Crear o actualizar datos familiares
  save: async (req, res) => {
    const { 
      paciente_id, 
      padre_nombre, padre_vivo, padre_ocupacion, padre_telefono,
      madre_nombre, madre_vivo, madre_ocupacion, madre_telefono,
      pareja_nombre, pareja_vivo, pareja_ocupacion, pareja_telefono,
      hermanos_numero, hermanos_observaciones,
      hijos_numero, hijos_observaciones
    } = req.body;
    
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

      // Verificar si existe registro
      const check = await pool.query(
        'SELECT id FROM datos_familia WHERE paciente_id = $1',
        [paciente_id]
      );

      if (check.rows.length > 0) {
        // Actualizar
        const result = await pool.query(
          `UPDATE datos_familia 
           SET padre_nombre = COALESCE($2, padre_nombre),
               padre_vivo = COALESCE($3, padre_vivo),
               padre_ocupacion = COALESCE($4, padre_ocupacion),
               padre_telefono = COALESCE($5, padre_telefono),
               madre_nombre = COALESCE($6, madre_nombre),
               madre_vivo = COALESCE($7, madre_vivo),
               madre_ocupacion = COALESCE($8, madre_ocupacion),
               madre_telefono = COALESCE($9, madre_telefono),
               pareja_nombre = COALESCE($10, pareja_nombre),
               pareja_vivo = COALESCE($11, pareja_vivo),
               pareja_ocupacion = COALESCE($12, pareja_ocupacion),
               pareja_telefono = COALESCE($13, pareja_telefono),
               hermanos_numero = COALESCE($14, hermanos_numero),
               hermanos_observaciones = COALESCE($15, hermanos_observaciones),
               hijos_numero = COALESCE($16, hijos_numero),
               hijos_observaciones = COALESCE($17, hijos_observaciones),
               updated_at = NOW()
           WHERE paciente_id = $1
           RETURNING *`,
          [
            paciente_id,
            padre_nombre || null, padre_vivo || null, padre_ocupacion || null, padre_telefono || null,
            madre_nombre || null, madre_vivo || null, madre_ocupacion || null, madre_telefono || null,
            pareja_nombre || null, pareja_vivo || null, pareja_ocupacion || null, pareja_telefono || null,
            hermanos_numero || null, hermanos_observaciones || null,
            hijos_numero || null, hijos_observaciones || null
          ]
        );
        console.log(`✅ Datos familiares actualizados para paciente ${paciente_id}`);
        return res.json(result.rows[0]);
      } else {
        // Insertar
        const result = await pool.query(
          `INSERT INTO datos_familia (
            paciente_id, padre_nombre, padre_vivo, padre_ocupacion, padre_telefono,
            madre_nombre, madre_vivo, madre_ocupacion, madre_telefono,
            pareja_nombre, pareja_vivo, pareja_ocupacion, pareja_telefono,
            hermanos_numero, hermanos_observaciones, hijos_numero, hijos_observaciones,
            created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
           RETURNING *`,
          [
            paciente_id,
            padre_nombre || null, padre_vivo || null, padre_ocupacion || null, padre_telefono || null,
            madre_nombre || null, madre_vivo || null, madre_ocupacion || null, madre_telefono || null,
            pareja_nombre || null, pareja_vivo || null, pareja_ocupacion || null, pareja_telefono || null,
            hermanos_numero || null, hermanos_observaciones || null,
            hijos_numero || null, hijos_observaciones || null
          ]
        );
        console.log(`✅ Datos familiares creados para paciente ${paciente_id}`);
        return res.status(201).json(result.rows[0]);
      }
    } catch (error) {
      console.error('❌ Error save:', error.message);
      console.error('Stack:', error.stack);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = datosFamiliaController;
