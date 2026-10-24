const pool = require('../db/connection');
const sync = require('../services/historiaSincronizada');
const billingMejoradoController = require('./billingMejoradoController');

// Inventario de bienes (mobiliario y equipo): área, estado y su fecha, historial, bajas
// con motivo y, si un paciente daña un bien, el cargo a su estado de cuenta.

const MIGRACION_PENDIENTE = 'Falta preparar la base de datos del inventario (npm run migrate:inventario-activos).';
const ESTADOS = ['bueno', 'regular', 'malo', 'en_reparacion'];
const MOTIVOS_BAJA = ['danado', 'obsoleto', 'extraviado', 'robo', 'vencido', 'donado', 'otro'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Fecha de hoy en Guatemala (el servidor puede estar en UTC)
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());

const responder = (res, contexto, error) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  if (error.code === '42P01' || error.code === '42703') return res.status(503).json({ success: false, message: MIGRACION_PENDIENTE });
  if (error.code === '23505') return res.status(409).json({ success: false, message: 'Ya existe un bien con ese código' });
  console.error(`Error en ${contexto}:`, error.message);
  res.status(500).json({ success: false, message: 'No se pudo completar la operación. Intente de nuevo.' });
};

const texto = (valor, max) => String(valor ?? '').trim().slice(0, max) || null;

const fecha = (valor, nombre = 'Fecha') => {
  const limpio = String(valor || '');
  if (!FECHA.test(limpio)) throw sync.errorConEstado(`${nombre} no válida`);
  if (limpio > hoy()) throw sync.errorConEstado(`${nombre} no puede ser futura`);
  return limpio;
};

const COLUMNAS = `a.id, a.codigo, a.nombre, a.categoria, a.area, a.ubicacion, a.marca, a.modelo, a.serie,
  a.cantidad, a.valor_unitario, to_char(a.fecha_adquisicion, 'YYYY-MM-DD') AS fecha_adquisicion,
  a.estado, to_char(a.fecha_estado, 'YYYY-MM-DD') AS fecha_estado, a.notas, a.created_at, a.updated_at`;

const leerActivo = async (db, id, bloquear = false) => {
  const result = await db.query(`SELECT ${COLUMNAS} FROM inventario_activos a WHERE a.id = $1 ${bloquear ? 'FOR UPDATE' : ''}`, [id]);
  if (!result.rowCount) throw sync.errorConEstado('El bien no existe', 404);
  return result.rows[0];
};

// Datos generales del formulario (el estado y las bajas tienen su propio flujo)
const leerDatos = (body) => {
  const nombre = texto(body.nombre, 150);
  const area = texto(body.area, 80);
  if (!nombre) throw sync.errorConEstado('Escriba el nombre del bien');
  if (!area) throw sync.errorConEstado('Indique el área donde está el bien');
  const cantidad = Number(body.cantidad ?? 1);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100000) throw sync.errorConEstado('La cantidad debe ser un número entero mayor a cero');
  const valor = Number(body.valor_unitario || 0);
  if (!Number.isFinite(valor) || valor < 0) throw sync.errorConEstado('El valor no es válido');
  return {
    codigo: texto(body.codigo, 40),
    nombre,
    categoria: texto(body.categoria, 60),
    area,
    ubicacion: texto(body.ubicacion, 120),
    marca: texto(body.marca, 80),
    modelo: texto(body.modelo, 80),
    serie: texto(body.serie, 80),
    cantidad,
    valor_unitario: Number(valor.toFixed(2)),
    fecha_adquisicion: body.fecha_adquisicion ? fecha(body.fecha_adquisicion, 'Fecha de adquisición') : null,
    notas: texto(body.notas, 2000)
  };
};

const siguienteCodigo = async (client) => {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('inventario_activos_codigo'))");
  const result = await client.query(
    `SELECT COALESCE(MAX(((regexp_match(codigo, '^INV-([0-9]+)$'))[1])::INT), 0) + 1 AS n FROM inventario_activos`
  );
  return `INV-${String(result.rows[0].n).padStart(4, '0')}`;
};

