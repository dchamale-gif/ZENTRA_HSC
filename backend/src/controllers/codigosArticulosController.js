const pool = require('../db/connection');
const inventarioArticulos = require('../services/inventarioArticulos');

const ARTICLE_COLUMNS = `
  id, codigo, nombre_articulo, descripcion, categoria, familia,
  precio_unitario, cantidad_disponible, activo, created_at, updated_at,
  tipo, subfamilia, precio_costo, unidad_medida, codigo_barras,
  codigo_alternativo, descripcion2
`;

const getNextCodigo = async (databaseClient) => {
  const result = await databaseClient.query(
    `SELECT codigo
     FROM codigos_articulos
     WHERE codigo ~ '[0-9]+$'
     ORDER BY ((regexp_match(codigo, '([0-9]+)$'))[1])::BIGINT DESC, codigo DESC
     LIMIT 1`
  );
  const lastCodigo = result.rows[0]?.codigo;
  const parts = lastCodigo?.match(/^(.*?)(\d+)$/);

  if (!parts) return 'ART-001';

  const nextNumber = Number(parts[2]) + 1;
  return `${parts[1]}${String(nextNumber).padStart(parts[2].length, '0')}`;
};

// ==========================================
// CODIGOS ARTICULOS CONTROLLER
// ==========================================

/**
 * GET /api/codigos-articulos
 * Listar todos los artículos
 */
