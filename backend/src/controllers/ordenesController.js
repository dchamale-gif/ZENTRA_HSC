const pool = require('../db/connection');
const { notificarPorPermiso } = require('../services/notificaciones');
const sync = require('../services/historiaSincronizada');

const ESTADOS_VALIDOS = ['pendiente', 'completada', 'cancelada'];

// La orden médica es texto libre; los servicios solo quedan en órdenes antiguas
// (los conceptos y medicinas los agrega enfermería en su orden).
const serviciosValidos = (servicios) => Array.isArray(servicios) &&
  servicios.every(servicio =>
    servicio && String(servicio.nombre || '').trim() &&
    Number.isFinite(Number(servicio.costo)) && Number(servicio.costo) >= 0
  );

const ordenesController = {
  // Obtener todas las órdenes médicas
  getAll: async (req, res) => {
    try {
      // Con la sincronización, cada orden trae el estado y la fecha de su historia clínica
      const conHistoria = await sync.disponible();
      const result = await pool.query(
        `SELECT o.*, p.nombre AS paciente_nombre,
                p.apellido_paterno AS paciente_apellido_paterno,
                p.apellido_materno AS paciente_apellido_materno,
                p.dpi AS paciente_dpi
                ${conHistoria ? ", h.estado AS historia_estado, to_char(h.fecha, 'YYYY-MM-DD') AS historia_fecha" : ''}
         FROM ordenes o
         INNER JOIN pacientes p ON p.id = o.paciente_id
         ${conHistoria ? 'LEFT JOIN historias_clinicas h ON h.id = o.historia_id' : ''}
         WHERE o.tipo = 'medica'
         ORDER BY o.fecha_orden DESC, o.created_at DESC`
      );
      res.json({ total: result.rows.length, ordenes: result.rows });
    } catch (error) {
      console.error('❌ Error getAll órdenes:', error.message);
      res.status(500).json({ error: 'Error obteniendo órdenes médicas' });
    }
  },

  // Obtener órdenes del paciente
  getByPaciente: async (req, res) => {
    const { pacienteId } = req.params;
    try {
      const result = await pool.query(
        "SELECT * FROM ordenes WHERE paciente_id = $1 AND tipo = 'medica' ORDER BY created_at DESC",
        [pacienteId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Error getByPaciente:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // Crear orden
  create: async (req, res) => {
    const {
      paciente_id,
      doctor,
      descripcion,
      notas = '',
      servicios = [],
      estado = 'pendiente',
      fecha_orden
    } = req.body;
    const doctorNormalizado = String(doctor || '').trim();
    const descripcionNormalizada = String(descripcion || '').trim();

    if (!paciente_id || !doctorNormalizado || !descripcionNormalizada || !serviciosValidos(servicios)) {
      return res.status(400).json({ error: 'Paciente, médico y orden médica son requeridos' });
    }
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: 'Estado de orden no válido' });
    }

    const client = await pool.connect();
    try {
      const pacienteCheck = await client.query(
        'SELECT id, nombre, apellido_paterno FROM pacientes WHERE id = $1',
        [paciente_id]
      );
      
      if (pacienteCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Paciente no encontrado' });
      }

      await client.query('BEGIN');
      // La orden queda en la historia clínica abierta del paciente
      const historia = (await sync.disponible())
        ? await sync.historiaParaOrden(req, pacienteCheck.rows[0].id, client)
        : null;
      const result = await client.query(
        `INSERT INTO ordenes
           (paciente_id, tipo, doctor, descripcion, notas, servicios, estado, fecha_orden, created_at, updated_at
            ${historia ? ', historia_id' : ''})
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, COALESCE($8::date, CURRENT_DATE), NOW(), NOW()
            ${historia ? ', $9' : ''})
         RETURNING *`,
        [paciente_id, 'medica', doctorNormalizado, descripcionNormalizada, notas, JSON.stringify(servicios), estado, fecha_orden || null,
          ...(historia ? [historia.id] : [])]
      );
      await client.query('COMMIT');
      console.log(`✅ Orden creada para paciente ${paciente_id}`);
      res.status(201).json({ orden: result.rows[0], historia_abierta_automaticamente: Boolean(historia?.creada) });

      // Avisar a quienes atienden órdenes médicas (sin bloquear la respuesta)
      const paciente = pacienteCheck.rows[0];
      notificarPorPermiso('ordenes_medicas_view', {
        tipo: 'orden_medica',
        titulo: `Nueva orden médica · ${[paciente.nombre, paciente.apellido_paterno].filter(Boolean).join(' ')}`,
        mensaje: `${doctorNormalizado}: ${descripcionNormalizada.slice(0, 160)}`,
        enlace: 'ordenes-medicas'
      }, { excluirUserId: req.user?.id });
      return;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.status) return res.status(error.status).json({ error: error.message });
      console.error('❌ Error create:', error.message);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  },

  // Actualizar una orden médica completa
  update: async (req, res) => {
    const { id } = req.params;
    const {
      paciente_id,
      doctor,
      descripcion,
      notas = '',
      servicios = [],
      estado = 'pendiente',
      fecha_orden
    } = req.body;
    const doctorNormalizado = String(doctor || '').trim();
    const descripcionNormalizada = String(descripcion || '').trim();

    if (!paciente_id || !doctorNormalizado || !descripcionNormalizada || !serviciosValidos(servicios)) {
      return res.status(400).json({ error: 'Paciente, médico y orden médica son requeridos' });
    }
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: 'Estado de orden no válido' });
    }

    try {
      if (await sync.disponible()) {
        const actual = await sync.estadoHistoriaDeOrden(id);
        if (actual?.estado === 'cerrada') {
          return res.status(409).json({ error: 'Esta orden pertenece a una historia clínica cerrada y ya no se puede modificar.' });
        }
        if (actual?.historia_id) {
          const mismoPaciente = await pool.query('SELECT 1 FROM ordenes WHERE id = $1 AND paciente_id::text = $2', [id, String(paciente_id)]);
          if (!mismoPaciente.rowCount) {
            return res.status(409).json({ error: 'La orden está ligada a la historia clínica de su paciente; no se puede pasar a otro paciente. Cree una orden nueva.' });
          }
        }
      }
      const result = await pool.query(
        `UPDATE ordenes
         SET paciente_id = $1, tipo = $2, doctor = $3, descripcion = $4,
             notas = $5, servicios = $6::jsonb, estado = $7,
             fecha_orden = COALESCE($8::date, fecha_orden), updated_at = NOW()
         WHERE id = $9
         RETURNING *`,
        [paciente_id, 'medica', doctorNormalizado, descripcionNormalizada, notas, JSON.stringify(servicios), estado, fecha_orden || null, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }
      res.json({ orden: result.rows[0] });
    } catch (error) {
      console.error('❌ Error update orden:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // Actualizar estado de orden
  updateEstado: async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: 'Estado de orden no válido' });
    }

    try {
      await sync.exigirOrdenEditable(id);
      const result = await pool.query(
        'UPDATE ordenes SET estado = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [estado, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }
      console.log(`✅ Orden actualizada: ${id} - Estado: ${estado}`);
      res.json(result.rows[0]);
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      console.error('❌ Error updateEstado:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  // Eliminar orden
  delete: async (req, res) => {
    const { id } = req.params;
    try {
      if (!(await sync.esAdmin(req))) {
        await sync.exigirOrdenEditable(id, 'Esta orden pertenece a una historia clínica cerrada; solo el administrador puede eliminarla.');
      }
      const result = await pool.query(
        'DELETE FROM ordenes WHERE id = $1 RETURNING *',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }
      console.log(`✅ Orden eliminada: ${id}`);
      res.json({ message: 'Orden eliminada' });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      console.error('❌ Error delete:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = ordenesController;
