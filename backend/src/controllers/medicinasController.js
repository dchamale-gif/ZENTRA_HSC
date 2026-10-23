const pool = require('../db/connection');
const inventario = require('../services/inventarioMedicinas');

// Presentaciones de cada medicina (la unidad base no va aquí: factor 1, precio = precio_venta)
const SELECT_PRESENTACIONES = `COALESCE((
    SELECT json_agg(json_build_object('id', p.id, 'nombre', p.nombre, 'factor', p.factor,
                                      'precio_venta', p.precio_venta, 'codigo_barra', p.codigo_barra) ORDER BY p.factor)
    FROM medicina_presentaciones p WHERE p.medicina_id = medicinas.id), '[]'::json) AS presentaciones`;

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
    
    let query = `SELECT medicinas.*${(await inventario.disponible()) ? `, ${SELECT_PRESENTACIONES}` : ''} FROM medicinas WHERE 1=1`;
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
      `SELECT medicinas.*${(await inventario.disponible()) ? `, ${SELECT_PRESENTACIONES}` : ''} FROM medicinas WHERE id = $1`,
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
  ['activo', ['activo'], 'booleano'],
  ['unidad_base', ['unidad_base'], 'texto']
];

// Columnas que solo existen con la migración de inventario
const CAMPOS_INVENTARIO = ['unidad_base'];

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
const leerCamposMedicina = (body, conInventario = false) => CAMPOS_MEDICINA
  .filter(([columna]) => conInventario || !CAMPOS_INVENTARIO.includes(columna))
  .map(([columna, claves, tipo]) => {
    const clave = claves.find(k => body[k] !== undefined);
    return clave === undefined ? null : [columna, convertirCampo(body[clave], tipo)];
  })
  .filter(Boolean);

const errorConEstado = inventario.errorConEstado;

// Valida y reemplaza las presentaciones de una medicina. Los códigos de barras no se pueden repetir
// entre medicinas ni presentaciones (el lector debe encontrar un solo producto).
const guardarPresentaciones = async (client, medicinaId, lista, codigoMedicina) => {
  if (!Array.isArray(lista)) return;
  if (lista.length > 10) throw errorConEstado('Puede registrar hasta 10 presentaciones por medicina');
  const limpias = lista.map((p, i) => {
    const nombre = String(p?.nombre || '').trim().slice(0, 40);
    const factor = Number(p?.factor);
    const precio = Number(p?.precio_venta ?? 0);
    const codigo = String(p?.codigo_barra || '').trim().slice(0, 60) || null;
    if (!nombre) throw errorConEstado(`Escriba el nombre de la presentación ${i + 1}`);
    if (!Number.isInteger(factor) || factor < 2) throw errorConEstado(`"${nombre}" debe contener al menos 2 unidades`);
    if (!Number.isFinite(precio) || precio < 0) throw errorConEstado(`El precio de "${nombre}" no es válido`);
    return { nombre, factor, precio, codigo };
  });
  const nombres = limpias.map(p => p.nombre.toLowerCase());
  if (new Set(nombres).size !== nombres.length) throw errorConEstado('Hay presentaciones con el mismo nombre');
  const codigos = limpias.map(p => p.codigo).filter(Boolean);
  if (codigoMedicina) codigos.push(codigoMedicina);
  if (new Set(codigos).size !== codigos.length) throw errorConEstado('Hay códigos de barras repetidos en esta medicina');
  for (const codigo of limpias.map(p => p.codigo).filter(Boolean)) {
    const usado = await client.query(
      `SELECT m.nombre FROM medicinas m WHERE m.codigo_barra = $1 AND m.id::text <> $2::text
       UNION ALL
       SELECT m.nombre FROM medicina_presentaciones p JOIN medicinas m ON m.id = p.medicina_id
       WHERE p.codigo_barra = $1 AND p.medicina_id::text <> $2::text
       LIMIT 1`,
      [codigo, String(medicinaId)]
    );
    if (usado.rowCount) throw errorConEstado(`El código de barras ${codigo} ya lo usa ${usado.rows[0].nombre}`);
  }
  await client.query('DELETE FROM medicina_presentaciones WHERE medicina_id = $1', [medicinaId]);
  for (const p of limpias) {
    await client.query(
      'INSERT INTO medicina_presentaciones (medicina_id, nombre, factor, precio_venta, codigo_barra) VALUES ($1, $2, $3, $4, $5)',
      [medicinaId, p.nombre, p.factor, p.precio, p.codigo]
    );
  }
};

