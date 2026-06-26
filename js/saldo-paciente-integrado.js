// ============================================
// MÓDULO DE SALDO DE PACIENTE - MEJORADO
// Integración con facturación
// ============================================

const SaldoPacienteIntegrado = {
    state: {
        pacientes: [],
        saldosPacientes: [],
        movimientosPaciente: [],
        searchTerm: '',
        filtroEstado: 'todos',
        paciente_seleccionado: null
    },

    init() {
        this.setupEventListeners();
        this.loadData();
        console.log('Módulo de Saldo de Paciente Integrado inicializado');
    },

    setupEventListeners() {
        const searchInput = document.getElementById('searchSaldoPaciente');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.renderSaldosPacientes();
            });
        }

        const filterSelect = document.getElementById('filterEstadoSaldo');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filtroEstado = e.target.value;
                this.renderSaldosPacientes();
            });
        }

        const registrarPagoBtn = document.getElementById('registrarPagoBtn');
        if (registrarPagoBtn) {
            registrarPagoBtn.addEventListener('click', () => this.abrirModalPago());
        }

        const generarEstadoBtn = document.getElementById('generarEstadoBtn');
        if (generarEstadoBtn) {
            generarEstadoBtn.addEventListener('click', () => this.generarEstado());
        }
    },

    loadData() {
        // Cargar desde localStorage o API
        try {
            const pacientes = JSON.parse(localStorage.getItem('pacientes')) || [];
            const saldos = JSON.parse(localStorage.getItem('saldosPacientes')) || [];
            
            this.state.pacientes = pacientes;
            this.state.saldosPacientes = saldos;

            this.renderSaldosPacientes();
            this.cargarSaldosDelServidor();
        } catch (error) {
            console.error('Error al cargar datos:', error);
        }
    },

    async cargarSaldosDelServidor() {
        try {
            const response = await fetch('http://localhost:3011/api/billing/saldos-pacientes', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();
            if (result.success) {
                this.state.saldosPacientes = result.data;
                this.renderSaldosPacientes();
            }
        } catch (error) {
            console.error('Error al cargar saldos del servidor:', error);
        }
    },

    renderSaldosPacientes() {
        const container = document.getElementById('saldosPacientesTableContainer');
        if (!container) return;

        let filtered = [...this.state.saldosPacientes];

        // Filtro por estado
        if (this.filtroEstado === 'deudores') {
            filtered = filtered.filter(s => s.saldo_pendiente > 0);
        } else if (this.filtroEstado === 'pagados') {
            filtered = filtered.filter(s => s.saldo_pendiente === 0);
        } else if (this.filtroEstado === 'morosos') {
            filtered = filtered.filter(s => {
                const dias = Math.floor((new Date() - new Date(s.ultima_transaccion)) / (1000 * 60 * 60 * 24));
                return s.saldo_pendiente > 0 && dias > 30;
            });
        }

        // Búsqueda
        if (this.searchTerm) {
            filtered = filtered.filter(s => {
                const pacient = this.state.pacientes.find(p => p.id === s.paciente_id);
                return pacient && (
                    pacient.nombre.toLowerCase().includes(this.searchTerm) ||
                    pacient.apellidoPaterno.toLowerCase().includes(this.searchTerm) ||
                    pacient.dpi.includes(this.searchTerm)
                );
            });
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No hay resultados</p></div>';
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="data-table saldos-table">
                    <thead>
                        <tr>
                            <th>Paciente</th>
                            <th>DPI</th>
                            <th class="text-right">Total Deuda</th>
                            <th class="text-right">Saldo Pendiente</th>
                            <th>Estado</th>
                            <th>Última Transacción</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(saldo => {
                            const pacient = this.state.pacientes.find(p => p.id === saldo.paciente_id);
                            if (!pacient) return '';

                            const estado = saldo.saldo_pendiente === 0 ? 'Pagado' : saldo.saldo_pendiente > 0 ? 'Deudor' : 'Acreedor';
                            const badgeClass = saldo.saldo_pendiente === 0 ? 'badge-success' : saldo.saldo_pendiente > 0 ? 'badge-danger' : 'badge-warning';

                            return `
                                <tr>
                                    <td>
                                        <strong>${pacient.nombre} ${pacient.apellidoPaterno}</strong>
                                        <br><small style="color: #999;">${pacient.apellidoMaterno || ''}</small>
                                    </td>
                                    <td>${pacient.dpi}</td>
                                    <td class="text-right font-weight-bold">Q${saldo.total_deuda.toFixed(2)}</td>
                                    <td class="text-right">
                                        <span style="color: ${saldo.saldo_pendiente > 0 ? '#e74c3c' : '#27ae60'}; font-weight: bold;">
                                            Q${saldo.saldo_pendiente.toFixed(2)}
                                        </span>
                                    </td>
                                    <td><span class="badge ${badgeClass}">${estado}</span></td>
                                    <td><small>${new Date(saldo.ultima_transaccion).toLocaleDateString('es-GT')}</small></td>
                                    <td>
                                        <button class="btn btn-sm btn-primary" onclick="SaldoPacienteIntegrado.abrirDetalles('${saldo.paciente_id}')">Ver Detalles</button>
                                        <button class="btn btn-sm btn-info" onclick="SaldoPacienteIntegrado.imprimirSaldo('${saldo.paciente_id}')">🖨️ Imprimir</button>
                                        <button class="btn btn-sm btn-success" onclick="SaldoPacienteIntegrado.abrirModalPagoDirecto('${saldo.paciente_id}', '${pacient.nombre} ${pacient.apellidoPaterno}')">Pago</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    abrirDetalles(pacienteId) {
        const saldo = this.state.saldosPacientes.find(s => s.paciente_id === pacienteId);
        const pacient = this.state.pacientes.find(p => p.id === pacienteId);

        if (!saldo || !pacient) return;

        const modal = document.getElementById('modalDetallesSaldo');
        if (!modal) return;

        const contenido = `
            <div class="detalles-saldo">
                <h3>${pacient.nombre} ${pacient.apellidoPaterno}</h3>
                <p><strong>DPI:</strong> ${pacient.dpi}</p>
                <p><strong>Teléfono:</strong> ${pacient.telefono || 'N/A'}</p>

                <div class="info-saldo">
                    <div class="info-item">
                        <span>Total Deuda:</span>
                        <strong>Q${saldo.total_deuda.toFixed(2)}</strong>
                    </div>
                    <div class="info-item">
                        <span>Saldo Pendiente:</span>
                        <strong style="color: ${saldo.saldo_pendiente > 0 ? '#e74c3c' : '#27ae60'};">Q${saldo.saldo_pendiente.toFixed(2)}</strong>
                    </div>
                    <div class="info-item">
                        <span>Última Transacción:</span>
                        <strong>${new Date(saldo.ultima_transaccion).toLocaleDateString('es-GT')}</strong>
                    </div>
                </div>

                <button class="btn btn-success" onclick="SaldoPacienteIntegrado.abrirModalPagoDirecto('${pacienteId}', '${pacient.nombre} ${pacient.apellidoPaterno}')" style="width: 100%; margin-top: 15px;">Registrar Pago</button>
                <button class="btn btn-info" onclick="SaldoPacienteIntegrado.generarEstadoCuentaDetallado('${pacienteId}')" style="width: 100%; margin-top: 10px;">Ver Estado de Cuenta</button>
            </div>
        `;

        const container = document.getElementById('modalDetallesContent');
        if (container) {
            container.innerHTML = contenido;
            modal.style.display = 'block';
        }
    },

    abrirModalPago() {
        const modal = document.getElementById('modalRegistrarPago');
        if (modal) {
            modal.style.display = 'block';
        }
    },

    abrirModalPagoDirecto(pacienteId, nombrePaciente) {
        const pacient = this.state.pacientes.find(p => p.id === pacienteId);
        const saldo = this.state.saldosPacientes.find(s => s.paciente_id === pacienteId);

        if (!saldo) {
            alert('No hay información de saldo para este paciente');
            return;
        }

        const modal = document.getElementById('modalPagoDireto');
        if (modal) {
            document.getElementById('modalPagoPacienteId').value = pacienteId;
            document.getElementById('modalPagoNombrePaciente').textContent = nombrePaciente;
            document.getElementById('modalPagoSaldoPendiente').textContent = 'Q' + saldo.saldo_pendiente.toFixed(2);
            document.getElementById('modalPagoMonto').value = saldo.saldo_pendiente;
            modal.style.display = 'block';
        }
    },

    async registrarPago() {
        const pacienteId = document.getElementById('modalPagoPacienteId').value;
        const monto = parseFloat(document.getElementById('modalPagoMonto').value);
        const metodoPago = document.getElementById('modalPagoMetodo').value;
        const referencia = document.getElementById('modalPagoReferencia').value;
        const observaciones = document.getElementById('modalPagoObservaciones').value;

        if (!pacienteId || !monto || monto <= 0) {
            alert('Ingrese un monto válido');
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
                    metodo_pago: metodoPago,
                    referencia: referencia,
                    observaciones: observaciones
                })
            });

            const result = await response.json();

            if (result.success) {
                alert('Pago registrado exitosamente');
                document.getElementById('modalPagoDireto').style.display = 'none';
                this.cargarSaldosDelServidor();
            } else {
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error('Error al registrar pago:', error);
            alert('Error al registrar pago');
        }
    },

    async generarEstadoCuentaDetallado(pacienteId) {
        const pacient = this.state.pacientes.find(p => p.id === pacienteId);

        try {
            const response = await fetch(`http://localhost:3011/api/billing/estado-cuenta/${pacienteId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();
            if (result.success) {
                document.getElementById('modalPagoDireto').style.display = 'none';
                this.imprimirEstadoCuenta(result.data);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al generar estado de cuenta');
        }
    },

    generarEstado() {
        const pacienteId = document.getElementById('selectPacienteEstado')?.value;
        if (!pacienteId) {
            alert('Seleccione un paciente');
            return;
        }

        this.generarEstadoCuentaDetallado(pacienteId);
    },

    imprimirEstadoCuenta(data) {
        const ventana = window.open('', '_blank', 'width=900,height=1000');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Estado de Cuenta</title>
                <style>
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                        padding: 30px; 
                        line-height: 1.6;
                        background: white;
                    }
                    .container { max-width: 900px; margin: 0 auto; }
                    .header { 
                        text-align: center; 
                        border-bottom: 3px solid #000; 
                        padding-bottom: 20px; 
                        margin-bottom: 30px; 
                    }
                    .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
                    .header h2 { margin: 10px 0 0 0; font-size: 16px; color: #666; }
                    
                    .info-section { 
                        display: grid; 
                        grid-template-columns: 1fr 1fr; 
                        gap: 30px; 
                        margin-bottom: 40px;
                    }
                    .info-box { }
                    .info-box .label { 
                        display: block; 
                        font-weight: bold; 
                        margin-top: 10px; 
                        font-size: 11px; 
                        color: #666; 
                        text-transform: uppercase;
                    }
                    .info-box p { margin: 3px 0; font-size: 13px; }
                    
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin: 20px 0; 
                    }
                    th, td { 
                        padding: 12px; 
                        text-align: left; 
                        border: 1px solid #ddd; 
                        font-size: 12px;
                    }
                    th { 
                        background-color: #2c3e50; 
                        color: white; 
                        font-weight: bold; 
                    }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    
                    .total-section { 
                        margin-top: 30px; 
                        border-top: 2px solid #000; 
                        padding-top: 20px; 
                    }
                    .total-row { 
                        display: flex; 
                        justify-content: space-between; 
                        padding: 10px 0; 
                        font-size: 13px; 
                        border-bottom: 1px solid #eee;
                    }
                    .total-row.grande { 
                        font-size: 16px; 
                        font-weight: bold; 
                        border: none;
                        margin-top: 10px;
                    }
                    .right { text-align: right; }
                    .footer { 
                        margin-top: 40px; 
                        text-align: center; 
                        font-size: 11px; 
                        color: #666; 
                        border-top: 1px solid #ddd; 
                        padding-top: 20px; 
                    }
                    .text-danger { color: #e74c3c; }
                    .text-success { color: #27ae60; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>ESTADO DE CUENTA DETALLADO</h1>
                        <h2>Centro Médico / Clínica</h2>
                    </div>

                    <div class="info-section">
                        <div class="info-box">
                            <div class="label">Paciente</div>
                            <p><strong>${data.paciente.nombre} ${data.paciente.apellidoPaterno} ${data.paciente.apellidoMaterno || ''}</strong></p>
                            <div class="label">DPI</div>
                            <p>${data.paciente.dpi}</p>
                            <div class="label">Teléfono</div>
                            <p>${data.paciente.telefono || 'N/A'}</p>
                        </div>
                        <div class="info-box">
                            <div class="label">Período</div>
                            <p>Datos generales</p>
                            <div class="label">Fecha de Generación</div>
                            <p>${new Date().toLocaleString('es-GT')}</p>
                            <div class="label">Moneda</div>
                            <p>Quetzales (Q)</p>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="width: 12%;">Fecha</th>
                                <th style="width: 30%;">Descripción</th>
                                <th style="width: 15%;">Concepto</th>
                                <th style="width: 13%; text-align: right;">Cargo</th>
                                <th style="width: 13%; text-align: right;">Abono</th>
                                <th style="width: 15%; text-align: right;">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.movimientos.map((mov, idx) => `
                                <tr>
                                    <td>${new Date(mov.fecha).toLocaleDateString('es-GT')}</td>
                                    <td>${mov.descripcion}</td>
                                    <td>${mov.tipo}</td>
                                    <td class="right">${mov.tipo === 'factura' || mov.tipo === 'cargo' ? 'Q' + parseFloat(mov.monto).toFixed(2) : '-'}</td>
                                    <td class="right">${mov.tipo === 'pago' || mov.tipo === 'abono' ? 'Q' + parseFloat(mov.monto).toFixed(2) : '-'}</td>
                                    <td class="right"><strong class="${parseFloat(mov.saldo_acumulado) > 0 ? 'text-danger' : 'text-success'}">Q${parseFloat(mov.saldo_acumulado).toFixed(2)}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="total-section">
                        <div class="total-row">
                            <span>Total de Cargos:</span>
                            <strong class="right">Q${data.totales.total_cargos.toFixed(2)}</strong>
                        </div>
                        <div class="total-row">
                            <span>Total de Abonos:</span>
                            <strong class="right">Q${data.totales.total_abonos.toFixed(2)}</strong>
                        </div>
                        <div class="total-row grande">
                            <span>SALDO ACTUAL:</span>
                            <strong class="right ${data.totales.saldo_actual < 0 ? 'text-success' : 'text-danger'}" style="font-size: 18px;">
                                Q${data.totales.saldo_actual.toFixed(2)}
                            </strong>
                        </div>
                    </div>

                    <div class="footer">
                        <p>Este es un estado de cuenta oficial del sistema contable.</p>
                        <p>Para consultas o aclaraciones, favor contactar a administración.</p>
                        <p style="margin-top: 20px; font-size: 10px;">Impreso el: ${new Date().toLocaleString('es-GT')}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        ventana.document.write(html);
        ventana.document.close();
        ventana.print();
    },

    imprimirSaldo(pacienteId) {
        const saldo = this.state.saldosPacientes.find(s => s.paciente_id === pacienteId);
        const pacient = this.state.pacientes.find(p => p.id === pacienteId);

        if (!saldo || !pacient) {
            alert('Datos de paciente no encontrados');
            return;
        }

        const ventana = window.open('', '_blank', 'width=700,height=600');
        const fecha = new Date().toLocaleDateString('es-GT');
        const hora = new Date().toLocaleTimeString('es-GT');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Estado de Saldo - ${pacient.nombre}</title>
                <style>
                    * { margin: 0; padding: 0; }
                    body { 
                        font-family: 'Arial', sans-serif; 
                        padding: 20px;
                        background: white;
                    }
                    .container {
                        max-width: 650px;
                        margin: 0 auto;
                        border: 1px solid #ddd;
                        padding: 30px;
                        border-radius: 5px;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 3px solid #34495e;
                        padding-bottom: 15px;
                        margin-bottom: 25px;
                    }
                    .header h1 {
                        color: #34495e;
                        font-size: 28px;
                        margin-bottom: 5px;
                    }
                    .header p {
                        color: #7f8c8d;
                        font-size: 12px;
                    }
                    .paciente-info {
                        background: #ecf0f1;
                        padding: 15px;
                        border-radius: 4px;
                        margin-bottom: 20px;
                    }
                    .info-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 8px;
                        font-size: 14px;
                    }
                    .info-label {
                        font-weight: bold;
                        color: #2c3e50;
                    }
                    .info-value {
                        color: #34495e;
                    }
                    .saldos-section {
                        margin-top: 30px;
                    }
                    .saldos-section h3 {
                        color: #34495e;
                        border-bottom: 2px solid #3498db;
                        padding-bottom: 8px;
                        margin-bottom: 20px;
                        font-size: 16px;
                    }
                    .saldo-item {
                        display: flex;
                        justify-content: space-between;
                        padding: 12px;
                        border-bottom: 1px solid #ecf0f1;
                        font-size: 14px;
                    }
                    .saldo-item:last-child {
                        border-bottom: none;
                    }
                    .saldo-label {
                        font-weight: 600;
                        color: #2c3e50;
                    }
                    .saldo-value {
                        text-align: right;
                        font-weight: bold;
                        font-size: 16px;
                    }
                    .saldo-deuda {
                        color: #e74c3c;
                    }
                    .saldo-pagado {
                        color: #27ae60;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 15px;
                        border-top: 1px solid #ddd;
                        color: #7f8c8d;
                        font-size: 11px;
                    }
                    .estado-badge {
                        display: inline-block;
                        padding: 5px 15px;
                        border-radius: 20px;
                        font-weight: bold;
                        font-size: 12px;
                        margin-top: 10px;
                    }
                    .estado-deudor {
                        background: #ffe6e6;
                        color: #c0392b;
                    }
                    .estado-pagado {
                        background: #e6ffe6;
                        color: #27ae60;
                    }
                    @media print {
                        body { padding: 0; }
                        .container { border: none; padding: 0; }
                        .footer { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>ESTADO DE SALDO</h1>
                        <p>Comprobante de Saldo Actual del Paciente</p>
                    </div>

                    <div class="paciente-info">
                        <div class="info-row">
                            <span class="info-label">Paciente:</span>
                            <span class="info-value">${pacient.nombre} ${pacient.apellidoPaterno} ${pacient.apellidoMaterno || ''}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Documento:</span>
                            <span class="info-value">${pacient.dpi || pacient.pasaporte || 'N/A'}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Teléfono:</span>
                            <span class="info-value">${pacient.telefono || 'N/A'}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Correo:</span>
                            <span class="info-value">${pacient.correo || 'N/A'}</span>
                        </div>
                    </div>

                    <div class="saldos-section">
                        <h3>INFORMACIÓN DE SALDO</h3>
                        
                        <div class="saldo-item">
                            <span class="saldo-label">Total Deuda:</span>
                            <span class="saldo-value">Q${parseFloat(saldo.total_deuda || 0).toFixed(2)}</span>
                        </div>
                        
                        <div class="saldo-item">
                            <span class="saldo-label">Saldo Pendiente:</span>
                            <span class="saldo-value saldo-${saldo.saldo_pendiente > 0 ? 'deuda' : 'pagado'}">
                                Q${parseFloat(saldo.saldo_pendiente || 0).toFixed(2)}
                            </span>
                        </div>

                        <div class="saldo-item">
                            <span class="saldo-label">Estado:</span>
                            <span class="saldo-value">
                                <div class="estado-badge ${saldo.saldo_pendiente === 0 ? 'estado-pagado' : 'estado-deudor'}">
                                    ${saldo.saldo_pendiente === 0 ? '✓ PAGADO' : '⚠ DEUDOR'}
                                </div>
                            </span>
                        </div>

                        <div class="saldo-item">
                            <span class="saldo-label">Última Transacción:</span>
                            <span class="info-value">${new Date(saldo.ultima_transaccion).toLocaleDateString('es-GT')}</span>
                        </div>
                    </div>

                    <div class="footer">
                        <p>Documento emitido: ${fecha} a las ${hora}</p>
                        <p>Este comprobante certifica el estado actual del saldo del paciente</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        ventana.document.write(html);
        ventana.document.close();
        ventana.print();
    },

    formatearMoneda(valor) {
        return 'Q' + valor.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
};

// Inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        SaldoPacienteIntegrado.init();
    });
} else {
    SaldoPacienteIntegrado.init();
}
