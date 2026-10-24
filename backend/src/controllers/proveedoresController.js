const pool = require('../db/connection');

const { pagosDisponibles } = require('./comprasController');

const PROVIDER_COLUMNS = `
  id, nombre, email, telefono, direccion, ciudad, razon_social,
  nit, contacto, activo, created_at, updated_at
`;

// Cuenta bancaria del proveedor (llega con la migración del pago de compras)
const CUENTA_COLUMNS = ['banco', 'numero_cuenta', 'tipo_cuenta'];
const TIPOS_CUENTA = ['monetaria', 'ahorro'];

const columnasProveedor = async () =>
  (await pagosDisponibles()) ? `${PROVIDER_COLUMNS}, ${CUENTA_COLUMNS.join(', ')}` : PROVIDER_COLUMNS;

// Limpia los datos de la cuenta; devuelve un mensaje de error o null
const validarCuenta = (body) => {
  if (body.tipo_cuenta && !TIPOS_CUENTA.includes(body.tipo_cuenta)) return 'Tipo de cuenta no válido';
  if (body.numero_cuenta && !/^[0-9A-Za-z -]{3,40}$/.test(String(body.numero_cuenta).trim())) {
    return 'El número de cuenta solo puede tener números, letras, espacios o guiones';
  }
  return null;
};

// ==========================================
// PROVEEDORES CONTROLLER
// ==========================================

/**
 * GET /api/proveedores
 * Listar todos los proveedores
 */
const getProveedores = async (req, res) => {
  try {
    const { activo = true } = req.query;
    
    let query = `SELECT ${await columnasProveedor()} FROM proveedores WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    // Filtrar por estado
    if (activo !== undefined) {
      query += ` AND activo = $${paramIndex}`;
      params.push(activo === 'true' || activo === true);
      paramIndex++;
    }

    query += ' ORDER BY nombre ASC';

    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      total: result.rows.length,
      proveedores: result.rows
    });
  } catch (error) {
    console.error('Error en getProveedores:', error);
    res.status(500).json({ error: 'Error obteniendo proveedores' });
  }
};

/**
 * GET /api/proveedores/:id
 * Obtener un proveedor específico
 */
const getProveedorById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT ${await columnasProveedor()} FROM proveedores WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    res.status(200).json({
      success: true,
      proveedor: result.rows[0]
    });
  } catch (error) {
    console.error('Error en getProveedorById:', error);
    res.status(500).json({ error: 'Error obteniendo proveedor' });
  }
};

/**
 * POST /api/proveedores
 * Crear nuevo proveedor
 */
const createProveedor = async (req, res) => {
  try {
    const {
      nombre,
      razon_social,
      nit,
      email,
      telefono,
      direccion,
      ciudad,
      contacto,
      activo = true
    } = req.body;

    if (!nombre?.trim()) {
      return res.status(400).json({
        error: 'Nombre del proveedor es requerido'
      });
    }

    if (nit) {
      const existing = await pool.query(
        'SELECT id FROM proveedores WHERE nit = $1',
        [nit]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'El NIT ya está registrado' });
      }
    }

    const errorCuenta = validarCuenta(req.body);
    if (errorCuenta) return res.status(400).json({ error: errorCuenta });

    const id = `PRV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const result = await pool.query(
      `INSERT INTO proveedores
       (id, nombre, email, telefono, direccion, ciudad, razon_social, nit,
        contacto, activo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING ${PROVIDER_COLUMNS}`,
      [
        id, nombre.trim(), email || null, telefono || null, direccion || null,
        ciudad || null, razon_social || null, nit || null, contacto || null, activo
      ]
    );

    let proveedor = result.rows[0];
    if (await pagosDisponibles()) {
      const cuenta = await pool.query(
        `UPDATE proveedores SET banco = $2, numero_cuenta = $3, tipo_cuenta = $4 WHERE id = $1
         RETURNING ${await columnasProveedor()}`,
        [id, String(req.body.banco || '').trim() || null, String(req.body.numero_cuenta || '').trim() || null, req.body.tipo_cuenta || null]
      );
      proveedor = cuenta.rows[0];
    }

    res.status(201).json({
      success: true,
      message: 'Proveedor creado exitosamente',
      proveedor
    });
  } catch (error) {
    console.error('Error en createProveedor:', error);
    res.status(500).json({ error: 'Error creando proveedor' });
  }
};

/**
 * PUT /api/proveedores/:id
 * Actualizar proveedor
 */
const updateProveedor = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query(
      'SELECT id FROM proveedores WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    if (req.body.nit) {
      const duplicateNit = await pool.query(
        'SELECT id FROM proveedores WHERE nit = $1 AND id != $2',
        [req.body.nit, id]
      );
      if (duplicateNit.rows.length > 0) {
        return res.status(409).json({ error: 'El NIT ya está registrado por otro proveedor' });
      }
    }

    const errorCuenta = validarCuenta(req.body);
    if (errorCuenta) return res.status(400).json({ error: errorCuenta });

    const allowedFields = ['nombre', 'email', 'telefono', 'direccion', 'ciudad',
      'razon_social', 'nit', 'contacto', 'activo',
      ...((await pagosDisponibles()) ? CUENTA_COLUMNS : [])];
    const updates = [];
    const values = [];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${values.length + 1}`);
        values.push(CUENTA_COLUMNS.includes(field) ? String(req.body[field] || '').trim() || null : req.body[field]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    const query = `UPDATE proveedores SET ${updates.join(', ')}, updated_at = NOW()
                   WHERE id = $${values.length + 1}`;
    values.push(id);

    await pool.query(query, values);

    const updated = await pool.query(
      `SELECT ${await columnasProveedor()} FROM proveedores WHERE id = $1`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Proveedor actualizado exitosamente',
      proveedor: updated.rows[0]
    });
  } catch (error) {
    console.error('Error en updateProveedor:', error);
    res.status(500).json({ error: 'Error actualizando proveedor' });
  }
};

/**
 * DELETE /api/proveedores/:id
 * Eliminar proveedor (soft delete)
 */
const deleteProveedor = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query(
      'SELECT id FROM proveedores WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    // Soft delete - marcar como inactivo
    await pool.query(
      'UPDATE proveedores SET activo = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Proveedor eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteProveedor:', error);
    res.status(500).json({ error: 'Error eliminando proveedor' });
  }
};

module.exports = {
  getProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor
};
