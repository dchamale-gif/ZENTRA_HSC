// ============================================
// CONTROLADOR DE FACTURACIÓN ROBUSTA
// Descuentos por Porcentaje y Cantidad Fija
// ============================================

const db = require('../db/connection');
const { generateId } = require('../utils/helpers');

class BillingController {
    // ============================================
    // GESTIÓN DE FACTURAS
    // ============================================

    /**
     * Crear una nueva factura
     */
    async createFactura(req, res) {
        try {
            const {
                numero_factura,
                cliente_id,
                paciente_id,
                items = [],
                descuentos = [],
                metodo_pago,
                observaciones
            } = req.body;

            const user_id = req.user.id;
            const factura_id = generateId('FAC');

            // Validar items
            if (!items || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'La factura debe contener al menos un item'
                });
            }

            // Calcular totales
            const calculos = this.calcularTotalesFactura(items, descuentos);

            // Iniciar transacción
            await db.query('BEGIN');

            try {
                // Insertar factura
                const queryFactura = `
                    INSERT INTO ventas (
                        id, numero_venta, numero_factura, cliente_id, paciente_id, user_id,
                        fecha, subtotal, descuento, impuesto, total, metodo_pago, 
                        estado, observaciones, subtotal_original, total_descuentos, 
                        total_impuestos, tipo_factura
                    ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, $8, $9, $10, $11, 'completada', $12, $13, $14, $15, 'normal')
                    RETURNING *
                `;

                const resultFactura = await db.query(queryFactura, [
                    factura_id,
                    numero_factura || factura_id,
                    numero_factura,
                    cliente_id || null,
                    paciente_id || null,
                    user_id,
                    calculos.subtotal,
                    calculos.total_descuentos,
                    calculos.total_impuestos,
                    calculos.total,
                    metodo_pago || 'efectivo',
                    observaciones || null,
                    calculos.subtotal,
                    calculos.total_descuentos,
                    calculos.total_impuestos
                ]);

                // Insertar items
                for (const item of items) {
                    const item_id = generateId('ITEM');
                    const subtotal_item = item.cantidad * item.precio_unitario;

                    await db.query(`
                        INSERT INTO venta_items (
                            id, venta_id, medicina_id, articulo_id, 
                            cantidad, precio_unitario, subtotal
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [
                        item_id,
                        factura_id,
                        item.medicina_id || null,
                        item.articulo_id || null,
                        item.cantidad,
                        item.precio_unitario,
                        subtotal_item
                    ]);

                    // Insertar descuentos por item si existen
                    if (item.descuentos && item.descuentos.length > 0) {
                        for (const desc of item.descuentos) {
                            const desc_id = generateId('DESC');
                            const monto_descuento = this.calcularDescuento(
                                subtotal_item,
                                desc.tipo,
                                desc.valor
                            );

                            await db.query(`
                                INSERT INTO venta_item_descuentos (
                                    id, venta_item_id, tipo_descuento, valor, 
                                    monto_descuento, motivo, usuario_id
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                            `, [
                                desc_id,
                                item_id,
                                desc.tipo,
                                desc.valor,
                                monto_descuento,
                                desc.motivo || null,
                                user_id
                            ]);
                        }
                    }
                }

                // Insertar descuentos a nivel de factura
                if (descuentos && descuentos.length > 0) {
                    for (const desc of descuentos) {
                        const desc_id = generateId('VDESC');
                        const monto_descuento = this.calcularDescuento(
                            calculos.subtotal,
                            desc.tipo,
                            desc.valor
                        );

                        await db.query(`
                            INSERT INTO venta_descuentos (
                                id, venta_id, descuento_id, tipo_descuento, valor,
                                monto_descuento, codigo_aplicado, motivo, usuario_id
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        `, [
                            desc_id,
                            factura_id,
                            desc.descuento_id || null,
                            desc.tipo,
                            desc.valor,
                            monto_descuento,
                            desc.codigo || null,
                            desc.motivo || null,
                            user_id
                        ]);
                    }
                }

                await db.query('COMMIT');

                res.status(201).json({
                    success: true,
                    message: 'Factura creada exitosamente',
                    data: {
                        id: factura_id,
                        numero_factura: numero_factura || factura_id,
                        ...calculos
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
     * Obtener detalles de una factura
     */
    async getFactura(req, res) {
        try {
            const { id } = req.params;

            const queryFactura = `
                SELECT v.*, u.nombre as usuario_nombre, c.nombre as cliente_nombre, p.nombre as paciente_nombre
                FROM ventas v
                LEFT JOIN users u ON v.user_id = u.id
                LEFT JOIN clientes c ON v.cliente_id = c.id
                LEFT JOIN pacientes p ON v.paciente_id = p.id
                WHERE v.id = $1
            `;

            const resultFactura = await db.query(queryFactura, [id]);
            if (resultFactura.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Factura no encontrada'
                });
            }

            const factura = resultFactura.rows[0];

            // Obtener items
            const queryItems = `
                SELECT vi.*, vd.monto_descuento as descuento_item
                FROM venta_items vi
                LEFT JOIN venta_item_descuentos vd ON vi.id = vd.venta_item_id
                WHERE vi.venta_id = $1
            `;
            const resultItems = await db.query(queryItems, [id]);

            // Obtener descuentos
            const queryDescuentos = `
                SELECT * FROM venta_descuentos WHERE venta_id = $1
            `;
            const resultDescuentos = await db.query(queryDescuentos, [id]);

            res.json({
                success: true,
                data: {
                    factura,
                    items: resultItems.rows,
                    descuentos: resultDescuentos.rows
                }
            });
        } catch (error) {
            console.error('Error al obtener factura:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener la factura',
                error: error.message
            });
        }
    }

    /**
     * Listar facturas con filtros
     */
    async listFacturas(req, res) {
        try {
            const { cliente_id, fecha_inicio, fecha_fin, estado, limit = 50, offset = 0 } = req.query;

            let query = 'SELECT * FROM ventas WHERE 1=1';
            const params = [];
            let paramCount = 1;

            if (cliente_id) {
                query += ` AND cliente_id = $${paramCount}`;
                params.push(cliente_id);
                paramCount++;
            }

            if (fecha_inicio) {
                query += ` AND fecha >= $${paramCount}`;
                params.push(fecha_inicio);
                paramCount++;
            }

            if (fecha_fin) {
                query += ` AND fecha <= $${paramCount}`;
                params.push(fecha_fin);
                paramCount++;
            }

            if (estado) {
                query += ` AND estado = $${paramCount}`;
                params.push(estado);
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
     * Actualizar factura
     */
    async updateFactura(req, res) {
        try {
            const { id } = req.params;
            const { items, descuentos, metodo_pago, observaciones } = req.body;
            const user_id = req.user.id;

            // Calcular nuevos totales si hay cambios
            const calculos = items ? this.calcularTotalesFactura(items, descuentos) : null;

            await db.query('BEGIN');

            try {
                if (calculos) {
                    // Actualizar factura
                    await db.query(`
                        UPDATE ventas 
                        SET subtotal = $1, total_descuentos = $2, total_impuestos = $3, total = $4,
                            metodo_pago = COALESCE($5, metodo_pago),
                            observaciones = COALESCE($6, observaciones),
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = $7
                    `, [
                        calculos.subtotal,
                        calculos.total_descuentos,
                        calculos.total_impuestos,
                        calculos.total,
                        metodo_pago || null,
                        observaciones || null,
                        id
                    ]);

                    // Eliminar items anteriores
                    await db.query('DELETE FROM venta_items WHERE venta_id = $1', [id]);
                    await db.query('DELETE FROM venta_item_descuentos WHERE venta_item_id IN (SELECT id FROM venta_items WHERE venta_id = $1)', [id]);

                    // Insertar nuevos items (mismo proceso que en create)
                    for (const item of items) {
                        const item_id = generateId('ITEM');
                        const subtotal_item = item.cantidad * item.precio_unitario;

                        await db.query(`
                            INSERT INTO venta_items (id, venta_id, medicina_id, articulo_id, cantidad, precio_unitario, subtotal)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                        `, [item_id, id, item.medicina_id || null, item.articulo_id || null, item.cantidad, item.precio_unitario, subtotal_item]);

                        if (item.descuentos && item.descuentos.length > 0) {
                            for (const desc of item.descuentos) {
                                const desc_id = generateId('DESC');
                                const monto_descuento = this.calcularDescuento(subtotal_item, desc.tipo, desc.valor);
                                await db.query(`
                                    INSERT INTO venta_item_descuentos (id, venta_item_id, tipo_descuento, valor, monto_descuento, motivo, usuario_id)
                                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                                `, [desc_id, item_id, desc.tipo, desc.valor, monto_descuento, desc.motivo || null, user_id]);
                            }
                        }
                    }
                }

                await db.query('COMMIT');

                res.json({
                    success: true,
                    message: 'Factura actualizada exitosamente',
                    data: calculos
                });
            } catch (error) {
                await db.query('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Error al actualizar factura:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar la factura',
                error: error.message
            });
        }
    }

    /**
     * Eliminar factura
     */
    async deleteFactura(req, res) {
        try {
            const { id } = req.params;

            await db.query('BEGIN');
            try {
                await db.query('DELETE FROM venta_descuentos WHERE venta_id = $1', [id]);
                await db.query('DELETE FROM venta_items WHERE venta_id = $1', [id]);
                await db.query('DELETE FROM ventas WHERE id = $1', [id]);
                await db.query('COMMIT');

                res.json({
                    success: true,
                    message: 'Factura eliminada exitosamente'
                });
            } catch (error) {
                await db.query('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Error al eliminar factura:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar la factura',
                error: error.message
            });
        }
    }

    // ============================================
    // GESTIÓN DE DESCUENTOS
    // ============================================

    /**
     * Crear descuento predefinido
     */
    async createDescuento(req, res) {
        try {
            const { nombre, descripcion, tipo_descuento, valor, minimo_aplicable, codigo_promocion, fecha_inicio, fecha_fin } = req.body;
            const descuento_id = generateId('DESC');

            // Validar tipo y valor
            if (!['porcentaje', 'fijo'].includes(tipo_descuento)) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de descuento inválido. Debe ser "porcentaje" o "fijo"'
                });
            }

            if (tipo_descuento === 'porcentaje' && (valor < 0 || valor > 100)) {
                return res.status(400).json({
                    success: false,
                    message: 'El porcentaje debe estar entre 0 y 100'
                });
            }

            const query = `
                INSERT INTO descuentos (
                    id, nombre, descripcion, tipo_descuento, valor, 
                    minimo_aplicable, codigo_promocion, fecha_inicio, fecha_fin
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;

            const result = await db.query(query, [
                descuento_id,
                nombre,
                descripcion || null,
                tipo_descuento,
                valor,
                minimo_aplicable || 0,
                codigo_promocion || null,
                fecha_inicio || null,
                fecha_fin || null
            ]);

            res.status(201).json({
                success: true,
                message: 'Descuento creado exitosamente',
                data: result.rows[0]
            });
        } catch (error) {
            console.error('Error al crear descuento:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear el descuento',
                error: error.message
            });
        }
    }

    /**
     * Listar descuentos disponibles
     */
    async listDescuentos(req, res) {
        try {
            const query = `
                SELECT * FROM descuentos 
                WHERE activo = true 
                AND (fecha_inicio IS NULL OR fecha_inicio <= CURRENT_DATE)
                AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
                ORDER BY nombre
            `;

            const result = await db.query(query);

            res.json({
                success: true,
                data: result.rows,
                total: result.rows.length
            });
        } catch (error) {
            console.error('Error al listar descuentos:', error);
            res.status(500).json({
                success: false,
                message: 'Error al listar descuentos',
                error: error.message
            });
        }
    }

    /**
     * Validar y aplicar código promocional
     */
    async validarCodigoPromocional(req, res) {
        try {
            const { codigo, monto_base } = req.body;

            if (!codigo) {
                return res.status(400).json({
                    success: false,
                    message: 'Código promocional requerido'
                });
            }

            const query = `
                SELECT * FROM descuentos 
                WHERE codigo_promocion = $1 
                AND activo = true
                AND (fecha_inicio IS NULL OR fecha_inicio <= CURRENT_DATE)
                AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
                LIMIT 1
            `;

            const result = await db.query(query, [codigo]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Código promocional no válido o expirado'
                });
            }

            const descuento = result.rows[0];

            // Validar monto mínimo
            if (monto_base && monto_base < descuento.minimo_aplicable) {
                return res.status(400).json({
                    success: false,
                    message: `Monto mínimo de ${descuento.minimo_aplicable} requerido para este descuento`,
                    monto_minimo: descuento.minimo_aplicable
                });
            }

            // Validar límite de usos
            if (descuento.maximo_uso && descuento.usos_realizados >= descuento.maximo_uso) {
                return res.status(400).json({
                    success: false,
                    message: 'Este código promocional ha alcanzado su límite de usos'
                });
            }

            const monto_descuento = this.calcularDescuento(monto_base, descuento.tipo_descuento, descuento.valor);

            res.json({
                success: true,
                data: {
                    descuento_id: descuento.id,
                    tipo_descuento: descuento.tipo_descuento,
                    valor: descuento.valor,
                    monto_descuento: monto_descuento,
                    descripcion: descuento.descripcion
                }
            });
        } catch (error) {
            console.error('Error al validar código promocional:', error);
            res.status(500).json({
                success: false,
                message: 'Error al validar el código promocional',
                error: error.message
            });
        }
    }

    // ============================================
    // MÉTODOS AUXILIARES DE CÁLCULO
    // ============================================

    /**
     * Calcular el monto de un descuento
     * @param {number} monto Base para calcular el descuento
     * @param {string} tipo 'porcentaje' o 'fijo'
     * @param {number} valor Porcentaje (0-100) o cantidad fija
     */
    calcularDescuento(monto, tipo, valor) {
        if (tipo === 'porcentaje') {
            return (monto * valor) / 100;
        } else if (tipo === 'fijo') {
            return Math.min(valor, monto); // No puede ser mayor al monto
        }
        return 0;
    }

    /**
     * Calcular totales de factura con descuentos
     */
    calcularTotalesFactura(items, descuentos = []) {
        // Calcular subtotal
        let subtotal = 0;
        for (const item of items) {
            subtotal += item.cantidad * item.precio_unitario;
        }

        // Calcular descuentos por items
        let total_descuentos_items = 0;
        for (const item of items) {
            if (item.descuentos && item.descuentos.length > 0) {
                const subtotal_item = item.cantidad * item.precio_unitario;
                for (const desc of item.descuentos) {
                    total_descuentos_items += this.calcularDescuento(subtotal_item, desc.tipo, desc.valor);
                }
            }
        }

        // Calcular descuentos a nivel factura
        let total_descuentos_factura = 0;
        const base_para_descuentos = subtotal - total_descuentos_items;
        for (const desc of descuentos) {
            total_descuentos_factura += this.calcularDescuento(base_para_descuentos, desc.tipo, desc.valor);
        }

        const total_descuentos = total_descuentos_items + total_descuentos_factura;
        const subtotal_con_descuentos = subtotal - total_descuentos;

        // Calcular impuestos (asumiendo 12% por defecto, puede ser configurable)
        const total_impuestos = subtotal_con_descuentos * 0.12;
        const total = subtotal_con_descuentos + total_impuestos;

        return {
            subtotal,
            total_descuentos,
            total_impuestos,
            total,
            subtotal_con_descuentos
        };
    }
}

module.exports = new BillingController();
