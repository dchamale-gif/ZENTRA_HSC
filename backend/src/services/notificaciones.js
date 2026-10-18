const pool = require('../db/connection');

// Crea la misma notificación para cada usuario activo que puede ver un módulo
// (por su rol o por ser administrador). Nunca lanza: una notificación fallida
// no debe interrumpir la operación que la originó.
const notificarPorPermiso = async (permiso, { tipo, titulo, mensaje = '', enlace = null }, { excluirUserId } = {}) => {
  try {
    const result = await pool.query(
      `INSERT INTO notificaciones (user_id, tipo, titulo, mensaje, enlace)
       SELECT DISTINCT u.id, $2, $3, $4, $5
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       WHERE u.activo = true
         AND (p.nombre = $1 OR r.nombre = 'admin')
         AND u.id IS DISTINCT FROM $6`,
      [permiso, tipo, titulo, mensaje, enlace, excluirUserId ?? null]
    );
    return result.rowCount;
  } catch (error) {
    console.error(`⚠️  No se pudo crear la notificación "${titulo}":`, error.message);
    return 0;
  }
};

module.exports = { notificarPorPermiso };
