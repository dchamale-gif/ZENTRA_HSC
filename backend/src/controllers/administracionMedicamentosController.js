const pool = require('../db/connection');
const sync = require('../services/historiaSincronizada');
const { clavesMedicamentos } = require('../services/controlMedicamentos');

// Control de medicamentos (por paciente y por día). Las dosis salen de los medicamentos que
// enfermería transcribe de cada orden médica (frecuencia y horario); aquí se guardan las dosis
// dadas y se suspende o reanuda un medicamento con su motivo.

const MIGRACION_PENDIENTE = 'Falta preparar la base de datos para el control de medicamentos (npm run migrate:control-medicamentos).';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const responder = (res, contexto, error) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  if (error.code === '42P01' || error.code === '42703') return res.status(503).json({ success: false, message: MIGRACION_PENDIENTE });
  console.error(`Error en ${contexto}:`, error.message);
  res.status(500).json({ success: false, message: 'No se pudo completar la operación. Intente de nuevo.' });
};

const fecha = (valor, nombre = 'Fecha') => {
  const texto = String(valor || '');
  if (!FECHA.test(texto)) throw sync.errorConEstado(`${nombre} no válida`);
  return texto;
};

// La orden, su transcripción y el medicamento indicado por la clave
const medicamentoDeOrden = async (db, ordenId, clave, { bloquear = false } = {}) => {
  const conHistoria = await sync.disponible();
  const result = await db.query(
    `SELECT o.id, o.paciente_id, o.estado, to_char(o.fecha_orden, 'YYYY-MM-DD') AS fecha_orden,
            oe.id AS enfermeria_id, oe.indicaciones
            ${conHistoria ? ', h.estado AS historia_estado' : ''}
     FROM ordenes o
     JOIN ordenes_enfermeria oe ON oe.orden_medica_id = o.id
     ${conHistoria ? 'LEFT JOIN historias_clinicas h ON h.id = o.historia_id' : ''}
     WHERE o.id = $1
     ${bloquear ? 'FOR UPDATE OF oe' : ''}`,
    [ordenId]
  );
  if (!result.rowCount) throw sync.errorConEstado('La orden no existe o aún no está transcrita por enfermería', 404);
  const orden = result.rows[0];
  const medicamento = clavesMedicamentos(orden.indicaciones).find(m => m.clave === clave);
  if (!medicamento) throw sync.errorConEstado('Ese medicamento ya no está en la transcripción de la orden', 404);
  if (orden.historia_estado === 'cerrada') {
    throw sync.errorConEstado('La orden pertenece a una historia clínica cerrada; su control de medicamentos queda en solo lectura.', 409);
  }
  return { orden, medicamento };
};

