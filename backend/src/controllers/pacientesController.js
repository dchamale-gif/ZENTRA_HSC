const pool = require('../db/connection');

// OBTENER todos los pacientes
const getPacientes = async (req, res) => {
  try {
    console.log('📋 Intentando obtener pacientes...');
    const result = await pool.query(
      `SELECT id, nombre, apellido_paterno, apellido_materno, edad, genero, 
              telefono, email, estado, created_at, updated_at,
              dpi, tipo_servicio, clasificacion, segmento_coex, 
              nacionalidad, grado_academico, estado_civil, profesion, ocupacion,
              fecha_nacimiento, foto, notas
       FROM pacientes 
       WHERE estado = 'activo'
       ORDER BY apellido_paterno, nombre`
    );

    console.log(`✅ ${result.rows.length} pacientes obtenidos`);
    res.status(200).json({
      total: result.rows.length,
      pacientes: result.rows
    });
  } catch (error) {
    console.error('❌ Error en getPacientes:', error.message);
    console.error('Detalles:', error);
    res.status(500).json({ 
      error: 'Error obteniendo pacientes',
      details: error.message
    });
  }
};

// OBTENER paciente por ID
const getPacienteById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, nombre, apellido_paterno, apellido_materno, edad, 
              fecha_nacimiento, genero, dpi, telefono, email, 
              direccion, colonia, zona, municipio, departamento,
              estado_civil, profesion, ocupacion, nacionalidad, grado_academico,
              tipo_servicio, clasificacion, segmento_coex, foto, notas,
              estado, created_at, updated_at
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
    const { nombre, apellido_paterno, apellido_materno, edad, fecha_nacimiento,
            genero, dpi, telefono, email, direccion, colonia, zona, 
            municipio, departamento, estado_civil, profesion, ocupacion,
            clasificacion, segmento_coex, is_cliente, tipo_servicio, foto, notas } = req.body;

    // Validar campos requeridos
    if (!nombre || !apellido_paterno) {
      return res.status(400).json({ error: 'Nombre y apellido paterno son requeridos' });
    }

    // Verificar que DPI sea único (si se proporciona)
    if (dpi) {
      const existing = await pool.query(
        'SELECT id FROM pacientes WHERE dpi = $1',
        [dpi]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'El DPI ya está registrado' });
      }
    }

    // Generar ID único
    const paciente_id = `PAC_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const result = await pool.query(
      `INSERT INTO pacientes 
       (id, nombre, apellido_paterno, apellido_materno, edad, fecha_nacimiento,
        genero, dpi, telefono, email, direccion, colonia, zona, 
        municipio, departamento, estado_civil, profesion, ocupacion, 
        clasificacion, segmento_coex, is_cliente, tipo_servicio, foto, notas, estado, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, 'activo', NOW(), NOW())
       RETURNING id, nombre, apellido_paterno, apellido_materno, email, telefono, clasificacion, segmento_coex, is_cliente, tipo_servicio, foto, notas`,
      [paciente_id, nombre, apellido_paterno, apellido_materno || null, edad || null, 
       fecha_nacimiento || null, genero || null, dpi || null, telefono || null, 
       email || null, direccion || null, colonia || null, zona || null, 
       municipio || null, departamento || null, estado_civil || null, 
       profesion || null, ocupacion || null, clasificacion || null, segmento_coex || null,
       is_cliente || false, tipo_servicio || null, foto || null, notas || null]
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
    const { nombre, apellido_paterno, apellido_materno, edad, fecha_nacimiento,
            genero, dpi, telefono, email, direccion, colonia, zona, 
            municipio, departamento, estado_civil, profesion, ocupacion,
            clasificacion, segmento_coex, is_cliente, tipo_servicio, foto, notas } = req.body;

    // Verificar que el paciente existe
    const existing = await pool.query('SELECT id FROM pacientes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const result = await pool.query(
      `UPDATE pacientes 
       SET nombre = COALESCE($1, nombre),
           apellido_paterno = COALESCE($2, apellido_paterno),
           apellido_materno = COALESCE($3, apellido_materno),
           edad = COALESCE($4, edad),
           fecha_nacimiento = COALESCE($5, fecha_nacimiento),
           genero = COALESCE($6, genero),
           dpi = COALESCE($7, dpi),
           telefono = COALESCE($8, telefono),
           email = COALESCE($9, email),
           direccion = COALESCE($10, direccion),
           colonia = COALESCE($11, colonia),
           zona = COALESCE($12, zona),
           municipio = COALESCE($13, municipio),
           departamento = COALESCE($14, departamento),
           estado_civil = COALESCE($15, estado_civil),
           profesion = COALESCE($16, profesion),
           ocupacion = COALESCE($17, ocupacion),
           clasificacion = COALESCE($19, clasificacion),
           segmento_coex = COALESCE($20, segmento_coex),
           is_cliente = COALESCE($21, is_cliente),
           tipo_servicio = COALESCE($22, tipo_servicio),
           foto = COALESCE($23, foto),
           notas = COALESCE($24, notas),
           updated_at = NOW()
       WHERE id = $18
       RETURNING id, nombre, apellido_paterno, apellido_materno, email, telefono, edad, genero, clasificacion, segmento_coex, is_cliente, tipo_servicio, foto, notas`,
      [nombre, apellido_paterno, apellido_materno, edad, fecha_nacimiento,
       genero, dpi, telefono, email, direccion, colonia, zona, 
       municipio, departamento, estado_civil, profesion, ocupacion, id,
       clasificacion, segmento_coex, is_cliente, tipo_servicio, foto, notas]
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
      'UPDATE pacientes SET estado = $1, updated_at = NOW() WHERE id = $2 RETURNING id, nombre, apellido_paterno',
      ['inactivo', id]
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
