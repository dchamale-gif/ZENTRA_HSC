// ============================================
// UTILIDADES Y HELPERS PARA FACTURACIÓN
// ============================================

/**
 * Generar ID único basado en prefijo
 * @param {string} prefix - Prefijo para el ID
 * @returns {string} ID generado
 */
function generateId(prefix = 'ID') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}${random}`;
}

/**
 * Validar tipo de descuento
 * @param {string} tipo - Tipo de descuento ('porcentaje' o 'fijo')
 * @returns {boolean}
 */
function validarTipoDescuento(tipo) {
    return ['porcentaje', 'fijo'].includes(tipo);
}

/**
 * Validar porcentaje (0-100)
 * @param {number} valor - Valor del porcentaje
 * @returns {boolean}
 */
function validarPorcentaje(valor) {
    return !isNaN(valor) && valor >= 0 && valor <= 100;
}

/**
 * Validar cantidad (debe ser positiva)
 * @param {number} valor - Cantidad a validar
 * @returns {boolean}
 */
function validarCantidad(valor) {
    return !isNaN(valor) && valor > 0;
}

/**
 * Calcular descuento según tipo
 * @param {number} base - Monto base
 * @param {string} tipo - 'porcentaje' o 'fijo'
 * @param {number} valor - Valor del descuento
 * @returns {number} Monto del descuento
 */
function calcularDescuento(base, tipo, valor) {
    if (!validarCantidad(base)) return 0;
    
    if (tipo === 'porcentaje') {
        if (!validarPorcentaje(valor)) return 0;
        return (base * valor) / 100;
    } else if (tipo === 'fijo') {
        if (!validarCantidad(valor)) return 0;
        return Math.min(valor, base); // No puede ser mayor al monto base
    }
    return 0;
}

/**
 * Formatear moneda
 * @param {number} valor - Valor a formatear
 * @param {string} moneda - Código de moneda (GTQ, USD, etc)
 * @returns {string}
 */
function formatearMoneda(valor, moneda = 'GTQ') {
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: moneda,
        minimumFractionDigits: 2
    }).format(valor);
}

/**
 * Redondear a 2 decimales
 * @param {number} valor
 * @returns {number}
 */
function redondear(valor) {
    return Math.round(valor * 100) / 100;
}

/**
 * Calcular totales de una factura
 * @param {Array} items - Array de items
 * @param {Array} descuentos - Array de descuentos
 * @param {number} impuesto_porcentaje - Porcentaje de impuesto
 * @returns {Object} Objeto con totales calculados
 */
function calcularTotalesFactura(items = [], descuentos = [], impuesto_porcentaje = 12) {
    // Calcular subtotal
    let subtotal = 0;
    for (const item of items) {
        const subtotal_item = item.cantidad * item.precio_unitario;
        subtotal += subtotal_item;
    }

    // Calcular descuentos de items
    let total_descuentos_items = 0;
    for (const item of items) {
        if (item.descuentos && Array.isArray(item.descuentos)) {
            const subtotal_item = item.cantidad * item.precio_unitario;
            for (const desc of item.descuentos) {
                total_descuentos_items += calcularDescuento(subtotal_item, desc.tipo, desc.valor);
            }
        }
    }

    // Calcular descuentos de factura
    let total_descuentos_factura = 0;
    const base_para_descuentos = subtotal - total_descuentos_items;
    for (const desc of descuentos) {
        total_descuentos_factura += calcularDescuento(base_para_descuentos, desc.tipo, desc.valor);
    }

    const total_descuentos = total_descuentos_items + total_descuentos_factura;
    const subtotal_con_descuentos = subtotal - total_descuentos;
    const total_impuestos = redondear(subtotal_con_descuentos * (impuesto_porcentaje / 100));
    const total = redondear(subtotal_con_descuentos + total_impuestos);

    return {
        subtotal: redondear(subtotal),
        total_descuentos: redondear(total_descuentos),
        total_descuentos_items: redondear(total_descuentos_items),
        total_descuentos_factura: redondear(total_descuentos_factura),
        subtotal_con_descuentos: redondear(subtotal_con_descuentos),
        total_impuestos: total_impuestos,
        total: total,
        impuesto_porcentaje: impuesto_porcentaje
    };
}

/**
 * Validar descuento predefinido
 * @param {Object} descuento - Objeto de descuento
 * @param {number} monto_base - Monto base para validar
 * @returns {Object} Objeto con validación y mensajes
 */
function validarDescuentoPredefinido(descuento, monto_base = 0) {
    const resultado = {
        valido: true,
        errores: []
    };

    // Validar que esté activo
    if (!descuento.activo) {
        resultado.valido = false;
        resultado.errores.push('El descuento no está activo');
    }

    // Validar fechas
    const hoy = new Date();
    if (descuento.fecha_inicio && new Date(descuento.fecha_inicio) > hoy) {
        resultado.valido = false;
        resultado.errores.push('El descuento aún no está disponible');
    }

    if (descuento.fecha_fin && new Date(descuento.fecha_fin) < hoy) {
        resultado.valido = false;
        resultado.errores.push('El descuento ha expirado');
    }

    // Validar monto mínimo
    if (monto_base && descuento.minimo_aplicable && monto_base < descuento.minimo_aplicable) {
        resultado.valido = false;
        resultado.errores.push(`Monto mínimo de ${formatearMoneda(descuento.minimo_aplicable)} requerido`);
    }

    // Validar límite de usos
    if (descuento.maximo_uso && descuento.usos_realizados >= descuento.maximo_uso) {
        resultado.valido = false;
        resultado.errores.push('El descuento ha alcanzado su límite de usos');
    }

    return resultado;
}

/**
 * Generar número de factura
 * @param {string} prefijo - Prefijo para la factura
 * @returns {string} Número de factura
 */
function generarNumeroFactura(prefijo = 'FAC') {
    const date = new Date();
    const año = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    return `${prefijo}-${año}${mes}${dia}-${random}`;
}

/**
 * Generar código promocional aleatorio
 * @param {number} longitud - Longitud del código
 * @returns {string} Código promocional
 */
function generarCodigoPromocional(longitud = 8) {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo = '';
    for (let i = 0; i < longitud; i++) {
        codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return codigo;
}

/**
 * Validar estructura de item
 * @param {Object} item - Item a validar
 * @returns {Object} Objeto con validación
 */
function validarItem(item) {
    const resultado = {
        valido: true,
        errores: []
    };

    if (!item.descripcion || item.descripcion.trim() === '') {
        resultado.errores.push('Descripción requerida');
    }

    if (!validarCantidad(item.cantidad)) {
        resultado.errores.push('Cantidad inválida (debe ser > 0)');
    }

    if (!validarCantidad(item.precio_unitario)) {
        resultado.errores.push('Precio unitario inválido (debe ser > 0)');
    }

    resultado.valido = resultado.errores.length === 0;
    return resultado;
}

/**
 * Calcular porcentaje de descuento aplicado
 * @param {number} subtotal - Subtotal original
 * @param {number} total_descuentos - Monto total de descuentos
 * @returns {number} Porcentaje de descuento
 */
function calcularPorcentajeDescuento(subtotal, total_descuentos) {
    if (subtotal === 0) return 0;
    return (total_descuentos / subtotal) * 100;
}

/**
 * Agrupar facturas por período
 * @param {Array} facturas - Array de facturas
 * @param {string} periodo - 'diario', 'semanal', 'mensual', 'anual'
 * @returns {Object} Facturas agrupadas
 */
function agruparFacturasPorPeriodo(facturas, periodo = 'diario') {
    const agrupadas = {};

    for (const factura of facturas) {
        const fecha = new Date(factura.fecha);
        let clave;

        switch (periodo) {
            case 'diario':
                clave = fecha.toISOString().split('T')[0];
                break;
            case 'semanal':
                const semana = Math.floor(fecha.getDate() / 7) + 1;
                clave = `${fecha.getFullYear()}-Sem${semana}`;
                break;
            case 'mensual':
                clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
                break;
            case 'anual':
                clave = `${fecha.getFullYear()}`;
                break;
            default:
                clave = fecha.toISOString().split('T')[0];
        }

        if (!agrupadas[clave]) {
            agrupadas[clave] = [];
        }
        agrupadas[clave].push(factura);
    }

    return agrupadas;
}

/**
 * Calcular estadísticas de facturas
 * @param {Array} facturas - Array de facturas
 * @returns {Object} Estadísticas
 */
function calcularEstadisticasFacturas(facturas) {
    return {
        total_facturas: facturas.length,
        total_ingresos: redondear(facturas.reduce((sum, f) => sum + (f.total || 0), 0)),
        total_descuentos: redondear(facturas.reduce((sum, f) => sum + (f.total_descuentos || 0), 0)),
        total_impuestos: redondear(facturas.reduce((sum, f) => sum + (f.total_impuestos || 0), 0)),
        promedio_factura: redondear(facturas.reduce((sum, f) => sum + (f.total || 0), 0) / (facturas.length || 1)),
        mayor_factura: Math.max(...facturas.map(f => f.total || 0)),
        menor_factura: Math.min(...facturas.map(f => f.total || 0))
    };
}

/**
 * Exportar facturas a CSV
 * @param {Array} facturas - Array de facturas
 * @returns {string} Contenido CSV
 */
function exportarFacturasCSV(facturas) {
    const headers = ['ID', 'Número', 'Cliente', 'Fecha', 'Subtotal', 'Descuentos', 'Impuestos', 'Total', 'Estado'];
    const rows = facturas.map(f => [
        f.id,
        f.numero_venta,
        f.cliente_nombre || '-',
        f.fecha,
        f.subtotal,
        f.total_descuentos,
        f.total_impuestos,
        f.total,
        f.estado
    ]);

    const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    return csv;
}

/**
 * Descargar CSV
 * @param {string} contenido - Contenido CSV
 * @param {string} nombreArchivo - Nombre del archivo
 */
function descargarCSV(contenido, nombreArchivo = 'facturas.csv') {
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', nombreArchivo);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

module.exports = {
    generateId,
    validarTipoDescuento,
    validarPorcentaje,
    validarCantidad,
    calcularDescuento,
    formatearMoneda,
    redondear,
    calcularTotalesFactura,
    validarDescuentoPredefinido,
    generarNumeroFactura,
    generarCodigoPromocional,
    validarItem,
    calcularPorcentajeDescuento,
    agruparFacturasPorPeriodo,
    calcularEstadisticasFacturas,
    exportarFacturasCSV,
    descargarCSV
};
