const pool = require('../db/connection');
const inventario = require('../services/inventarioMedicinas');
const requerimientos = require('./requerimientosController');
const { validarSubida, limpiarNombre, enviarArchivo } = require('../services/archivos');

const MIGRACION_PAGOS = 'Falta preparar la base de datos para el pago de las compras (npm run migrate:compras-pagos).';
const FORMAS_PAGO = ['efectivo', 'tarjeta', 'cheque', 'transferencia'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// El pago de las compras llega con su migración; mientras falte, las compras funcionan como antes
let pagosCache = { valor: false, hasta: 0 };
const pagosDisponibles = async () => {
  if (Date.now() < pagosCache.hasta) return pagosCache.valor;
  const result = await pool.query(
    `SELECT to_regclass('public.compra_vouchers') IS NOT NULL
        AND EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'proveedores' AND column_name = 'numero_cuenta') AS listo`
  );
  const valor = result.rows[0].listo;
  pagosCache = { valor, hasta: valor ? Infinity : Date.now() + 60000 };
  return valor;
};

const errorConEstado = (message, status = 400) => Object.assign(new Error(message), { status });

// Condición y datos del pago. Crédito: vence a los días indicados desde la fecha de la compra;
// pago inmediato: vence el mismo día. La fecha de pago queda vacía mientras no se haya pagado.
const leerPago = (body, fechaCompra) => {
  const condicion = body.condicion_pago === 'credito' ? 'credito' : 'contado';
  let dias = null;
  if (condicion === 'credito') {
    dias = Number(body.dias_credito);
    if (!Number.isInteger(dias) || dias < 1 || dias > 365) throw errorConEstado('Indique los días de crédito (de 1 a 365)');
  }
  const forma = body.forma_pago || null;
  if (forma && !FORMAS_PAGO.includes(forma)) throw errorConEstado('Forma de pago no válida');
  const fechaPago = body.fecha_pago || null;
  if (fechaPago && !FECHA.test(fechaPago)) throw errorConEstado('Fecha de pago no válida');
  if (fechaPago && !forma) throw errorConEstado('Indique la forma de pago');
  const vence = new Date(`${String(fechaCompra).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(vence.getTime())) throw errorConEstado('Fecha de la compra no válida');
  vence.setUTCDate(vence.getUTCDate() + (dias || 0));
  return {
    condicion,
    dias,
    vencimiento: vence.toISOString().slice(0, 10),
    forma,
    referencia: String(body.referencia_pago || '').trim().slice(0, 60) || null,
    fechaPago
  };
};

const guardarPago = (client, compraId, pago) => client.query(
  `UPDATE compras SET condicion_pago = $2, dias_credito = $3, fecha_vencimiento_pago = $4,
          forma_pago = $5, referencia_pago = $6, fecha_pago = $7
   WHERE id = $1`,
  [compraId, pago.condicion, pago.dias, pago.vencimiento, pago.forma, pago.referencia, pago.fechaPago]
);

// Requerimiento del que sale la compra: uno del sistema (por su número) o uno en papel (número y fecha a mano).
// Uno del sistema debe estar confirmado y no haber generado ya otra compra.
const leerRequerimiento = async (client, body, compraId = null) => {
  const numero = String(body.numero_requerimiento || '').trim().slice(0, 30);
  if (!numero) return { id: null, numero: null, fecha: null };
  const fechaManual = body.fecha_requerimiento || null;
  if (fechaManual && !FECHA.test(fechaManual)) throw errorConEstado('Fecha del requerimiento no válida');
  const { rows } = await client.query(
    `SELECT r.id, r.numero, to_char(r.fecha, 'YYYY-MM-DD') AS fecha, r.estado, c.id AS compra_id, c.numero_compra
     FROM requerimientos_compra r LEFT JOIN compras c ON c.requerimiento_id = r.id
     WHERE UPPER(r.numero) = UPPER($1)`, [numero]);
  const r = rows[0];
  if (!r) return { id: null, numero, fecha: fechaManual };
  if (r.estado !== 'confirmada') {
    throw errorConEstado(`El requerimiento ${r.numero} está ${r.estado === 'rechazada' ? 'rechazado' : 'pendiente'}: debe confirmarse antes de comprarlo`, 409);
  }
  if (r.compra_id && r.compra_id !== compraId) throw errorConEstado(`El requerimiento ${r.numero} ya generó la compra ${r.numero_compra}`, 409);
  return { id: r.id, numero: r.numero, fecha: r.fecha };
};

const guardarRequerimiento = (client, compraId, req) => client.query(
  'UPDATE compras SET requerimiento_id = $2, numero_requerimiento = $3, fecha_requerimiento = $4 WHERE id = $1',
  [compraId, req.id, req.numero, req.fecha]
);

const compraSelect = (conInventario, conPagos, conRequerimientos) => `
  SELECT c.id, c.numero_compra, c.proveedor_id, p.nombre AS proveedor_nombre,
         c.user_id, c.fecha, c.fecha_entrega, c.total, c.estado,
         c.observaciones, c.created_at, c.updated_at,${conRequerimientos ? `
         c.requerimiento_id, c.numero_requerimiento, to_char(c.fecha_requerimiento, 'YYYY-MM-DD') AS fecha_requerimiento,` : ''}${conPagos ? `
         c.condicion_pago, c.dias_credito, to_char(c.fecha_vencimiento_pago, 'YYYY-MM-DD') AS fecha_vencimiento_pago,
         c.forma_pago, c.referencia_pago, to_char(c.fecha_pago, 'YYYY-MM-DD') AS fecha_pago,
         p.banco AS proveedor_banco, p.numero_cuenta AS proveedor_numero_cuenta, p.tipo_cuenta AS proveedor_tipo_cuenta,
         COALESCE((SELECT json_agg(json_build_object(
                     'id', v.id, 'nombre', v.nombre_archivo, 'tipo_contenido', v.tipo_contenido,
                     'tamano', v.tamano, 'subido_por', v.subido_por_nombre, 'fecha', v.created_at
                   ) ORDER BY v.created_at)
                   FROM compra_vouchers v WHERE v.compra_id = c.id), '[]'::json) AS vouchers,` : ''}
         COALESCE(
           json_agg(
             json_build_object(
               'id', ci.id,
               'tipo', CASE WHEN ci.medicina_id IS NOT NULL THEN 'medicina' ELSE 'articulo' END,
               'concepto_id', COALESCE(ci.medicina_id, ci.articulo_id),
               'concepto_nombre', COALESCE(m.nombre, a.nombre_articulo),
               'cantidad', ci.cantidad,
               'precio_unitario', ci.precio_unitario,
               'subtotal', ci.subtotal${conInventario ? `,
               'presentacion_id', ci.presentacion_id,
               'presentacion_nombre', ci.presentacion_nombre,
               'factor', ci.factor` : ''}
             ) ORDER BY ci.created_at, ci.id
           ) FILTER (WHERE ci.id IS NOT NULL),
           '[]'::json
         ) AS items
  FROM compras c
  JOIN proveedores p ON p.id = c.proveedor_id
  LEFT JOIN compra_items ci ON ci.compra_id = c.id
  LEFT JOIN medicinas m ON m.id = ci.medicina_id
  LEFT JOIN codigos_articulos a ON a.id = ci.articulo_id
`;

const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('La compra debe incluir al menos un concepto');
    error.status = 400;
    throw error;
  }

  return items.map((item, index) => {
    const tipo = item.tipo;
    const conceptoId = String(item.concepto_id || '').trim();
    const cantidad = Number(item.cantidad);
    const precioUnitario = Number(item.precio_unitario);

    if (!['articulo', 'medicina'].includes(tipo) || !conceptoId) {
      const error = new Error(`Concepto ${index + 1}: tipo y producto son requeridos`);
      error.status = 400;
      throw error;
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      const error = new Error(`Concepto ${index + 1}: la cantidad debe ser un entero mayor a cero`);
      error.status = 400;
      throw error;
    }
    if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
      const error = new Error(`Concepto ${index + 1}: el costo unitario no es válido`);
      error.status = 400;
      throw error;
    }

    const presentacionId = tipo === 'medicina' && item.presentacion_id ? Number(item.presentacion_id) : null;
    if (presentacionId !== null && !Number.isInteger(presentacionId)) {
      const error = new Error(`Concepto ${index + 1}: presentación no válida`);
      error.status = 400;
      throw error;
    }
    return {
      tipo,
      conceptoId,
      cantidad,
      precioUnitario,
      presentacionId,
      subtotal: Number((cantidad * precioUnitario).toFixed(2))
    };
  });
};

const getNextNumeroCompra = async (client) => {
  const result = await client.query(
    `SELECT numero_compra
     FROM compras
     WHERE numero_compra ~ '[0-9]+$'
     ORDER BY ((regexp_match(numero_compra, '([0-9]+)$'))[1])::BIGINT DESC
     LIMIT 1`
  );
  const parts = result.rows[0]?.numero_compra?.match(/^(.*?)(\d+)$/);
  if (!parts) return 'COMP-001';
  return `${parts[1]}${String(Number(parts[2]) + 1).padStart(parts[2].length, '0')}`;
};

const insertItems = async (client, compraId, items) => {
  const conInventario = await inventario.disponible();
  for (const item of items) {
    const itemId = `CI-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const valores = [
      itemId,
      compraId,
      item.tipo === 'medicina' ? item.conceptoId : null,
      item.tipo === 'articulo' ? item.conceptoId : null,
      item.cantidad,
      item.precioUnitario,
      item.subtotal
    ];
    if (conInventario) {
      const pres = item.tipo === 'medicina'
        ? await inventario.presentacion(client, item.conceptoId, item.presentacionId)
        : { id: null, nombre: null, factor: 1 };
      await client.query(
        `INSERT INTO compra_items
         (id, compra_id, medicina_id, articulo_id, cantidad, precio_unitario, subtotal, presentacion_id, presentacion_nombre, factor)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [...valores, pres.id, pres.nombre, pres.factor]
      );
    } else {
      await client.query(
        `INSERT INTO compra_items
         (id, compra_id, medicina_id, articulo_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        valores
      );
    }
  }
};

// Una compra suma al inventario cuando está recibida (compras.inventario_aplicado lo recuerda).
// Medicinas: en unidades base, con su costo por unidad, y quedan en el kárdex. Artículos: tal cual.
const aplicarInventario = async (client, compraId, req) => {
  const compra = await client.query('SELECT numero_compra FROM compras WHERE id = $1', [compraId]);
  const items = await client.query(
    'SELECT medicina_id, articulo_id, cantidad, precio_unitario, presentacion_nombre, factor FROM compra_items WHERE compra_id = $1',
    [compraId]
  );
  for (const item of items.rows) {
    if (item.medicina_id) {
      const factor = Number(item.factor) || 1;
      const costo = Number(item.precio_unitario) / factor;
      await inventario.mover(client, {
        medicinaId: item.medicina_id,
        cantidad: item.cantidad * factor,
        tipo: 'ingreso_compra',
        presentacion: { nombre: item.presentacion_nombre, factor },
        cantidadPresentacion: item.cantidad,
        costoUnitario: costo,
        referencia: compra.rows[0].numero_compra,
        motivo: 'Compra recibida',
        req
      });
      // El costo de la medicina queda con el de la última compra, por unidad base
      await client.query('UPDATE medicinas SET precio_costo = $1 WHERE id = $2', [Number(costo.toFixed(4)), item.medicina_id]);
    } else if (item.articulo_id) {
      await client.query(
        'UPDATE codigos_articulos SET cantidad_disponible = COALESCE(cantidad_disponible, 0) + $1, updated_at = NOW() WHERE id = $2',
        [item.cantidad, item.articulo_id]
      );
    }
  }
  await client.query('UPDATE compras SET inventario_aplicado = true WHERE id = $1', [compraId]);
};

// Deshace lo que sumó la compra (al editarla, cambiarle el estado o eliminarla)
const revertirInventario = async (client, compraId, req, motivo) => {
  const compra = await client.query('SELECT numero_compra FROM compras WHERE id = $1', [compraId]);
  const items = await client.query(
    'SELECT medicina_id, articulo_id, cantidad, presentacion_nombre, factor FROM compra_items WHERE compra_id = $1',
    [compraId]
  );
  for (const item of items.rows) {
    if (item.medicina_id) {
      const factor = Number(item.factor) || 1;
      try {
        await inventario.mover(client, {
          medicinaId: item.medicina_id,
          cantidad: -item.cantidad * factor,
          tipo: 'reversion_compra',
          presentacion: { nombre: item.presentacion_nombre, factor },
          cantidadPresentacion: item.cantidad,
          referencia: compra.rows[0].numero_compra,
          motivo,
          req
        });
      } catch (error) {
        if (error.status === 409) error.message = `No se puede deshacer la compra: parte de lo recibido ya salió del inventario. ${error.message}`;
        throw error;
      }
    } else if (item.articulo_id) {
      const result = await client.query(
        `UPDATE codigos_articulos SET cantidad_disponible = cantidad_disponible - $1, updated_at = NOW()
         WHERE id = $2 AND cantidad_disponible >= $1`,
        [item.cantidad, item.articulo_id]
      );
      if (!result.rowCount) {
        const error = new Error('No se puede deshacer la compra: parte de los artículos recibidos ya salió del inventario.');
        error.status = 409;
        throw error;
      }
    }
  }
  await client.query('UPDATE compras SET inventario_aplicado = false WHERE id = $1', [compraId]);
};

const getCompras = async (req, res) => {
  try {
    const conPagos = await pagosDisponibles();
    const result = await pool.query(
      `${compraSelect(await inventario.disponible(), conPagos, await requerimientos.disponible())}
       GROUP BY c.id, p.id
       ORDER BY c.fecha DESC, c.created_at DESC`
    );
    res.status(200).json({ success: true, total: result.rows.length, compras: result.rows, pagos: conPagos });
  } catch (error) {
    console.error('Error en getCompras:', error);
    res.status(500).json({ error: 'Error obteniendo compras' });
  }
};

const getCompraById = async (req, res) => {
  try {
    const result = await pool.query(
      `${compraSelect(await inventario.disponible(), await pagosDisponibles(), await requerimientos.disponible())}
       WHERE c.id = $1
       GROUP BY c.id, p.id`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Compra no encontrada' });
    res.status(200).json({ success: true, compra: result.rows[0] });
  } catch (error) {
    console.error('Error en getCompraById:', error);
    res.status(500).json({ error: 'Error obteniendo compra' });
  }
};

const createCompra = async (req, res) => {
  let client;
  try {
    const { proveedor_id, fecha, fecha_entrega, estado = 'pendiente', observaciones } = req.body;
    if (!proveedor_id || !fecha) return res.status(400).json({ error: 'Proveedor y fecha son requeridos' });

    const items = normalizeItems(req.body.items);
    const total = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
    const pago = (await pagosDisponibles()) ? leerPago(req.body, fecha) : null;
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('compras_numero_correlativo'))");
    const numeroCompra = await getNextNumeroCompra(client);
    const compraId = `COM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const result = await client.query(
      `INSERT INTO compras
       (id, numero_compra, proveedor_id, user_id, fecha, fecha_entrega, total, estado, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [compraId, numeroCompra, proveedor_id, req.user.id, fecha, fecha_entrega || null,
        total, estado, observaciones || null]
    );
    await insertItems(client, compraId, items);
    if (pago) await guardarPago(client, compraId, pago);
    if (await requerimientos.disponible()) await guardarRequerimiento(client, compraId, await leerRequerimiento(client, req.body));
    if (estado === 'recibida' && await inventario.disponible()) await aplicarInventario(client, compraId, req);
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Compra creada exitosamente', compra: result.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error en createCompra:', error);
    const status = error.status || (error.code === '23503' ? 400 : 500);
    res.status(status).json({ error: error.code === '23503' ? 'Proveedor o concepto no válido' : error.message || 'Error creando compra' });
  } finally {
    if (client) client.release();
  }
};

const updateCompra = async (req, res) => {
  let client;
  try {
    const { proveedor_id, fecha, fecha_entrega, estado = 'pendiente', observaciones } = req.body;
    if (!proveedor_id || !fecha) return res.status(400).json({ error: 'Proveedor y fecha son requeridos' });

    const items = normalizeItems(req.body.items);
    const total = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
    const pago = (await pagosDisponibles()) ? leerPago(req.body, fecha) : null;
    client = await pool.connect();
    await client.query('BEGIN');
    const conInventario = await inventario.disponible();
    const existing = await client.query(
      `SELECT id, estado${conInventario ? ', inventario_aplicado' : ''} FROM compras WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Compra no encontrada' });
    }
    // Lo recibido se deshace y, si sigue recibida, se vuelve a sumar con los conceptos nuevos.
    // Una compra marcada recibida antes de este control no había sumado: solo suma si pasa a recibida ahora.
    const anterior = existing.rows[0];
    if (anterior.inventario_aplicado) await revertirInventario(client, req.params.id, req, 'Compra editada');

    const result = await client.query(
      `UPDATE compras
       SET proveedor_id = $1, fecha = $2, fecha_entrega = $3, total = $4,
           estado = $5, observaciones = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [proveedor_id, fecha, fecha_entrega || null, total, estado, observaciones || null, req.params.id]
    );
    await client.query('DELETE FROM compra_items WHERE compra_id = $1', [req.params.id]);
    await insertItems(client, req.params.id, items);
    if (pago) await guardarPago(client, req.params.id, pago);
    if (await requerimientos.disponible()) {
      await guardarRequerimiento(client, req.params.id, await leerRequerimiento(client, req.body, req.params.id));
    }
    if (conInventario && estado === 'recibida' && (anterior.inventario_aplicado || anterior.estado !== 'recibida')) {
      await aplicarInventario(client, req.params.id, req);
    }
    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Compra actualizada exitosamente', compra: result.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error en updateCompra:', error);
    const status = error.status || (error.code === '23503' ? 400 : 500);
    res.status(status).json({ error: error.code === '23503' ? 'Proveedor o concepto no válido' : error.message || 'Error actualizando compra' });
  } finally {
    if (client) client.release();
  }
};