// GET /api/administracion-medicamentos?desde=&hasta=&paciente_id=
// Medicamentos transcritos de las órdenes que tocan el rango y las dosis dadas en él
const listar = async (req, res) => {
  try {
    const desde = fecha(req.query.desde, 'Fecha inicial');
    const hasta = fecha(req.query.hasta, 'Fecha final');
    if (hasta < desde) throw sync.errorConEstado('La fecha final debe ser posterior a la inicial');
    const pacienteId = String(req.query.paciente_id || '');
    const conHistoria = await sync.disponible();

    const ordenes = await pool.query(
      `SELECT o.id, o.paciente_id, o.doctor, o.estado, left(o.descripcion, 200) AS descripcion,
              to_char(o.fecha_orden, 'YYYY-MM-DD') AS fecha_orden, to_char(o.updated_at, 'YYYY-MM-DD') AS fecha_estado,
              oe.indicaciones, to_char(oe.updated_at, 'YYYY-MM-DD') AS fecha_transcripcion,
              CONCAT_WS(' ', p.nombre, p.apellido_paterno, p.apellido_materno) AS paciente_nombre
              ${conHistoria ? ", h.estado AS historia_estado, to_char(COALESCE(h.cerrada_en, h.updated_at), 'YYYY-MM-DD') AS fecha_cierre" : ''}
       FROM ordenes o
       JOIN ordenes_enfermeria oe ON oe.orden_medica_id = o.id
       JOIN pacientes p ON p.id = o.paciente_id
       ${conHistoria ? 'LEFT JOIN historias_clinicas h ON h.id = o.historia_id' : ''}
       WHERE o.tipo = 'medica' AND o.fecha_orden::date <= $2::date
         AND ($3 = '' OR o.paciente_id::text = $3)
         AND (o.estado = 'pendiente' OR o.updated_at::date >= $1::date
              OR EXISTS (SELECT 1 FROM administracion_medicamentos a
                         WHERE a.orden_medica_id = o.id AND a.fecha BETWEEN $1::date AND $2::date))
       ORDER BY paciente_nombre, o.fecha_orden, o.id`,
      [desde, hasta, pacienteId]
    );

    const medicamentos = ordenes.rows.flatMap(o => clavesMedicamentos(o.indicaciones).map(({ clave, item }) => ({
      orden_medica_id: o.id,
      paciente_id: o.paciente_id,
      paciente_nombre: o.paciente_nombre,
      doctor: o.doctor,
      orden_estado: o.estado,
      orden_descripcion: o.descripcion,
      historia_estado: o.historia_estado || null,
      fecha_orden: o.fecha_orden,
      // Último día con dosis: al cerrarse/completarse la orden, o cuando la indicación quedó cumplida
      fecha_fin: o.historia_estado === 'cerrada' ? o.fecha_cierre
        : o.estado !== 'pendiente' ? o.fecha_estado
          : item.estado === 'cumplida' ? o.fecha_transcripcion : null,
      fecha_transcripcion: o.fecha_transcripcion,
      clave,
      nombre: item.catalogo?.nombre || item.descripcion,
      detalle: item.catalogo?.detalle || '',
      dosis: item.dosis || '',
      via: item.via || '',
      frecuencia: item.frecuencia || '',
      horario: item.horario || '',
      estado: item.estado || 'pendiente',
      suspension: item.suspension || null
    })));

    const registros = await pool.query(
      `SELECT orden_medica_id, medicina_clave, to_char(fecha, 'YYYY-MM-DD') AS fecha, aplicacion, hora,
              registrado_por_id, registrado_por_nombre, registrado_en
       FROM administracion_medicamentos
       WHERE fecha BETWEEN $1::date AND $2::date AND ($3 = '' OR paciente_id::text = $3)`,
      [desde, hasta, pacienteId]
    );

    res.json({ success: true, data: { medicamentos, registros: registros.rows } });
  } catch (error) {
    responder(res, 'listar control de medicamentos', error);
  }
};

