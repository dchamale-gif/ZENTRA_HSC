// ============================================
// Módulo: Gastos y Servicios
// Descripción: Gestión de gastos, conceptos y proveedores
// ============================================

class GastosServiciosModule {
    constructor() {
        this.state = {
            conceptos: [],
            proveedores: [],
            pagos: [],
            filtroConcepto: 'todos',
            filtroPeriodo: 'mensual',
            fechaInicio: null,
            fechaFin: null
        };
        this.init();
    }

    init() {
        // Cargar datos del localStorage o usar demoData
        const savedData = localStorage.getItem('gastosServiciosData');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.state = { ...this.state, ...data };
            } catch (e) {
                console.error('Error parsing saved data:', e);
                this.loadDemoData();
            }
        } else {
            this.loadDemoData();
        }
        this.setDefaultPeriod();
    }

    loadDemoData() {
        // Intentar cargar de DemoData
        if (window.DemoData && window.DemoData.conceptos) {
            this.state.conceptos = [...window.DemoData.conceptos];
            this.state.proveedores = [...window.DemoData.proveedores];
            this.state.pagos = [...window.DemoData.pagos];
        } else {
            // Si DemoData no está disponible, usar datos por defecto
            console.warn('DemoData no disponible, usando datos por defecto');
            
            const today = new Date();
            const dates = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                dates.push(d.toISOString().split('T')[0]);
            }
            
            this.state.conceptos = [
                { id: 'CON-001', nombre: 'EEGSA', descripcion: 'Energía Eléctrica', categoria: 'Servicios Básicos' },
                { id: 'CON-002', nombre: 'Telefonía', descripcion: 'Servicios de Telefonía', categoria: 'Comunicaciones' },
                { id: 'CON-003', nombre: 'Internet', descripcion: 'Servicio de Internet', categoria: 'Comunicaciones' },
                { id: 'CON-004', nombre: 'Agua', descripcion: 'Suministro de Agua', categoria: 'Servicios Básicos' },
                { id: 'CON-005', nombre: 'Gasolina', descripcion: 'Combustible Vehículos', categoria: 'Transporte' }
            ];
            this.state.proveedores = [
                { id: 'PRV-001', nombre: 'EEGSA', contacto: 'Gerente de Ventas', referencia: 'Energía Eléctrica de Guatemala', telefono: '2206-6500', estado: 'activo', fechaAlta: new Date().toISOString().split('T')[0] },
                { id: 'PRV-002', nombre: 'Claro Guatemala', contacto: 'Representante Comercial', referencia: 'Telefonía', telefono: '1200-1200', estado: 'activo', fechaAlta: new Date().toISOString().split('T')[0] },
                { id: 'PRV-003', nombre: 'EMAYA', contacto: 'Jefe de Servicio al Cliente', referencia: 'Agua', telefono: '2221-2000', estado: 'activo', fechaAlta: new Date().toISOString().split('T')[0] },
                { id: 'PRV-004', nombre: 'Shell Guatemala', contacto: 'Ejecutivo de Cuenta', referencia: 'Combustibles', telefono: '2384-7000', estado: 'activo', fechaAlta: new Date().toISOString().split('T')[0] }
            ];
            this.state.pagos = [
                { id: 'PAG-001', fecha: dates[0], concepto: 'CON-001', proveedor: 'PRV-001', monto: 1560, numeroFactura: 'FAC-2024-001', requisicion: 'REQ-2024-001', referencia: 'Ref#001', estado: 'pagado' },
                { id: 'PAG-002', fecha: dates[1], concepto: 'CON-002', proveedor: 'PRV-002', monto: 780, numeroFactura: 'FAC-2024-002', requisicion: '', referencia: 'Ref#002', estado: 'pagado' },
                { id: 'PAG-003', fecha: dates[2], concepto: 'CON-003', proveedor: 'PRV-002', monto: 390, numeroFactura: 'FAC-2024-003', requisicion: 'LOTE-001', referencia: 'Ref#003', estado: 'pagado' },
                { id: 'PAG-004', fecha: dates[3], concepto: 'CON-001', proveedor: 'PRV-001', monto: 1560, numeroFactura: 'FAC-2024-004', requisicion: 'REQ-2024-002', referencia: 'Ref#004', estado: 'pagado' },
                { id: 'PAG-005', fecha: dates[4], concepto: 'CON-004', proveedor: 'PRV-003', monto: 468, numeroFactura: 'FAC-2024-005', requisicion: '', referencia: 'Ref#005', estado: 'pagado' },
                { id: 'PAG-006', fecha: dates[5], concepto: 'CON-002', proveedor: 'PRV-002', monto: 624, numeroFactura: 'FAC-2024-006', requisicion: 'LOTE-002', referencia: 'Ref#006', estado: 'pagado' },
                { id: 'PAG-007', fecha: dates[6], concepto: 'CON-005', proveedor: 'PRV-004', monto: 2340, numeroFactura: 'FAC-2024-007', requisicion: 'REQ-2024-003', referencia: 'Ref#007', estado: 'pagado' }
            ];
        }
        this.save();
    }

    setDefaultPeriod() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        this.state.fechaInicio = firstDay.toISOString().split('T')[0];
        this.state.fechaFin = lastDay.toISOString().split('T')[0];
    }

    save() {
        localStorage.setItem('gastosServiciosData', JSON.stringify(this.state));
    }

    // ==================== PAGOS ====================
    addPago(concepto, proveedor, monto, fecha, numeroFactura, requisicion, referencia) {
        if (!concepto || !proveedor || !monto || !fecha || !numeroFactura) {
            alert('Por favor complete todos los campos requeridos (incluyendo número de factura)');
            return false;
        }

        const newPago = {
            id: 'PAG-' + Date.now(),
            fecha: fecha,
            concepto: concepto,
            proveedor: proveedor,
            monto: parseFloat(monto),
            numeroFactura: numeroFactura,
            requisicion: requisicion || '',
            referencia: referencia || '',
            estado: 'pagado'
        };

        this.state.pagos.unshift(newPago);
        this.save();
        return true;
    }

    deletePago(pagoId) {
        this.state.pagos = this.state.pagos.filter(p => p.id !== pagoId);
        this.save();
    }

    editPago(pagoId, concepto, proveedor, monto, fecha, numeroFactura, requisicion, referencia) {
        const pago = this.state.pagos.find(p => p.id === pagoId);
        if (pago) {
            pago.concepto = concepto;
            pago.proveedor = proveedor;
            pago.monto = parseFloat(monto);
            pago.fecha = fecha;
            pago.numeroFactura = numeroFactura;
            pago.requisicion = requisicion || '';
            pago.referencia = referencia || '';
            this.save();
            return true;
        }
        return false;
    }

    getPagoConcepto(conceptoId) {
        return this.state.conceptos.find(c => c.id === conceptoId);
    }

    getPagoProveedor(proveedorId) {
        return this.state.proveedores.find(p => p.id === proveedorId);
    }

    // ==================== PROVEEDORES ====================
    addProveedor(nombre, contacto, referencia, telefono) {
        if (!nombre || !contacto) {
            alert('Por favor ingrese el nombre del proveedor y el contacto');
            return false;
        }

        const newProveedor = {
            id: 'PRV-' + Date.now(),
            nombre: nombre,
            contacto: contacto,
            referencia: referencia || '',
            telefono: telefono || '',
            estado: 'activo',
            fechaAlta: new Date().toISOString().split('T')[0],
            historialBajas: [] // Array para guardar historial de bajas si se reactiva
        };

        this.state.proveedores.push(newProveedor);
        this.save();
        return true;
    }

    deleteProveedor(proveedorId) {
        this.state.proveedores = this.state.proveedores.filter(p => p.id !== proveedorId);
        this.save();
    }

    // Dar de baja un proveedor (sin eliminar datos)
    darDeBajaProveedor(proveedorId, motivo, fechaBaja) {
        const proveedor = this.state.proveedores.find(p => p.id === proveedorId);
        if (proveedor) {
            proveedor.estado = 'inactivo';
            proveedor.fechaBaja = fechaBaja || new Date().toISOString().split('T')[0];
            proveedor.motivoBaja = motivo || '';
            if (!proveedor.historialBajas) {
                proveedor.historialBajas = [];
            }
            proveedor.historialBajas.push({
                fecha: fechaBaja || new Date().toISOString().split('T')[0],
                motivo: motivo || '',
                timestamp: new Date().toISOString()
            });
            this.save();
            return true;
        }
        return false;
    }

    // Reactivar proveedor
    reactivarProveedor(proveedorId) {
        const proveedor = this.state.proveedores.find(p => p.id === proveedorId);
        if (proveedor) {
            proveedor.estado = 'activo';
            delete proveedor.fechaBaja;
            delete proveedor.motivoBaja;
            this.save();
            return true;
        }
        return false;
    }

    editProveedor(proveedorId, nombre, contacto, referencia, telefono) {
        const proveedor = this.state.proveedores.find(p => p.id === proveedorId);
        if (proveedor) {
            proveedor.nombre = nombre;
            proveedor.contacto = contacto;
            proveedor.referencia = referencia || '';
            proveedor.telefono = telefono || '';
            this.save();
            return true;
        }
        return false;
    }

    // ==================== REPORTES ====================
    generateGastosReport() {
        const pagosFiltered = this.filterPagosByPeriodo();
        const resumen = {};
        let totalGeneral = 0;

        pagosFiltered.forEach(pago => {
            const concepto = this.getPagoConcepto(pago.concepto);
            const conceptoNombre = concepto ? concepto.nombre : 'Desconocido';
            
            if (!resumen[conceptoNombre]) {
                resumen[conceptoNombre] = { monto: 0, cantidad: 0, pagos: [] };
            }
            resumen[conceptoNombre].monto += pago.monto;
            resumen[conceptoNombre].cantidad += 1;
            resumen[conceptoNombre].pagos.push(pago);
            totalGeneral += pago.monto;
        });

        return { resumen, totalGeneral, pagosFiltered };
    }

    generateComparativoReport() {
        // Gastos
        const reportGastos = this.generateGastosReport();
        const totalGastos = reportGastos.totalGeneral;

        // Ventas (desde demo data o localStorage)
        let totalVentas = 0;
        if (window.DemoData && window.DemoData.transactions) {
            totalVentas = window.DemoData.transactions
                .filter(t => t.type === 'Venta')
                .reduce((sum, t) => sum + (t.amount || 0), 0);
        }

        // Compras
        let totalCompras = 0;
        if (window.DemoData && window.DemoData.transactions) {
            totalCompras = window.DemoData.transactions
                .filter(t => t.type === 'Compra')
                .reduce((sum, t) => sum + (t.amount || 0), 0);
        }

        return {
            periodo: `${this.state.fechaInicio} a ${this.state.fechaFin}`,
            gastos: totalGastos,
            ventas: totalVentas,
            compras: totalCompras,
            ganancia: totalVentas - totalCompras - totalGastos
        };
    }

    filterPagosByPeriodo() {
        const inicio = new Date(this.state.fechaInicio);
        const fin = new Date(this.state.fechaFin);
        
        return this.state.pagos.filter(pago => {
            const pagofecha = new Date(pago.fecha);
            return pagofecha >= inicio && pagofecha <= fin;
        });
    }

    setPeriodo(tipoPeriodo) {
        const today = new Date();
        this.state.filtroPeriodo = tipoPeriodo;

        switch (tipoPeriodo) {
            case 'diario':
                this.state.fechaInicio = today.toISOString().split('T')[0];
                this.state.fechaFin = today.toISOString().split('T')[0];
                break;
            case 'semanal':
                const firstDay = new Date(today);
                firstDay.setDate(today.getDate() - today.getDay());
                const lastDay = new Date(firstDay);
                lastDay.setDate(firstDay.getDate() + 6);
                this.state.fechaInicio = firstDay.toISOString().split('T')[0];
                this.state.fechaFin = lastDay.toISOString().split('T')[0];
                break;
            case 'mensual':
                const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const lastMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                this.state.fechaInicio = firstMonth.toISOString().split('T')[0];
                this.state.fechaFin = lastMonth.toISOString().split('T')[0];
                break;
        }
        this.save();
    }

    // ==================== UTILIDADES ====================
    formatarMoneda(valor) {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: 'GTQ',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(valor);
    }

    formatarFecha(fecha) {
        return new Intl.DateTimeFormat('es-GT', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(new Date(fecha));
    }

    // ==================== RENDERIZADO ====================
    renderPagos() {
        const container = document.getElementById('listadoPagos');
        if (!container) return;

        const pagos = this.filterPagosByPeriodo();
        
        if (pagos.length === 0) {
            container.innerHTML = '<p class="empty-state">No hay pagos registrados en este período</p>';
            return;
        }

        let html = '<table class="tabla-datos">';
        html += '<thead><tr>';
        html += '<th>Fecha</th>';
        html += '<th>Concepto</th>';
        html += '<th>Proveedor</th>';
        html += '<th>Nº Factura</th>';
        html += '<th>Requisición/Lote</th>';
        html += '<th>Referencia</th>';
        html += '<th>Monto</th>';
        html += '<th>Acciones</th>';
        html += '</tr></thead><tbody>';

        pagos.forEach(pago => {
            const concepto = this.getPagoConcepto(pago.concepto);
            const proveedor = this.getPagoProveedor(pago.proveedor);
            const conceptoNombre = concepto ? concepto.nombre : 'Desconocido';
            const proveedorNombre = proveedor ? proveedor.nombre : 'Desconocido';

            html += '<tr>';
            html += `<td>${this.formatarFecha(pago.fecha)}</td>`;
            html += `<td>${conceptoNombre}</td>`;
            html += `<td>${proveedorNombre}</td>`;
            html += `<td><strong>${pago.numeroFactura || '-'}</strong></td>`;
            html += `<td>${pago.requisicion || '-'}</td>`;
            html += `<td>${pago.referencia || '-'}</td>`;
            html += `<td class="monto">${this.formatarMoneda(pago.monto)}</td>`;
            html += `<td class="acciones">`;
            html += `<button onclick="gastosModule.deletePago('${pago.id}'); gastosModule.render();" class="btn-delete"><i class="fas fa-trash"></i></button>`;
            html += `</td></tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    renderProveedores() {
        const container = document.getElementById('listadoProveedores');
        if (!container) return;

        if (this.state.proveedores.length === 0) {
            container.innerHTML = '<p class="empty-state">No hay proveedores registrados</p>';
            return;
        }

        let html = '<table class="tabla-datos">';
        html += '<thead><tr>';
        html += '<th>Nombre</th>';
        html += '<th>Contacto</th>';
        html += '<th>Teléfono</th>';
        html += '<th>Referencia</th>';
        html += '<th>Estado</th>';
        html += '<th>Acciones</th>';
        html += '</tr></thead><tbody>';

        this.state.proveedores.forEach(proveedor => {
            const estadoClass = proveedor.estado === 'activo' ? 'badge-active' : 'badge-inactive';
            const estadoIcon = proveedor.estado === 'activo' ? 'fas fa-check-circle' : 'fas fa-times-circle';
            const botonesAccion = proveedor.estado === 'activo'
                ? `<button onclick="abrirModalBajaProveedor('${proveedor.id}', '${proveedor.nombre}')" class="btn-warning" style="padding: 5px 10px; margin-right: 5px;"><i class="fas fa-ban"></i> Dar de baja</button>`
                : `<button onclick="gastosModule.reactivarProveedor('${proveedor.id}'); gastosModule.render();" class="btn-info" style="padding: 5px 10px; margin-right: 5px;"><i class="fas fa-refresh"></i> Reactivar</button>`;

            html += '<tr>';
            html += `<td><strong>${proveedor.nombre}</strong></td>`;
            html += `<td>${proveedor.contacto || '-'}</td>`;
            html += `<td>${proveedor.telefono || '-'}</td>`;
            html += `<td>${proveedor.referencia || '-'}</td>`;
            html += `<td><span class="${estadoClass}"><i class="${estadoIcon}"></i> ${proveedor.estado}</span></td>`;
            html += `<td class="acciones">`;
            html += botonesAccion;
            html += `<button onclick="gastosModule.deleteProveedor('${proveedor.id}'); gastosModule.render();" class="btn-delete"><i class="fas fa-trash"></i> Eliminar</button>`;
            html += `</td></tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    renderReporteGastos() {
        const container = document.getElementById('reporteGastos');
        if (!container) return;

        const data = this.generateGastosReport();
        const { resumen, totalGeneral } = data;

        let html = '<div class="reporte-contenedor">';
        html += `<h3>Reporte de Gastos (${this.state.filtroPeriodo})</h3>`;
        html += `<p class="periodo-label">Período: ${this.formatarFecha(this.state.fechaInicio)} - ${this.formatarFecha(this.state.fechaFin)}</p>`;

        if (Object.keys(resumen).length === 0) {
            html += '<p class="empty-state">No hay datos para mostrar en este período</p>';
        } else {
            html += '<table class="tabla-datos">';
            html += '<thead><tr>';
            html += '<th>Concepto</th>';
            html += '<th>Cantidad</th>';
            html += '<th>Total</th>';
            html += '</tr></thead><tbody>';

            Object.keys(resumen).sort().forEach(concepto => {
                const data = resumen[concepto];
                html += '<tr>';
                html += `<td>${concepto}</td>`;
                html += `<td class="cantidad">${data.cantidad}</td>`;
                html += `<td class="monto">${this.formatarMoneda(data.monto)}</td>`;
                html += '</tr>';
            });

            html += '<tr class="fila-total">';
            html += '<td><strong>TOTAL</strong></td>';
            html += '<td></td>';
            html += `<td class="monto"><strong>${this.formatarMoneda(totalGeneral)}</strong></td>`;
            html += '</tr></tbody></table>';
        }

        html += '</div>';
        container.innerHTML = html;
    }

    renderReporteComparativo() {
        const container = document.getElementById('reporteComparativo');
        if (!container) return;

        const datos = this.generateComparativoReport();

        let html = '<div class="reporte-contenedor">';
        html += '<h3>Reporte Comparativo</h3>';
        html += `<p class="periodo-label">Período: ${datos.periodo}</p>`;

        html += '<table class="tabla-comparativo">';
        html += '<thead><tr>';
        html += '<th>Concepto</th>';
        html += '<th>Monto (Q.)</th>';
        html += '</tr></thead><tbody>';

        html += '<tr>';
        html += `<td>Ventas</td>`;
        html += `<td class="monto positivo">${this.formatarMoneda(datos.ventas)}</td>`;
        html += '</tr>';

        html += '<tr>';
        html += `<td>Compras</td>`;
        html += `<td class="monto negativo">${this.formatarMoneda(datos.compras)}</td>`;
        html += '</tr>';

        html += '<tr>';
        html += `<td>Gastos y Servicios</td>`;
        html += `<td class="monto negativo">${this.formatarMoneda(datos.gastos)}</td>`;
        html += '</tr>';

        html += '<tr class="fila-total">';
        html += `<td><strong>Ganancia Neta</strong></td>`;
        html += `<td class="monto ${datos.ganancia >= 0 ? 'positivo' : 'negativo'}"><strong>${this.formatarMoneda(datos.ganancia)}</strong></td>`;
        html += '</tr>';

        html += '</tbody></table>';
        html += '</div>';

        container.innerHTML = html;
    }

    renderSelectConceptos() {
        const select = document.getElementById('selectConcepto');
        if (!select) return;

        select.innerHTML = '<option value="">-- Seleccionar Concepto --</option>';
        this.state.conceptos.forEach(concepto => {
            select.innerHTML += `<option value="${concepto.id}">${concepto.nombre}</option>`;
        });
    }

    renderSelectProveedores() {
        const select = document.getElementById('selectProveedor');
        if (!select) return;

        select.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>';
        this.state.proveedores.forEach(proveedor => {
            select.innerHTML += `<option value="${proveedor.id}">${proveedor.nombre}</option>`;
        });
    }

    render() {
        this.renderSelectConceptos();
        this.renderSelectProveedores();
        this.renderPagos();
        this.renderProveedores();
        this.renderReporteGastos();
        this.renderReporteComparativo();
    }

    // ==================== EXPORT ====================
    exportHTML(tipoReporte) {
        let html = '<!DOCTYPE html>';
        html += '<html lang="es">';
        html += '<head>';
        html += '<meta charset="UTF-8">';
        html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
        html += `<title>Reporte ${tipoReporte}</title>`;
        html += '<style>';
        html += 'body { font-family: Arial, sans-serif; margin: 20px; color: #333; }';
        html += 'h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }';
        html += 'p { color: #666; }';
        html += 'table { width: 100%; border-collapse: collapse; margin-top: 20px; }';
        html += 'th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }';
        html += 'th { background-color: #3498db; color: white; font-weight: bold; }';
        html += 'tr:nth-child(even) { background-color: #ecf0f1; }';
        html += '.fila-total { background-color: #2ecc71; font-weight: bold; color: white; }';
        html += '.positivo { color: #27ae60; }';
        html += '.negativo { color: #e74c3c; }';
        html += '.monto { text-align: right; }';
        html += '</style>';
        html += '</head>';
        html += '<body>';

        if (tipoReporte === 'Gastos') {
            const data = this.generateGastosReport();
            html += '<h1>Reporte de Gastos y Servicios</h1>';
            html += `<p><strong>Período:</strong> ${this.formatarFecha(this.state.fechaInicio)} - ${this.formatarFecha(this.state.fechaFin)}</p>`;
            html += `<p><strong>Generado:</strong> ${new Date().toLocaleString('es-GT')}</p>`;
            html += '<table>';
            html += '<thead><tr><th>Concepto</th><th>Cantidad</th><th>Total</th></tr></thead>';
            html += '<tbody>';
            
            Object.keys(data.resumen).sort().forEach(concepto => {
                const item = data.resumen[concepto];
                html += `<tr><td>${concepto}</td><td>${item.cantidad}</td><td class="monto">${this.formatarMoneda(item.monto)}</td></tr>`;
            });

            html += `<tr class="fila-total"><td>TOTAL</td><td></td><td class="monto">${this.formatarMoneda(data.totalGeneral)}</td></tr>`;
            html += '</tbody></table>';
        } else if (tipoReporte === 'Comparativo') {
            const datos = this.generateComparativoReport();
            html += '<h1>Reporte Comparativo Financiero</h1>';
            html += `<p><strong>Período:</strong> ${datos.periodo}</p>`;
            html += `<p><strong>Generado:</strong> ${new Date().toLocaleString('es-GT')}</p>`;
            html += '<table>';
            html += '<thead><tr><th>Concepto</th><th>Monto</th></tr></thead>';
            html += '<tbody>';
            html += `<tr><td>Ventas</td><td class="monto positivo">${this.formatarMoneda(datos.ventas)}</td></tr>`;
            html += `<tr><td>Compras</td><td class="monto negativo">${this.formatarMoneda(datos.compras)}</td></tr>`;
            html += `<tr><td>Gastos y Servicios</td><td class="monto negativo">${this.formatarMoneda(datos.gastos)}</td></tr>`;
            html += `<tr class="fila-total"><td>Ganancia Neta</td><td class="monto ${datos.ganancia >= 0 ? 'positivo' : 'negativo'}">${this.formatarMoneda(datos.ganancia)}</td></tr>`;
            html += '</tbody></table>';
        }

        html += '</body></html>';

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `reporte-${tipoReporte.toLowerCase()}-${new Date().toISOString().split('T')[0]}.html`;
        link.click();
    }
}

// Inicializar módulo globalmente
let gastosModule;
document.addEventListener('DOMContentLoaded', function() {
    gastosModule = new GastosServiciosModule();
    gastosModule.render();
});