const registrarMovimiento = (client, req, datos) => client.query(
  `INSERT INTO inventario_activos_movimientos
     (activo_id, tipo, fecha, estado_anterior, estado_nuevo, area_anterior, area_nueva, cantidad, motivo, detalle,
      paciente_id, paciente_nombre, venta_id, monto_cargado, usuario_id, usuario_nombre)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
  [datos.activoId, datos.tipo, datos.fecha, datos.estadoAnterior || null, datos.estadoNuevo || null,
    datos.areaAnterior || null, datos.areaNueva || null, datos.cantidad ?? null, datos.motivo || null, datos.detalle || null,
    datos.cargo?.pacienteId || null, datos.cargo?.pacienteNombre || null, datos.cargo?.ventaId || null,
    datos.cargo?.monto ?? null, req.user.id, sync.nombreUsuario(req)]
);

// Cargo al estado de cuenta del paciente que dañó el bien (factura a crédito, igual que los demás cargos)
const cargarPaciente = async (client, req, activo, cargo, { cantidad, detalle }) => {
  if (!cargo) return null;
  const pacienteId = String(cargo.paciente_id || '').trim();
  const monto = Number(cargo.monto);
  if (!pacienteId) throw sync.errorConEstado('Elija el paciente al que se carga el daño');
  if (!Number.isFinite(monto) || monto <= 0) throw sync.errorConEstado('El monto a cargar debe ser mayor a cero');
  const paciente = await client.query(
    `SELECT CONCAT_WS(' ', nombre, apellido_paterno, apellido_materno) AS nombre FROM pacientes WHERE id = $1`,
    [pacienteId]
  );
  if (!paciente.rowCount) throw sync.errorConEstado('El paciente no existe', 404);
  const total = Number(monto.toFixed(2));
  const descripcion = `Daño a ${activo.nombre} (${activo.codigo})${cantidad > 1 ? ` × ${cantidad}` : ''}`;
  const factura = await billingMejoradoController.registrarFacturaPaciente(client, {
    pacienteId,
    userId: Number(req.user.id),
    items: [{
      descripcion, cantidad: 1, precioUnitario: total, subtotal: total, descuento: 0, itemTotal: total,
      tipoItem: 'danio_inventario', medicinaId: null
    }],
    totales: { subtotal: total, total_descuentos: 0, total_impuestos: 0, base_impuesto: total, total_neto: total },
    metodoPago: 'credito',
    observaciones: detalle ? `Daño de inventario: ${detalle}`.slice(0, 500) : 'Daño de inventario'
  });
  return { pacienteId, pacienteNombre: paciente.rows[0].nombre, ventaId: factura.facturaId, numeroFactura: factura.numeroFactura, monto: total };
};

// GET /api/inventario-activos
const listar = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${COLUMNAS},
              (SELECT COUNT(*)::int FROM inventario_activos_movimientos m WHERE m.activo_id = a.id AND m.paciente_id IS NOT NULL) AS cargos_paciente
       FROM inventario_activos a
       ORDER BY a.area, a.nombre, a.codigo`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    responder(res, 'listar inventario', error);
  }
};

