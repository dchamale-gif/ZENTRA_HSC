const pool = require('../db');

// OBTENER empresa por paciente_id
const getEmpresaByPacienteId = async (req, res) => {
  const { pacienteId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT * FROM empresas WHERE paciente_id = $1`,
      [pacienteId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Información de empresa no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error en getEmpresaByPacienteId:', error);
    res.status(500).json({ error: 'Error al obtener información de empresa' });
  }
};

// CREAR nueva empresa
const createEmpresa = async (req, res) => {
  const { paciente_id, nombre, telefono, direccion } = req.body;

  try {
    // Validar que el paciente existe
    const pacienteCheck = await pool.query(
      'SELECT id FROM pacientes WHERE id = $1',
      [paciente_id]
    );

    if (pacienteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    // Verificar si ya existe empresa para este paciente
    const existingCheck = await pool.query(
      'SELECT id FROM empresas WHERE paciente_id = $1',
      [paciente_id]
    );

    if (existingCheck.rows.length > 0) {
      // Si ya existe, hacer update en lugar de insert
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
      return res.status(200).json(result.rows[0]);
    }

    const result = await pool.query(
      `INSERT INTO empresas (paciente_id, nombre, telefono, direccion, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [paciente_id, nombre || null, telefono || null, direccion || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error en createEmpresa:', error);
    res.status(500).json({ error: 'Error al crear información de empresa' });
  }
};

// ACTUALIZAR empresa
const updateEmpresa = async (req, res) => {
  const { pacienteId } = req.params;
  const { nombre, telefono, direccion } = req.body;

  try {
    const result = await pool.query(
      `UPDATE empresas 
       SET nombre = COALESCE($2, nombre),
           telefono = COALESCE($3, telefono),
           direccion = COALESCE($4, direccion),
           updated_at = NOW()
       WHERE paciente_id = $1
       RETURNING *`,
      [pacienteId, nombre || null, telefono || null, direccion || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Información de empresa no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error en updateEmpresa:', error);
    res.status(500).json({ error: 'Error al actualizar información de empresa' });
  }
};

// ELIMINAR empresa
const deleteEmpresa = async (req, res) => {
  const { pacienteId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM empresas WHERE paciente_id = $1 RETURNING *',
      [pacienteId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Información de empresa no encontrada' });
    }

    res.json({ message: 'Información de empresa eliminada', data: result.rows[0] });
  } catch (error) {
    console.error('❌ Error en deleteEmpresa:', error);
    res.status(500).json({ error: 'Error al eliminar información de empresa' });
  }
};

module.exports = {
  getEmpresaByPacienteId,
  createEmpresa,
  updateEmpresa,
  deleteEmpresa
};
