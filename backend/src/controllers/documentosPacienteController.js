const pool = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

const documentosPacienteController = {
  // Obtener documentos del paciente por categoría
  getByPaciente: async (req, res) => {
    const { pacienteId } = req.params;
    try {
      const result = await pool.query(
        'SELECT id, paciente_id, categoria, nombre_archivo, contenido, timestamp_carga FROM documentos_paciente WHERE paciente_id = $1 ORDER BY categoria, timestamp_carga DESC',
        [pacienteId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Error getByPaciente:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // Obtener documento específico por categoría
  getByCategoria: async (req, res) => {
    const { pacienteId, categoria } = req.params;
    try {
      const result = await pool.query(
        'SELECT id, paciente_id, categoria, nombre_archivo, contenido, timestamp_carga FROM documentos_paciente WHERE paciente_id = $1 AND categoria = $2 LIMIT 1',
        [pacienteId, categoria]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('❌ Error getByCategoria:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // Guardar/actualizar documento
  save: async (req, res) => {
    const { paciente_id, categoria, nombre_archivo, contenido } = req.body;
    
    if (!paciente_id || !categoria || !contenido) {
      return res.status(400).json({ error: 'paciente_id, categoria y contenido requeridos' });
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

      // Verificar si ya existe documento con esta categoría
      const existingDoc = await pool.query(
        'SELECT id FROM documentos_paciente WHERE paciente_id = $1 AND categoria = $2',
        [paciente_id, categoria]
      );

      let result;
      if (existingDoc.rows.length > 0) {
        // Actualizar documento existente
        result = await pool.query(
          `UPDATE documentos_paciente 
           SET nombre_archivo = $1, contenido = $2, timestamp_carga = NOW()
           WHERE paciente_id = $3 AND categoria = $4
           RETURNING *`,
          [nombre_archivo || null, contenido, paciente_id, categoria]
        );
        console.log(`✅ Documento ${categoria} actualizado para paciente ${paciente_id}`);
      } else {
        // Crear nuevo documento
        const docId = uuidv4();
        result = await pool.query(
          `INSERT INTO documentos_paciente (id, paciente_id, categoria, nombre_archivo, contenido, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           RETURNING *`,
          [docId, paciente_id, categoria, nombre_archivo || null, contenido]
        );
        console.log(`✅ Documento ${categoria} creado para paciente ${paciente_id}`);
      }

      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('❌ Error save:', error.message);
      console.error('Stack:', error.stack);
      res.status(500).json({ error: error.message });
    }
  },

  // Eliminar documento
  delete: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        'DELETE FROM documentos_paciente WHERE id = $1 RETURNING *',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado' });
      }
      console.log(`✅ Documento ${id} eliminado`);
      res.json({ message: 'Documento eliminado', data: result.rows[0] });
    } catch (error) {
      console.error('❌ Error delete:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = documentosPacienteController;
