const jwt = require('jsonwebtoken');
const pool = require('../db/connection');

// Middleware: Verificar JWT Token
const authMiddleware = async (req, res, next) => {
  // Ya autenticado en un middleware anterior (p. ej. al montar la ruta)
  if (req.user) return next();

  try {
    const token = req.headers.authorization?.split(' ')[1]; // "Bearer TOKEN"

    if (!token) {
      console.log('❌ Sin token');
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verificado:', decoded);
    
    // Obtener usuario de la BD para verificar que siga activo
    const result = await pool.query(
      'SELECT id, email, nombre, apellido, activo FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows[0]) {
      console.log('❌ Usuario no encontrado:', decoded.userId);
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    
    if (!result.rows[0].activo) {
      console.log('❌ Usuario inactivo:', decoded.userId);
      return res.status(401).json({ error: 'Usuario inactivo' });
    }

    console.log('✅ Usuario autenticado:', result.rows[0].email);
    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('❌ Error en authMiddleware:', error.message);
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

// Roles y permisos del usuario (se cargan una vez por request)
const cargarPermisos = async (req) => {
  if (req.userPermissions && req.userRoles) return;

  const [rolesResult, permissionsResult] = await Promise.all([
    pool.query(
      `SELECT r.nombre FROM roles r
       JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [req.user.id]
    ),
    pool.query(
      `SELECT DISTINCT p.nombre FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [req.user.id]
    )
  ]);

  req.userRoles = rolesResult.rows.map(r => r.nombre);
  req.userPermissions = permissionsResult.rows.map(p => p.nombre);
};

const esAdmin = (req) => req.userRoles?.includes('admin');

const METODOS_LECTURA = ['GET', 'HEAD', 'OPTIONS'];

// Middleware: exige permiso sobre un módulo según el método HTTP.
// GET -> <modulo>_view ; POST/PUT/PATCH/DELETE -> <modulo>_edit
// `regla` puede ser:
//   - 'modulo'                         -> ver y editar con ese módulo
//   - { ver: [...], editar: [...] }    -> basta con tener permiso en uno de la lista
//   - (req) => regla                   -> para rutas que mezclan módulos
const normalizarRegla = (regla) => {
  if (typeof regla === 'string') return { ver: [regla], editar: [regla] };
  return { ver: regla.ver || [], editar: regla.editar || [] };
};

const requireModule = (regla) => {
  return async (req, res, next) => {
    try {
      await cargarPermisos(req);
      if (esAdmin(req)) return next();

      const { ver, editar } = normalizarRegla(typeof regla === 'function' ? regla(req) : regla);
      const accion = METODOS_LECTURA.includes(req.method) ? 'view' : 'edit';
      const permitidos = (accion === 'view' ? ver : editar).map(m => `${m}_${accion}`);

      if (!permitidos.some(p => req.userPermissions.includes(p))) {
        return res.status(403).json({
          success: false,
          error: 'Permiso denegado',
          message: accion === 'view'
            ? 'No tiene permiso para ver este módulo'
            : 'No tiene permiso para modificar este módulo',
          required: permitidos
        });
      }

      next();
    } catch (error) {
      console.error('Error en requireModule:', error);
      res.status(500).json({ success: false, error: 'Error verificando permisos' });
    }
  };
};

// Middleware: exige uno de los roles indicados (admin siempre pasa)
const requireRole = (...roles) => {
  return async (req, res, next) => {
    try {
      await cargarPermisos(req);
      if (esAdmin(req) || roles.some(r => req.userRoles.includes(r))) return next();
      return res.status(403).json({ success: false, error: 'Permiso denegado', message: 'Acceso restringido' });
    } catch (error) {
      console.error('Error en requireRole:', error);
      res.status(500).json({ success: false, error: 'Error verificando permisos' });
    }
  };
};

module.exports = {
  authMiddleware,
  rolePermissionMiddleware,
  requireModule,
  requireRole,
  cargarPermisos
};
