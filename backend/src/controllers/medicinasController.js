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
    const { activo = true, categoria, seccion, familia, subfamilia } = req.query;
    
    let query = 'SELECT * FROM medicinas WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // Filtrar por estado
    if (activo !== undefined) {
      query += ` AND activo = $${paramIndex}`;
      params.push(activo === 'true' || activo === true);
      paramIndex++;
    }

    const seccionFiltro = seccion || categoria;
    if (seccionFiltro) {
      query += ` AND seccion = $${paramIndex}`;
      params.push(seccionFiltro);
      paramIndex++;
    }
    if (familia) {
      query += ` AND familia = $${paramIndex}`;
      params.push(familia);
      paramIndex++;
    }
    if (subfamilia) {
      query += ` AND subfamilia = $${paramIndex}`;
      params.push(subfamilia);
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
      seccion = 'SEC-001',
      familia,
      subfamilia,
      codigo_externo,
      codigo_barra,
      principio_activo,
      presentacion,
      concentracion,
      precio,
      precio_venta,
      precio_costo,
      stock,
      cantidad,
      stock_minimo,
      cantidad_minima,
      proveedor_id,
      vencimiento,
      fecha_vencimiento,
      forma_farmaceutica,
      lote,
      activo = true
    } = req.body;

    // Validar campos requeridos
    if (!nombre) {
      return res.status(400).json({ 
        error: 'Nombre es requerido'
      });
    }

    const idMetadata = await pool.query(
      `SELECT data_type, column_default, is_identity
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'medicinas'
         AND column_name = 'id'`
    );
    const idColumn = idMetadata.rows[0];
    const requiresManualId = idColumn &&
      ['character varying', 'character', 'text'].includes(idColumn.data_type) &&
      !idColumn.column_default && idColumn.is_identity !== 'YES';
    const generatedId = `MED-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const values = [
      nombre, descripcion || null, seccion || 'SEC-001', familia || null, subfamilia || null,
      principio_activo || null, concentracion || null, forma_farmaceutica || null,
      presentacion || null, cantidad ?? stock ?? 0, cantidad_minima ?? stock_minimo ?? 0,
      precio_costo ?? 0, precio_venta ?? precio ?? 0, lote || null,
      fecha_vencimiento || vencimiento || null, proveedor_id || null,
      codigo_externo || null, codigo_barra || null, activo
    ];

    const result = await pool.query(
      `INSERT INTO medicinas 
       (${requiresManualId ? 'id, ' : ''}nombre, descripcion, seccion, familia, subfamilia,
        principio_activo, concentracion, forma_farmaceutica, presentacion,
        cantidad, cantidad_minima, precio_costo, precio_venta, lote,
        fecha_vencimiento, proveedor_id, codigo_externo, codigo_barra, activo,
        created_at, updated_at)
       VALUES (${requiresManualId ? '$1, ' : ''}${values.map((_, index) => `$${index + (requiresManualId ? 2 : 1)}`).join(', ')}, NOW(), NOW())
       RETURNING *`,
      requiresManualId ? [generatedId, ...values] : values
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
      seccion,
      familia,
      subfamilia,
      codigo_externo,
      codigo_barra,
      principio_activo,
      presentacion,
      concentracion,
      precio,
      precio_venta,
      precio_costo,
      stock,
      cantidad,
      stock_minimo,
      cantidad_minima,
      proveedor_id,
      vencimiento,
      fecha_vencimiento,
      forma_farmaceutica,
      lote,
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
    if (seccion !== undefined) {
      updates.push(`seccion = $${paramIndex}`);
      values.push(seccion || null);
      paramIndex++;
    }
    if (familia !== undefined) {
      updates.push(`familia = $${paramIndex}`);
      values.push(familia || null);
      paramIndex++;
    }
    if (subfamilia !== undefined) {
      updates.push(`subfamilia = $${paramIndex}`);
      values.push(subfamilia || null);
      paramIndex++;
    }
    if (codigo_externo !== undefined) {
      updates.push(`codigo_externo = $${paramIndex}`);
      values.push(codigo_externo);
      paramIndex++;
    }
    if (codigo_barra !== undefined) {
      updates.push(`codigo_barra = $${paramIndex}`);
      values.push(codigo_barra || null);
      paramIndex++;
    }
    if (principio_activo !== undefined) {
      updates.push(`principio_activo = $${paramIndex}`);
      values.push(principio_activo || null);
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
    if (precio !== undefined || precio_venta !== undefined) {
      updates.push(`precio_venta = $${paramIndex}`);
      values.push(precio_venta ?? precio);
      paramIndex++;
    }
    if (precio_costo !== undefined) {
      updates.push(`precio_costo = $${paramIndex}`);
      values.push(precio_costo);
      paramIndex++;
    }
    if (stock !== undefined || cantidad !== undefined) {
      updates.push(`cantidad = $${paramIndex}`);
      values.push(cantidad ?? stock);
      paramIndex++;
    }
    if (stock_minimo !== undefined || cantidad_minima !== undefined) {
      updates.push(`cantidad_minima = $${paramIndex}`);
      values.push(cantidad_minima ?? stock_minimo);
      paramIndex++;
    }
    if (proveedor_id !== undefined) {
      updates.push(`proveedor_id = $${paramIndex}`);
      values.push(proveedor_id);
      paramIndex++;
    }
    if (vencimiento !== undefined || fecha_vencimiento !== undefined) {
      updates.push(`fecha_vencimiento = $${paramIndex}`);
      values.push(fecha_vencimiento || vencimiento || null);
      paramIndex++;
    }
    if (forma_farmaceutica !== undefined) {
      updates.push(`forma_farmaceutica = $${paramIndex}`);
      values.push(forma_farmaceutica || null);
      paramIndex++;
    }
    if (lote !== undefined) {
      updates.push(`lote = $${paramIndex}`);
      values.push(lote || null);
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
        WHERE activo = true AND cantidad <= cantidad_minima
        ORDER BY cantidad ASC`
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
      'SELECT cantidad FROM medicinas WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Medicina no encontrada' });
    }

    const stockActual = existing.rows[0].cantidad;
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
      'UPDATE medicinas SET cantidad = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
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
