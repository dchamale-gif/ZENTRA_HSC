const pool = require('../db/connection');

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
    
    let query = 'SELECT * FROM proveedores WHERE 1=1';
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
      'SELECT * FROM proveedores WHERE id = $1',
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
      ruc,
      email,
      telefono,
      direccion,
      ciudad,
      pais,
      contacto_principal,
      contacto_email,
      contacto_telefono,
      terminos_pago,
      dias_credito,
      precio_promedio,
      activo = true
    } = req.body;

    // Validar campos requeridos
    if (!nombre || !ruc) {
      return res.status(400).json({ 
        error: 'Nombre y RUC son requeridos' 
      });
    }

    // Verificar RUC único
    const existing = await pool.query(
      'SELECT id FROM proveedores WHERE ruc = $1',
      [ruc]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'El RUC ya está registrado' });
    }

    // Generar ID
    const id = `PRV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const result = await pool.query(
      `INSERT INTO proveedores 
       (id, nombre, razon_social, ruc, email, telefono, direccion, ciudad, pais,
        contacto_principal, contacto_email, contacto_telefono, terminos_pago,
        dias_credito, precio_promedio, activo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
       RETURNING *`,
      [
        id, nombre, razon_social || null, ruc, email || null, telefono || null,
        direccion || null, ciudad || null, pais || null, contacto_principal || null,
        contacto_email || null, contacto_telefono || null, terminos_pago || null,
        dias_credito || 0, precio_promedio || 0, activo
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Proveedor creado exitosamente',
      proveedor: result.rows[0]
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
    const {
      nombre,
      razon_social,
      ruc,
      email,
      telefono,
      direccion,
      ciudad,
      pais,
      contacto_principal,
      contacto_email,
      contacto_telefono,
      terminos_pago,
      dias_credito,
      precio_promedio,
      activo
    } = req.body;

    // Verificar que existe
    const existing = await pool.query(
      'SELECT id FROM proveedores WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    // Si se actualiza RUC, verificar que sea único
    if (ruc) {
      const duplicateRuc = await pool.query(
        'SELECT id FROM proveedores WHERE ruc = $1 AND id != $2',
        [ruc, id]
      );
      if (duplicateRuc.rows.length > 0) {
        return res.status(409).json({ error: 'El RUC ya está registrado por otro proveedor' });
      }
    }

    // Construir query dinámicamente
    let query = 'UPDATE proveedores SET ';
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (nombre !== undefined) {
      updates.push(`nombre = $${paramIndex}`);
      values.push(nombre);
      paramIndex++;
    }
    if (razon_social !== undefined) {
      updates.push(`razon_social = $${paramIndex}`);
      values.push(razon_social);
      paramIndex++;
    }
    if (ruc !== undefined) {
      updates.push(`ruc = $${paramIndex}`);
      values.push(ruc);
      paramIndex++;
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      values.push(email);
      paramIndex++;
    }
    if (telefono !== undefined) {
      updates.push(`telefono = $${paramIndex}`);
      values.push(telefono);
      paramIndex++;
    }
    if (direccion !== undefined) {
      updates.push(`direccion = $${paramIndex}`);
      values.push(direccion);
      paramIndex++;
    }
    if (ciudad !== undefined) {
      updates.push(`ciudad = $${paramIndex}`);
      values.push(ciudad);
      paramIndex++;
    }
    if (pais !== undefined) {
      updates.push(`pais = $${paramIndex}`);
      values.push(pais);
      paramIndex++;
    }
    if (contacto_principal !== undefined) {
      updates.push(`contacto_principal = $${paramIndex}`);
      values.push(contacto_principal);
      paramIndex++;
    }
    if (contacto_email !== undefined) {
      updates.push(`contacto_email = $${paramIndex}`);
      values.push(contacto_email);
      paramIndex++;
    }
    if (contacto_telefono !== undefined) {
      updates.push(`contacto_telefono = $${paramIndex}`);
      values.push(contacto_telefono);
      paramIndex++;
    }
    if (terminos_pago !== undefined) {
      updates.push(`terminos_pago = $${paramIndex}`);
      values.push(terminos_pago);
      paramIndex++;
    }
    if (dias_credito !== undefined) {
      updates.push(`dias_credito = $${paramIndex}`);
      values.push(dias_credito);
      paramIndex++;
    }
    if (precio_promedio !== undefined) {
      updates.push(`precio_promedio = $${paramIndex}`);
      values.push(precio_promedio);
      paramIndex++;
    }
    if (activo !== undefined) {
      updates.push(`activo = $${paramIndex}`);
      values.push(activo);
      paramIndex++;
    }

    // Siempre actualizar updated_at
    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) { // Solo updated_at
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    query += updates.join(', ');
    query += ` WHERE id = $${paramIndex}`;
    values.push(id);

    await pool.query(query, values);

    const updated = await pool.query(
      'SELECT * FROM proveedores WHERE id = $1',
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
