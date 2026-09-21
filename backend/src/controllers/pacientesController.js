const pool = require('../db/connection');

// OBTENER todos los pacientes
const getPacientes = async (req, res) => {
  try {
    console.log('📋 Intentando obtener pacientes...');
    const result = await pool.query(
      `SELECT id, nombre, apellido_paterno, apellido_materno, edad, genero, 
              telefono, email, estado, created_at, updated_at,
              dpi, tipo_servicio, clasificacion, segmento_coex, 
              nacionalidad, grado_academico, estado_civil, profesion, ocupacion, tiene_hijos,
              fecha_nacimiento, foto, notas, direccion, colonia, zona, municipio, departamento,
              is_cliente, fecha_registro, fecha_primer_consulta, motivo_consulta, referencia
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
              tiene_hijos, fecha_primer_consulta, motivo_consulta, referencia,
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
            municipio, departamento, nacionalidad, estado_civil, profesion, ocupacion, grado_academico, tiene_hijos,
            clasificacion, segmento_coex, is_cliente, tipo_servicio, foto, notas,
            fecha_primer_consulta, motivo_consulta, referencia } = req.body;

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

    // Calcular edad si se proporciona fecha_nacimiento
    let edadCalculada = edad;
    if (fecha_nacimiento && !edad) {
      const birthDate = new Date(fecha_nacimiento);
      const today = new Date();
      edadCalculada = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
    }

    const result = await pool.query(
      `INSERT INTO pacientes 
       (id, nombre, apellido_paterno, apellido_materno, edad, fecha_nacimiento,
        genero, dpi, telefono, email, direccion, colonia, zona, 
        municipio, departamento, nacionalidad, estado_civil, profesion, ocupacion, grado_academico, tiene_hijos,
        clasificacion, segmento_coex, is_cliente, tipo_servicio, foto, notas, fecha_primer_consulta, motivo_consulta, referencia, estado, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::text != '' THEN $6::date ELSE NULL END, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, 'activo', NOW(), NOW())
       RETURNING *`,
      [paciente_id, nombre, apellido_paterno, apellido_materno || null, edadCalculada || null, 
       fecha_nacimiento || null, genero || null, dpi || null, telefono || null, 
       email || null, direccion || null, colonia || null, zona || null, 
       municipio || null, departamento || null, nacionalidad || null, estado_civil || null, 
       profesion || null, ocupacion || null, grado_academico || null, tiene_hijos || null, clasificacion || null, segmento_coex || null,
       is_cliente || false, tipo_servicio || null, foto || null, notas || null, fecha_primer_consulta || null, motivo_consulta || null, referencia || null]
    );

    res.status(201).json({
      message: 'Paciente creado exitosamente',
      paciente: result.rows[0]
    });
  } catch (error) {
    console.error('Error en createPaciente:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    
    // Retornar error más específico
    const errorMsg = error.detail || error.message || 'Error creando paciente';
    const statusCode = error.code === '23505' ? 409 : 500; // 409 para duplicados
    
    res.status(statusCode).json({ 
      error: errorMsg,
      code: error.code
    });
  }
};

// ACTUALIZAR paciente
const updatePaciente = async (req, res) => {
  const { id } = req.params;
  
  try {
    const { nombre, apellido_paterno, apellido_materno, edad, fecha_nacimiento,
            genero, dpi, telefono, email, direccion, colonia, zona, 
            municipio, departamento, nacionalidad, estado_civil, profesion, ocupacion, grado_academico, tiene_hijos,
            clasificacion, segmento_coex, is_cliente, tipo_servicio, foto, notas,
            fecha_primer_consulta, motivo_consulta, referencia } = req.body;

    console.log('\n✅ updatePaciente() iniciado para ID:', id);

    // Verificar que el paciente existe
    const existing = await pool.query('SELECT id FROM pacientes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    // Calcular edad si se proporciona fecha_nacimiento
    let edadCalculada = edad;
    if (fecha_nacimiento && !edad) {
      const birthDate = new Date(fecha_nacimiento);
      const today = new Date();
      edadCalculada = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
    }

    const result = await pool.query(
      `UPDATE pacientes 
       SET nombre = COALESCE($2, nombre),
           apellido_paterno = COALESCE($3, apellido_paterno),
           apellido_materno = COALESCE($4, apellido_materno),
           edad = COALESCE($5, edad),
           fecha_nacimiento = COALESCE(CASE WHEN $6::text != '' THEN $6::date ELSE NULL END, fecha_nacimiento),
           genero = COALESCE($7, genero),
           dpi = COALESCE($8, dpi),
           telefono = COALESCE($9, telefono),
           email = COALESCE($10, email),
           direccion = COALESCE($11, direccion),
           colonia = COALESCE($12, colonia),
           zona = COALESCE($13, zona),
           municipio = COALESCE($14, municipio),
           departamento = COALESCE($15, departamento),
           nacionalidad = COALESCE($16, nacionalidad),
           estado_civil = COALESCE($17, estado_civil),
           profesion = COALESCE($18, profesion),
           ocupacion = COALESCE($19, ocupacion),
           grado_academico = COALESCE($20, grado_academico),
           tiene_hijos = COALESCE($21, tiene_hijos),
           clasificacion = COALESCE($22, clasificacion),
           segmento_coex = COALESCE($23, segmento_coex),
           is_cliente = COALESCE($24, is_cliente),
           tipo_servicio = COALESCE($25, tipo_servicio),
           foto = COALESCE($26, foto),
           notas = COALESCE($27, notas),
           fecha_primer_consulta = COALESCE(CASE WHEN $28::text != '' THEN $28::date ELSE NULL END, fecha_primer_consulta),
           motivo_consulta = COALESCE($29, motivo_consulta),
           referencia = COALESCE($30, referencia),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, nombre, apellido_paterno, apellido_materno, edadCalculada, 
       fecha_nacimiento, genero, dpi, telefono, email, direccion, colonia, 
       zona, municipio, departamento, nacionalidad, estado_civil, profesion, ocupacion, grado_academico, tiene_hijos,
       clasificacion, segmento_coex, is_cliente, tipo_servicio, foto, notas, fecha_primer_consulta, motivo_consulta, referencia]
    );

    console.log('✅ Paciente actualizado:', id);
    res.status(200).json({
      message: 'Paciente actualizado exitosamente',
      paciente: result.rows[0]
    });
  } catch (error) {
    console.error('Error en updatePaciente:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      pacienteId: id
    });
    
    const errorMsg = error.detail || error.message || 'Error actualizando paciente';
    const statusCode = error.code === '23505' ? 409 : 500;
    
    res.status(statusCode).json({ 
      error: errorMsg,
      code: error.code
    });
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
