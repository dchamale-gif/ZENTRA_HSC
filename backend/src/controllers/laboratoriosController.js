const pool = require('../db/connection');

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MIGRACION_PENDIENTE = 'Falta preparar la base de datos para los PDF de laboratorio (npm run migrate:laboratorios-archivos).';

// El nombre llega en la URL; se limpia para guardarlo y para el encabezado de descarga
const limpiarNombre = (nombre) => {
  const limpio = String(nombre || '').replace(/[\\/\r\n"]/g, '_').trim().slice(0, 200) || 'resultado';
  return /\.pdf$/i.test(limpio) ? limpio : `${limpio}.pdf`;
};

const laboratoriosController = {
  // Obtener laboratorios del paciente, con la lista de sus PDF (sin el contenido)
  getByPaciente: async (req, res) => {
    const { pacienteId } = req.params;
    try {
      let result;
      try {
        result = await pool.query(
          `SELECT l.*,
                  COALESCE(json_agg(json_build_object(
                    'id', a.id, 'nombre', a.nombre_archivo, 'tamano', a.tamano,
                    'subido_por', a.subido_por_nombre, 'fecha', a.created_at
                  ) ORDER BY a.created_at) FILTER (WHERE a.id IS NOT NULL), '[]') AS archivos
           FROM laboratorios l
           LEFT JOIN laboratorio_archivos a ON a.laboratorio_id = l.id
           WHERE l.paciente_id = $1
           GROUP BY l.id
           ORDER BY l.fecha DESC, l.id DESC`,
          [pacienteId]
        );
      } catch (error) {
        // Sin la migración de PDF, los laboratorios se siguen listando
        if (error.code !== '42P01') throw error;
        result = await pool.query(
          'SELECT *, NULL AS archivos FROM laboratorios WHERE paciente_id = $1 ORDER BY fecha DESC, id DESC',
          [pacienteId]
        );
      }
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Error getByPaciente:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // Crear laboratorio
  create: async (req, res) => {
    const { paciente_id, tipo, fecha, resultado } = req.body;
    
    if (!paciente_id || !tipo || !fecha) {
      return res.status(400).json({ error: 'paciente_id, tipo y fecha requeridos' });
    }

    try {
      const pacienteCheck = await pool.query(
        'SELECT id FROM pacientes WHERE id = $1',
        [paciente_id]
      );
      
      if (pacienteCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Paciente no encontrado' });
      }

      const result = await pool.query(
        `INSERT INTO laboratorios (paciente_id, tipo, fecha, resultado, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [paciente_id, tipo, fecha, resultado || null]
      );
      console.log(`✅ Laboratorio creado para paciente ${paciente_id}`);
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('❌ Error create:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // POST /api/laboratorios/:id/archivos?nombre=... (cuerpo: el PDF tal cual, application/pdf)
  subirArchivo: async (req, res) => {
    const laboratorioId = Number(req.params.id);
    const contenido = req.body;
    if (!Number.isInteger(laboratorioId)) {
      return res.status(400).json({ error: 'Laboratorio no válido' });
    }
    if (!Buffer.isBuffer(contenido) || contenido.length === 0) {
      return res.status(400).json({ error: 'Adjunte un archivo PDF' });
    }
    if (contenido.length > MAX_PDF_BYTES) {
      return res.status(413).json({ error: 'El PDF puede pesar hasta 10 MB' });
    }
    // Los PDF empiezan con "%PDF"; se rechaza cualquier otro archivo aunque diga ser PDF
    if (contenido.subarray(0, 4).toString('latin1') !== '%PDF') {
      return res.status(400).json({ error: 'El archivo no es un PDF válido' });
    }

    const nombre = limpiarNombre(req.query.nombre);
    const autor = `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email;
    try {
      const result = await pool.query(
        `INSERT INTO laboratorio_archivos (laboratorio_id, nombre_archivo, tamano, contenido, subido_por, subido_por_nombre)
         SELECT l.id, $2, $3, $4, $5, $6 FROM laboratorios l WHERE l.id = $1
         RETURNING id, nombre_archivo AS nombre, tamano, subido_por_nombre AS subido_por, created_at AS fecha`,
        [laboratorioId, nombre, contenido.length, contenido, req.user.id, autor]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Laboratorio no encontrado' });
      }
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '42P01') return res.status(503).json({ error: MIGRACION_PENDIENTE });
      console.error('❌ Error subirArchivo:', error.message);
      res.status(500).json({ error: 'No se pudo guardar el PDF' });
    }
  },

  // GET /api/laboratorios/archivos/:archivoId - Devuelve el PDF para verlo o descargarlo
  verArchivo: async (req, res) => {
    const archivoId = Number(req.params.archivoId);
    if (!Number.isInteger(archivoId)) {
      return res.status(400).json({ error: 'Archivo no válido' });
    }
    try {
      const result = await pool.query(
        'SELECT nombre_archivo, contenido FROM laboratorio_archivos WHERE id = $1',
        [archivoId]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
      }
      const { nombre_archivo: nombre, contenido } = result.rows[0];
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': contenido.length,
        'Content-Disposition': `inline; filename="${nombre.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store'
      });
      res.send(contenido);
    } catch (error) {
      if (error.code === '42P01') return res.status(503).json({ error: MIGRACION_PENDIENTE });
      console.error('❌ Error verArchivo:', error.message);
      res.status(500).json({ error: 'No se pudo abrir el PDF' });
    }
  },

  // DELETE /api/laboratorios/archivos/:archivoId
  eliminarArchivo: async (req, res) => {
    const archivoId = Number(req.params.archivoId);
    if (!Number.isInteger(archivoId)) {
      return res.status(400).json({ error: 'Archivo no válido' });
    }
    try {
      const result = await pool.query('DELETE FROM laboratorio_archivos WHERE id = $1', [archivoId]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
      }
      res.json({ message: 'PDF eliminado' });
    } catch (error) {
      if (error.code === '42P01') return res.status(503).json({ error: MIGRACION_PENDIENTE });
      console.error('❌ Error eliminarArchivo:', error.message);
      res.status(500).json({ error: 'No se pudo eliminar el PDF' });
    }
  },

  // Eliminar laboratorio (sus PDF se borran en cascada)
  delete: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        'DELETE FROM laboratorios WHERE id = $1 RETURNING *',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Laboratorio no encontrado' });
      }
      console.log(`✅ Laboratorio eliminado: ${id}`);
      res.json({ message: 'Laboratorio eliminado' });
    } catch (error) {
      console.error('❌ Error delete:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = laboratoriosController;
