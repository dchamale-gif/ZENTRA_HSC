// ============================================
// CONTROLADOR DE COTIZACIONES
// Cotizaciones para pacientes o interesados, con plantillas reutilizables.
// Al ingresar el paciente, la cotización se convierte en una factura a su
// estado de cuenta en la misma transacción.
// ============================================

const db = require('../db/connection');
const { generateId } = require('../utils/helpers');
const billingMejoradoController = require('./billingMejoradoController');

const ESTADOS_EDITABLES = ['borrador', 'generada'];
const IVA = 12;

const redondear = valor => Math.round((Number(valor) + Number.EPSILON) * 100) / 100;

const errorConEstado = (mensaje, status = 400) => {
    const error = new Error(mensaje);
    error.status = status;
    return error;
};

const textoOpcional = valor => {
    const texto = String(valor ?? '').trim();
    return texto === '' ? null : texto;
};

// Valida los conceptos y calcula el total de cada uno
const normalizarItems = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        throw errorConEstado('Agrega al menos un concepto a la cotización');
    }
    return items.map((item, index) => {
        const descripcion = String(item.descripcion || '').trim();
        const cantidad = Number(item.cantidad);
        const precioUnitario = Number(item.precio_unitario);
        const descuento = Number(item.descuento || 0);
        if (!descripcion) throw errorConEstado(`El concepto ${index + 1} no tiene descripción`);
        if (!Number.isInteger(cantidad) || cantidad <= 0) throw errorConEstado(`Cantidad no válida en "${descripcion}" (debe ser un número entero mayor a 0)`);
        if (!Number.isFinite(precioUnitario) || precioUnitario < 0) throw errorConEstado(`Precio no válido en "${descripcion}"`);
        const subtotal = redondear(cantidad * precioUnitario);
        if (!Number.isFinite(descuento) || descuento < 0 || descuento > subtotal) throw errorConEstado(`Descuento no válido en "${descripcion}"`);
        return {
            orden: index,
            descripcion,
            tipo_item: String(item.tipo_item || 'general').trim() || 'general',
            cantidad,
            precio_unitario: redondear(precioUnitario),
            descuento: redondear(descuento),
            total: redondear(subtotal - descuento),
            medicina_id: textoOpcional(item.medicina_id)
        };
    });
};

const calcularTotales = (items) => {
    const subtotal = redondear(items.reduce((suma, i) => suma + i.cantidad * i.precio_unitario, 0));
    const descuento = redondear(items.reduce((suma, i) => suma + i.descuento, 0));
    return { subtotal, descuento, total: redondear(subtotal - descuento) };
};