// PUT /api/administracion-medicamentos/dosis { orden_medica_id, medicina_clave, fecha, aplicacion, hora?, dado }
const marcarDosis = async (req, res) => {
  try {
    const ordenId = Number(req.body.orden_medica_id);
    const clave = String(req.body.medicina_clave || '');
    const dia = fecha(req.body.fecha);
    const aplicacion = Number(req.body.aplicacion);
    if (!Number.isInteger(ordenId) || !clave) throw sync.errorConEstado('Indique la orden y el medicamento');
    if (!Number.isInteger(aplicacion) || aplicacion < 1 || aplicacion > 48) throw sync.errorConEstado('Aplicación no válida');
    const hora = /^\d{2}:\d{2}$/.test(String(req.body.hora || '')) ? req.body.hora : null;

    const { orden, medicamento } = await medicamentoDeOrden(pool, ordenId, clave);
    if (dia < orden.fecha_orden) throw sync.errorConEstado('La dosis es anterior a la orden médica');

    if (req.body.dado) {
      if (dia > new Date(Date.now() + 86400000).toISOString().slice(0, 10)) {
        throw sync.errorConEstado('No se puede marcar como dada una dosis de un día futuro');
      }
      const susp = medicamento.item.suspension;
      if (susp && (dia > susp.desde || (dia === susp.desde && aplicacion >= Number(susp.aplicacion || 1)))) {
        throw sync.errorConEstado('El medicamento está suspendido desde esa dosis; reanúdelo para marcarla', 409);
      }
      await pool.query(
        `INSERT INTO administracion_medicamentos
           (orden_medica_id, paciente_id, medicina_clave, medicina_nombre, fecha, aplicacion, hora, registrado_por_id, registrado_por_nombre)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (orden_medica_id, medicina_clave, fecha, aplicacion) DO NOTHING`,
        [ordenId, orden.paciente_id, clave, medicamento.item.catalogo?.nombre || medicamento.item.descripcion,
          dia, aplicacion, hora, req.user.id, sync.nombreUsuario(req)]
      );
      return res.json({ success: true, message: 'Dosis registrada como dada' });
    }

    // Desmarcar: quien la registró o el admin
    const actual = await pool.query(
      `SELECT id, registrado_por_id FROM administracion_medicamentos
       WHERE orden_medica_id = $1 AND medicina_clave = $2 AND fecha = $3 AND aplicacion = $4`,
      [ordenId, clave, dia, aplicacion]
    );
    if (!actual.rowCount) return res.json({ success: true, message: 'La dosis no estaba registrada' });
    if (Number(actual.rows[0].registrado_por_id) !== Number(req.user.id) && !(await sync.esAdmin(req))) {
      throw sync.errorConEstado('Solo quien registró la dosis (o un administrador) puede desmarcarla', 403);
    }
    await pool.query('DELETE FROM administracion_medicamentos WHERE id = $1', [actual.rows[0].id]);
    res.json({ success: true, message: 'Dosis desmarcada' });
  } catch (error) {
    responder(res, 'registrar dosis', error);
  }
};

// Cambia el estado del medicamento dentro de la transcripción (así lo ven también Medicamentos y Prescripciones)
const cambiarSuspension = async (req, res, suspender) => {
  const client = await pool.connect();
  try {
    const ordenId = Number(req.body.orden_medica_id);
    const clave = String(req.body.medicina_clave || '');
    if (!Number.isInteger(ordenId) || !clave) throw sync.errorConEstado('Indique la orden y el medicamento');
    let suspension = null;
    if (suspender) {
      const motivo = String(req.body.motivo || '').trim();
      if (motivo.length < 3) throw sync.errorConEstado('Escriba el motivo de la suspensión');
      const aplicacion = Number(req.body.aplicacion) || 1;
      suspension = {
        desde: fecha(req.body.desde),
        aplicacion,
        motivo: motivo.slice(0, 500),
        usuario: sync.nombreUsuario(req),
        registrado: new Date().toISOString()
      };
    }

    await client.query('BEGIN');
    const { orden, medicamento } = await medicamentoDeOrden(client, ordenId, clave, { bloquear: true });
    const indicaciones = [...orden.indicaciones];
    const item = { ...indicaciones[medicamento.indice] };
    if (suspender) {
      Object.assign(item, { estado: 'suspendida', suspension });
    } else {
      item.estado = 'pendiente';
      delete item.suspension;
    }
    indicaciones[medicamento.indice] = item;
    await client.query(
      `UPDATE ordenes_enfermeria SET indicaciones = $2::jsonb, actualizado_por_nombre = $3, updated_at = NOW() WHERE id = $1`,
      [orden.enfermeria_id, JSON.stringify(indicaciones), sync.nombreUsuario(req)]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: suspender ? 'Medicamento suspendido' : 'Medicamento reanudado', data: { paciente_id: orden.paciente_id } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    responder(res, suspender ? 'suspender medicamento' : 'reanudar medicamento', error);
  } finally {
    client.release();
  }
};

// POST /api/administracion-medicamentos/suspension { orden_medica_id, medicina_clave, desde, aplicacion, motivo }
const suspender = (req, res) => cambiarSuspension(req, res, true);
// DELETE /api/administracion-medicamentos/suspension { orden_medica_id, medicina_clave }
const reanudar = (req, res) => cambiarSuspension(req, res, false);

module.exports = { listar, marcarDosis, suspender, reanudar };
