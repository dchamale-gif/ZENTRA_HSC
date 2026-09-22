const pool = require('../db/connection');

const DIAS_VALIDOS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

const normalizarDias = (dias) => {
  if (!Array.isArray(dias)) return null;
  const normalizados = [...new Set(dias.map(dia => String(dia).toLowerCase()))];
  return normalizados.length > 0 && normalizados.every(dia => DIAS_VALIDOS.includes(dia))
    ? normalizados
    : null;
};

const selectPersonal = `
  SELECT pm.*, em.nombre AS especialidad
  FROM personal_medico pm
  INNER JOIN especialidades_medicas em ON em.id = pm.especialidad_id
`;

const personalMedicoController = {
  getAll: async (req, res) => {
    try {
      const result = await pool.query(`${selectPersonal} ORDER BY pm.apellido_paterno, pm.nombre`);
      res.json({ total: result.rows.length, personal: result.rows });
    } catch (error) {
      console.error('Error obteniendo personal médico:', error.message);
      res.status(500).json({ error: 'Error obteniendo personal médico' });
    }
  },

  getEspecialidades: async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, nombre FROM especialidades_medicas WHERE activo = true ORDER BY nombre'
      );
      res.json({ especialidades: result.rows });
    } catch (error) {
      console.error('Error obteniendo especialidades:', error.message);
      res.status(500).json({ error: 'Error obteniendo especialidades' });
    }
  },

  create: async (req, res) => {
    const {
      nombre, apellido_paterno, apellido_materno, especialidad_id,
      numero_colegiado, email, telefono, horario_inicio,
      horario_fin, dias_disponibles, estado
    } = req.body;

    if (!nombre || !apellido_paterno || !especialidad_id || !numero_colegiado || !telefono) {
      return res.status(400).json({ error: 'Faltan campos obligatorios del personal médico' });
    }

    if (email && !String(email).includes('@')) {
      return res.status(400).json({ error: 'El email no tiene un formato válido' });
    }

    const diasLaborales = normalizarDias(dias_disponibles);
    if (!diasLaborales) {
      return res.status(400).json({ error: 'Selecciona al menos un día laboral válido' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO personal_medico
           (nombre, apellido_paterno, apellido_materno, especialidad_id,
            numero_colegiado, email, telefono, horario_inicio, horario_fin,
            dias_disponibles, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::time, '08:00'),
                 COALESCE($9::time, '16:00'), COALESCE($10::text[], ARRAY['lunes', 'martes', 'miercoles', 'jueves', 'viernes']),
                 COALESCE($11, 'activo'))
         RETURNING id`,
        [nombre, apellido_paterno, apellido_materno || null, especialidad_id,
          numero_colegiado, email || null, telefono, horario_inicio || null,
          horario_fin || null, diasLaborales, estado || null]
      );
      const saved = await pool.query(`${selectPersonal} WHERE pm.id = $1`, [result.rows[0].id]);
      res.status(201).json({ personal: saved.rows[0] });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'El número de colegiado o el email ya están registrados' });
      }
      console.error('Error creando personal médico:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  update: async (req, res) => {
    const { id } = req.params;
    const {
      nombre, apellido_paterno, apellido_materno, especialidad_id,
      numero_colegiado, email, telefono, horario_inicio,
      horario_fin, dias_disponibles, estado
    } = req.body;

    if (!nombre || !apellido_paterno || !especialidad_id || !numero_colegiado || !telefono) {
      return res.status(400).json({ error: 'Faltan campos obligatorios del personal médico' });
    }

    if (email && !String(email).includes('@')) {
      return res.status(400).json({ error: 'El email no tiene un formato válido' });
    }

    const diasLaborales = normalizarDias(dias_disponibles);
    if (!diasLaborales) {
      return res.status(400).json({ error: 'Selecciona al menos un día laboral válido' });
    }

    try {
      const result = await pool.query(
        `UPDATE personal_medico
         SET nombre = $1, apellido_paterno = $2, apellido_materno = $3,
             especialidad_id = $4, numero_colegiado = $5, email = $6,
             telefono = $7, horario_inicio = $8::time, horario_fin = $9::time,
             dias_disponibles = $10::text[], estado = $11, updated_at = NOW()
         WHERE id = $12
         RETURNING id`,
        [nombre, apellido_paterno, apellido_materno || null, especialidad_id,
          numero_colegiado, email || null, telefono, horario_inicio, horario_fin,
          diasLaborales, estado, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Personal no encontrado' });

      const saved = await pool.query(`${selectPersonal} WHERE pm.id = $1`, [id]);
      res.json({ personal: saved.rows[0] });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'El número de colegiado o el email ya están registrados' });
      }
      console.error('Error actualizando personal médico:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  delete: async (req, res) => {
    try {
      const result = await pool.query(
        'DELETE FROM personal_medico WHERE id = $1 RETURNING id',
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Personal no encontrado' });
      res.json({ message: 'Personal médico eliminado' });
    } catch (error) {
      console.error('Error eliminando personal médico:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = personalMedicoController;