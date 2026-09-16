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
        try {
            const {
                paciente_id,
                items = [],
                descuentos = [],
                totales = {},
                metodo_pago = 'efectivo',
                observaciones = ''
            } = req.body;

            const user_id = parseInt(req.user.id, 10);
            const factura_id = generateId('FAC');
            const numero_factura = await this.generarNumeroFactura();

            // Validaciones
            if (!paciente_id || !items.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Paciente e items son requeridos'
                });
            }

            // Coercionar paciente_id a INTEGER si es string numérica
            const paciente_id_int = parseInt(paciente_id, 10);
            if (isNaN(paciente_id_int) || isNaN(user_id)) {
                return res.status(400).json({
                    success: false,
                    message: 'paciente_id y user_id deben ser números válidos'
                });
            }

            await db.query('BEGIN');

            try {
                // 1. Crear factura en tabla mejorada
                const queryFactura = `
                    INSERT INTO ventas_mejorada (
                        id, numero_factura, paciente_id, user_id, fecha,
                        subtotal, total_descuentos, base_impuesto, total_impuestos, total,
                        metodo_pago, observaciones, estado, tipo_factura
                    ) VALUES (
                        $1, $2, $3, $4, CURRENT_DATE,
                        $5, $6, $7, $8, $9,
                        $10, $11, 'completada', 'normal'
                    ) RETURNING *
                `;

                const resFactura = await db.query(queryFactura, [
                    factura_id,
                    numero_factura,
                    paciente_id_int,
                    user_id,
                    totales.subtotal || 0,
                    totales.total_descuentos || 0,
                    totales.base_impuesto || 0,
                    totales.total_impuestos || 0,
                    totales.total || 0,
                    metodo_pago,
                    observaciones
                ]);

                // 2. Insertar items en tabla mejorada
                for (const item of items) {
                    const item_id = generateId('ITEM');
                    const descuento_item = item.descuento_total || 0;
                    const total_item = item.total_item || (item.subtotal - descuento_item);

                    await db.query(`
                        INSERT INTO venta_items_mejorada (
                            id, venta_id, descripcion, cantidad, precio_unitario,
                            subtotal, descuento, total, tipo_item
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'general')
                    `, [
                        item_id,
                        factura_id,
                        item.descripcion,
                        item.cantidad,
                        item.precio_unitario,
                        item.subtotal,
                        descuento_item,
                        total_item
                    ]);

                    // 3. Insertar descuentos de item si existen
                    if (item.descuentos && item.descuentos.length > 0) {
                        for (const desc of item.descuentos) {
                            await db.query(`
                                INSERT INTO venta_item_descuentos_mejorada (
                                    id, venta_item_id, tipo_descuento, valor,
                                    monto_descuento, motivo, usuario_id
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                            `, [
                                generateId('IDESC'),
                                item_id,
                                desc.tipo,
                                desc.valor,
                                desc.monto || desc.monto_descuento,
                                desc.motivo,
                                user_id
                            ]);
                        }
                    }
                }

                // 4. Insertar descuentos de factura
                if (descuentos && descuentos.length > 0) {
                    for (const desc of descuentos) {
                        await db.query(`
                            INSERT INTO venta_descuentos_mejorada (
                                id, venta_id, tipo_descuento, valor,
                                monto_descuento, motivo, usuario_id
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                        `, [
                            generateId('VDESC'),
                            factura_id,
                            desc.tipo,
                            desc.valor,
                            desc.monto_aplicado || desc.monto,
                            desc.motivo,
                            user_id
                        ]);
                    }
                }

                // 5. Actualizar saldo del paciente
                const querySaldo = `
                    UPDATE pacientes_saldo
                    SET saldo_pendiente = saldo_pendiente + $1,
                        total_deuda = total_deuda + $2,
                        ultima_transaccion = CURRENT_TIMESTAMP,
                        usuario_actualizo = $3
                    WHERE paciente_id = $4
                    RETURNING *
                `;

                let resSaldo = await db.query(querySaldo, [
                    totales.total_neto || 0,
                    totales.total_neto || 0,
                    user_id,
                    paciente_id_int
                ]);

                let saldo_anterior = 0;
                const monto = parseFloat(totales.total_neto) || 0;

                // Si no existe el saldo, crear uno nuevo
                if (resSaldo.rows.length === 0) {
                    saldo_anterior = 0;  // No había saldo previo
                    const resSaldoNew = await db.query(`
                        INSERT INTO pacientes_saldo (
                            id, paciente_id, saldo_pendiente, total_deuda,
                            usuario_actualizo
                        ) VALUES ($1, $2, $3, $4, $5)
                        RETURNING *
                    `, [
                        generateId('SALDO'),
                        paciente_id_int,
                        monto,
                        monto,
                        user_id
                    ]);
                    resSaldo.rows = resSaldoNew.rows;
                } else {
                    // El UPDATE devuelve el saldo DESPUÉS, pero necesitamos el ANTERIOR
                    // Restar el monto que acabamos de sumar para obtener el anterior
                    const saldo_nuevo = parseFloat(resSaldo.rows[0]?.saldo_pendiente) || 0;
                    saldo_anterior = saldo_nuevo - monto;
                }

                // 6. Registrar movimiento en historial
                await db.query(`
                    INSERT INTO movimientos_paciente (
                        id, paciente_id, tipo, descripcion, monto, saldo_anterior,
                        saldo_nuevo, referencia_id, usuario_id, fecha
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
                `, [
                    generateId('MOV'),
                    paciente_id_int,
                    'factura',
                    `Factura ${numero_factura}`,
                    monto,
                    saldo_anterior,
                    saldo_anterior + monto,
                    factura_id,
                    user_id
                ]);

                await db.query('COMMIT');

                res.status(201).json({
                    success: true,
                    message: 'Factura creada exitosamente',
                    data: {
                        id: factura_id,
                        numero_factura: numero_factura,
                        paciente_id: paciente_id,
                        totales: totales,
                        fecha: new Date().toISOString(),
                        metodo_pago: metodo_pago
                    }
                });

            } catch (error) {
                await db.query('ROLLBACK');
                throw error;
            }

        } catch (error) {
            console.error('Error al crear factura:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear la factura',
                error: error.message
            });
        }
    }

    /**
     * Obtener estado de cuenta detallado de un paciente
     */
    async getEstadoCuenta(req, res) {
        try {
            const { paciente_id } = req.params;
            const paciente_id_int = parseInt(paciente_id, 10);
            if (isNaN(paciente_id_int)) {
                return res.status(400).json({
                    success: false,
                    message: 'paciente_id debe ser un número válido'
                });
            }

            // Obtener datos del paciente
            const queryPaciente = `
                SELECT id, nombre, apellido_paterno, apellido_materno, dpi, telefono
                FROM pacientes
                WHERE id = $1
            `;
            const resPaciente = await db.query(queryPaciente, [paciente_id_int]);

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
            const resSaldo = await db.query(querySaldo, [paciente_id_int]);
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
            const resMovimientos = await db.query(queryMovimientos, [paciente_id_int]);

            // Obtener facturas
            const queryFacturas = `
                SELECT 
                    id, numero_factura, fecha, subtotal, total_descuentos,
                    total_impuestos, total, metodo_pago, estado
                FROM ventas_mejorada
                WHERE paciente_id = $1
                ORDER BY fecha DESC
                LIMIT 50
            `;
            const resFacturas = await db.query(queryFacturas, [paciente_id_int]);

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
     * Obtener saldo del paciente
     */
    async getSaldoPaciente(req, res) {
        try {
            const { paciente_id } = req.params;
            const paciente_id_int = parseInt(paciente_id, 10);
            if (isNaN(paciente_id_int)) {
                return res.status(400).json({
                    success: false,
                    message: 'paciente_id debe ser un número válido'
                });
            }

            const query = `
                SELECT 
                    id, paciente_id, saldo_pendiente, total_deuda,
                    ultima_transaccion, usuario_actualizo
                FROM pacientes_saldo
                WHERE paciente_id = $1
            `;

            const result = await db.query(query, [paciente_id_int]);

            if (result.rows.length === 0) {
                return res.json({
                    success: true,
                    data: {
                        paciente_id: paciente_id_int,
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

            let query = 'SELECT * FROM ventas_mejorada WHERE 1=1';
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
     * Registrar pago/abono a saldo
     */
    async registrarPago(req, res) {
        try {
            const {
                paciente_id,
                monto,
                metodo_pago = 'efectivo',
                referencia = null,
                observaciones = ''
            } = req.body;

            const user_id = req.user.id;

            if (!paciente_id || !monto || monto <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Paciente y monto requeridos'
                });
            }

            // Coercionar paciente_id a INTEGER
            const paciente_id_int = parseInt(paciente_id, 10);
            if (isNaN(paciente_id_int)) {
                return res.status(400).json({
                    success: false,
                    message: 'paciente_id debe ser un número válido'
                });
            }

            await db.query('BEGIN');

            try {
                // Obtener saldo actual
                const querySaldo = `
                    SELECT * FROM pacientes_saldo WHERE paciente_id = $1
                `;
                const resSaldo = await db.query(querySaldo, [paciente_id_int]);

                if (resSaldo.rows.length === 0) {
                    await db.query('ROLLBACK');
                    return res.status(404).json({
                        success: false,
                        message: 'No hay saldo registrado para este paciente'
                    });
                }

                const saldoAnterior = resSaldo.rows[0].saldo_pendiente;
                const saldoNuevo = Math.max(0, saldoAnterior - monto);

                // Actualizar saldo
                await db.query(`
                    UPDATE pacientes_saldo
                    SET saldo_pendiente = $1,
                        ultima_transaccion = CURRENT_TIMESTAMP,
                        usuario_actualizo = $2
                    WHERE paciente_id = $3
                `, [saldoNuevo, user_id, paciente_id_int]);

                // Registrar movimiento
                await db.query(`
                    INSERT INTO movimientos_paciente (
                        id, paciente_id, tipo, descripcion, monto, saldo_anterior,
                        saldo_nuevo, referencia_id, usuario_id, fecha
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
                `, [
                    generateId('MOV'),
                    paciente_id_int,
                    'pago',
                    `Pago ${metodo_pago}${observaciones ? ': ' + observaciones : ''}`,
                    monto,
                    saldoAnterior,
                    saldoNuevo,
                    referencia,
                    user_id
                ]);

                await db.query('COMMIT');

                res.json({
                    success: true,
                    message: 'Pago registrado exitosamente',
                    data: {
                        saldo_anterior: saldoAnterior,
                        monto_pagado: monto,
                        saldo_nuevo: saldoNuevo
                    }
                });

            } catch (error) {
                await db.query('ROLLBACK');
                throw error;
            }

        } catch (error) {
            console.error('Error al registrar pago:', error);
            res.status(500).json({
                success: false,
                message: 'Error al registrar pago',
                error: error.message
            });
        }
    }

    /**
     * Obtener estado de cuenta detallado con items agrupados por categoría
     */
    async getEstadoCuentaDetallado(req, res) {
        try {
            const { paciente_id } = req.params;
            const paciente_id_int = parseInt(paciente_id, 10);
            if (isNaN(paciente_id_int)) {
                return res.status(400).json({
                    success: false,
                    message: 'paciente_id debe ser un número válido'
                });
            }

            // Obtener datos del paciente
            const queryPaciente = `
                SELECT id, nombre, apellido_paterno, apellido_materno, dpi, telefono
                FROM pacientes
                WHERE id = $1
            `;
            const resPaciente = await db.query(queryPaciente, [paciente_id_int]);

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
            const resSaldo = await db.query(querySaldo, [paciente_id_int]);
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
                FROM ventas_mejorada v
                LEFT JOIN venta_items_mejorada vi ON v.id = vi.venta_id
                WHERE v.paciente_id = $1
                ORDER BY v.fecha DESC, vi.descripcion
            `;
            const resFacturas = await db.query(queryFacturas, [paciente_id_int]);

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
                    const categoria = row.tipo_item || 'general';
                    if (!factura.categorias[categoria]) {
                        factura.categorias[categoria] = [];
                    }
                    factura.categorias[categoria].push({
                        id: row.item_id,
                        descripcion: row.descripcion,
                        cantidad: row.cantidad,
                        precio_unitario: parseFloat(row.precio_unitario),
                        subtotal: parseFloat(row.item_subtotal),
                        descuento: parseFloat(row.item_descuento),
                        total: parseFloat(row.item_total)
                    });
                }
            });

            // Convertir map a array
            const facturas = Array.from(facturaMap.values());

            // Calcular totales generales
            const totales = {
                subtotal_total: facturas.reduce((sum, f) => sum + f.subtotal, 0),
                descuentos_total: facturas.reduce((sum, f) => sum + f.total_descuentos, 0),
                impuestos_total: facturas.reduce((sum, f) => sum + f.total_impuestos, 0),
                total_facturado: facturas.reduce((sum, f) => sum + f.total, 0),
                saldo_pendiente: saldo.saldo_pendiente,
                saldo_favor: saldo.saldo_pendiente < 0 ? Math.abs(saldo.saldo_pendiente) : 0
            };

            res.json({
                success: true,
                data: {
                    paciente,
                    facturas,
                    totales,
                    saldo
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
    async generarNumeroFactura() {
        const query = `
            SELECT COUNT(*) as total FROM ventas_mejorada 
            WHERE EXTRACT(YEAR FROM fecha) = EXTRACT(YEAR FROM CURRENT_DATE)
        `;
        try {
            const result = await db.query(query);
            const numero = (result.rows[0]?.total || 0) + 1;
            const año = new Date().getFullYear();
            return `FAC-${año}-${String(numero).padStart(6, '0')}`;
        } catch {
            return `FAC-${Date.now()}`;
        }
    }
}

module.exports = new BillingMejoradoController();
