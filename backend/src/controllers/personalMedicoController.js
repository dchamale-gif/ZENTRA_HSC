const pool = require('../db/connection');

const DIAS_VALIDOS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

const normalizarDias = (dias) => {
  if (!Array.isArray(dias)) return null;
  const normalizados = [...new Set(dias.map(dia => String(dia).toLowerCase()))];
  return normalizados.length > 0 && normalizados.every(dia => DIAS_VALIDOS.includes(dia))
    ? normalizados
    : null;
};

// El listado incluye la foto de perfil (pequeña) pero no las fotos del DPI,
// que se piden aparte en GET /:id/documentos para no cargar la tabla.
const selectPersonal = `
  SELECT pm.id, pm.nombre, pm.apellido_paterno, pm.apellido_materno,
         pm.especialidad_id, pm.numero_colegiado, pm.email, pm.telefono,
         pm.horario_inicio, pm.horario_fin, pm.dias_disponibles, pm.estado,
         pm.created_at, pm.updated_at, pm.dpi, pm.foto_perfil,
         (pm.dpi_frente IS NOT NULL) AS tiene_dpi_frente,
         (pm.dpi_reverso IS NOT NULL) AS tiene_dpi_reverso,
         em.nombre AS especialidad
  FROM personal_medico pm
  INNER JOIN especialidades_medicas em ON em.id = pm.especialidad_id
`;

const IMAGENES = ['foto_perfil', 'dpi_frente', 'dpi_reverso'];
const DATA_URL_IMAGEN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const MAX_IMAGEN_BYTES = 3 * 1024 * 1024; // 3 MB por imagen ya decodificada

// Devuelve un mensaje de error o null. undefined = no se envió (no cambia), null = quitar.
const validarImagenes = (body) => {
  for (const campo of IMAGENES) {
    const valor = body[campo];
    if (valor === undefined || valor === null) continue;
    if (typeof valor !== 'string' || !DATA_URL_IMAGEN.test(valor)) {
      return `La imagen ${campo.replace('_', ' ')} debe ser JPG, PNG o WEBP`;
    }
    const base64 = valor.slice(valor.indexOf(',') + 1);
    if (Math.floor(base64.length * 3 / 4) > MAX_IMAGEN_BYTES) {
      return `La imagen ${campo.replace('_', ' ')} supera los 3 MB`;
    }
  }
  return null;
};

// DPI de Guatemala: 13 dígitos (se aceptan espacios o guiones)
const normalizarDPI = (dpi) => {
  if (dpi === undefined) return undefined;
  if (dpi === null || String(dpi).trim() === '') return null;
  const digitos = String(dpi).replace(/[\s-]/g, '');
  return /^\d{13}$/.test(digitos) ? digitos : false;
};

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

    const dpi = normalizarDPI(req.body.dpi);
    if (dpi === false) return res.status(400).json({ error: 'El DPI debe tener 13 dígitos' });
    const errorImagen = validarImagenes(req.body);
    if (errorImagen) return res.status(400).json({ error: errorImagen });

    try {
      const result = await pool.query(
        `INSERT INTO personal_medico
           (nombre, apellido_paterno, apellido_materno, especialidad_id,
            numero_colegiado, email, telefono, horario_inicio, horario_fin,
            dias_disponibles, estado, dpi, foto_perfil, dpi_frente, dpi_reverso)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::time, '08:00'),
                 COALESCE($9::time, '16:00'), COALESCE($10::text[], ARRAY['lunes', 'martes', 'miercoles', 'jueves', 'viernes']),
                 COALESCE($11, 'activo'), $12, $13, $14, $15)
         RETURNING id`,
        [nombre, apellido_paterno, apellido_materno || null, especialidad_id,
          numero_colegiado, email || null, telefono, horario_inicio || null,
          horario_fin || null, diasLaborales, estado || null, dpi ?? null,
          req.body.foto_perfil || null, req.body.dpi_frente || null, req.body.dpi_reverso || null]
      );
      const saved = await pool.query(`${selectPersonal} WHERE pm.id = $1`, [result.rows[0].id]);
      res.status(201).json({ personal: saved.rows[0] });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'El número de colegiado, el email o el DPI ya están registrados' });
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

    const dpi = normalizarDPI(req.body.dpi);
    if (dpi === false) return res.status(400).json({ error: 'El DPI debe tener 13 dígitos' });
    const errorImagen = validarImagenes(req.body);
    if (errorImagen) return res.status(400).json({ error: errorImagen });

    // DPI e imágenes solo se modifican si vienen en la petición (null = quitar)
    const values = [nombre, apellido_paterno, apellido_materno || null, especialidad_id,
      numero_colegiado, email || null, telefono, horario_inicio, horario_fin,
      diasLaborales, estado];
    const opcionales = [];
    if (dpi !== undefined) {
      values.push(dpi);
      opcionales.push(`dpi = $${values.length}`);
    }
    IMAGENES.forEach(campo => {
      if (req.body[campo] === undefined) return;
      values.push(req.body[campo] || null);
      opcionales.push(`${campo} = $${values.length}`);
    });
    values.push(id);

    try {
      const result = await pool.query(
        `UPDATE personal_medico
         SET nombre = $1, apellido_paterno = $2, apellido_materno = $3,
             especialidad_id = $4, numero_colegiado = $5, email = $6,
             telefono = $7, horario_inicio = $8::time, horario_fin = $9::time,
             dias_disponibles = $10::text[], estado = $11,
             ${opcionales.map(sql => `${sql}, `).join('')}updated_at = NOW()
         WHERE id = $${values.length}
         RETURNING id`,
        values
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Personal no encontrado' });

      const saved = await pool.query(`${selectPersonal} WHERE pm.id = $1`, [id]);
      res.json({ personal: saved.rows[0] });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'El número de colegiado, el email o el DPI ya están registrados' });
      }
      console.error('Error actualizando personal médico:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // Foto y fotografías del DPI de una persona
  getDocumentos: async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, dpi, foto_perfil, dpi_frente, dpi_reverso FROM personal_medico WHERE id = $1',
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Personal no encontrado' });
      res.json({ documentos: result.rows[0] });
    } catch (error) {
      console.error('Error obteniendo documentos del personal médico:', error.message);
      res.status(500).json({ error: 'Error obteniendo documentos del personal médico' });
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