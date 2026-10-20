const pool = require('../db/connection');

// Una orden de enfermería traduce una orden médica en indicaciones concretas
const TIPOS = ['medicamento', 'procedimiento', 'cuidado', 'control_signos', 'dieta', 'laboratorio', 'otro'];
const ESTADOS = ['pendiente', 'cumplida', 'suspendida'];
const MAX_INDICACIONES = 50;
const CAMPOS_CORTOS = ['dosis', 'via', 'frecuencia', 'horario'];

// Huella del contenido clínico de la orden médica (no cambia si solo cambia su estado)
const FIRMA_ORDEN = "md5(COALESCE(o.descripcion, '') || '|' || COALESCE(o.notas, '') || '|' || COALESCE(o.servicios::text, ''))";

const responderError = (res, contexto, error) => {
  if (error.code === '42P01') {
    return res.status(503).json({
      success: false,
      message: 'Falta preparar la base de datos para órdenes de enfermería (npm run migrate:ordenes-enfermeria).'
    });
  }
  console.error(`Error en ${contexto}:`, error.message);
  res.status(500).json({ success: false, message: 'No se pudo completar la operación. Intente de nuevo.' });
};

const validarIndicaciones = (indicaciones) => {
  if (!Array.isArray(indicaciones) || indicaciones.length === 0) {
    return { error: 'Agregue al menos una indicación' };
  }
  if (indicaciones.length > MAX_INDICACIONES) {
    return { error: `Puede registrar hasta ${MAX_INDICACIONES} indicaciones por orden` };
  }

  const limpias = [];
  for (const [i, item] of indicaciones.entries()) {
    const descripcion = String(item?.descripcion || '').trim();
    if (!descripcion) return { error: `Escriba la indicación ${i + 1}` };
    if (descripcion.length > 500) return { error: `La indicación ${i + 1} puede tener hasta 500 caracteres` };

    const tipo = TIPOS.includes(item.tipo) ? item.tipo : 'otro';
    const estado = ESTADOS.includes(item.estado) ? item.estado : 'pendiente';
    const limpia = { tipo, descripcion, estado };
    for (const campo of CAMPOS_CORTOS) {
      limpia[campo] = String(item[campo] || '').trim().slice(0, 100);
    }
    limpias.push(limpia);
  }
  return { indicaciones: limpias };
};

// GET /api/ordenes-enfermeria - Órdenes médicas con su traducción de enfermería (si existe)
const listar = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.paciente_id, o.doctor, o.descripcion, o.notas, o.servicios, o.estado,
              o.fecha_orden, o.created_at,
              p.nombre AS paciente_nombre, p.apellido_paterno AS paciente_apellido_paterno,
              p.apellido_materno AS paciente_apellido_materno, p.dpi AS paciente_dpi,
              oe.id AS enfermeria_id, oe.indicaciones, oe.observaciones,
              oe.creado_por_nombre, oe.actualizado_por_nombre, oe.updated_at AS enfermeria_actualizada,
              (oe.id IS NOT NULL AND oe.orden_medica_firma IS DISTINCT FROM ${FIRMA_ORDEN}) AS orden_cambio
       FROM ordenes o
       JOIN pacientes p ON p.id = o.paciente_id
       LEFT JOIN ordenes_enfermeria oe ON oe.orden_medica_id = o.id
       WHERE o.tipo = 'medica'
       ORDER BY o.fecha_orden DESC, o.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    responderError(res, 'listar órdenes de enfermería', error);
  }
};

// PUT /api/ordenes-enfermeria/:ordenMedicaId { indicaciones, observaciones } - Crea o reemplaza
const guardar = async (req, res) => {
  const ordenMedicaId = Number(req.params.ordenMedicaId);
  if (!Number.isInteger(ordenMedicaId)) {
    return res.status(400).json({ success: false, message: 'Orden médica no válida' });
  }

  const { indicaciones, error } = validarIndicaciones(req.body.indicaciones);
  if (error) return res.status(400).json({ success: false, message: error });

  const observaciones = String(req.body.observaciones || '').trim();
  if (observaciones.length > 2000) {
    return res.status(400).json({ success: false, message: 'Las observaciones pueden tener hasta 2000 caracteres' });
  }

  const autor = `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email;

  try {
    const result = await pool.query(
      `INSERT INTO ordenes_enfermeria
         (orden_medica_id, indicaciones, observaciones, orden_medica_firma,
          creado_por, creado_por_nombre, actualizado_por_nombre)
       SELECT o.id, $2::jsonb, $3, ${FIRMA_ORDEN}, $4, $5, $5
       FROM ordenes o
       WHERE o.id = $1 AND o.tipo = 'medica'
       ON CONFLICT (orden_medica_id) DO UPDATE SET
         indicaciones = EXCLUDED.indicaciones,
         observaciones = EXCLUDED.observaciones,
         orden_medica_firma = EXCLUDED.orden_medica_firma,
         actualizado_por_nombre = EXCLUDED.actualizado_por_nombre,
         updated_at = NOW()
       RETURNING id, orden_medica_id, indicaciones, observaciones, creado_por_nombre,
                 actualizado_por_nombre, updated_at AS enfermeria_actualizada`,
      [ordenMedicaId, JSON.stringify(indicaciones), observaciones, req.user.id, autor]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'La orden médica ya no existe' });
    }
    res.json({ success: true, message: 'Orden de enfermería guardada', data: result.rows[0] });
  } catch (error) {
    responderError(res, 'guardar orden de enfermería', error);
  }
};

// DELETE /api/ordenes-enfermeria/:ordenMedicaId
const eliminar = async (req, res) => {
  const ordenMedicaId = Number(req.params.ordenMedicaId);
  if (!Number.isInteger(ordenMedicaId)) {
    return res.status(400).json({ success: false, message: 'Orden médica no válida' });
  }
  try {
    const result = await pool.query('DELETE FROM ordenes_enfermeria WHERE orden_medica_id = $1', [ordenMedicaId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Esta orden aún no tiene indicaciones de enfermería' });
    }
    res.json({ success: true, message: 'Orden de enfermería eliminada' });
  } catch (error) {
    responderError(res, 'eliminar orden de enfermería', error);
  }
};

module.exports = { listar, guardar, eliminar };