// POST /api/inventario-activos
const crear = async (req, res) => {
  const client = await pool.connect();
  try {
    const datos = leerDatos(req.body);
    const estado = ESTADOS.includes(req.body.estado) ? req.body.estado : 'bueno';
    const fechaEstado = req.body.fecha_estado ? fecha(req.body.fecha_estado, 'Fecha del estado') : hoy();
    await client.query('BEGIN');
    if (!datos.codigo) datos.codigo = await siguienteCodigo(client);
    const result = await client.query(
      `INSERT INTO inventario_activos
         (codigo, nombre, categoria, area, ubicacion, marca, modelo, serie, cantidad, valor_unitario,
          fecha_adquisicion, notas, estado, fecha_estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [datos.codigo, datos.nombre, datos.categoria, datos.area, datos.ubicacion, datos.marca, datos.modelo,
        datos.serie, datos.cantidad, datos.valor_unitario, datos.fecha_adquisicion, datos.notas, estado, fechaEstado]
    );
    const id = result.rows[0].id;
    await registrarMovimiento(client, req, {
      activoId: id, tipo: 'alta', fecha: fechaEstado, estadoNuevo: estado, areaNueva: datos.area, cantidad: datos.cantidad
    });
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Bien registrado', data: await leerActivo(pool, id) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    responder(res, 'registrar bien', error);
  } finally {
    client.release();
  }
};

// PUT /api/inventario-activos/:id - datos generales; un cambio de área queda como traslado
const actualizar = async (req, res) => {
  const client = await pool.connect();
  try {
    const datos = leerDatos(req.body);
    await client.query('BEGIN');
    const actual = await leerActivo(client, req.params.id, true);
    if (actual.estado === 'dado_de_baja') throw sync.errorConEstado('El bien está dado de baja; ya no se modifica', 409);
    await client.query(
      `UPDATE inventario_activos
       SET codigo = COALESCE($2, codigo), nombre = $3, categoria = $4, area = $5, ubicacion = $6, marca = $7,
           modelo = $8, serie = $9, cantidad = $10, valor_unitario = $11, fecha_adquisicion = $12, notas = $13,
           updated_at = NOW()
       WHERE id = $1`,
      [actual.id, datos.codigo, datos.nombre, datos.categoria, datos.area, datos.ubicacion, datos.marca,
        datos.modelo, datos.serie, datos.cantidad, datos.valor_unitario, datos.fecha_adquisicion, datos.notas]
    );
    if (datos.area !== actual.area || (datos.ubicacion || null) !== (actual.ubicacion || null)) {
      await registrarMovimiento(client, req, {
        activoId: actual.id, tipo: 'traslado', fecha: hoy(),
        areaAnterior: [actual.area, actual.ubicacion].filter(Boolean).join(' · '),
        areaNueva: [datos.area, datos.ubicacion].filter(Boolean).join(' · ')
      });
    }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Bien actualizado', data: await leerActivo(pool, actual.id) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    responder(res, 'actualizar bien', error);
  } finally {
    client.release();
  }
};

// POST /api/inventario-activos/:id/estado { estado, fecha, detalle, cargo?: { paciente_id, monto } }
const cambiarEstado = async (req, res) => {
  const client = await pool.connect();
  try {
    const estado = req.body.estado;
    if (!ESTADOS.includes(estado)) throw sync.errorConEstado('Estado no válido');
    const dia = fecha(req.body.fecha);
    const detalle = texto(req.body.detalle, 2000);
    if (req.body.cargo && !['malo', 'en_reparacion'].includes(estado)) {
      throw sync.errorConEstado('Solo se carga al paciente cuando el bien queda dañado o en reparación');
    }
    if ((estado === 'malo' || estado === 'en_reparacion') && !detalle) throw sync.errorConEstado('Explique qué le pasó al bien');

    await client.query('BEGIN');
    const actual = await leerActivo(client, req.params.id, true);
    if (actual.estado === 'dado_de_baja') throw sync.errorConEstado('El bien está dado de baja', 409);
    if (actual.estado === estado && !req.body.cargo) throw sync.errorConEstado('El bien ya está en ese estado');
    const cargo = await cargarPaciente(client, req, actual, req.body.cargo, { cantidad: 1, detalle });
    await client.query(
      'UPDATE inventario_activos SET estado = $2, fecha_estado = $3, updated_at = NOW() WHERE id = $1',
      [actual.id, estado, dia]
    );
    await registrarMovimiento(client, req, {
      activoId: actual.id, tipo: 'cambio_estado', fecha: dia, estadoAnterior: actual.estado, estadoNuevo: estado,
      detalle, cargo
    });
    await client.query('COMMIT');
    res.json({
      success: true,
      message: cargo ? `Estado actualizado y cargado a ${cargo.pacienteNombre} (factura ${cargo.numeroFactura})` : 'Estado actualizado',
      data: await leerActivo(pool, actual.id)
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    responder(res, 'cambiar estado del bien', error);
  } finally {
    client.release();
  }
};

// POST /api/inventario-activos/:id/baja { fecha, cantidad, motivo, detalle, cargo?: { paciente_id, monto } }
// Con cantidad menor a la existente se dan de baja solo esas unidades; con todas, el bien queda dado de baja.
const darDeBaja = async (req, res) => {
  const client = await pool.connect();
  try {
    const dia = fecha(req.body.fecha, 'Fecha de baja');
    const motivo = req.body.motivo;
    if (!MOTIVOS_BAJA.includes(motivo)) throw sync.errorConEstado('Elija el motivo de la baja');
    const detalle = texto(req.body.detalle, 2000);
    if (!detalle || detalle.length < 5) throw sync.errorConEstado('Explique por qué se da de baja');
    if (req.body.cargo && motivo !== 'danado') throw sync.errorConEstado('Solo se carga al paciente cuando el bien se dañó');

    await client.query('BEGIN');
    const actual = await leerActivo(client, req.params.id, true);
    if (actual.estado === 'dado_de_baja') throw sync.errorConEstado('El bien ya está dado de baja', 409);
    const cantidad = Number(req.body.cantidad ?? actual.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > actual.cantidad) {
      throw sync.errorConEstado(`La cantidad a dar de baja debe estar entre 1 y ${actual.cantidad}`);
    }
    const cargo = await cargarPaciente(client, req, actual, req.body.cargo, { cantidad, detalle });
    const restante = actual.cantidad - cantidad;
    await client.query(
      `UPDATE inventario_activos
       SET cantidad = $2, estado = CASE WHEN $2 = 0 THEN 'dado_de_baja' ELSE estado END,
           fecha_estado = CASE WHEN $2 = 0 THEN $3::date ELSE fecha_estado END, updated_at = NOW()
       WHERE id = $1`,
      [actual.id, restante, dia]
    );
    await registrarMovimiento(client, req, {
      activoId: actual.id, tipo: 'baja', fecha: dia, estadoAnterior: actual.estado,
      estadoNuevo: restante === 0 ? 'dado_de_baja' : actual.estado, cantidad, motivo, detalle, cargo
    });
    await client.query('COMMIT');
    const unidades = restante === 0 ? 'Bien dado de baja' : `${cantidad} unidad${cantidad === 1 ? '' : 'es'} dada${cantidad === 1 ? '' : 's'} de baja`;
    res.json({
      success: true,
      message: cargo ? `${unidades} y cargado a ${cargo.pacienteNombre} (factura ${cargo.numeroFactura})` : unidades,
      data: await leerActivo(pool, actual.id)
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    responder(res, 'dar de baja bien', error);
  } finally {
    client.release();
  }
};

// GET /api/inventario-activos/:id/movimientos
const movimientos = async (req, res) => {
  try {
    await leerActivo(pool, req.params.id);
    const result = await pool.query(
      `SELECT m.id, m.tipo, to_char(m.fecha, 'YYYY-MM-DD') AS fecha, m.estado_anterior, m.estado_nuevo,
              m.area_anterior, m.area_nueva, m.cantidad, m.motivo, m.detalle, m.paciente_id, m.paciente_nombre,
              m.monto_cargado, v.numero_factura, m.usuario_nombre, m.created_at
       FROM inventario_activos_movimientos m
       LEFT JOIN ventas v ON v.id = m.venta_id
       WHERE m.activo_id = $1
       ORDER BY m.fecha DESC, m.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    responder(res, 'historial del bien', error);
  }
};

// DELETE /api/inventario-activos/:id - solo para corregir un registro equivocado (administrador, sin cargos a pacientes)
const eliminar = async (req, res) => {
  try {
    if (!(await sync.esAdmin(req))) {
      throw sync.errorConEstado('Solo un administrador puede eliminar un bien. Para retirarlo del inventario, dele de baja.', 403);
    }
    const cargos = await pool.query(
      'SELECT 1 FROM inventario_activos_movimientos WHERE activo_id = $1 AND venta_id IS NOT NULL LIMIT 1',
      [req.params.id]
    );
    if (cargos.rowCount) throw sync.errorConEstado('El bien tiene cargos a pacientes; dele de baja en lugar de eliminarlo', 409);
    const result = await pool.query('DELETE FROM inventario_activos WHERE id = $1', [req.params.id]);
    if (!result.rowCount) throw sync.errorConEstado('El bien no existe', 404);
    res.json({ success: true, message: 'Bien eliminado' });
  } catch (error) {
    responder(res, 'eliminar bien', error);
  }
};

module.exports = { listar, crear, actualizar, cambiarEstado, darDeBaja, movimientos, eliminar };
