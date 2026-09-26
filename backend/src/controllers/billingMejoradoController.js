// ============================================
// CONTROLADOR DE FACTURACIÓN MEJORADA
// Integración con saldo de paciente
// ============================================

const db = require('../db/connection');
const { generateId } = require('../utils/helpers');

class BillingMejoradoController {
    /**
     * Crear factura mejorada con integración a saldo
     */
    async createFacturaMejorada(req, res) {
        let client;
        try {
            const { paciente_id, items = [], totales = {}, metodo_pago = 'efectivo', observaciones = '' } = req.body;
            const pacienteId = String(paciente_id || '').trim();
            const userId = Number(req.user.id);
            const total = Number(totales.total_neto);

            if (!pacienteId || !items.length) {
                return res.status(400).json({ success: false, message: 'Paciente e items son requeridos' });
            }
            if (!Number.isInteger(userId) || !Number.isFinite(total) || total < 0) {
                return res.status(400).json({ success: false, message: 'Usuario o totales no válidos' });
            }

            const normalizedItems = items.map((item, index) => {
                const cantidad = Number(item.cantidad);
                const precioUnitario = Number(item.precio_unitario);
                const subtotal = Number(item.subtotal ?? cantidad * precioUnitario);
                const descuento = Number(item.descuento_total || 0);
                const itemTotal = Number(item.total_item ?? subtotal - descuento);
                if (!String(item.descripcion || '').trim() || cantidad <= 0 ||
                    ![precioUnitario, subtotal, descuento, itemTotal].every(Number.isFinite)) {
                    const error = new Error(`Concepto ${index + 1} no válido`);
                    error.status = 400;
                    throw error;
                }
                return {
                    descripcion: String(item.descripcion).trim(),
                    cantidad,
                    precioUnitario,
                    subtotal,
                    descuento,
                    itemTotal,
                    tipoItem: String(item.tipo_item || 'general'),
                    medicinaId: item.medicina_id || null
                };
            });

            client = await db.connect();
            await client.query('BEGIN');
            await client.query("SELECT pg_advisory_xact_lock(hashtext('facturas_numero_correlativo'))");
            const paciente = await client.query('SELECT id FROM pacientes WHERE id = $1', [pacienteId]);
            if (paciente.rows.length === 0) {
                const error = new Error('Paciente no encontrado');
                error.status = 404;
                throw error;
            }

            const numeroFactura = await this.generarNumeroFactura(client);
            const facturaId = generateId('FAC');
            const subtotal = Number(totales.subtotal || 0);
            const descuento = Number(totales.total_descuentos || 0);
            const impuesto = Number(totales.total_impuestos || 0);
            await client.query(`
                INSERT INTO ventas (
                    id, numero_venta, numero_factura, paciente_id, user_id, fecha, hora,
                    subtotal, descuento, impuesto, total, metodo_pago, estado, observaciones,
                    subtotal_original, total_descuentos, total_impuestos, base_impuesto, tipo_factura
                ) VALUES ($1, $2, $2, $3, $4, CURRENT_DATE, CURRENT_TIME,
                    $5, $6, $7, $8, $9, 'completada', $10, $5, $6, $7, $11, 'paciente')`,
                [facturaId, numeroFactura, pacienteId, userId, subtotal, descuento, impuesto,
                    total, metodo_pago, observaciones || null, Number(totales.base_impuesto || 0)]
            );

            for (const item of normalizedItems) {
                await client.query(`
                    INSERT INTO venta_items (
                        id, venta_id, descripcion, cantidad, precio_unitario, subtotal,
                        descuento, total, tipo_item, medicina_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [generateId('ITEM'), facturaId, item.descripcion, item.cantidad,
                        item.precioUnitario, item.subtotal, item.descuento, item.itemTotal,
                        item.tipoItem, item.medicinaId]
                );
            }

            const saldoResult = await client.query(`
                INSERT INTO pacientes_saldo (paciente_id, saldo_pendiente, total_deuda, usuario_actualizo)
                VALUES ($1, $2, $2, $3)
                ON CONFLICT (paciente_id) DO UPDATE SET
                    saldo_pendiente = pacientes_saldo.saldo_pendiente + EXCLUDED.saldo_pendiente,
                    total_deuda = pacientes_saldo.total_deuda + EXCLUDED.total_deuda,
                    ultima_transaccion = CURRENT_TIMESTAMP,
                    usuario_actualizo = EXCLUDED.usuario_actualizo,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING saldo_pendiente`,
                [pacienteId, total, String(userId)]
            );
            const saldoNuevo = Number(saldoResult.rows[0].saldo_pendiente);
            await client.query(`
                INSERT INTO movimientos_paciente (
                    paciente_id, tipo, descripcion, monto, saldo_anterior,
                    saldo_nuevo, referencia_id, usuario_id
                ) VALUES ($1, 'factura', $2, $3, $4, $5, $6, $7)`,
                [pacienteId, `Factura ${numeroFactura}`, total, saldoNuevo - total,
                    saldoNuevo, facturaId, userId]
            );
            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Factura creada como venta y cargada al estado de cuenta',
                data: { id: facturaId, numero_factura: numeroFactura, paciente_id: pacienteId,
                    totales: { ...totales, total: total, total_neto: total }, fecha: new Date().toISOString(), metodo_pago }
            });
        } catch (error) {
            if (client) await client.query('ROLLBACK');
            console.error('Error al crear factura:', error);
            res.status(error.status || 500).json({
                success: false,
                message: 'Error al crear la factura',
                error: error.message
            });
        } finally {
            if (client) client.release();
        }
    }

    /**
     * Obtener estado de cuenta detallado de un paciente
     */
    async getEstadoCuenta(req, res) {
        try {
            const { paciente_id } = req.params;
            const pacienteId = String(paciente_id || '').trim();
            if (!pacienteId) {
                return res.status(400).json({
                    success: false,
                    message: 'paciente_id es requerido'
                });
            }

            // Obtener datos del paciente
            const queryPaciente = `
                SELECT id, nombre, apellido_paterno, apellido_materno, dpi, telefono
                FROM pacientes
                WHERE id = $1
            `;
            const resPaciente = await db.query(queryPaciente, [pacienteId]);

            if (resPaciente.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Paciente no encontrado'
                });
            }

            const paciente = resPaciente.rows[0];

            // Obtener saldo actual
            const querySaldo = `
                SELECT saldo_pendiente, total_deuda, ultima_transaccion
                FROM pacientes_saldo
                WHERE paciente_id = $1
            `;
            const resSaldo = await db.query(querySaldo, [pacienteId]);
            const saldo = resSaldo.rows[0] || { saldo_pendiente: 0, total_deuda: 0 };

            // Obtener movimientos
            const queryMovimientos = `
                SELECT 
                    id, tipo, descripcion, monto, saldo_anterior, saldo_nuevo,
                    fecha, referencia_id
                FROM movimientos_paciente
                WHERE paciente_id = $1
                ORDER BY fecha DESC
                LIMIT 100
            `;
            const resMovimientos = await db.query(queryMovimientos, [pacienteId]);

            // Obtener facturas
            const queryFacturas = `
                SELECT 
                    id, numero_factura, fecha, subtotal, total_descuentos,
                    total_impuestos, total, metodo_pago, estado
                FROM ventas
                WHERE paciente_id = $1
                ORDER BY fecha DESC
                LIMIT 50
            `;
            const resFacturas = await db.query(queryFacturas, [pacienteId]);

            // Procesar movimientos para incluir saldo acumulado
            const movimientos = resMovimientos.rows.map(mov => ({
                fecha: mov.fecha,
                descripcion: mov.descripcion,
                tipo: mov.tipo,
                monto: mov.monto,
                saldo_acumulado: mov.saldo_nuevo
            }));

            // Calcular totales
            const totalCargos = resFacturas.rows.reduce((sum, f) => sum + parseFloat(f.total || 0), 0);
            const totalAbonos = movimientos
                .filter(m => m.tipo === 'pago')
                .reduce((sum, m) => sum + parseFloat(m.monto || 0), 0);

            const totales = {
                total_cargos: totalCargos,
                total_abonos: totalAbonos,
                saldo_actual: saldo.saldo_pendiente || 0
            };

            res.json({
                success: true,
                data: {
                    paciente,
                    movimientos,
                    facturas: resFacturas.rows,
                    totales,
                    saldo
                }
            });

        } catch (error) {
            console.error('Error al obtener estado de cuenta:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estado de cuenta',
                error: error.message
            });
        }
    }

    /**
     * Listar saldos actuales de todos los pacientes
     */
    async listSaldosPacientes(req, res) {
        try {
            const result = await db.query(`
                SELECT paciente_id, saldo_pendiente, total_deuda, ultima_transaccion
                FROM pacientes_saldo
                ORDER BY ultima_transaccion DESC NULLS LAST
            `);

            res.json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            console.error('Error al listar saldos de pacientes:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener saldos de pacientes',
                error: error.message
            });
        }
    }

    /**
     * Obtener saldo del paciente
     */
    async getSaldoPaciente(req, res) {
        try {
            const { paciente_id } = req.params;
            const pacienteId = String(paciente_id || '').trim();
            if (!pacienteId) {
                return res.status(400).json({
                    success: false,
                    message: 'paciente_id es requerido'
                });
            }

            const query = `
                SELECT 
                    id, paciente_id, saldo_pendiente, total_deuda,
                    ultima_transaccion, usuario_actualizo
                FROM pacientes_saldo
                WHERE paciente_id = $1
            `;

            const result = await db.query(query, [pacienteId]);

            if (result.rows.length === 0) {
                return res.json({
                    success: true,
                    data: {
                        paciente_id: pacienteId,
                        saldo_pendiente: 0,
                        total_deuda: 0,
                        ultima_transaccion: null
                    }
                });
            }

            res.json({
                success: true,
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Error al obtener saldo:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener saldo',
                error: error.message
            });
        }
    }

    /**
     * Listar facturas
     */
    async listFacturas(req, res) {
        try {
            const { paciente_id, limit = 50, offset = 0 } = req.query;

            let query = 'SELECT * FROM ventas WHERE paciente_id IS NOT NULL';
            const params = [];
            let paramCount = 1;

            if (paciente_id) {
                query += ` AND paciente_id = $${paramCount}`;
                params.push(paciente_id);
                paramCount++;
            }

            query += ` ORDER BY fecha DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
            params.push(limit, offset);

            const result = await db.query(query, params);

            res.json({
                success: true,
                data: result.rows,
                total: result.rows.length
            });

        } catch (error) {
            console.error('Error al listar facturas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al listar facturas',
                error: error.message
            });
        }
    }

    /**
     * Listar pagos registrados
     */
    async listPagos(req, res) {
        try {
            const { paciente_id } = req.query;
            const params = [];
            let whereCondition = "WHERE tipo = 'pago'";

            if (paciente_id) {
                params.push(String(paciente_id).trim());
                whereCondition += ' AND paciente_id = $1';
            }

            const result = await db.query(`
                SELECT id, paciente_id, fecha, monto, descripcion,
                       referencia_id AS referencia
                FROM movimientos_paciente
                ${whereCondition}
                ORDER BY fecha DESC, id DESC
            `, params);

            const data = result.rows.map(pago => ({
                ...pago,
                monto: Number(pago.monto) || 0,
                metodo: this.extractPaymentMethod(pago.descripcion),
                moneda: 'GTQ'
            }));

            res.json({ success: true, data, moneda: 'GTQ' });
        } catch (error) {
            console.error('Error al listar pagos:', error);
            res.status(500).json({
                success: false,
                message: 'Error al listar pagos',
                error: error.message
            });
        }
    }

    /**
     * Registrar pago/abono a saldo
     */
    async registrarPago(req, res) {
        let client;
        try {
            const {
                paciente_id,
                monto,
                metodo_pago,
                metodo,
                referencia,
                voucher,
                numero_cheque,
                numero_autorizacion,
                observaciones = ''
            } = req.body;

            const user_id = Number(req.user.id);
            const pacienteId = String(paciente_id || '').trim();
            const montoPago = Number(monto);
            const metodoPago = metodo_pago || metodo || 'efectivo';
            const referenciaPago = referencia || voucher || numero_cheque || numero_autorizacion || null;

            if (!pacienteId || !Number.isFinite(montoPago) || montoPago <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Paciente y monto requeridos'
                });
            }
            if (!Number.isInteger(user_id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Usuario no válido'
                });
            }

