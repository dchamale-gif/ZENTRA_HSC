const pool = require('../db/connection');

// ==========================================
// MEDICINAS CONTROLLER
// ==========================================

/**
 * GET /api/medicinas
 * Listar todas las medicinas
 */
const getMedicinas = async (req, res) => {
  try {
    const { activo = true, categoria, seccion } = req.query;
    
    let query = 'SELECT * FROM medicinas WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // Filtrar por estado
    if (activo !== undefined) {
      query += ` AND activo = $${paramIndex}`;
      params.push(activo === 'true' || activo === true);
      paramIndex++;
    }

    // Filtrar por categoría (si existe la columna)
    if (categoria) {
      query += ` AND categoria = $${paramIndex}`;
      params.push(categoria);
      paramIndex++;
    }

    // Ordenar por nombre
    query += ' ORDER BY nombre ASC';

    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      total: result.rows.length,
      medicinas: result.rows
    });
  } catch (error) {
    console.error('Error en getMedicinas:', error);
    res.status(500).json({ error: 'Error obteniendo medicinas' });
  }
};

/**
 * GET /api/medicinas/:id
 * Obtener una medicina específica
 */
const getMedicinaById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM medicinas WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medicina no encontrada' });
    }

    res.status(200).json({
      success: true,
      medicina: result.rows[0]
    });
  } catch (error) {
    console.error('Error en getMedicinaById:', error);
    res.status(500).json({ error: 'Error obteniendo medicina' });
  }
};

/**
 * POST /api/medicinas
 * Crear nueva medicina
 */
const createMedicina = async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      codigo_interno,
      codigo_externo,
      presentacion,
      concentracion,
      precio,
      stock,
      stock_minimo,
      proveedor_id,
      vencimiento,
      categoria,
      activo = true
    } = req.body;

    // Validar campos requeridos
    if (!nombre || !codigo_interno) {
      return res.status(400).json({ 
        error: 'Nombre y código interno son requeridos' 
      });
    }

    // Generar ID
    const id = `MED-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const result = await pool.query(
      `INSERT INTO medicinas 
       (id, nombre, descripcion, codigo_interno, codigo_externo, presentacion, 
        concentracion, precio, stock, stock_minimo, proveedor_id, vencimiento, 
        categoria, activo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
       RETURNING *`,
      [
        id, nombre, descripcion, codigo_interno, codigo_externo, presentacion,
        concentracion || null, precio || 0, stock || 0, stock_minimo || 0,
        proveedor_id || null, vencimiento || null, categoria || null, activo
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Medicina creada exitosamente',
      medicina: result.rows[0]
    });
  } catch (error) {
    console.error('Error en createMedicina:', error);
    res.status(500).json({ error: 'Error creando medicina' });
  }
};

/**
 * PUT /api/medicinas/:id
 * Actualizar medicina
 */
const updateMedicina = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      descripcion,
      codigo_interno,
      codigo_externo,
      presentacion,
      concentracion,
      precio,
      stock,
      stock_minimo,
      proveedor_id,
      vencimiento,
      categoria,
      activo
    } = req.body;

    // Verificar que existe
    const existing = await pool.query(
      'SELECT id FROM medicinas WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Medicina no encontrada' });
    }

    // Construir query dinámicamente
    let query = 'UPDATE medicinas SET ';
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (nombre !== undefined) {
      updates.push(`nombre = $${paramIndex}`);
      values.push(nombre);
      paramIndex++;
    }
    if (descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex}`);
      values.push(descripcion);
      paramIndex++;
    }
    if (codigo_interno !== undefined) {
      updates.push(`codigo_interno = $${paramIndex}`);
      values.push(codigo_interno);
      paramIndex++;
    }
    if (codigo_externo !== undefined) {
      updates.push(`codigo_externo = $${paramIndex}`);
      values.push(codigo_externo);
      paramIndex++;
    }
    if (presentacion !== undefined) {
      updates.push(`presentacion = $${paramIndex}`);
      values.push(presentacion);
      paramIndex++;
    }
    if (concentracion !== undefined) {
      updates.push(`concentracion = $${paramIndex}`);
      values.push(concentracion);
      paramIndex++;
    }
    if (precio !== undefined) {
      updates.push(`precio = $${paramIndex}`);
      values.push(precio);
      paramIndex++;
    }
    if (stock !== undefined) {
      updates.push(`stock = $${paramIndex}`);
      values.push(stock);
      paramIndex++;
    }
    if (stock_minimo !== undefined) {
      updates.push(`stock_minimo = $${paramIndex}`);
      values.push(stock_minimo);
      paramIndex++;
    }
    if (proveedor_id !== undefined) {
      updates.push(`proveedor_id = $${paramIndex}`);
      values.push(proveedor_id);
      paramIndex++;
    }
    if (vencimiento !== undefined) {
      updates.push(`vencimiento = $${paramIndex}`);
      values.push(vencimiento);
      paramIndex++;
    }
    if (categoria !== undefined) {
      updates.push(`categoria = $${paramIndex}`);
      values.push(categoria);
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

    const result = await pool.query(query, values);

    const updated = await pool.query(
      'SELECT * FROM medicinas WHERE id = $1',
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Medicina actualizada exitosamente',
      medicina: updated.rows[0]
    });
  } catch (error) {
    console.error('Error en updateMedicina:', error);
    res.status(500).json({ error: 'Error actualizando medicina' });
  }
};

