const bcrypt = require('bcryptjs');
const pool = require('../db/connection');

const ROLES_CON_USUARIOS = `
  COALESCE(
    (SELECT json_agg(r.nombre ORDER BY r.nombre)
     FROM user_roles ur JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = u.id),
    '[]'::json
  ) AS roles`;

// Reemplaza los roles de un usuario dentro de una transacción
const asignarRoles = async (client, userId, roles) => {
  await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  if (roles.length === 0) return;

  const result = await client.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE nombre = ANY($2::text[])
     RETURNING role_id`,
    [userId, roles]
  );
  if (result.rowCount !== roles.length) {
    const error = new Error('Uno o más roles no existen');
    error.status = 400;
    throw error;
  }
};

// Evita que el sistema se quede sin ningún administrador activo
const quedaAlgunAdmin = async (client, excluirUserId) => {
  const result = await client.query(
    `SELECT 1 FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE r.nombre = 'admin' AND u.activo = true AND u.id <> $1
     LIMIT 1`,
    [excluirUserId]
  );
  return result.rowCount > 0;
};

// GET /api/usuarios/roles - Roles disponibles con sus permisos
const getRoles = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.nombre, r.descripcion,
              COALESCE(json_agg(p.nombre ORDER BY p.nombre) FILTER (WHERE p.id IS NOT NULL), '[]'::json) AS permisos
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       GROUP BY r.id
       ORDER BY r.id`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error en getRoles:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo roles' });
  }
};

// GET /api/usuarios - Lista de usuarios con sus roles
const getUsuarios = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.nombre, u.apellido, u.telefono, u.activo, u.ultimo_login, ${ROLES_CON_USUARIOS}
       FROM users u
       ORDER BY u.activo DESC, u.nombre, u.apellido`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error en getUsuarios:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo usuarios' });
  }
};

// POST /api/usuarios - Crear usuario con roles
const createUsuario = async (req, res) => {
  const { email, password, nombre, apellido, telefono, roles = [] } = req.body;

  if (!email || !password || !nombre) {
    return res.status(400).json({ success: false, message: 'Email, contraseña y nombre son requeridos' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
  }
  if (!Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ success: false, message: 'Asigne al menos un rol' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existe = await client.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existe.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'El email ya está registrado' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await client.query(
      `INSERT INTO users (email, password_hash, nombre, apellido, telefono, activo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       RETURNING id`,
      [email.trim().toLowerCase(), hash, nombre, apellido || null, telefono || null]
    );
    await asignarRoles(client, result.rows[0].id, roles);

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { id: result.rows[0].id }, message: 'Usuario creado' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en createUsuario:', error);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Error creando usuario' });
  } finally {
    client.release();
  }
};

// PUT /api/usuarios/:id - Actualizar datos, roles, estado o contraseña
const updateUsuario = async (req, res) => {
  const userId = Number(req.params.id);
  const { nombre, apellido, telefono, activo, roles, password } = req.body;

  if (password !== undefined && password.length < 8) {
    return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
  }
  if (roles !== undefined && (!Array.isArray(roles) || roles.length === 0)) {
    return res.status(400).json({ success: false, message: 'Asigne al menos un rol' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const actual = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (actual.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const quitaAdmin = (roles !== undefined && !roles.includes('admin')) || activo === false;
    if (quitaAdmin && !(await quedaAlgunAdmin(client, userId))) {
      const esAdminActual = await client.query(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1 AND r.nombre = 'admin'`,
        [userId]
      );
      if (esAdminActual.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Debe existir al menos un administrador activo' });
      }
    }

    await client.query(
      `UPDATE users SET
         nombre = COALESCE($2, nombre),
         apellido = COALESCE($3, apellido),
         telefono = COALESCE($4, telefono),
         activo = COALESCE($5, activo),
         updated_at = NOW()
       WHERE id = $1`,
      [userId, nombre ?? null, apellido ?? null, telefono ?? null, typeof activo === 'boolean' ? activo : null]
    );

    if (password !== undefined) {
      const hash = await bcrypt.hash(password, 10);
      await client.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, hash]);
    }

    if (roles !== undefined) {
      await asignarRoles(client, userId, roles);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Usuario actualizado' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en updateUsuario:', error);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Error actualizando usuario' });
  } finally {
    client.release();
  }
};

module.exports = {
  getRoles,
  getUsuarios,
  createUsuario,
  updateUsuario
};