            client = await db.connect();
            await client.query('BEGIN');
            const resSaldo = await client.query(
                'SELECT * FROM pacientes_saldo WHERE paciente_id = $1 FOR UPDATE',
                [pacienteId]
            );
            if (resSaldo.rows.length === 0) {
                const error = new Error('No hay saldo registrado para este paciente');
                error.status = 404;
                throw error;
            }

            const saldoAnterior = Number(resSaldo.rows[0].saldo_pendiente);
            const saldoNuevo = Math.max(0, saldoAnterior - montoPago);
            await client.query(`
                UPDATE pacientes_saldo
                SET saldo_pendiente = $1, ultima_transaccion = CURRENT_TIMESTAMP,
                    usuario_actualizo = $2, updated_at = CURRENT_TIMESTAMP
                WHERE paciente_id = $3`,
                [saldoNuevo, String(user_id), pacienteId]
            );
            const movimientoResult = await client.query(`
                INSERT INTO movimientos_paciente (
                    paciente_id, tipo, descripcion, monto, saldo_anterior,
                    saldo_nuevo, referencia_id, usuario_id
                ) VALUES ($1, 'pago', $2, $3, $4, $5, $6, $7)
                RETURNING id, paciente_id, fecha, monto, descripcion, referencia_id AS referencia`,
                [pacienteId, `Pago ${metodoPago}${observaciones ? ': ' + observaciones : ''}`,
                    montoPago, saldoAnterior, saldoNuevo, referenciaPago, user_id]
            );
            await client.query('COMMIT');
            res.json({
                success: true,
                message: 'Pago registrado exitosamente',
                data: {
                    ...movimientoResult.rows[0],
                    monto: montoPago,
                    metodo: metodoPago,
                    moneda: 'GTQ',
                    saldo_anterior: saldoAnterior,
                    saldo_nuevo: saldoNuevo
                }
            });

        } catch (error) {
            if (client) await client.query('ROLLBACK');
            console.error('Error al registrar pago:', error);
            res.status(error.status || 500).json({
                success: false,
                message: 'Error al registrar pago',
                error: error.message
            });
        } finally {
            if (client) client.release();
        }
    }

    extractPaymentMethod(description = '') {
        const match = String(description).match(/^Pago\s+([^:]+)/i);
        return match ? match[1].trim().toLowerCase() : 'efectivo';
    }

    /**
     * Obtener estado de cuenta detallado con items agrupados por categoría
     */
    async getEstadoCuentaDetallado(req, res) {
        try {
            const { paciente_id } = req.params;
            const pacienteId = String(paciente_id || '').trim();
            if (!pacienteId) {
                return res.status(400).json({
                    success: false,
                    message: 'paciente_id es requerido'
                });
            }

            // Obtener datos del paciente
            const queryPaciente = `
                SELECT id, nombre, apellido_paterno, apellido_materno, dpi, telefono
                FROM pacientes
                WHERE id = $1
            `;
            const resPaciente = await db.query(queryPaciente, [pacienteId]);

            if (resPaciente.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Paciente no encontrado'
                });
            }

            const paciente = resPaciente.rows[0];

            // Obtener saldo actual
            const querySaldo = `
                SELECT saldo_pendiente, total_deuda
                FROM pacientes_saldo
                WHERE paciente_id = $1
            `;
            const resSaldo = await db.query(querySaldo, [pacienteId]);
            const saldo = resSaldo.rows[0] || { saldo_pendiente: 0, total_deuda: 0 };

            // Obtener todas las facturas con sus items agrupados por categoría
            const queryFacturas = `
                SELECT 
                    v.id, v.numero_factura, v.fecha, v.subtotal, 
                    v.total_descuentos, v.total_impuestos, v.total,
                    vi.id as item_id, vi.descripcion, vi.cantidad, 
                    vi.precio_unitario, vi.subtotal as item_subtotal,
                    vi.descuento as item_descuento,
                    vi.total as item_total,
                    vi.tipo_item
                FROM ventas v
                LEFT JOIN venta_items vi ON v.id = vi.venta_id
                WHERE v.paciente_id = $1
                ORDER BY v.fecha DESC, vi.descripcion
            `;
            const resFacturas = await db.query(queryFacturas, [pacienteId]);

            // Agrupar items por categoría
            const facturaMap = new Map();
            resFacturas.rows.forEach(row => {
                if (!facturaMap.has(row.numero_factura)) {
                    facturaMap.set(row.numero_factura, {
                        id: row.id,
                        numero_factura: row.numero_factura,
                        fecha: row.fecha,
                        subtotal: parseFloat(row.subtotal),
                        total_descuentos: parseFloat(row.total_descuentos),
                        total_impuestos: parseFloat(row.total_impuestos),
                        total: parseFloat(row.total),
                        categorias: {}
                    });
                }

                const factura = facturaMap.get(row.numero_factura);
                if (row.item_id) {
                    const esMedicamentoAnterior = (row.tipo_item === 'general' || !row.tipo_item) &&
                        /^Medicamento:/i.test(row.descripcion || '');
                    const categoria = esMedicamentoAnterior ? 'medicina' : (row.tipo_item || 'general');
                    const cantidad = Number(row.cantidad) || 0;
                    const precioUnitario = Number(row.precio_unitario) || 0;
                    const subtotal = Number(row.item_subtotal ?? cantidad * precioUnitario) || 0;
                    const descuento = Number(row.item_descuento) || 0;
                    const totalGuardado = Number(row.item_total);
                    const total = totalGuardado > 0 ? totalGuardado : Math.max(0, subtotal - descuento);
                    if (!factura.categorias[categoria]) {
                        factura.categorias[categoria] = [];
                    }
                    factura.categorias[categoria].push({
                        id: row.item_id,
                        descripcion: row.descripcion,
                        cantidad,
                        precio_unitario: precioUnitario,
                        subtotal,
                        descuento,
                        total
                    });
                }
            });

            // Convertir map a array
            const facturas = Array.from(facturaMap.values());

            const resMovimientos = await db.query(`
                SELECT id, tipo, descripcion, monto, saldo_anterior, saldo_nuevo, fecha, referencia_id
                FROM movimientos_paciente
                WHERE paciente_id = $1
                ORDER BY fecha DESC
            `, [pacienteId]);
            const movimientos = resMovimientos.rows.map(movimiento => ({
                ...movimiento,
                monto: Number(movimiento.monto) || 0,
                saldo_anterior: Number(movimiento.saldo_anterior) || 0,
                saldo_nuevo: Number(movimiento.saldo_nuevo) || 0
            }));
            const totalAbonos = movimientos
                .filter(movimiento => movimiento.tipo === 'pago')
                .reduce((total, movimiento) => total + movimiento.monto, 0);
            const saldoPendiente = Number(saldo.saldo_pendiente) || 0;

            // Calcular totales generales
            const totales = {
                subtotal_total: facturas.reduce((sum, f) => sum + f.subtotal, 0),
                descuentos_total: facturas.reduce((sum, f) => sum + f.total_descuentos, 0),
                impuestos_total: facturas.reduce((sum, f) => sum + f.total_impuestos, 0),
                total_facturado: facturas.reduce((sum, f) => sum + f.total, 0),
                total_abonos: totalAbonos,
                saldo_pendiente: saldoPendiente,
                saldo_favor: saldoPendiente < 0 ? Math.abs(saldoPendiente) : 0,
                moneda: 'GTQ'
            };

            res.json({
                success: true,
                data: {
                    paciente,
                    facturas,
                    movimientos,
                    totales,
                    saldo: {
                        ...saldo,
                        saldo_pendiente: saldoPendiente,
                        total_deuda: Number(saldo.total_deuda) || 0
                    },
                    moneda: 'GTQ'
                }
            });

        } catch (error) {
            console.error('Error al obtener estado de cuenta detallado:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estado de cuenta',
                error: error.message
            });
        }
    }

    /**
     * Generar número de factura
     */
    async generarNumeroFactura(databaseClient = db) {
        const query = `
            SELECT numero_factura FROM ventas
            WHERE numero_factura ~ $1
            ORDER BY ((regexp_match(numero_factura, '([0-9]+)$'))[1])::BIGINT DESC
            LIMIT 1
        `;
        try {
            const año = new Date().getFullYear();
            const result = await databaseClient.query(query, [`^FAC-${año}-[0-9]+$`]);
            const ultimo = result.rows[0]?.numero_factura;
            const numero = ultimo ? Number(ultimo.match(/(\d+)$/)?.[1] || 0) + 1 : 1;
            return `FAC-${año}-${String(numero).padStart(6, '0')}`;
        } catch {
            return `FAC-${Date.now()}`;
        }
    }
}

module.exports = new BillingMejoradoController();
