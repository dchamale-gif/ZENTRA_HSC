const pool = require('../db');

// OBTENER responsable por paciente_id
const getResponsableByPacienteId = async (req, res) => {
  const { pacienteId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT * FROM responsables_paciente WHERE paciente_id = $1`,
      [pacienteId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Información de responsable no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error en getResponsableByPacienteId:', error);
    res.status(500).json({ error: 'Error al obtener información de responsable' });
  }
};

// CREAR nuevo responsable
const createResponsable = async (req, res) => {
  const { paciente_id, nombre, relacion, telefono, email } = req.body;

  try {
    // Validar que el paciente existe
    const pacienteCheck = await pool.query(
      'SELECT id FROM pacientes WHERE id = $1',
      [paciente_id]
    );

    if (pacienteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    // Verificar si ya existe responsable para este paciente
    const existingCheck = await pool.query(
      'SELECT id FROM responsables_paciente WHERE paciente_id = $1',
      [paciente_id]
    );

    if (existingCheck.rows.length > 0) {
      // Si ya existe, hacer update en lugar de insert
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
      return res.status(200).json(result.rows[0]);
    }

    const result = await pool.query(
      `INSERT INTO responsables_paciente (paciente_id, nombre, relacion, telefono, email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [paciente_id, nombre || null, relacion || null, telefono || null, email || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error en createResponsable:', error);
    res.status(500).json({ error: 'Error al crear información de responsable' });
  }
};

// ACTUALIZAR responsable
const updateResponsable = async (req, res) => {
  const { pacienteId } = req.params;
  const { nombre, relacion, telefono, email } = req.body;

  try {
    const result = await pool.query(
      `UPDATE responsables_paciente 
       SET nombre = COALESCE($2, nombre),
           relacion = COALESCE($3, relacion),
           telefono = COALESCE($4, telefono),
           email = COALESCE($5, email),
           updated_at = NOW()
       WHERE paciente_id = $1
       RETURNING *`,
      [pacienteId, nombre || null, relacion || null, telefono || null, email || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Información de responsable no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error en updateResponsable:', error);
    res.status(500).json({ error: 'Error al actualizar información de responsable' });
  }
};

// ELIMINAR responsable
const deleteResponsable = async (req, res) => {
  const { pacienteId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM responsables_paciente WHERE paciente_id = $1 RETURNING *',
      [pacienteId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Información de responsable no encontrada' });
    }

    res.json({ message: 'Información de responsable eliminada', data: result.rows[0] });
  } catch (error) {
    console.error('❌ Error en deleteResponsable:', error);
    res.status(500).json({ error: 'Error al eliminar información de responsable' });
  }
};

module.exports = {
  getResponsableByPacienteId,
  createResponsable,
  updateResponsable,
  deleteResponsable
};
