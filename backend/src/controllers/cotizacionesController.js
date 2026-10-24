// ============================================
// CONTROLADOR DE COTIZACIONES
// Cotizaciones para pacientes o interesados, con plantillas reutilizables.
// Cada una indica la empresa que la emite (A o B) y el IVA que se suma al total.
// Al ingresar al paciente, la cotización solo queda guardada en su ficha
// (no genera cargos), para llevar la cuenta de cuántas veces cotiza.
// ============================================

const db = require('../db/connection');
const { generateId } = require('../utils/helpers');

const ESTADOS_EDITABLES = ['borrador', 'generada'];
const EMPRESAS = ['A', 'B'];
const IVA_OPCIONES = [12, 5, 0];

// Las columnas de empresa e IVA llegan con npm run migrate:cotizaciones.
// Mientras no se corra, las cotizaciones se guardan como antes (IVA 12 % incluido).
let empresaIvaCache = { valor: false, hasta: 0 };
const empresaIvaDisponible = async () => {
    if (Date.now() < empresaIvaCache.hasta) return empresaIvaCache.valor;
    const { rows } = await db.query(`
        SELECT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'cotizaciones' AND column_name = 'iva_monto') AS listo`);
    const valor = rows[0].listo;
    empresaIvaCache = { valor, hasta: valor ? Infinity : Date.now() + 60000 };
    return valor;
};

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

// Valida los conceptos y calcula el total de cada uno.
// Cada concepto debe venir del listado de artículos o del de medicinas.
const normalizarItems = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        throw errorConEstado('Agrega al menos un concepto a la cotización');
    }
    return items.map((item, index) => {
        const descripcion = String(item.descripcion || '').trim();
        const articuloId = textoOpcional(item.articulo_id);
        const medicinaId = textoOpcional(item.medicina_id);
        const cantidad = Number(item.cantidad);
        const precioUnitario = Number(item.precio_unitario);
        const descuento = Number(item.descuento || 0);
        const nombre = descripcion || `El concepto ${index + 1}`;
        if (Boolean(articuloId) === Boolean(medicinaId)) {
            throw errorConEstado(`${nombre} debe elegirse del listado de artículos o de medicinas`);
        }
        if (!Number.isInteger(cantidad) || cantidad <= 0) throw errorConEstado(`Cantidad no válida en "${nombre}" (debe ser un número entero mayor a 0)`);
        if (!Number.isFinite(precioUnitario) || precioUnitario < 0) throw errorConEstado(`Precio no válido en "${nombre}"`);
        const subtotal = redondear(cantidad * precioUnitario);
        if (!Number.isFinite(descuento) || descuento < 0 || descuento > subtotal) throw errorConEstado(`Descuento no válido en "${nombre}"`);
        return {
            orden: index,
            descripcion,
            contenido: textoOpcional(String(item.contenido ?? '').replace(/\r\n/g, '\n')),
            tipo_item: medicinaId ? 'medicina' : (String(item.tipo_item || 'general').trim() || 'general'),
            cantidad,
            precio_unitario: redondear(precioUnitario),
            descuento: redondear(descuento),
            total: redondear(subtotal - descuento),
            articulo_id: articuloId,
            medicina_id: medicinaId
        };
    });
};

// Comprueba que los artículos y medicinas existan y toma el nombre del catálogo
const validarCatalogo = async (client, items) => {
    const articuloIds = [...new Set(items.map(i => i.articulo_id).filter(Boolean))];
    const medicinaIds = [...new Set(items.map(i => i.medicina_id).filter(Boolean))];
    const [articulos, medicinas] = await Promise.all([
        articuloIds.length
            ? client.query('SELECT id::text AS id, nombre_articulo AS nombre FROM codigos_articulos WHERE id::text = ANY($1::text[])', [articuloIds])
            : { rows: [] },
        medicinaIds.length
            ? client.query('SELECT id::text AS id, nombre FROM medicinas WHERE id::text = ANY($1::text[])', [medicinaIds])
            : { rows: [] }
    ]);
    const nombresArticulos = new Map(articulos.rows.map(r => [r.id, r.nombre]));
    const nombresMedicinas = new Map(medicinas.rows.map(r => [r.id, r.nombre]));
    return items.map(item => {
        const nombre = item.articulo_id ? nombresArticulos.get(item.articulo_id) : nombresMedicinas.get(item.medicina_id);
        if (!nombre) {
            const listado = item.articulo_id ? 'artículos' : 'medicinas';
            throw errorConEstado(`"${item.descripcion || 'Un concepto'}" ya no existe en el listado de ${listado}`);
        }
        return { ...item, descripcion: String(nombre).trim() };
    });
};

// Empresa que emite y IVA. iva_porcentaje null = cotización anterior, con el IVA del 12 % ya en los precios.
const leerFacturacion = (body) => {
    const empresa = String(body.empresa || 'A').trim().toUpperCase();
    if (!EMPRESAS.includes(empresa)) throw errorConEstado('Elige la empresa A o la empresa B');
    if (body.iva_porcentaje === null || body.iva_porcentaje === 'incluido') return { empresa, ivaPorcentaje: null };
    const ivaPorcentaje = Number(body.iva_porcentaje ?? 12);
    if (!IVA_OPCIONES.includes(ivaPorcentaje)) throw errorConEstado('El IVA debe ser 12 %, 5 % o sin IVA');
    return { empresa, ivaPorcentaje };
};