const getArticulos = async (req, res) => {
  try {
    const { categoria, familia, activo, search } = req.query;
    
    let query = `SELECT ${ARTICLE_COLUMNS} FROM codigos_articulos WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    // Filtrar por estado
    if (activo !== undefined) {
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
      `SELECT ${ARTICLE_COLUMNS} FROM codigos_articulos WHERE id = $1`,
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
 * GET /api/codigos-articulos/siguiente-codigo
 * Previsualizar el siguiente código interno
 */
const getSiguienteCodigo = async (req, res) => {
  try {
    const codigo = await getNextCodigo(pool);
    res.status(200).json({ success: true, codigo });
  } catch (error) {
    console.error('Error en getSiguienteCodigo:', error);
    res.status(500).json({ error: 'Error generando el siguiente código' });
  }
};

/**
 * POST /api/codigos-articulos
 * Crear nuevo artículo
 */
const createArticulo = async (req, res) => {
  let client;

  try {
    const {
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
    if (!nombre_articulo) {
      return res.status(400).json({ 
        error: 'Nombre del artículo es requerido'
      });
    }

    client = await pool.connect();
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('codigos_articulos_codigo_correlativo'))");
    const codigo = await getNextCodigo(client);

    const idMetadata = await client.query(
      `SELECT data_type, column_default, is_identity
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'codigos_articulos'
         AND column_name = 'id'`
    );
    const idColumn = idMetadata.rows[0];
    const requiresManualId = idColumn &&
      ['character varying', 'character', 'text'].includes(idColumn.data_type) &&
      !idColumn.column_default && idColumn.is_identity !== 'YES';
    const generatedId = `ART-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const values = [codigo, nombre_articulo, descripcion || null, categoria || null, familia || null,
      subfamilia || null, precio_unitario ?? 0, precio_costo ?? 0, 0,
      unidad_medida || null, codigo_barras || null, codigo_alternativo || null,
      descripcion2 || null, tipo || 'producto', activo];

    const result = await client.query(
      `INSERT INTO codigos_articulos
       (${requiresManualId ? 'id, ' : ''}codigo, nombre_articulo, descripcion, categoria, familia, subfamilia,
        precio_unitario, precio_costo, cantidad_disponible, unidad_medida,
        codigo_barras, codigo_alternativo, descripcion2, tipo, activo,
        created_at, updated_at)
       VALUES (${requiresManualId ? '$1, ' : ''}${values.map((_, index) => `$${index + (requiresManualId ? 2 : 1)}`).join(', ')}, NOW(), NOW())
       RETURNING ${ARTICLE_COLUMNS}`,
      requiresManualId ? [generatedId, ...values] : values
    );
    // La existencia inicial entra por el kárdex
    const inicial = Number(cantidad_disponible ?? 0);
    if (!Number.isInteger(inicial) || inicial < 0) {
      throw Object.assign(new Error('La cantidad disponible debe ser un entero de 0 o más'), { status: 400 });
    }
    if (inicial > 0) {
      result.rows[0].cantidad_disponible = await inventarioArticulos.mover(client, {
        articuloId: result.rows[0].id, cantidad: inicial, tipo: 'inicial',
        costoUnitario: precio_costo ?? null, motivo: 'Existencia inicial al registrar el artículo', req
      });
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Artículo creado exitosamente',
      articulo: result.rows[0]
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error en createArticulo:', error);
    res.status(500).json({ error: 'Error creando artículo' });
  } finally {
    if (client) client.release();
  }
};

/**
 * PUT /api/codigos-articulos/:id
 * Actualizar artículo
 */
const updateArticulo = async (req, res) => {
  let client;
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

    client = await pool.connect();
    await client.query('BEGIN');
    // Un cambio de existencia desde el formulario queda en el kárdex como ajuste
    if (cantidad_disponible !== undefined && cantidad_disponible !== null && cantidad_disponible !== '') {
      await inventarioArticulos.fijar(client, id, cantidad_disponible, req, 'Cambio manual desde Códigos de artículos');
    }
    const result = await client.query(
      `UPDATE codigos_articulos 
       SET codigo = COALESCE($1, codigo),
           nombre_articulo = COALESCE($2, nombre_articulo),
           descripcion = COALESCE($3, descripcion),
           categoria = COALESCE($4, categoria),
           familia = COALESCE($5, familia),
           subfamilia = COALESCE($6, subfamilia),
           precio_unitario = COALESCE($7, precio_unitario),
           precio_costo = COALESCE($8, precio_costo),
           unidad_medida = COALESCE($9, unidad_medida),
           codigo_barras = COALESCE($10, codigo_barras),
           codigo_alternativo = COALESCE($11, codigo_alternativo),
           descripcion2 = COALESCE($12, descripcion2),
           tipo = COALESCE($13, tipo),
           activo = COALESCE($14, activo),
           updated_at = NOW()
       WHERE id = $15
      RETURNING ${ARTICLE_COLUMNS}`,
      [codigo, nombre_articulo, descripcion, categoria, familia, subfamilia,
       precio_unitario, precio_costo, unidad_medida,
       codigo_barras, codigo_alternativo, descripcion2, tipo, activo, id]
    );
    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Artículo actualizado exitosamente',
      articulo: result.rows[0]
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error en updateArticulo:', error);
    res.status(500).json({ error: 'Error actualizando artículo' });
  } finally {
    if (client) client.release();
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

    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      const existencia = await inventarioArticulos.fijar(client, id, cantidad_disponible, req, 'Cambio manual de la cantidad disponible');
      if (existencia === null) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Artículo no encontrado' });
      }
      result = await client.query(`SELECT ${ARTICLE_COLUMNS} FROM codigos_articulos WHERE id = $1`, [id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    res.status(200).json({
      success: true,
      articulo: result.rows[0]
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
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
      `SELECT ${ARTICLE_COLUMNS} FROM codigos_articulos
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

/**
 * GET /api/codigos-articulos/:id/movimientos
 * Kárdex del artículo: entradas y salidas con la existencia que dejó cada una
 */
const getMovimientos = async (req, res) => {
  try {
    if (!(await inventarioArticulos.disponible())) {
      return res.status(503).json({ error: 'Falta preparar la base de datos para el kárdex de artículos (npm run migrate:regulaciones).' });
    }
    const { rows } = await pool.query(
      `SELECT id, fecha, tipo, cantidad, existencia_resultante, costo_unitario, referencia, motivo, usuario_nombre
       FROM articulo_movimientos WHERE articulo_id::text = $1
       ORDER BY fecha DESC, id DESC LIMIT 300`, [String(req.params.id)]);
    res.json({ movimientos: rows });
  } catch (error) {
    console.error('Error en getMovimientos (artículos):', error);
    res.status(500).json({ error: 'Error obteniendo el kárdex del artículo' });
  }
};

module.exports = {
  getMovimientos,
  getArticulos,
  getArticuloById,
  getSiguienteCodigo,
  createArticulo,
  updateArticulo,
  deleteArticulo,
  actualizarCantidad,
  getArticulosStockBajo
};
