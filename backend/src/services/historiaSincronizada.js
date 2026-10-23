const pool = require('../db/connection');
const { cargarPermisos } = require('../middleware/auth');

// Reglas que unen órdenes médicas y notas de enfermería con la historia clínica:
// - Una orden nueva se liga a la historia abierta del paciente (el médico la abre si no hay).
// - Lo que pertenece a una historia cerrada queda en solo lectura.
// Si la base aún no tiene la migración (npm run migrate:sincronizacion-historia),
// todo sigue funcionando como antes, sin ligar.

let disponibleCache = { valor: false, hasta: 0 };

const disponible = async () => {
  if (Date.now() < disponibleCache.hasta) return disponibleCache.valor;
  const result = await pool.query(
    `SELECT to_regclass('public.notas_enfermeria') IS NOT NULL
        AND EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'ordenes' AND column_name = 'historia_id') AS listo`
  );
  const valor = result.rows[0].listo;
  // Una vez lista no cambia; si falta, se vuelve a revisar al minuto
  disponibleCache = { valor, hasta: valor ? Infinity : Date.now() + 60000 };
  return valor;
};

const errorConEstado = (message, status = 400, extra = {}) => Object.assign(new Error(message), { status, ...extra });

const nombreUsuario = (req) => `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email;

const esAdmin = async (req) => {
  await cargarPermisos(req);
  return req.userRoles.includes('admin');
};

// Historia a la que se liga una orden nueva: la abierta; si no hay y quien ordena es médico, se abre una del día
const historiaParaOrden = async (req, pacienteId, db = pool) => {
  const abierta = await db.query(
    "SELECT id FROM historias_clinicas WHERE paciente_id = $1 AND estado = 'abierta'",
    [pacienteId]
  );
  if (abierta.rowCount) return { id: abierta.rows[0].id, creada: false };

  await cargarPermisos(req);
  const puedeAbrir = req.userRoles.includes('admin') || req.userPermissions.includes('historia_clinica_cierre_edit');
  if (!puedeAbrir) {
    throw errorConEstado('El paciente no tiene una historia clínica abierta. El médico debe abrirla antes de dar órdenes.', 409);
  }
  const autor = nombreUsuario(req);
  const nueva = await db.query(
    `INSERT INTO historias_clinicas (paciente_id, tipo, medico_id, medico_nombre, actualizado_por_nombre)
     VALUES ($1, 'consulta', $2, $3, $3) RETURNING id`,
    [pacienteId, req.user.id, autor]
  );
  return { id: nueva.rows[0].id, creada: true };
};

// Estado de la historia a la que pertenece una orden ('abierta', 'cerrada' o null si no está ligada)
const estadoHistoriaDeOrden = async (ordenId) => {
  const result = await pool.query(
    `SELECT o.historia_id, h.estado FROM ordenes o
     LEFT JOIN historias_clinicas h ON h.id = o.historia_id
     WHERE o.id = $1`,
    [ordenId]
  );
  return result.rows[0] || null;
};

// Lanza 409 si la orden pertenece a una historia cerrada
const exigirOrdenEditable = async (ordenId, mensaje = 'Esta orden pertenece a una historia clínica cerrada y ya no se puede modificar.') => {
  if (!(await disponible())) return;
  const orden = await estadoHistoriaDeOrden(ordenId);
  if (orden?.estado === 'cerrada') throw errorConEstado(mensaje, 409);
};

module.exports = { disponible, historiaParaOrden, estadoHistoriaDeOrden, exigirOrdenEditable, esAdmin, nombreUsuario, errorConEstado };