// El IVA se calcula sobre el monto ya descontado y se suma al total, como en el estado de cuenta
const calcularTotales = (items, ivaPorcentaje = null) => {
    const subtotal = redondear(items.reduce((suma, i) => suma + i.cantidad * i.precio_unitario, 0));
    const descuento = redondear(items.reduce((suma, i) => suma + i.descuento, 0));
    const base = redondear(subtotal - descuento);
    const iva = ivaPorcentaje ? redondear(base * ivaPorcentaje / 100) : 0;
    return { subtotal, descuento, iva, total: redondear(base + iva) };
};

const guardarFacturacion = async (client, id, facturacion, totales) => {
    await client.query(
        'UPDATE cotizaciones SET empresa = $1, iva_porcentaje = $2, iva_monto = $3 WHERE id = $4',
        [facturacion.empresa, facturacion.ivaPorcentaje, totales.iva, id]
    );
};

// Datos del cliente: si viene un paciente registrado, se completan con su ficha
const resolverCliente = async (client, body) => {
    const pacienteId = textoOpcional(body.paciente_id);
    let nombre = textoOpcional(body.cliente_nombre);
    let telefono = textoOpcional(body.cliente_telefono);
    let dpi = textoOpcional(body.cliente_dpi);
    let email = textoOpcional(body.cliente_email);
    const responsable = textoOpcional(body.cliente_responsable);

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
    return { pacienteId, nombre, telefono, dpi, email, responsable };
};

// Cuántas cotizaciones (sin contar las anuladas) tiene el paciente de esta cotización
const SQL_VECES_PACIENTE = `(SELECT COUNT(*) FROM cotizaciones c2
    WHERE c.paciente_id IS NOT NULL AND c2.paciente_id = c.paciente_id AND c2.estado <> 'anulada')::int AS veces_paciente`;

