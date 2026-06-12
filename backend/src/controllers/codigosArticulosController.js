const pool = require('../db/connection');

// ==========================================
// CODIGOS ARTICULOS CONTROLLER
// ==========================================

/**
 * GET /api/codigos-articulos
 * Listar todos los artículos
 */
const getArticulos = async (req, res) => {
  try {
    const { categoria, familia, activo = true, search } = req.query;
    
    let query = 'SELECT * FROM codigos_articulos WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // Filtrar por estado
    if (activo !== undefined && activo !== 'false') {
      query += ` AND activo = $${paramIndex}`;
      params.push(activo === 'true' || activo === true);
      paramIndex++;
    }

    // Filtrar por categoría
    if (categoria) {
      query += ` AND categoria = $${paramIndex}`;
      params.push(categoria);
      paramIndex++;
    }

    // Filtrar por familia
    if (familia) {
      query += ` AND familia = $${paramIndex}`;
      params.push(familia);
      paramIndex++;
    }

    // Búsqueda por nombre, código o descripción
    if (search) {
      query += ` AND (nombre_articulo ILIKE $${paramIndex} 
                   OR codigo ILIKE $${paramIndex}
                   OR codigo_barras ILIKE $${paramIndex}
                   OR descripcion ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Ordenar por nombre
    query += ' ORDER BY nombre_articulo ASC';

    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      total: result.rows.length,
      articulos: result.rows
    });
  } catch (error) {
    console.error('Error en getArticulos:', error);
    res.status(500).json({ error: 'Error obteniendo artículos' });
  }
};

/**
 * GET /api/codigos-articulos/:id
 * Obtener un artículo específico
 */
const getArticuloById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM codigos_articulos WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Artículo no encontrado' });
    }

    res.status(200).json({
      success: true,
      articulo: result.rows[0]
    });
  } catch (error) {
    console.error('Error en getArticuloById:', error);
    res.status(500).json({ error: 'Error obteniendo artículo' });
  }
};

/**
 * POST /api/codigos-articulos
 * Crear nuevo artículo
 */
const createArticulo = async (req, res) => {
  try {
    const {
      codigo,
      nombre_articulo,
      descripcion,
      categoria,
      familia,
      subfamilia,
      precio_unitario,
      precio_costo,
      cantidad_disponible,
      unidad_medida,
      codigo_barras,
      codigo_alternativo,
      descripcion2,
      tipo,
      activo = true
    } = req.body;

    // Validar campos requeridos
    if (!codigo || !nombre_articulo) {
      return res.status(400).json({ 
        error: 'Código y nombre del artículo son requeridos' 
      });
    }

    // Verificar que código sea único
    const existing = await pool.query(
      'SELECT id FROM codigos_articulos WHERE codigo = $1',
      [codigo]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Este código ya existe' });
    }

    const result = await pool.query(
      `INSERT INTO codigos_articulos 
       (codigo, nombre_articulo, descripcion, categoria, familia, subfamilia,
        precio_unitario, precio_costo, cantidad_disponible, unidad_medida,
        codigo_barras, codigo_alternativo, descripcion2, tipo, activo, 
        created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
       RETURNING *`,
      [codigo, nombre_articulo, descripcion || null, categoria || null, familia || null, 
       subfamilia || null, precio_unitario || 0, precio_costo || 0, cantidad_disponible || 0, 
       unidad_medida || null, codigo_barras || null, codigo_alternativo || null, 
       descripcion2 || null, tipo || null, activo]
    );

    res.status(201).json({
      success: true,
      message: 'Artículo creado exitosamente',
      articulo: result.rows[0]
    });
  } catch (error) {
    console.error('Error en createArticulo:', error);
    res.status(500).json({ error: 'Error creando artículo' });
  }
};

/**
 * PUT /api/codigos-articulos/:id
 * Actualizar artículo
 */
const updateArticulo = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      codigo,
      nombre_articulo,
      descripcion,
      categoria,
      familia,
      subfamilia,
      precio_unitario,
      precio_costo,
      cantidad_disponible,
      unidad_medida,
      codigo_barras,
      codigo_alternativo,
      descripcion2,
      tipo,
      activo
    } = req.body;

    // Verificar que existe
    const existing = await pool.query(
      'SELECT id FROM codigos_articulos WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Artículo no encontrado' });
    }

    const result = await pool.query(
      `UPDATE codigos_articulos 
       SET codigo = COALESCE($1, codigo),
           nombre_articulo = COALESCE($2, nombre_articulo),
           descripcion = COALESCE($3, descripcion),
           categoria = COALESCE($4, categoria),
           familia = COALESCE($5, familia),
           subfamilia = COALESCE($6, subfamilia),
           precio_unitario = COALESCE($7, precio_unitario),
           precio_costo = COALESCE($8, precio_costo),
           cantidad_disponible = COALESCE($9, cantidad_disponible),
           unidad_medida = COALESCE($10, unidad_medida),
           codigo_barras = COALESCE($11, codigo_barras),
           codigo_alternativo = COALESCE($12, codigo_alternativo),
           descripcion2 = COALESCE($13, descripcion2),
           tipo = COALESCE($14, tipo),
           activo = COALESCE($15, activo),
           updated_at = NOW()
       WHERE id = $16
       RETURNING *`,
      [codigo, nombre_articulo, descripcion, categoria, familia, subfamilia,
       precio_unitario, precio_costo, cantidad_disponible, unidad_medida,
       codigo_barras, codigo_alternativo, descripcion2, tipo, activo, id]
    );

    res.status(200).json({
      success: true,
      message: 'Artículo actualizado exitosamente',
      articulo: result.rows[0]
    });
  } catch (error) {
    console.error('Error en updateArticulo:', error);
    res.status(500).json({ error: 'Error actualizando artículo' });
  }
};

/**
 * DELETE /api/codigos-articulos/:id
 * Eliminar artículo (soft delete)
 */
const deleteArticulo = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE codigos_articulos 
       SET activo = false, updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, nombre_articulo`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Artículo no encontrado' });
    }

    res.status(200).json({
      success: true,
      message: 'Artículo eliminado exitosamente',
      articulo: result.rows[0]
    });
  } catch (error) {
    console.error('Error en deleteArticulo:', error);
    res.status(500).json({ error: 'Error eliminando artículo' });
  }
};

/**
 * PUT /api/codigos-articulos/:id/cantidad
 * Actualizar cantidad disponible
 */
const actualizarCantidad = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad_disponible } = req.body;

    if (cantidad_disponible === undefined) {
      return res.status(400).json({ error: 'Cantidad es requerida' });
    }

    const result = await pool.query(
      `UPDATE codigos_articulos 
       SET cantidad_disponible = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [cantidad_disponible, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Artículo no encontrado' });
    }

    res.status(200).json({
      success: true,
      articulo: result.rows[0]
    });
  } catch (error) {
    console.error('Error en actualizarCantidad:', error);
    res.status(500).json({ error: 'Error actualizando cantidad' });
  }
};

/**
 * GET /api/codigos-articulos/stock/bajo
 * Obtener artículos con stock bajo (cantidad < 10)
 */
const getArticulosStockBajo = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM codigos_articulos 
       WHERE activo = true AND cantidad_disponible < 10
       ORDER BY cantidad_disponible ASC`
    );

    res.status(200).json({
      success: true,
      total: result.rows.length,
      articulos: result.rows
    });
  } catch (error) {
    console.error('Error en getArticulosStockBajo:', error);
    res.status(500).json({ error: 'Error obteniendo artículos con stock bajo' });
  }
};

module.exports = {
  getArticulos,
  getArticuloById,
  createArticulo,
  updateArticulo,
  deleteArticulo,
  actualizarCantidad,
  getArticulosStockBajo
};