const deleteCompra = async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    if (await inventario.disponible()) {
      const existing = await client.query('SELECT inventario_aplicado FROM compras WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (existing.rows[0]?.inventario_aplicado) await revertirInventario(client, req.params.id, req, 'Compra eliminada');
    }
    const result = await client.query('DELETE FROM compras WHERE id = $1 RETURNING id, numero_compra', [req.params.id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Compra no encontrada' });
    }
    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Compra eliminada exitosamente', compra: result.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error en deleteCompra:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Error eliminando compra' });
  } finally {
    if (client) client.release();
  }
};

const ESTADOS = ['pendiente', 'ordenada', 'recibida', 'cancelada'];

// PUT /api/compras/:id/estado { estado } (desde el listado). Recibida suma al inventario; al dejar de estarlo se resta.
const cambiarEstado = async (req, res) => {
  let client;
  try {
    const estado = req.body.estado;
    if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado no válido' });
    client = await pool.connect();
    await client.query('BEGIN');
    const conInventario = await inventario.disponible();
    const existing = await client.query(
      `SELECT id, estado${conInventario ? ', inventario_aplicado' : ''} FROM compras WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (existing.rows.length === 0) throw errorConEstado('Compra no encontrada', 404);
    const anterior = existing.rows[0];
    if (anterior.inventario_aplicado && estado !== 'recibida') {
      await revertirInventario(client, req.params.id, req, `Compra pasada a ${estado}`);
    }
    await client.query('UPDATE compras SET estado = $1, updated_at = NOW() WHERE id = $2', [estado, req.params.id]);
    if (conInventario && estado === 'recibida' && !anterior.inventario_aplicado && anterior.estado !== 'recibida') {
      await aplicarInventario(client, req.params.id, req);
    }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Estado de la compra actualizado' });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error en cambiarEstado:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Error cambiando el estado de la compra' });
  } finally {
    if (client) client.release();
  }
};

// PUT /api/compras/:id/pago { pagada, fecha_pago, forma_pago, referencia_pago } (desde el listado)
const marcarPago = async (req, res) => {
  try {
    if (!(await pagosDisponibles())) return res.status(503).json({ error: MIGRACION_PAGOS });
    let result;
    if (req.body.pagada) {
      const fechaPago = req.body.fecha_pago;
      const forma = req.body.forma_pago;
      if (!FECHA.test(fechaPago || '')) throw errorConEstado('Indique la fecha de pago');
      if (!FORMAS_PAGO.includes(forma)) throw errorConEstado('Indique la forma de pago');
      const referencia = String(req.body.referencia_pago || '').trim().slice(0, 60) || null;
      result = await pool.query(
        `UPDATE compras SET fecha_pago = $2, forma_pago = $3, referencia_pago = COALESCE($4, referencia_pago), updated_at = NOW()
         WHERE id = $1`,
        [req.params.id, fechaPago, forma, referencia]
      );
    } else {
      result = await pool.query('UPDATE compras SET fecha_pago = NULL, updated_at = NOW() WHERE id = $1', [req.params.id]);
    }
    if (result.rowCount === 0) throw errorConEstado('Compra no encontrada', 404);
    res.json({ success: true, message: req.body.pagada ? 'Compra marcada como pagada' : 'Pago marcado como pendiente' });
  } catch (error) {
    console.error('Error en marcarPago:', error.message);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Error guardando el pago' });
  }
};

// POST /api/compras/:id/vouchers?nombre= (cuerpo: el PDF o la imagen del voucher tal cual)
const subirVoucher = async (req, res) => {
  const { tipoContenido, status, error: errorArchivo } = validarSubida(req.body);
  if (errorArchivo) return res.status(status).json({ error: errorArchivo });
  const autor = `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email;
  try {
    if (!(await pagosDisponibles())) return res.status(503).json({ error: MIGRACION_PAGOS });
    const result = await pool.query(
      `INSERT INTO compra_vouchers (compra_id, nombre_archivo, tipo_contenido, tamano, contenido, subido_por, subido_por_nombre)
       SELECT c.id, $2, $3, $4, $5, $6, $7 FROM compras c WHERE c.id = $1
       RETURNING id, nombre_archivo AS nombre, tipo_contenido, tamano, subido_por_nombre AS subido_por, created_at AS fecha`,
      [req.params.id, limpiarNombre(req.query.nombre, tipoContenido, 'voucher'), tipoContenido,
        req.body.length, req.body, req.user.id, autor]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Compra no encontrada' });
    res.status(201).json({ success: true, voucher: result.rows[0] });
  } catch (error) {
    console.error('Error en subirVoucher:', error.message);
    res.status(500).json({ error: 'No se pudo guardar el voucher' });
  }
};

// GET /api/compras/vouchers/:voucherId - Devuelve el voucher para verlo o descargarlo
const verVoucher = async (req, res) => {
  const voucherId = Number(req.params.voucherId);
  if (!Number.isInteger(voucherId)) return res.status(400).json({ error: 'Voucher no válido' });
  try {
    if (!(await pagosDisponibles())) return res.status(503).json({ error: MIGRACION_PAGOS });
    const result = await pool.query(
      'SELECT nombre_archivo, tipo_contenido, contenido FROM compra_vouchers WHERE id = $1',
      [voucherId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Voucher no encontrado' });
    const { nombre_archivo: nombre, tipo_contenido: tipoContenido, contenido } = result.rows[0];
    enviarArchivo(res, { nombre, tipoContenido, contenido });
  } catch (error) {
    console.error('Error en verVoucher:', error.message);
    res.status(500).json({ error: 'No se pudo abrir el voucher' });
  }
};

// DELETE /api/compras/vouchers/:voucherId
const eliminarVoucher = async (req, res) => {
  const voucherId = Number(req.params.voucherId);
  if (!Number.isInteger(voucherId)) return res.status(400).json({ error: 'Voucher no válido' });
  try {
    if (!(await pagosDisponibles())) return res.status(503).json({ error: MIGRACION_PAGOS });
    const result = await pool.query('DELETE FROM compra_vouchers WHERE id = $1', [voucherId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Voucher no encontrado' });
    res.json({ success: true, message: 'Voucher eliminado' });
  } catch (error) {
    console.error('Error en eliminarVoucher:', error.message);
    res.status(500).json({ error: 'No se pudo eliminar el voucher' });
  }
};

module.exports = {
  getCompras, getCompraById, createCompra, updateCompra, deleteCompra, cambiarEstado, marcarPago,
  subirVoucher, verVoucher, eliminarVoucher, pagosDisponibles
};