const guardarItems = async (client, cotizacionId, items) => {
    await client.query('DELETE FROM cotizacion_items WHERE cotizacion_id = $1', [cotizacionId]);
    for (const item of items) {
        await client.query(`
            INSERT INTO cotizacion_items
                (cotizacion_id, orden, descripcion, contenido, tipo_item, cantidad, precio_unitario, descuento, total, articulo_id, medicina_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [cotizacionId, item.orden, item.descripcion, item.contenido, item.tipo_item, item.cantidad,
                item.precio_unitario, item.descuento, item.total, item.articulo_id, item.medicina_id]
        );
    }
};

const obtenerCotizacion = async (client, id) => {
    const { rows } = await client.query(`
        SELECT c.*,
               (c.created_at + make_interval(days => c.vigencia_dias))::date AS valida_hasta,
               NULLIF(TRIM(CONCAT_WS(' ', p.nombre, p.apellido_paterno, p.apellido_materno)), '') AS paciente_nombre,
               NULLIF(TRIM(CONCAT_WS(' ', u.nombre, u.apellido)), '') AS cotizador_nombre,
               ${SQL_VECES_PACIENTE}
        FROM cotizaciones c
        LEFT JOIN pacientes p ON p.id = c.paciente_id
        LEFT JOIN users u ON u.id = c.usuario_id
        WHERE c.id = $1`, [id]);
    if (rows.length === 0) return null;
    const items = await client.query(
        'SELECT * FROM cotizacion_items WHERE cotizacion_id = $1 ORDER BY orden, id', [id]
    );
    return { ...rows[0], items: items.rows };
};

const avisoSinMigracion = conFacturacion => conFacturacion ? undefined
    : 'Se guardó con el IVA del 12 % incluido: la empresa y el IVA elegidos se guardarán cuando se corra npm run migrate:cotizaciones';

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
            const { estado, q, paciente_id: pacienteId } = req.query;
            const values = [];
            const condiciones = [];
            if (pacienteId) {
                values.push(String(pacienteId));
                condiciones.push(`c.paciente_id::text = $${values.length}`);
            }
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
                       to_jsonb(c)->>'empresa' AS empresa, (to_jsonb(c)->>'iva_porcentaje')::numeric AS iva_porcentaje,
                       COALESCE((to_jsonb(c)->>'iva_monto')::numeric, 0) AS iva_monto,
                       ${SQL_VECES_PACIENTE},
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
            const estado = req.body.estado === 'generada' ? 'generada' : 'borrador';
            const vigencia = Number(req.body.vigencia_dias) || 15;

            const conFacturacion = await empresaIvaDisponible();
            const facturacion = leerFacturacion(req.body);
            client = await db.connect();
            const items = await validarCatalogo(client, normalizarItems(req.body.items));
            const totales = calcularTotales(items, conFacturacion ? facturacion.ivaPorcentaje : null);
            await client.query('BEGIN');
            const cliente = await resolverCliente(client, req.body);
            const { rows } = await client.query(
                `SELECT 'COT-' || LPAD(n::text, GREATEST(3, LENGTH(n::text)), '0') AS numero
                 FROM (SELECT nextval('cotizaciones_numero_seq') AS n) s`
            );
            const id = generateId('COT');
            await client.query(`
                INSERT INTO cotizaciones (
                    id, numero, paciente_id, cliente_nombre, cliente_telefono, cliente_dpi, cliente_email,
                    motivo, notas, estado, vigencia_dias, subtotal, descuento, total, fecha_generada, usuario_id,
                    cliente_responsable
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                    CASE WHEN $17::boolean THEN CURRENT_TIMESTAMP END, $15, $16)`,
                [id, rows[0].numero, cliente.pacienteId, cliente.nombre, cliente.telefono, cliente.dpi, cliente.email,
                    textoOpcional(req.body.motivo), textoOpcional(req.body.notas), estado, vigencia,
                    totales.subtotal, totales.descuento, totales.total, Number(req.user?.id) || null,
                    cliente.responsable, estado === 'generada']
            );
            if (conFacturacion) await guardarFacturacion(client, id, facturacion, totales);
            await guardarItems(client, id, items);
            const cotizacion = await obtenerCotizacion(client, id);
            await client.query('COMMIT');
            res.status(201).json({ success: true, data: cotizacion, aviso: avisoSinMigracion(conFacturacion) });
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
            const conFacturacion = await empresaIvaDisponible();
            const facturacion = leerFacturacion(req.body);
            client = await db.connect();
            const items = await validarCatalogo(client, normalizarItems(req.body.items));
            const totales = calcularTotales(items, conFacturacion ? facturacion.ivaPorcentaje : null);
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
                    fecha_generada = CASE WHEN $15::boolean THEN CURRENT_TIMESTAMP ELSE fecha_generada END,
                    cliente_responsable = $14,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $13`,
                [cliente.pacienteId, cliente.nombre, cliente.telefono, cliente.dpi, cliente.email,
                    textoOpcional(req.body.motivo), textoOpcional(req.body.notas), estado,
                    Number(req.body.vigencia_dias) || 15, totales.subtotal, totales.descuento, totales.total, req.params.id,
                    cliente.responsable, estado === 'generada']
            );
            if (conFacturacion) await guardarFacturacion(client, req.params.id, facturacion, totales);
            await guardarItems(client, req.params.id, items);
            const cotizacion = await obtenerCotizacion(client, req.params.id);
            await client.query('COMMIT');
            res.json({ success: true, data: cotizacion, aviso: avisoSinMigracion(conFacturacion) });
        } catch (error) {
            if (client) await client.query('ROLLBACK');
            responderError(res, error, 'actualizar la cotización');
        } finally {
            if (client) client.release();
        }
    },

    // POST /api/cotizaciones/:id/ingresar  { paciente_id }
    // Guarda la cotización en la ficha del paciente. No genera cargos en su estado de cuenta.
    async ingresar(req, res) {
        try {
            const pacienteId = textoOpcional(req.body.paciente_id);
            if (!pacienteId) throw errorConEstado('Selecciona el paciente');
            const paciente = await db.query('SELECT id FROM pacientes WHERE id::text = $1', [pacienteId]);
            if (paciente.rows.length === 0) throw errorConEstado('El paciente seleccionado no existe', 404);

            const { rows } = await db.query(`
                UPDATE cotizaciones SET
                    estado = 'ingresada', paciente_id = $1, fecha_ingreso = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2 AND estado IN ('borrador', 'generada')
                RETURNING id`, [paciente.rows[0].id, req.params.id]);
            if (rows.length === 0) {
                const existe = await db.query('SELECT estado FROM cotizaciones WHERE id = $1', [req.params.id]);
                if (existe.rows.length === 0) throw errorConEstado('Cotización no encontrada', 404);
                const estado = existe.rows[0].estado === 'ingresada' ? 'en la ficha del paciente' : existe.rows[0].estado;
                throw errorConEstado(`Esta cotización ya está ${estado}`, 409);
            }
            const resultado = await obtenerCotizacion(db, req.params.id);
            res.json({ success: true, message: `Cotización ${resultado.numero} guardada en la ficha del paciente`, data: resultado });
        } catch (error) {
            responderError(res, error, 'ingresar la cotización');
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
            const items = (await validarCatalogo(db, normalizarItems(req.body.items))).map(({ orden, total, ...item }) => item);
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

    // Solo administrador. Los cargos de cotizaciones ingresadas con la versión anterior se conservan.
    async eliminar(req, res) {
        try {
            const { rowCount } = await db.query('DELETE FROM cotizaciones WHERE id = $1', [req.params.id]);
            if (rowCount === 0) throw errorConEstado('Cotización no encontrada', 404);
            res.json({ success: true, message: 'Cotización eliminada' });
        } catch (error) {
            responderError(res, error, 'eliminar la cotización');
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
