const jwt = require('jsonwebtoken');
const pool = require('../db/connection');

// Middleware: Verificar JWT Token
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // "Bearer TOKEN"

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Obtener usuario de la BD para verificar que siga activo
    const result = await pool.query(
      'SELECT id, email, nombre, apellido, activo FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows[0] || !result.rows[0].activo) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Middleware: Verificar Rol y Permisos
const rolePermissionMiddleware = (requiredPermissions = []) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Obtener roles del usuario
      const rolesResult = await pool.query(
        `SELECT r.id, r.nombre FROM roles r
         JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = $1`,
        [userId]
      );

      if (rolesResult.rows.length === 0) {
        return res.status(403).json({ error: 'Usuario sin roles asignados' });
      }

      const userRoles = rolesResult.rows.map(r => r.nombre);

      // Si no hay permisos requeridos, solo verificar que tenga rol
      if (requiredPermissions.length === 0) {
        req.userRoles = userRoles;
        return next();
      }

      // Obtener permisos del usuario
      const permissionsResult = await pool.query(
        `SELECT p.nombre FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         JOIN user_roles ur ON rp.role_id = ur.role_id
         WHERE ur.user_id = $1`,
        [userId]
      );

      const userPermissions = permissionsResult.rows.map(p => p.nombre);

      // Verificar si tiene al menos uno de los permisos requeridos
      const hasPermission = requiredPermissions.some(perm => 
        userPermissions.includes(perm)
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Permiso denegado',
          required: requiredPermissions,
          userPermissions: userPermissions
        });
      }

      req.userRoles = userRoles;
      req.userPermissions = userPermissions;
      next();
    } catch (error) {
      console.error('Error en rolePermissionMiddleware:', error);
      res.status(500).json({ error: 'Error verificando permisos' });
    }
  };
};

module.exports = {
  authMiddleware,
  rolePermissionMiddleware
};