/**
 * DELETE /api/medicinas/:id
 * Eliminar medicina (soft delete - marcar como inactiva)
 */
const deleteMedicina = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query(
      'SELECT id FROM medicinas WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Medicina no encontrada' });
    }

    // Soft delete - marcar como inactiva
    await pool.query(
      'UPDATE medicinas SET activo = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Medicina eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteMedicina:', error);
    res.status(500).json({ error: 'Error eliminando medicina' });
  }
};

/**
 * GET /api/medicinas/stock/bajo
 * Obtener medicinas con stock bajo
 */
const getMedicinasStockBajo = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM medicinas 
       WHERE activo = true AND stock <= stock_minimo
       ORDER BY stock ASC`
    );

    res.status(200).json({
      success: true,
      total: result.rows.length,
      medicinas: result.rows
    });
  } catch (error) {
    console.error('Error en getMedicinasStockBajo:', error);
    res.status(500).json({ error: 'Error obteniendo medicinas' });
  }
};

/**
 * PUT /api/medicinas/:id/stock
 * Actualizar stock de una medicina
 */
const actualizarStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad, tipo = 'suma' } = req.body; // tipo: suma o resta

    if (cantidad === undefined || cantidad === null) {
      return res.status(400).json({ error: 'Cantidad es requerida' });
    }

    const existing = await pool.query(
      'SELECT stock FROM medicinas WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Medicina no encontrada' });
    }

    const stockActual = existing.rows[0].stock;
    let nuevoStock = stockActual;

    if (tipo === 'suma') {
      nuevoStock = stockActual + cantidad;
    } else if (tipo === 'resta') {
      nuevoStock = stockActual - cantidad;
      if (nuevoStock < 0) {
        return res.status(400).json({ error: 'Stock insuficiente' });
      }
    }

    const result = await pool.query(
      'UPDATE medicinas SET stock = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [nuevoStock, id]
    );

    res.status(200).json({
      success: true,
      message: 'Stock actualizado exitosamente',
      medicina: result.rows[0],
      stockAnterior: stockActual,
      stockNuevo: nuevoStock
    });
  } catch (error) {
    console.error('Error en actualizarStock:', error);
    res.status(500).json({ error: 'Error actualizando stock' });
  }
};

module.exports = {
  getMedicinas,
  getMedicinaById,
  createMedicina,
  updateMedicina,
  deleteMedicina,
  getMedicinasStockBajo,
  actualizarStock
};
