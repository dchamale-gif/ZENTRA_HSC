const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/connection');

// REGISTRO: Crear nuevo usuario
const register = async (req, res) => {
  try {
    const { email, password, nombre, apellido, telefono } = req.body;

    // Validar campos requeridos
    if (!email || !password || !nombre || !apellido) {
      return res.status(400).json({ error: 'Campos requeridos: email, password, nombre, apellido' });
    }

    // Verificar si email ya existe
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    // Hash de contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar usuario
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, nombre, apellido, telefono, activo, ultimo_login, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW(), NOW())
       RETURNING id, email, nombre, apellido, telefono`,
      [email, hashedPassword, nombre, apellido, telefono || null]
    );

    const user = result.rows[0];

    // Asignar rol por defecto: recepcionista
    await pool.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, (SELECT id FROM roles WHERE nombre = $2))',
      [user.id, 'recepcionista']
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido
      }
    });
  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({ error: 'Error registrando usuario' });
  }
};

// LOGIN: Autenticar usuario
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password son requeridos' });
    }

    // Buscar usuario
    const result = await pool.query(
      'SELECT id, email, password_hash, nombre, apellido, activo FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];

    if (!user.activo) {
      return res.status(401).json({ error: 'Usuario inactivo' });
    }

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Obtener roles y permisos
    const rolesResult = await pool.query(
      `SELECT r.nombre FROM roles r
       JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [user.id]
    );

    const permissionsResult = await pool.query(
      `SELECT p.nombre FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = $1
       GROUP BY p.nombre`,
      [user.id]
    );

    const roles = rolesResult.rows.map(r => r.nombre);
    const permissions = permissionsResult.rows.map(p => p.nombre);

    // Generar JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        roles: roles,
        permissions: permissions
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '7d' }
    );

    // Actualizar último login
    await pool.query(
      'UPDATE users SET ultimo_login = NOW() WHERE id = $1',
      [user.id]
    );

    res.status(200).json({
      message: 'Login exitoso',
      token: token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        roles: roles,
        permissions: permissions
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en login' });
  }
};

// LOGOUT: Simplemente notificar (el token se invalida en el frontend)
const logout = (req, res) => {
  try {
    // En una implementación más robusta, podrías blacklistar el token
    res.status(200).json({ message: 'Logout exitoso' });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ error: 'Error en logout' });
  }
};

// PERFIL: Obtener datos del usuario actual
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT id, email, nombre, apellido, telefono, activo, ultimo_login FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.status(200).json({
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error en getProfile:', error);
    res.status(500).json({ error: 'Error obteniendo perfil' });
  }
};

module.exports = {
  register,
  login,
  logout,
  getProfile
};