// Datos del cliente: si viene un paciente registrado, se completan con su ficha
const resolverCliente = async (client, body) => {
    const pacienteId = textoOpcional(body.paciente_id);
    let nombre = textoOpcional(body.cliente_nombre);
    let telefono = textoOpcional(body.cliente_telefono);
    let dpi = textoOpcional(body.cliente_dpi);
    let email = textoOpcional(body.cliente_email);

    if (pacienteId) {
        const { rows } = await client.query(
            'SELECT id, nombre, apellido_paterno, apellido_materno, telefono, dpi, email FROM pacientes WHERE id = $1',
            [pacienteId]
        );
        if (rows.length === 0) throw errorConEstado('El paciente seleccionado no existe', 404);
        const p = rows[0];
        nombre = nombre || [p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(' ');
        telefono = telefono || p.telefono || null;
        dpi = dpi || p.dpi || null;
        email = email || p.email || null;
    }

    if (!nombre) throw errorConEstado('El nombre del cliente es obligatorio');
    return { pacienteId, nombre, telefono, dpi, email };
};

const guardarItems = async (client, cotizacionId, items) => {
    await client.query('DELETE FROM cotizacion_items WHERE cotizacion_id = $1', [cotizacionId]);
    for (const item of items) {
        await client.query(`
            INSERT INTO cotizacion_items
                (cotizacion_id, orden, descripcion, tipo_item, cantidad, precio_unitario, descuento, total, medicina_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [cotizacionId, item.orden, item.descripcion, item.tipo_item, item.cantidad,
                item.precio_unitario, item.descuento, item.total, item.medicina_id]
        );
    }
};

const obtenerCotizacion = async (client, id) => {
    const { rows } = await client.query(`
        SELECT c.*,
               (c.created_at + make_interval(days => c.vigencia_dias))::date AS valida_hasta,
               NULLIF(TRIM(CONCAT_WS(' ', p.nombre, p.apellido_paterno, p.apellido_materno)), '') AS paciente_nombre
        FROM cotizaciones c
        LEFT JOIN pacientes p ON p.id = c.paciente_id
        WHERE c.id = $1`, [id]);
    if (rows.length === 0) return null;
    const items = await client.query(
        'SELECT * FROM cotizacion_items WHERE cotizacion_id = $1 ORDER BY orden, id', [id]
    );
    return { ...rows[0], items: items.rows };
};

const responderError = (res, error, accion) => {
    console.error(`Error al ${accion}:`, error);
    res.status(error.status || 500).json({
        success: false,
        message: error.status ? error.message : `Error al ${accion}`,
        error: error.message
    });
};

const cotizacionesController = {
    // GET /api/cotizaciones?estado=&q=
    async listar(req, res) {
        try {
            const { estado, q } = req.query;
            const values = [];
            const condiciones = [];
            if (estado) {
                values.push(estado);
                condiciones.push(`c.estado = $${values.length}`);
            }
            if (q && String(q).trim()) {
                values.push(`%${String(q).trim()}%`);
                condiciones.push(`(c.numero ILIKE $${values.length} OR c.cliente_nombre ILIKE $${values.length}
                    OR c.cliente_telefono ILIKE $${values.length} OR c.cliente_dpi ILIKE $${values.length}
                    OR c.motivo ILIKE $${values.length})`);
            }
            const { rows } = await db.query(`
                SELECT c.id, c.numero, c.paciente_id, c.cliente_nombre, c.cliente_telefono, c.cliente_dpi,
                       c.motivo, c.estado, c.vigencia_dias, c.subtotal, c.descuento, c.total,
                       c.numero_factura, c.fecha_generada, c.fecha_ingreso, c.created_at, c.updated_at,
                       (c.created_at + make_interval(days => c.vigencia_dias))::date AS valida_hasta,
                       (SELECT COUNT(*) FROM cotizacion_items i WHERE i.cotizacion_id = c.id)::int AS total_items
                FROM cotizaciones c
                ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
                ORDER BY c.created_at DESC
                LIMIT 300`, values);
            res.json({ success: true, data: rows });
        } catch (error) {
            responderError(res, error, 'listar cotizaciones');
        }
    },

    // GET /api/cotizaciones/:id
    async obtener(req, res) {
        try {
            const cotizacion = await obtenerCotizacion(db, req.params.id);
            if (!cotizacion) return res.status(404).json({ success: false, message: 'Cotización no encontrada' });
            res.json({ success: true, data: cotizacion });
        } catch (error) {
            responderError(res, error, 'obtener la cotización');
        }
    },

    // POST /api/cotizaciones  (estado: borrador | generada)
    async crear(req, res) {
        let client;
        try {
            const items = normalizarItems(req.body.items);
            const totales = calcularTotales(items);
            const estado = req.body.estado === 'generada' ? 'generada' : 'borrador';
            const vigencia = Number(req.body.vigencia_dias) || 15;

            client = await db.connect();
            await client.query('BEGIN');
            const cliente = await resolverCliente(client, req.body);
            const { rows } = await client.query(
                "SELECT 'COT-' || LPAD(nextval('cotizaciones_numero_seq')::text, 6, '0') AS numero"
            );
            const id = generateId('COT');
            await client.query(`
                INSERT INTO cotizaciones (
                    id, numero, paciente_id, cliente_nombre, cliente_telefono, cliente_dpi, cliente_email,
                    motivo, notas, estado, vigencia_dias, subtotal, descuento, total, fecha_generada, usuario_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                    CASE WHEN $10::text = 'generada' THEN CURRENT_TIMESTAMP END, $15)`,
                [id, rows[0].numero, cliente.pacienteId, cliente.nombre, cliente.telefono, cliente.dpi, cliente.email,
                    textoOpcional(req.body.motivo), textoOpcional(req.body.notas), estado, vigencia,
                    totales.subtotal, totales.descuento, totales.total, Number(req.user?.id) || null]
            );
            await guardarItems(client, id, items);
            const cotizacion = await obtenerCotizacion(client, id);
            await client.query('COMMIT');
            res.status(201).json({ success: true, data: cotizacion });
        } catch (error) {
            if (client) await client.query('ROLLBACK');
            responderError(res, error, 'crear la cotización');
        } finally {
            if (client) client.release();
        }
    },

    // PUT /api/cotizaciones/:id
    async actualizar(req, res) {
        let client;
        try {
            const items = normalizarItems(req.body.items);
            const totales = calcularTotales(items);
            client = await db.connect();
            await client.query('BEGIN');

            const actual = await client.query('SELECT estado FROM cotizaciones WHERE id = $1 FOR UPDATE', [req.params.id]);
            if (actual.rows.length === 0) throw errorConEstado('Cotización no encontrada', 404);
            if (!ESTADOS_EDITABLES.includes(actual.rows[0].estado)) {
                throw errorConEstado(`Una cotización ${actual.rows[0].estado} ya no se puede modificar`, 409);
            }

            const cliente = await resolverCliente(client, req.body);
            const estado = req.body.estado === 'generada' ? 'generada' : (req.body.estado === 'borrador' ? 'borrador' : actual.rows[0].estado);
            await client.query(`
                UPDATE cotizaciones SET
                    paciente_id = $1, cliente_nombre = $2, cliente_telefono = $3, cliente_dpi = $4, cliente_email = $5,
                    motivo = $6, notas = $7, estado = $8, vigencia_dias = $9,
                    subtotal = $10, descuento = $11, total = $12,
                    fecha_generada = CASE WHEN $8::text = 'generada' THEN CURRENT_TIMESTAMP ELSE fecha_generada END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $13`,
                [cliente.pacienteId, cliente.nombre, cliente.telefono, cliente.dpi, cliente.email,
                    textoOpcional(req.body.motivo), textoOpcional(req.body.notas), estado,
                    Number(req.body.vigencia_dias) || 15, totales.subtotal, totales.descuento, totales.total, req.params.id]
            );
            await guardarItems(client, req.params.id, items);
            const cotizacion = await obtenerCotizacion(client, req.params.id);
            await client.query('COMMIT');
            res.json({ success: true, data: cotizacion });
        } catch (error) {
            if (client) await client.query('ROLLBACK');
            responderError(res, error, 'actualizar la cotización');
        } finally {
            if (client) client.release();
        }
    },

    // POST /api/cotizaciones/:id/ingresar  { paciente_id }
    // Convierte la cotización en una factura al estado de cuenta del paciente.
    async ingresar(req, res) {
        let client;
        try {
            const pacienteId = textoOpcional(req.body.paciente_id);
            const userId = Number(req.user?.id);
            if (!pacienteId) throw errorConEstado('Selecciona el paciente que ingresa');
            if (!Number.isInteger(userId)) throw errorConEstado('Usuario no válido');

            client = await db.connect();
            await client.query('BEGIN');
            const actual = await client.query('SELECT * FROM cotizaciones WHERE id = $1 FOR UPDATE', [req.params.id]);
            if (actual.rows.length === 0) throw errorConEstado('Cotización no encontrada', 404);
            const cotizacion = actual.rows[0];
            if (!ESTADOS_EDITABLES.includes(cotizacion.estado)) {
                throw errorConEstado(`Esta cotización ya está ${cotizacion.estado}`, 409);
            }

            const { rows: items } = await client.query(
                'SELECT * FROM cotizacion_items WHERE cotizacion_id = $1 ORDER BY orden, id', [cotizacion.id]
            );
            if (items.length === 0) throw errorConEstado('La cotización no tiene conceptos');

            // Precios con IVA incluido, como el resto de cargos del sistema
            const total = redondear(cotizacion.total);
            const base = redondear(total / (1 + IVA / 100));
            const itemsFactura = billingMejoradoController.normalizarItemsFactura(items.map(item => ({
                descripcion: item.descripcion,
                cantidad: Number(item.cantidad),
                precio_unitario: Number(item.precio_unitario),
                subtotal: redondear(Number(item.cantidad) * Number(item.precio_unitario)),
                descuento_total: Number(item.descuento),
                total_item: Number(item.total),
                tipo_item: item.tipo_item,
                medicina_id: item.medicina_id
            })));

            const factura = await billingMejoradoController.registrarFacturaPaciente(client, {
                pacienteId,
                userId,
                items: itemsFactura,
                totales: {
                    subtotal: Number(cotizacion.subtotal),
                    total_descuentos: Number(cotizacion.descuento),
                    base_impuesto: base,
                    total_impuestos: redondear(total - base),
                    total_neto: total
                },
                metodoPago: 'credito',
                observaciones: `Cotización ${cotizacion.numero}${cotizacion.motivo ? `: ${cotizacion.motivo}` : ''}`
            });

            await client.query(`
                UPDATE cotizaciones SET
                    estado = 'ingresada', paciente_id = $1, venta_id = $2, numero_factura = $3,
                    fecha_ingreso = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = $4`,
                [pacienteId, factura.facturaId, factura.numeroFactura, cotizacion.id]
            );
            const resultado = await obtenerCotizacion(client, cotizacion.id);
            await client.query('COMMIT');
            res.json({ success: true, message: `Cotización cargada al estado de cuenta (factura ${factura.numeroFactura})`, data: resultado });
        } catch (error) {
            if (client) await client.query('ROLLBACK');
            responderError(res, error, 'ingresar la cotización');
        } finally {
            if (client) client.release();
        }
    },

    // POST /api/cotizaciones/:id/anular  { motivo }
    async anular(req, res) {
        try {
            const motivo = textoOpcional(req.body.motivo);
            if (!motivo) throw errorConEstado('Indica el motivo de la anulación');
            const { rows } = await db.query(`
                UPDATE cotizaciones SET estado = 'anulada', motivo_anulacion = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2 AND estado IN ('borrador', 'generada')
                RETURNING id`, [motivo, req.params.id]);
            if (rows.length === 0) throw errorConEstado('La cotización no existe o ya no se puede anular', 409);
            res.json({ success: true, message: 'Cotización anulada' });
        } catch (error) {
            responderError(res, error, 'anular la cotización');
        }
    },

    // ---------- Plantillas ----------
    async listarPlantillas(req, res) {
        try {
            const { rows } = await db.query(
                'SELECT * FROM cotizacion_plantillas WHERE activo = true ORDER BY nombre'
            );
            res.json({ success: true, data: rows });
        } catch (error) {
            responderError(res, error, 'listar plantillas');
        }
    },

    async guardarPlantilla(req, res) {
        try {
            const nombre = textoOpcional(req.body.nombre);
            if (!nombre) throw errorConEstado('La plantilla necesita un nombre');
            const items = normalizarItems(req.body.items).map(({ orden, total, ...item }) => item);
            const id = req.params.id;
            const { rows } = id
                ? await db.query(`
                    UPDATE cotizacion_plantillas SET nombre = $1, descripcion = $2, items = $3::jsonb, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $4 RETURNING *`, [nombre, textoOpcional(req.body.descripcion), JSON.stringify(items), id])
                : await db.query(`
                    INSERT INTO cotizacion_plantillas (nombre, descripcion, items)
                    VALUES ($1, $2, $3::jsonb) RETURNING *`, [nombre, textoOpcional(req.body.descripcion), JSON.stringify(items)]);
            if (rows.length === 0) throw errorConEstado('Plantilla no encontrada', 404);
            res.status(id ? 200 : 201).json({ success: true, data: rows[0] });
        } catch (error) {
            if (error.code === '23505') error = errorConEstado('Ya existe una plantilla con ese nombre', 409);
            responderError(res, error, 'guardar la plantilla');
        }
    },

    async eliminarPlantilla(req, res) {
        try {
            const { rowCount } = await db.query('DELETE FROM cotizacion_plantillas WHERE id = $1', [req.params.id]);
            if (rowCount === 0) throw errorConEstado('Plantilla no encontrada', 404);
            res.json({ success: true, message: 'Plantilla eliminada' });
        } catch (error) {
            responderError(res, error, 'eliminar la plantilla');
        }
    }
};

module.exports = cotizacionesController;