const medicinaCompleta = async (db, id) => {
  const result = await db.query(
    `SELECT medicinas.*${(await inventario.disponible()) ? `, ${SELECT_PRESENTACIONES}` : ''} FROM medicinas WHERE id = $1`,
    [id]
  );
  return result.rows[0];
};

/**
 * POST /api/medicinas
 * Crear nueva medicina
 */
const createMedicina = async (req, res) => {
  let client;
  try {
    const conInventario = await inventario.disponible();
    const campos = new Map(leerCamposMedicina(req.body, conInventario));

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

    // Con kárdex, la existencia inicial entra como movimiento "inicial"
    const existenciaInicial = conInventario ? campos.get('cantidad') || 0 : 0;
    if (conInventario) campos.set('cantidad', 0);

    const columnas = [...campos.keys()];
    const values = [...campos.values()];
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO medicinas (${columnas.join(', ')}, created_at, updated_at)
       VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')}, NOW(), NOW())
       RETURNING *`,
      values
    );
    const nueva = result.rows[0];
    if (conInventario) {
      await guardarPresentaciones(client, nueva.id, req.body.presentaciones, nueva.codigo_barra);
      if (existenciaInicial > 0) {
        await inventario.mover(client, {
          medicinaId: nueva.id, cantidad: existenciaInicial, tipo: 'inicial', motivo: 'Existencia inicial al registrar la medicina', req
        });
      }
    }
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Medicina creada exitosamente',
      medicina: await medicinaCompleta(pool, nueva.id)
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error en createMedicina:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : `Error creando medicina: ${error.message}` });
  } finally {
    if (client) client.release();
  }
};

/**
 * PUT /api/medicinas/:id
 * Actualizar medicina (solo los campos enviados)
 */
const updateMedicina = async (req, res) => {
  let client;
  try {
    const { id } = req.params;
    const conInventario = await inventario.disponible();

    const existing = await pool.query('SELECT id FROM medicinas WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Medicina no encontrada' });
    }

    // Con kárdex la existencia solo cambia con movimientos (compras, ventas, consumo, ajustes)
    const campos = leerCamposMedicina(req.body, conInventario).filter(([columna]) => !(conInventario && columna === 'cantidad'));
    if (campos.some(([columna, valor]) => columna === 'nombre' && !valor)) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    if (campos.length === 0 && !Array.isArray(req.body.presentaciones)) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    client = await pool.connect();
    await client.query('BEGIN');
    if (campos.length) {
      const values = campos.map(([, valor]) => valor);
      const sets = campos.map(([columna], i) => `${columna} = $${i + 1}`);
      values.push(id);
      await client.query(
        `UPDATE medicinas SET ${sets.join(', ')}, updated_at = NOW()
         WHERE id = $${values.length}`,
        values
      );
    }
    if (conInventario) {
      const codigo = (await client.query('SELECT codigo_barra FROM medicinas WHERE id = $1', [id])).rows[0]?.codigo_barra;
      await guardarPresentaciones(client, id, req.body.presentaciones, codigo);
    }
    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Medicina actualizada exitosamente',
      medicina: await medicinaCompleta(pool, id)
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error en updateMedicina:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : `Error actualizando medicina: ${error.message}` });
  } finally {
    if (client) client.release();
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
 * PUT /api/medicinas/:id/stock { cantidad, tipo: 'suma' | 'resta', motivo? }
 * Ajuste directo de existencia (en unidades base); queda en el kárdex como ajuste
 */
const actualizarStock = async (req, res) => {
  let client;
  try {
    const cantidad = Number(req.body.cantidad);
    const tipo = req.body.tipo || 'suma';
    if (!Number.isInteger(cantidad) || cantidad <= 0) return res.status(400).json({ error: 'Cantidad es requerida' });
    client = await pool.connect();
    await client.query('BEGIN');
    const anterior = await client.query('SELECT cantidad FROM medicinas WHERE id = $1', [req.params.id]);
    if (!anterior.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Medicina no encontrada' });
    }
    const stockNuevo = await inventario.mover(client, {
      medicinaId: req.params.id,
      cantidad: tipo === 'resta' ? -cantidad : cantidad,
      tipo: 'ajuste',
      motivo: req.body.motivo || 'Ajuste de existencia',
      req
    });
    await client.query('COMMIT');
    res.status(200).json({
      success: true,
      message: 'Stock actualizado exitosamente',
      medicina: await medicinaCompleta(pool, req.params.id),
      stockAnterior: Number(anterior.rows[0].cantidad),
      stockNuevo
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error en actualizarStock:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Error actualizando stock' });
  } finally {
    if (client) client.release();
  }
};

/**
 * GET /api/medicinas/:id/movimientos - Kárdex de la medicina (los más recientes primero)
 */
const getMovimientos = async (req, res) => {
  try {
    if (!(await inventario.disponible())) {
      return res.status(503).json({ error: 'Falta preparar la base de datos para el kárdex (npm run migrate:inventario-medicinas).' });
    }
    const result = await pool.query(
      `SELECT mv.id, mv.fecha, mv.tipo, mv.cantidad, mv.existencia_resultante, mv.presentacion,
              mv.cantidad_presentacion, mv.factor, mv.costo_unitario, mv.referencia, mv.motivo,
              mv.usuario_nombre, mv.paciente_id,
              NULLIF(CONCAT_WS(' ', p.nombre, p.apellido_paterno), '') AS paciente_nombre
       FROM medicina_movimientos mv
       LEFT JOIN pacientes p ON p.id = mv.paciente_id
       WHERE mv.medicina_id = $1
       ORDER BY mv.fecha DESC, mv.id DESC
       LIMIT 500`,
      [req.params.id]
    );
    res.status(200).json({ success: true, movimientos: result.rows });
  } catch (error) {
    console.error('Error en getMovimientos:', error);
    res.status(500).json({ error: 'Error obteniendo el kárdex' });
  }
};

/**
 * POST /api/medicinas/:id/movimientos
 * { tipo: 'consumo_interno' | 'ajuste_entrada' | 'ajuste_salida', presentacion_id?, cantidad, paciente_id?, motivo }
 * Consumo interno: medicamento usado para atender pacientes del centro (no es venta).
 * Ajuste: corrección por conteo físico, merma, vencimiento…; el motivo es obligatorio.
 */
const registrarMovimiento = async (req, res) => {
  let client;
  try {
    if (!(await inventario.disponible())) {
      return res.status(503).json({ error: 'Falta preparar la base de datos para el kárdex (npm run migrate:inventario-medicinas).' });
    }
    const tipo = String(req.body.tipo || '');
    if (!['consumo_interno', 'ajuste_entrada', 'ajuste_salida'].includes(tipo)) throw errorConEstado('Tipo de movimiento no válido');
    const cantidad = Number(req.body.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0) throw errorConEstado('La cantidad debe ser un número entero mayor a cero');
    const motivo = String(req.body.motivo || '').trim();
    if (tipo !== 'consumo_interno' && motivo.length < 3) throw errorConEstado('Escriba el motivo del ajuste');
    const pacienteId = tipo === 'consumo_interno' && req.body.paciente_id ? String(req.body.paciente_id) : null;

    client = await pool.connect();
    await client.query('BEGIN');
    const pres = await inventario.presentacion(client, req.params.id, req.body.presentacion_id || null);
    const signo = tipo === 'ajuste_entrada' ? 1 : -1;
    const existencia = await inventario.mover(client, {
      medicinaId: req.params.id,
      cantidad: signo * cantidad * pres.factor,
      tipo: tipo === 'consumo_interno' ? 'consumo_interno' : 'ajuste',
      presentacion: pres,
      cantidadPresentacion: cantidad,
      pacienteId,
      motivo: motivo || 'Consumo interno',
      req
    });
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Movimiento registrado', existencia, medicina: await medicinaCompleta(pool, req.params.id) });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23503') return res.status(400).json({ error: 'El paciente indicado no existe' });
    if (!error.status) console.error('Error en registrarMovimiento:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Error registrando el movimiento' });
  } finally {
    if (client) client.release();
  }
};

module.exports = {
  getMedicinas,
  getMedicinaById,
  createMedicina,
  updateMedicina,
  deleteMedicina,
  getMedicinasStockBajo,
  actualizarStock,
  getMovimientos,
  registrarMovimiento
};
