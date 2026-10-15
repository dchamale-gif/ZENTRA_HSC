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

    // Filtrar por estado (por defecto solo activas; ?activo=todos devuelve todas)
    if (activo !== undefined && activo !== 'todos') {
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

// Campos de la medicina: columna -> nombres aceptados en el body y tipo.
// Crear y actualizar usan esta misma lista, así ningún campo queda fuera.
const CAMPOS_MEDICINA = [
  ['nombre', ['nombre'], 'texto'],
  ['descripcion', ['descripcion'], 'texto'],
  ['seccion', ['seccion', 'categoria'], 'texto'],
  ['familia', ['familia'], 'texto'],
  ['subfamilia', ['subfamilia'], 'texto'],
  ['principio_activo', ['principio_activo'], 'texto'],
  ['concentracion', ['concentracion'], 'texto'],
  ['dosis', ['dosis'], 'texto'],
  ['unidad_dosis', ['unidad_dosis'], 'texto'],
  ['forma_farmaceutica', ['forma_farmaceutica'], 'texto'],
  ['presentacion', ['presentacion'], 'texto'],
  ['cantidad', ['cantidad', 'stock'], 'entero'],
  ['cantidad_minima', ['cantidad_minima', 'stock_minimo'], 'entero'],
  ['precio_costo', ['precio_costo'], 'decimal'],
  ['precio_venta', ['precio_venta', 'precio'], 'decimal'],
  ['lote', ['lote'], 'texto'],
  ['fecha_vencimiento', ['fecha_vencimiento', 'vencimiento'], 'fecha'],
  ['proveedor_id', ['proveedor_id'], 'texto'],
  ['proveedor', ['proveedor'], 'texto'],
  ['contraindicaciones', ['contraindicaciones'], 'texto'],
  ['efectos_secundarios', ['efectos_secundarios'], 'texto'],
  ['codigo_externo', ['codigo_externo'], 'texto'],
  ['codigo_barra', ['codigo_barra'], 'texto'],
  ['activo', ['activo'], 'booleano']
];

const convertirCampo = (valor, tipo) => {
  if (valor === null) return null;
  switch (tipo) {
    case 'entero': {
      const numero = parseInt(valor, 10);
      return Number.isFinite(numero) ? Math.max(0, numero) : 0;
    }
    case 'decimal': {
      const numero = parseFloat(valor);
      return Number.isFinite(numero) ? Math.max(0, numero) : 0;
    }
    case 'booleano':
      return valor === true || valor === 'true' || valor === 1 || valor === '1';
    case 'fecha':
    case 'texto': {
      const texto = String(valor).trim();
      return texto === '' ? null : texto;
    }
    default:
      return valor;
  }
};

// Devuelve [[columna, valor], ...] solo con los campos presentes en el body
const leerCamposMedicina = (body) => CAMPOS_MEDICINA
  .map(([columna, claves, tipo]) => {
    const clave = claves.find(k => body[k] !== undefined);
    return clave === undefined ? null : [columna, convertirCampo(body[clave], tipo)];
  })
  .filter(Boolean);

/**
 * POST /api/medicinas
 * Crear nueva medicina
 */
const createMedicina = async (req, res) => {
  try {
    const campos = new Map(leerCamposMedicina(req.body));

    if (!campos.get('nombre')) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }

    // Valores por defecto de una medicina nueva
    if (!campos.get('seccion')) campos.set('seccion', 'SEC-001');
    if (!campos.has('cantidad')) campos.set('cantidad', 0);
    if (!campos.has('cantidad_minima')) campos.set('cantidad_minima', 0);
    if (!campos.has('precio_costo')) campos.set('precio_costo', 0);
    if (!campos.has('precio_venta')) campos.set('precio_venta', 0);
    if (!campos.has('activo')) campos.set('activo', true);

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
    if (requiresManualId) {
      campos.set('id', `MED-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
    }

    const columnas = [...campos.keys()];
    const values = [...campos.values()];
    const result = await pool.query(
      `INSERT INTO medicinas (${columnas.join(', ')}, created_at, updated_at)
       VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')}, NOW(), NOW())
       RETURNING *`,
      values
    );

    res.status(201).json({
      success: true,
      message: 'Medicina creada exitosamente',
      medicina: result.rows[0]
    });
  } catch (error) {
    console.error('Error en createMedicina:', error);
    res.status(500).json({ error: `Error creando medicina: ${error.message}` });
  }
};

/**
 * PUT /api/medicinas/:id
 * Actualizar medicina (solo los campos enviados)
 */
const updateMedicina = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query('SELECT id FROM medicinas WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Medicina no encontrada' });
    }

    const campos = leerCamposMedicina(req.body);
    if (campos.some(([columna, valor]) => columna === 'nombre' && !valor)) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    if (campos.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    const values = campos.map(([, valor]) => valor);
    const sets = campos.map(([columna], i) => `${columna} = $${i + 1}`);
    values.push(id);

    const result = await pool.query(
      `UPDATE medicinas SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    res.status(200).json({
      success: true,
      message: 'Medicina actualizada exitosamente',
      medicina: result.rows[0]
    });
  } catch (error) {
    console.error('Error en updateMedicina:', error);
    res.status(500).json({ error: `Error actualizando medicina: ${error.message}` });
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
