const pool = require('../db/connection');

// OBTENER todos los pacientes
const getPacientes = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, cedula, nombre, apellido, edad, genero, tipo_sangre, 
              telefono, email, activo, created_at
       FROM pacientes 
       WHERE activo = true
       ORDER BY apellido, nombre
       LIMIT 100`
    );

    res.status(200).json({
      total: result.rows.length,
      pacientes: result.rows
    });
  } catch (error) {
    console.error('Error en getPacientes:', error);
    res.status(500).json({ error: 'Error obteniendo pacientes' });
  }
};

// OBTENER paciente por ID
const getPacienteById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, cedula, nombre, apellido, edad, genero, tipo_sangre, 
              telefono, email, direccion, ciudad, alergias, enfermedades_cronicas,
              contacto_emergencia, activo, created_at, updated_at
       FROM pacientes 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    res.status(200).json({
      paciente: result.rows[0]
    });
  } catch (error) {
    console.error('Error en getPacienteById:', error);
    res.status(500).json({ error: 'Error obteniendo paciente' });
  }
};

// CREAR paciente
const createPaciente = async (req, res) => {
  try {
    const { cedula, nombre, apellido, edad, genero, tipo_sangre, 
            telefono, email, direccion, ciudad, alergias, 
            enfermedades_cronicas, contacto_emergencia } = req.body;

    // Validar campos requeridos
    if (!cedula || !nombre || !apellido) {
      return res.status(400).json({ error: 'Cédula, nombre y apellido son requeridos' });
    }

    // Verificar que cédula sea única
    const existing = await pool.query(
      'SELECT id FROM pacientes WHERE cedula = $1',
      [cedula]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'La cédula ya está registrada' });
    }

    const result = await pool.query(
      `INSERT INTO pacientes 
       (cedula, nombre, apellido, edad, genero, tipo_sangre, telefono, email, 
        direccion, ciudad, alergias, enfermedades_cronicas, contacto_emergencia, 
        activo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, NOW(), NOW())
       RETURNING id, cedula, nombre, apellido, email, telefono`,
      [cedula, nombre, apellido, edad || null, genero || null, tipo_sangre || null,
       telefono || null, email || null, direccion || null, ciudad || null,
       alergias || null, enfermedades_cronicas || null, contacto_emergencia || null]
    );

    res.status(201).json({
      message: 'Paciente creado exitosamente',
      paciente: result.rows[0]
    });
  } catch (error) {
    console.error('Error en createPaciente:', error);
    res.status(500).json({ error: 'Error creando paciente' });
  }
};

// ACTUALIZAR paciente
const updatePaciente = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, edad, genero, tipo_sangre, telefono, email,
            direccion, ciudad, alergias, enfermedades_cronicas, contacto_emergencia } = req.body;

    // Verificar que el paciente existe
    const existing = await pool.query('SELECT id FROM pacientes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const result = await pool.query(
      `UPDATE pacientes 
       SET nombre = COALESCE($1, nombre),
           apellido = COALESCE($2, apellido),
           edad = COALESCE($3, edad),
           genero = COALESCE($4, genero),
           tipo_sangre = COALESCE($5, tipo_sangre),
           telefono = COALESCE($6, telefono),
           email = COALESCE($7, email),
           direccion = COALESCE($8, direccion),
           ciudad = COALESCE($9, ciudad),
           alergias = COALESCE($10, alergias),
           enfermedades_cronicas = COALESCE($11, enfermedades_cronicas),
           contacto_emergencia = COALESCE($12, contacto_emergencia),
           updated_at = NOW()
       WHERE id = $13
       RETURNING id, cedula, nombre, apellido, email, telefono, edad, genero`,
      [nombre, apellido, edad, genero, tipo_sangre, telefono, email,
       direccion, ciudad, alergias, enfermedades_cronicas, contacto_emergencia, id]
    );

    res.status(200).json({
      message: 'Paciente actualizado exitosamente',
      paciente: result.rows[0]
    });
  } catch (error) {
    console.error('Error en updatePaciente:', error);
    res.status(500).json({ error: 'Error actualizando paciente' });
  }
};

// ELIMINAR paciente (soft delete)
const deletePaciente = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE pacientes SET activo = false, updated_at = NOW() WHERE id = $1 RETURNING id, nombre, apellido',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    res.status(200).json({
      message: 'Paciente eliminado exitosamente',
      paciente: result.rows[0]
    });
  } catch (error) {
    console.error('Error en deletePaciente:', error);
    res.status(500).json({ error: 'Error eliminando paciente' });
  }
};

module.exports = {
  getPacientes,
  getPacienteById,
  createPaciente,
  updatePaciente,
  deletePaciente
};
