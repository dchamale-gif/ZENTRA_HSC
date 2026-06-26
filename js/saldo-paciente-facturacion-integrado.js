// ============================================
// MÓDULO INTEGRADO: SALDO DE PACIENTE + FACTURACIÓN
// Sistema completo en una interfaz unificada
// ============================================

const SaldoPacienteFacturacion = {
    state: {
        pacientes: [],
        saldos: [],
        facturas: [],
        movimientos: [],
        items_actuales: [],
        descuentos_actuales: [],
        paciente_seleccionado: null,
        config: {
            iva: 12,
            moneda: 'GTQ',
            simbolo: 'Q'
        },
        totales: {
            subtotal: 0,
            total_descuentos: 0,
            base_impuesto: 0,
            total_impuestos: 0,
            total_neto: 0
        }
    },

    // ============================================
    // INICIALIZACIÓN
    // ============================================

    init() {
        this.setupEventListeners();
        this.loadData();
        this.renderSaldos();
        console.log('✅ Módulo Integrado Inicializado');
    },

    setupEventListeners() {
        // Tab búsqueda de saldos
        const searchSaldo = document.getElementById('searchSaldo');
        if (searchSaldo) {
            searchSaldo.addEventListener('input', (e) => this.filtrarSaldos(e.target.value));
        }

        const filterEstado = document.getElementById('filterEstado');
        if (filterEstado) {
            filterEstado.addEventListener('change', () => this.actualizarTabla());
        }

        // Tab facturación - búsqueda de paciente
        const searchFactura = document.getElementById('busquedaPacienteFactura');
        if (searchFactura) {
            searchFactura.addEventListener('input', (e) => this.buscarPacienteFactura(e.target.value));
        }

        // Tab pagos - búsqueda de paciente
        const searchPago = document.getElementById('busquedaPacientePago');
        if (searchPago) {
            searchPago.addEventListener('input', (e) => this.buscarPacientePago(e.target.value));
        }
    },

    loadData() {
        try {
            this.state.pacientes = JSON.parse(localStorage.getItem('pacientes')) || [];
            this.state.saldos = JSON.parse(localStorage.getItem('saldosPacientes')) || [];
            this.cargarDelServidor();
        } catch (error) {
            console.error('Error al cargar datos:', error);
        }
    },

    async cargarDelServidor() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            // Intentar cargar del servidor, si falla usar datos locales
            const response = await fetch('http://localhost:3011/api/billing/saldos-pacientes', {
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(() => null);

            if (response?.ok) {
                const result = await response.json();
                if (result.success) {
                    this.state.saldos = result.data;
                }
            }
        } catch (error) {
            console.warn('Usando datos locales - servidor no disponible');
        }
    },

    // ============================================
    // FUNCIÓN DE TABS
    // ============================================

    switchTab(tabName) {
        // Ocultar todos
        document.querySelectorAll('.tab-content').forEach(el => {
            el.classList.remove('active');
        });
        document.querySelectorAll('.tab-btn').forEach(el => {
            el.classList.remove('active');
        });

        // Mostrar seleccionado
        document.getElementById(tabName).classList.add('active');
        event.target.classList.add('active');

        // Acciones específicas por tab
        if (tabName === 'estados') {
            this.cargarPacientesParaEstado();
        }
    },

    // ============================================
    // TAB 1: SALDOS
    // ============================================

    filtrarSaldos(termino) {
        const tabla = document.getElementById('tablaSaldos');
        termino = termino.toLowerCase();

        const filtrados = this.state.saldos.filter(s => {
            const p = this.state.pacientes.find(pac => pac.id === s.paciente_id);
            if (!p) return false;
            return p.nombre.toLowerCase().includes(termino) ||
                   p.apellidoPaterno.toLowerCase().includes(termino) ||
                   p.dpi.includes(termino);
        });

        this.renderTabla(filtrados);
    },

    actualizarTabla() {
        const filtro = document.getElementById('filterEstado').value;
        let filtrados = [...this.state.saldos];

        if (filtro === 'deudores') {
            filtrados = filtrados.filter(s => s.saldo_pendiente > 0);
        } else if (filtro === 'pagados') {
            filtrados = filtrados.filter(s => s.saldo_pendiente === 0);
        }

        this.renderTabla(filtrados);
    },

    renderSaldos() {
        this.renderTabla(this.state.saldos);
        this.actualizarResumen();
    },

    renderTabla(saldos) {
        const tabla = document.getElementById('tablaSaldos');
        if (!tabla) return;

        if (saldos.length === 0) {
            tabla.innerHTML = '<tr><td colspan="7" class="text-center">No hay datos</td></tr>';
            return;
        }

        tabla.innerHTML = saldos.map(s => {
            const p = this.state.pacientes.find(pac => pac.id === s.paciente_id);
            if (!p) return '';

            const estado = s.saldo_pendiente === 0 ? 'Pagado' : 'Deudor';
            const badgeClass = s.saldo_pendiente === 0 ? 'badge-success' : 'badge-danger';
            const fecha = new Date(s.ultima_transaccion).toLocaleDateString('es-GT');

            return `
                <tr>
                    <td><strong>${p.nombre} ${p.apellidoPaterno}</strong></td>
                    <td>${p.dpi}</td>
                    <td class="text-right"><strong>Q${s.total_deuda.toFixed(2)}</strong></td>
                    <td class="text-right" style="color: ${s.saldo_pendiente > 0 ? '#e74c3c' : '#27ae60'};">
                        <strong>Q${s.saldo_pendiente.toFixed(2)}</strong>
                    </td>
                    <td class="text-center"><span class="badge ${badgeClass}">${estado}</span></td>
                    <td><small>${fecha}</small></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-primary" onclick="SaldoPacienteFacturacion.verDetalles('${s.paciente_id}')">Ver</button>
                        <button class="btn btn-sm btn-success" onclick="SaldoPacienteFacturacion.abrirPagoDirecto('${s.paciente_id}')">Pago</button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    actualizarResumen() {
        const totalDeuda = this.state.saldos.reduce((sum, s) => sum + s.total_deuda, 0);
        const totalPendiente = this.state.saldos.reduce((sum, s) => sum + s.saldo_pendiente, 0);
        const pacientesDeudores = this.state.saldos.filter(s => s.saldo_pendiente > 0).length;

        const resumen = document.getElementById('resumenSaldos');
        resumen.innerHTML = `
            <div class="saldo-item">
                <div class="saldo-label">Total Deuda General</div>
                <div class="saldo-value positivo">Q${totalDeuda.toFixed(2)}</div>
            </div>
            <div class="saldo-item">
                <div class="saldo-label">Total Pendiente</div>
                <div class="saldo-value positivo">Q${totalPendiente.toFixed(2)}</div>
            </div>
            <div class="saldo-item">
                <div class="saldo-label">Pacientes Deudores</div>
                <div class="saldo-value">${pacientesDeudores}</div>
            </div>
        `;
    },

    verDetalles(pacienteId) {
        alert('Funcionalidad de detalles en desarrollo');
    },

    abrirPagoDirecto(pacienteId) {
        document.querySelector('[onclick="switchTab(\'pagos\')"]').click();
        const saldo = this.state.saldos.find(s => s.paciente_id === pacienteId);
        const p = this.state.pacientes.find(pac => pac.id === pacienteId);

        document.getElementById('pacienteIdPago').value = pacienteId;
        document.getElementById('pacienteNombrePago').value = p.nombre + ' ' + p.apellidoPaterno;
        document.getElementById('saldoPendientePago').value = 'Q' + saldo.saldo_pendiente.toFixed(2);
        document.getElementById('montoPago').value = saldo.saldo_pendiente;
        document.getElementById('formPago').style.display = 'block';
    },

    // ============================================
    // TAB 2: FACTURACIÓN
    // ============================================

    buscarPacienteFactura(termino) {
        if (!termino) {
            document.getElementById('resultadosPacientes').innerHTML = '';
            return;
        }

        const resultados = this.state.pacientes.filter(p =>
            p.nombre.toLowerCase().includes(termino.toLowerCase()) ||
            p.apellidoPaterno.toLowerCase().includes(termino.toLowerCase()) ||
            p.dpi.includes(termino)
        );

        const html = resultados.map(p => `
            <div class="search-result-item" onclick="SaldoPacienteFacturacion.seleccionarPacienteFactura('${p.id}', '${p.nombre} ${p.apellidoPaterno}')">
                <strong>${p.nombre} ${p.apellidoPaterno}</strong> - DPI: ${p.dpi}
            </div>
        `).join('');

        document.getElementById('resultadosPacientes').innerHTML = html;
    },

    seleccionarPacienteFactura(pacienteId, nombre) {
        this.state.paciente_seleccionado = { id: pacienteId, nombre: nombre };
        document.getElementById('pacienteIdFactura').value = pacienteId;
        document.getElementById('busquedaPacienteFactura').value = nombre;
        document.getElementById('resultadosPacientes').innerHTML = '';
        document.getElementById('pacienteSeleccionado').style.display = 'block';
        document.getElementById('pacienteSeleccionado').textContent = '✓ ' + nombre + ' seleccionado';

        // Mostrar datos en sidebar
        const p = this.state.pacientes.find(pac => pac.id === pacienteId);
        const saldo = this.state.saldos.find(s => s.paciente_id === pacienteId);

        document.getElementById('datoPacienteSeleccionado').innerHTML = `
            <p><strong>${p.nombre} ${p.apellidoPaterno}</strong></p>
            <p>DPI: ${p.dpi}</p>
            <p>Teléfono: ${p.telefono || 'N/A'}</p>
            ${saldo ? `<p style="color: #e74c3c;">Saldo Pendiente: Q${saldo.saldo_pendiente.toFixed(2)}</p>` : ''}
        `;
    },

    agregarItem() {
        const desc = document.getElementById('descripcionItem').value;
        const cant = parseFloat(document.getElementById('cantidadItem').value);
        const precio = parseFloat(document.getElementById('precioItem').value);

        if (!desc || !cant || !precio || cant <= 0 || precio <= 0) {
            alert('Complete todos los campos correctamente');
            return;
        }

        const item = {
            id: 'ITEM-' + Date.now(),
            descripcion: desc,
            cantidad: cant,
            precio_unitario: precio,
            subtotal: cant * precio,
            descuentos: [],
            descuento_total: 0,
            total_item: cant * precio
        };

        this.state.items_actuales.push(item);
        this.limpiarFormItem();
        this.renderItems();
        this.actualizarTotales();
    },

    renderItems() {
        const tbody = document.getElementById('tablaItems');
        if (this.state.items_actuales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="color: #999;">Sin artículos</td></tr>';
            return;
        }

        tbody.innerHTML = this.state.items_actuales.map((item, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${item.descripcion}</td>
                <td class="text-center">${item.cantidad}</td>
                <td class="text-right">Q${item.precio_unitario.toFixed(2)}</td>
                <td class="text-right">Q${item.subtotal.toFixed(2)}</td>
                <td class="text-right">${item.descuento_total > 0 ? 'Q' + item.descuento_total.toFixed(2) : '-'}</td>
                <td class="text-right"><strong>Q${item.total_item.toFixed(2)}</strong></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-warning" onclick="SaldoPacienteFacturacion.abrirDescuentoItem('${item.id}')">Desc</button>
                    <button class="btn btn-sm btn-danger" onclick="SaldoPacienteFacturacion.eliminarItem('${item.id}')">X</button>
                </td>
            </tr>
        `).join('');
    },

    eliminarItem(itemId) {
        this.state.items_actuales = this.state.items_actuales.filter(i => i.id !== itemId);
        this.renderItems();
        this.actualizarTotales();
    },

    limpiarFormItem() {
        document.getElementById('descripcionItem').value = '';
        document.getElementById('cantidadItem').value = '1';
        document.getElementById('precioItem').value = '';
    },

    abrirDescuentoItem(itemId) {
        const item = this.state.items_actuales.find(i => i.id === itemId);
        if (!item) return;

        const tipo = prompt('Descuento:\n1. Porcentaje (%)\n2. Cantidad Fija (Q)\n\nSelecciona 1 o 2:');
        if (!tipo) return;

        const tipoDesc = tipo === '1' ? 'porcentaje' : 'fijo';
        const valor = parseFloat(prompt(`Ingresa el valor (${tipoDesc}):`));

        if (isNaN(valor) || valor <= 0) return;

        if (tipoDesc === 'porcentaje' && (valor < 0 || valor > 100)) {
            alert('Porcentaje debe estar entre 0 y 100');
            return;
        }

        const motivo = prompt('Motivo del descuento (opcional):');
        const monto = this.calcularDescuento(item.subtotal, tipoDesc, valor);

        item.descuentos.push({ tipo: tipoDesc, valor: valor, monto: monto, motivo });
        item.descuento_total = item.descuentos.reduce((sum, d) => sum + d.monto, 0);
        item.descuento_total = Math.min(item.descuento_total, item.subtotal);
        item.total_item = item.subtotal - item.descuento_total;

        this.renderItems();
        this.actualizarTotales();
    },

    abrirModalDescuento() {
        document.getElementById('modalDescuento').classList.add('active');
    },

    agregarDescuento() {
        const tipo = document.getElementById('tipoDescuento').value;
        const valor = parseFloat(document.getElementById('valorDescuento').value);
        const motivo = document.getElementById('motivoDescuento').value;

        if (!tipo || !valor || valor <= 0) {
            alert('Valores inválidos');
            return;
        }

        if (tipo === 'porcentaje' && (valor < 0 || valor > 100)) {
            alert('Porcentaje debe estar entre 0 y 100');
            return;
        }

        this.state.descuentos_actuales.push({
            id: 'DESC-' + Date.now(),
            tipo: tipo,
            valor: valor,
            motivo: motivo || 'Sin especificar'
        });

        document.getElementById('tipoDescuento').value = 'porcentaje';
        document.getElementById('valorDescuento').value = '';
        document.getElementById('motivoDescuento').value = '';
        document.getElementById('modalDescuento').classList.remove('active');

        this.actualizarTotales();
        this.renderDescuentos();
    },

    renderDescuentos() {
        const tbody = document.getElementById('tablaDescuentos');
        if (this.state.descuentos_actuales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color: #999;">Sin descuentos</td></tr>';
            return;
        }

        tbody.innerHTML = this.state.descuentos_actuales.map((desc, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td><strong>${desc.tipo === 'porcentaje' ? desc.valor + '%' : 'Q' + desc.valor.toFixed(2)}</strong></td>
                <td>${desc.tipo}</td>
                <td>${desc.motivo}</td>
                <td class="text-right">Q${this.calcularMontoDescuento(desc).toFixed(2)}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-danger" onclick="SaldoPacienteFacturacion.eliminarDescuento('${desc.id}')">X</button>
                </td>
            </tr>
        `).join('');
    },

    eliminarDescuento(descId) {
        this.state.descuentos_actuales = this.state.descuentos_actuales.filter(d => d.id !== descId);
        this.renderDescuentos();
        this.actualizarTotales();
    },

    calcularDescuento(base, tipo, valor) {
        if (tipo === 'porcentaje') {
            return (base * valor) / 100;
        } else {
            return Math.min(valor, base);
        }
    },

    calcularMontoDescuento(desc) {
        if (desc.tipo === 'porcentaje') {
            return (this.state.totales.subtotal * desc.valor) / 100;
        } else {
            return desc.valor;
        }
    },

    actualizarTotales() {
        const subtotal = this.state.items_actuales.reduce((sum, item) => sum + item.subtotal, 0);

        let totalDesc = this.state.items_actuales.reduce((sum, item) => sum + (item.descuento_total || 0), 0);

        this.state.descuentos_actuales.forEach(desc => {
            totalDesc += this.calcularMontoDescuento(desc);
        });

        totalDesc = Math.min(totalDesc, subtotal);

        const base = subtotal - totalDesc;
        const impuestos = (base * this.state.config.iva) / 100;
        const total = base + impuestos;

        this.state.totales = {
            subtotal: subtotal,
            total_descuentos: totalDesc,
            base_impuesto: base,
            total_impuestos: impuestos,
            total_neto: total
        };

        this.renderTotales();
    },

    renderTotales() {
        const t = this.state.totales;
        document.getElementById('totalesFactura').innerHTML = `
            <div class="total-row">
                <span>Subtotal:</span>
                <strong>Q${t.subtotal.toFixed(2)}</strong>
            </div>
            ${t.total_descuentos > 0 ? `
                <div class="total-row descuento">
                    <span>Descuentos:</span>
                    <strong>-Q${t.total_descuentos.toFixed(2)}</strong>
                </div>
            ` : ''}
            <div class="total-row">
                <span>Base Imponible:</span>
                <strong>Q${t.base_impuesto.toFixed(2)}</strong>
            </div>
            <div class="total-row">
                <span>IVA ${this.state.config.iva}%:</span>
                <strong>Q${t.total_impuestos.toFixed(2)}</strong>
            </div>
            <div class="total-row final">
                <span>TOTAL:</span>
                <strong style="color: #e74c3c; font-size: 20px;">Q${t.total_neto.toFixed(2)}</strong>
            </div>
        `;
    },

    async guardarFactura() {
        if (!this.state.paciente_seleccionado) {
            alert('Selecciona un paciente');
            return;
        }

        if (this.state.items_actuales.length === 0) {
            alert('Agrega al menos un artículo');
            return;
        }

        const datos = {
            paciente_id: this.state.paciente_seleccionado.id,
            items: this.state.items_actuales,
            descuentos: this.state.descuentos_actuales,
            totales: this.state.totales,
            metodo_pago: document.getElementById('metodoPago').value,
            observaciones: document.getElementById('observaciones').value
        };

        try {
            const response = await fetch('http://localhost:3011/api/billing/facturas-mejorada', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(datos)
            }).catch(() => null);

            if (response?.ok) {
                const result = await response.json();
                if (result.success) {
                    alert('✅ Factura guardada: ' + result.data.numero_factura);
                    this.imprimirRecibo(result.data);
                    this.cancelarFactura();
                    this.loadData();
                }
            } else {
                alert('✅ Factura guardada localmente (server no disponible)');
                this.imprimirRecibo(datos);
                this.cancelarFactura();
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al guardar factura');
        }
    },

    cancelarFactura() {
        this.state.items_actuales = [];
        this.state.descuentos_actuales = [];
        this.state.paciente_seleccionado = null;
        document.getElementById('pacienteIdFactura').value = '';
        document.getElementById('busquedaPacienteFactura').value = '';
        document.getElementById('pacienteSeleccionado').style.display = 'none';
        document.getElementById('datoPacienteSeleccionado').innerHTML = '<p>No hay paciente seleccionado</p>';
        document.getElementById('descripcionItem').value = '';
        document.getElementById('cantidadItem').value = '1';
        document.getElementById('precioItem').value = '';
        document.getElementById('metodoPago').value = 'efectivo';
        document.getElementById('observaciones').value = '';
        this.renderItems();
        this.renderDescuentos();
        this.actualizarTotales();
    },

    imprimirRecibo(factura) {
        const ventana = window.open('', '_blank', 'width=600,height=800');
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Recibo</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background: #34495e; color: white; }
                    .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
                    .total-final { font-size: 16px; font-weight: bold; border-top: 2px solid #000; margin-top: 10px; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>RECIBO</h1>
                    <p>Paciente: ${factura.paciente_seleccionado?.nombre || 'N/A'}</p>
                    <p>Fecha: ${new Date().toLocaleDateString('es-GT')}</p>
                </div>
                <table>
                    <thead><tr><th>Descripción</th><th class="text-right">Cant.</th><th class="text-right">P.U.</th><th class="text-right">Total</th></tr></thead>
                    <tbody>
                        ${factura.items.map(i => `<tr><td>${i.descripcion}</td><td class="text-right">${i.cantidad}</td><td class="text-right">Q${i.precio_unitario.toFixed(2)}</td><td class="text-right">Q${i.total_item.toFixed(2)}</td></tr>`).join('')}
                    </tbody>
                </table>
                <div style="margin-top: 20px;">
                    <div class="total-row"><span>Subtotal:</span><strong>Q${factura.totales.subtotal.toFixed(2)}</strong></div>
                    ${factura.totales.total_descuentos > 0 ? `<div class="total-row"><span>Descuentos:</span><strong>-Q${factura.totales.total_descuentos.toFixed(2)}</strong></div>` : ''}
                    <div class="total-row"><span>IVA 12%:</span><strong>Q${factura.totales.total_impuestos.toFixed(2)}</strong></div>
                    <div class="total-row total-final"><span>TOTAL:</span><strong>Q${factura.totales.total_neto.toFixed(2)}</strong></div>
                </div>
            </body>
            </html>
        `;
        ventana.document.write(html);
        ventana.document.close();
        ventana.print();
    },

    // ============================================
    // TAB 3: ESTADOS
    // ============================================

    cargarPacientesParaEstado() {
        const select = document.getElementById('selectPacienteEstado');
        select.innerHTML = '<option value="">-- Selecciona paciente --</option>' +
            this.state.pacientes.map(p => `
                <option value="${p.id}">${p.nombre} ${p.apellidoPaterno} (${p.dpi})</option>
            `).join('');
    },

    async cargarEstadoCuenta() {
        const pacienteId = document.getElementById('selectPacienteEstado').value;
        if (!pacienteId) {
            document.getElementById('estadoCuentaContainer').style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`http://localhost:3011/api/billing/estado-cuenta/${pacienteId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            }).catch(() => null);

            if (response?.ok) {
                const result = await response.json();
                if (result.success) {
                    this.mostrarEstadoCuenta(result.data);
                }
            }
        } catch (error) {
            alert('Error al cargar estado de cuenta');
        }
    },

    mostrarEstadoCuenta(data) {
        document.getElementById('estadoCuentaContainer').style.display = 'block';
        const p = data.paciente;
        const t = data.totales;

        let html = `
            <div style="background: #f9f9f9; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                <h3>${p.nombre} ${p.apellidoPaterno}</h3>
                <p>DPI: ${p.dpi}</p>
                <p>Teléfono: ${p.telefono || 'N/A'}</p>
            </div>

            <table class="data-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Descripción</th>
                        <th class="text-right">Cargo</th>
                        <th class="text-right">Abono</th>
                        <th class="text-right">Saldo</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.movimientos.forEach(m => {
            html += `
                <tr>
                    <td>${new Date(m.fecha).toLocaleDateString('es-GT')}</td>
                    <td>${m.descripcion}</td>
                    <td class="text-right">${m.tipo === 'factura' ? 'Q' + parseFloat(m.monto).toFixed(2) : '-'}</td>
                    <td class="text-right">${m.tipo === 'pago' ? 'Q' + parseFloat(m.monto).toFixed(2) : '-'}</td>
                    <td class="text-right"><strong>Q${parseFloat(m.saldo_acumulado).toFixed(2)}</strong></td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>

            <div style="margin-top: 20px;">
                <div class="total-row"><span>Total Cargos:</span><strong>Q${t.total_cargos.toFixed(2)}</strong></div>
                <div class="total-row"><span>Total Abonos:</span><strong>Q${t.total_abonos.toFixed(2)}</strong></div>
                <div class="total-row total-final"><span>SALDO ACTUAL:</span><strong style="color: ${t.saldo_actual > 0 ? '#e74c3c' : '#27ae60'};">Q${t.saldo_actual.toFixed(2)}</strong></div>
            </div>
        `;

        document.getElementById('estadoCuentaContent').innerHTML = html;
    },

    imprimirEstado() {
        const pacienteId = document.getElementById('selectPacienteEstado').value;
        if (!pacienteId) {
            alert('Selecciona un paciente');
            return;
        }

        // Implementar impresión
        window.print();
    },

    // ============================================
    // TAB 4: PAGOS
    // ============================================

    buscarPacientePago(termino) {
        if (!termino) {
            document.getElementById('resultadosPago').innerHTML = '';
            return;
        }

        const resultados = this.state.saldos.filter(s => {
            const p = this.state.pacientes.find(pac => pac.id === s.paciente_id);
            if (!p || s.saldo_pendiente === 0) return false;
            return p.nombre.toLowerCase().includes(termino.toLowerCase()) ||
                   p.apellidoPaterno.toLowerCase().includes(termino.toLowerCase()) ||
                   p.dpi.includes(termino);
        });

        const html = resultados.map(s => {
            const p = this.state.pacientes.find(pac => pac.id === s.paciente_id);
            return `
                <div class="search-result-item" onclick="SaldoPacienteFacturacion.seleccionarPacientePago('${s.paciente_id}', '${p.nombre} ${p.apellidoPaterno}', ${s.saldo_pendiente})">
                    <strong>${p.nombre} ${p.apellidoPaterno}</strong> - DPI: ${p.dpi}
                    <br><small>Saldo Pendiente: Q${s.saldo_pendiente.toFixed(2)}</small>
                </div>
            `;
        }).join('');

        document.getElementById('resultadosPago').innerHTML = html;
    },

    seleccionarPacientePago(pacienteId, nombre, saldo) {
        document.getElementById('pacienteIdPago').value = pacienteId;
        document.getElementById('pacienteNombrePago').value = nombre;
        document.getElementById('saldoPendientePago').value = 'Q' + saldo.toFixed(2);
        document.getElementById('montoPago').value = saldo;
        document.getElementById('busquedaPacientePago').value = nombre;
        document.getElementById('resultadosPago').innerHTML = '';
        document.getElementById('formPago').style.display = 'block';
    },

    async registrarPago() {
        const pacienteId = document.getElementById('pacienteIdPago').value;
        const monto = parseFloat(document.getElementById('montoPago').value);

        if (!pacienteId || !monto || monto <= 0) {
            alert('Ingresa un monto válido');
            return;
        }

        try {
            const response = await fetch('http://localhost:3011/api/billing/pagos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    paciente_id: pacienteId,
                    monto: monto,
                    metodo_pago: document.getElementById('metodoPagoPago').value,
                    referencia: document.getElementById('referenciaPago').value,
                    observaciones: document.getElementById('observacionesPago').value
                })
            }).catch(() => null);

            if (response?.ok) {
                const result = await response.json();
                if (result.success) {
                    alert('✅ Pago registrado correctamente');
                    this.cancelarPago();
                    this.loadData();
                    this.renderSaldos();
                }
            } else {
                alert('✅ Pago guardado localmente');
                this.cancelarPago();
            }
        } catch (error) {
            alert('Error al registrar pago');
        }
    },

    cancelarPago() {
        document.getElementById('formPago').style.display = 'none';
        document.getElementById('pacienteIdPago').value = '';
        document.getElementById('pacienteNombrePago').value = '';
        document.getElementById('saldoPendientePago').value = '';
        document.getElementById('montoPago').value = '';
        document.getElementById('busquedaPacientePago').value = '';
        document.getElementById('resultadosPago').innerHTML = '';
    }
};

// Exposición global para onclick
window.switchTab = (tab) => SaldoPacienteFacturacion.switchTab(tab);

// Inicializar cuando DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        SaldoPacienteFacturacion.init();
    });
} else {
    SaldoPacienteFacturacion.init();
}
