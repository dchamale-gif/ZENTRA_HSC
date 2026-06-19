// ============================================
// MÓDULO DE SALDO DEL PACIENTE
// ============================================
// Visualizar saldo diario sin cerrar cuenta
// Abonos, pagos y microfacturas

const SaldoPacienteModule = {
    state: {
        pacientes: [],
        saldosPacientes: [], // Saldos pendientes por cobrar
        movimientosPaciente: [], // Transacciones por paciente
        searchTerm: '',
        filtroEstado: 'todos' // todos, deudores, pagados
    },

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        this.loadData();
        console.log('Módulo de Saldo del Paciente inicializado');
    },

    // Configurar event listeners
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

        const addPaymentBtn = document.getElementById('addPaymentBtn');
        if (addPaymentBtn) {
            addPaymentBtn.addEventListener('click', () => this.openPaymentModal());
        }

        const savePaymentBtn = document.getElementById('savePaymentBtn');
        if (savePaymentBtn) {
            savePaymentBtn.addEventListener('click', () => this.savePayment());
        }

        const closePaymentModal = document.querySelector('#paymentModal .close-btn');
        if (closePaymentModal) {
            closePaymentModal.addEventListener('click', () => this.closePaymentModal());
        }
    },

    // Cargar datos
    loadData() {
        const demoData = window.DemoData || {};
        this.state.pacientes = JSON.parse(JSON.stringify(demoData.pacientes || []));
        this.state.saldosPacientes = JSON.parse(JSON.stringify(demoData.saldosPacientes || []));
        this.state.movimientosPaciente = JSON.parse(JSON.stringify(demoData.movimientosPaciente || []));
        this.renderSaldosPacientes();
    },

    // Renderizar tabla de saldos
    renderSaldosPacientes() {
        const container = document.getElementById('saldosPacientesTableContainer');
        if (!container) return;

        let filtered = [...this.state.saldosPacientes];

        // Filtro por estado
        if (this.filtroEstado === 'deudores') {
            filtered = filtered.filter(s => s.saldoPendiente > 0);
        } else if (this.filtroEstado === 'pagados') {
            filtered = filtered.filter(s => s.saldoPendiente === 0);
        }

        // Búsqueda
        if (this.searchTerm) {
            filtered = filtered.filter(s => {
                const pacient = this.state.pacientes.find(p => p.id === s.pacienteId);
                return pacient && (
                    pacient.nombre.toLowerCase().includes(this.searchTerm) ||
                    pacient.apellidoPaterno.toLowerCase().includes(this.searchTerm) ||
                    pacient.dpi.includes(this.searchTerm)
                );
            });
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No hay datos de saldo registrados</p></div>';
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Paciente</th>
                            <th>Cédula</th>
                            <th>Saldo Pendiente</th>
                            <th>Total Acumulado</th>
                            <th>Abonos Realizados</th>
                            <th>Última Transacción</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(saldo => this.renderSaldoRow(saldo)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // Renderizar fila de saldo
    renderSaldoRow(saldo) {
        const pacient = this.state.pacientes.find(p => p.id === saldo.pacienteId);
        if (!pacient) return '';

        const estadoBadge = saldo.saldoPendiente === 0
            ? '<span class="badge badge-success">Pagado</span>'
            : '<span class="badge badge-warning">Deudor</span>';

        return `
            <tr>
                <td><strong>${pacient.nombre} ${pacient.apellidoPaterno} ${pacient.apellidoMaterno || ''}</strong></td>
                <td>${pacient.dpi || pacient.pasaporte || 'N/A'}</td>
                <td><span class="amount ${saldo.saldoPendiente > 0 ? 'negative' : 'positive'}">$${saldo.saldoPendiente.toFixed(2)}</span></td>
                <td>$${saldo.totalAcumulado.toFixed(2)}</td>
                <td>$${saldo.totalAbonos.toFixed(2)}</td>
                <td>${saldo.ultimaTransaccion}</td>
                <td>${estadoBadge}</td>
                <td class="actions">
                    <button class="btn-icon btn-view" title="Ver Detalles" onclick="SaldoPacienteModule.viewSaldoDetails('${saldo.pacienteId}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon btn-edit" title="Registrar Pago" onclick="SaldoPacienteModule.openPaymentModal('${saldo.pacienteId}')">
                        <i class="fas fa-money-bill-wave"></i>
                    </button>
                </td>
            </tr>
        `;
    },

    // Ver detalles de saldo
    viewSaldoDetails(pacienteId) {
        const saldo = this.state.saldosPacientes.find(s => s.pacienteId === pacienteId);
        const pacient = this.state.pacientes.find(p => p.id === pacienteId);
        const movimientos = this.state.movimientosPaciente.filter(m => m.pacienteId === pacienteId);

        if (!saldo || !pacient) return;

        const detailsModal = document.getElementById('saldoDetailsModal');
        const detailsContent = document.getElementById('saldoDetailsContent');
        if (!detailsModal || !detailsContent) return;

        detailsContent.innerHTML = `
            <div class="saldo-details-card">
                <div class="saldo-header">
                    <h3>Estado de Cuenta - ${pacient.nombre} ${pacient.apellidoPaterno} ${pacient.apellidoMaterno || ''}</h3>
                    ${saldo.saldoPendiente === 0 
                        ? '<span class="badge badge-success">SIN DEUDA</span>'
                        : '<span class="badge badge-danger">DEUDOR</span>'
                    }
                </div>

                <div class="saldo-summary">
                    <div class="summary-item">
                        <label>Total Acumulado</label>
                        <p class="amount">$${saldo.totalAcumulado.toFixed(2)}</p>
                    </div>
                    <div class="summary-item">
                        <label>Total Abonos</label>
                        <p class="amount positive">$${saldo.totalAbonos.toFixed(2)}</p>
                    </div>
                    <div class="summary-item">
                        <label>Saldo Pendiente</label>
                        <p class="amount ${saldo.saldoPendiente > 0 ? 'negative' : 'positive'}" style="font-size: 18px; font-weight: bold;">
                            $${saldo.saldoPendiente.toFixed(2)}
                        </p>
                    </div>
                    <div class="summary-item">
                        <label>% Pagado</label>
                        <p class="percentage">${((saldo.totalAbonos / saldo.totalAcumulado) * 100).toFixed(1)}%</p>
                    </div>
                </div>

                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${((saldo.totalAbonos / saldo.totalAcumulado) * 100)}%"></div>
                </div>

                ${movimientos.length > 0 ? `
                    <div class="movimientos-section">
                        <h4>Detalle de Servicios Prestados</h4>
                        <div style="overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
                                <thead>
                                    <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
                                        <th style="padding: 10px; text-align: left;">Fecha</th>
                                        <th style="padding: 10px; text-align: left;">Concepto</th>
                                        <th style="padding: 10px; text-align: center;">Detalle</th>
                                        <th style="padding: 10px; text-align: right;">Monto</th>
                                        <th style="padding: 10px; text-align: center;">Tipo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${movimientos.map(m => {
                                        const tipoClass = m.tipo === 'Abono' ? 'positive' : 'negative';
                                        const tipoIcon = m.tipo === 'Abono' ? '✓ Pago' : '• Cargo';
                                        return `
                                            <tr style="border-bottom: 1px solid #eee;">
                                                <td style="padding: 10px;">${m.fecha}</td>
                                                <td style="padding: 10px;"><strong>${m.descripcion}</strong></td>
                                                <td style="padding: 10px; text-align: center;">
                                                    ${m.lineas && m.lineas.length > 0 ? `
                                                        <button onclick="SaldoPacienteModule.mostrarLineasDetalle('${m.id}')" class="btn-link" style="color: #0066cc; text-decoration: underline; border: none; background: none; cursor: pointer; font-size: 12px;">
                                                            Ver líneas (${m.lineas.length})
                                                        </button>
                                                    ` : '-'}
                                                </td>
                                                <td style="padding: 10px; text-align: right; font-weight: bold; color: ${m.tipo === 'Abono' ? '#27ae60' : '#e74c3c'};">
                                                    ${m.tipo === 'Abono' ? '+' : '-'}$${m.monto.toFixed(2)}
                                                </td>
                                                <td style="padding: 10px; text-align: center;">
                                                    <span style="background: ${m.tipo === 'Abono' ? '#d4edda' : '#f8d7da'}; color: ${m.tipo === 'Abono' ? '#155724' : '#721c24'}; padding: 3px 8px; border-radius: 3px; font-size: 11px; font-weight: 600;">
                                                        ${tipoIcon}
                                                    </span>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>

                        <div class="movimientos-list">
                            ${movimientos.filter(m => m.tipo === 'Abono').map(m => `
                                <div class="movimiento-item">
                                    <div class="mov-header">
                                        <strong>Pago registrado</strong>
                                        <span class="badge badge-success">${m.fecha}</span>
                                    </div>
                                    <div class="mov-details">
                                        <span class="mov-desc">${m.descripcion}</span>
                                        <span class="mov-amount positive">+$${m.monto.toFixed(2)}</span>
                                    </div>
                                    ${m.factura ? `
                                        <div style="margin-top: 8px;">
                                            <button onclick="SaldoPacienteModule.descargarFactura('${m.factura}')" class="btn-small" style="background: #27ae60; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px;">
                                                <i class="fas fa-file-download"></i> Descargar Comprobante
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        detailsModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    // Mostrar líneas detalladas de un movimiento
    mostrarLineasDetalle(movimientoId) {
        const movimiento = this.state.movimientosPaciente.find(m => m.id === movimientoId);
        if (!movimiento || !movimiento.lineas || movimiento.lineas.length === 0) return;

        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10001;';
        modal.innerHTML = `
            <div style="background: white; border-radius: 8px; padding: 0; max-width: 500px; width: 90%;">
                <div style="padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 16px;">${movimiento.descripcion}</h3>
                    <button onclick="this.closest('div').parentElement.remove();" style="border: none; background: none; font-size: 24px; cursor: pointer; color: #999;">×</button>
                </div>
                <div style="padding: 15px; max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f5f5f5;">
                                <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Concepto</th>
                                <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Cantidad</th>
                                <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Unitario</th>
                                <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${movimiento.lineas.map(linea => `
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 8px;">${linea.concepto}</td>
                                    <td style="text-align: right; padding: 8px;">${linea.cantidad}</td>
                                    <td style="text-align: right; padding: 8px;">$${linea.unitario.toFixed(2)}</td>
                                    <td style="text-align: right; padding: 8px; font-weight: bold;">$${linea.subtotal.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f5f5f5; font-weight: bold;">
                                <td colspan="3" style="padding: 10px; text-align: right; border-top: 2px solid #ddd;">TOTAL:</td>
                                <td style="padding: 10px; text-align: right; border-top: 2px solid #ddd;">$${movimiento.monto.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div style="padding: 12px; background: #f5f5f5; border-top: 1px solid #eee; text-align: right;">
                    <button onclick="this.closest('div').parentElement.remove();" class="btn btn-secondary" style="font-size: 13px; padding: 6px 12px;">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // Cerrar modal de detalles
    closeSaldoDetailsModal() {
        const modal = document.getElementById('saldoDetailsModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    },

    // Abrir modal de pago
    openPaymentModal(pacienteId = null) {
        const modal = document.getElementById('paymentModal');
        const form = document.getElementById('editPaymentForm');
        if (!modal || !form) return;

        form.reset();
        document.getElementById('paymentPacienteId').value = pacienteId || '';
        document.getElementById('paymentFecha').valueAsDate = new Date();
        
        if (pacienteId) {
            this.updatePaymentPacienteSelect();
            document.getElementById('paymentPacienteSelect').value = pacienteId;
            this.loadSaldoInfo(pacienteId);
        }

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    // Cerrar modal
    closePaymentModal() {
        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    },

    // Actualizar select de pacientes
    updatePaymentPacienteSelect() {
        const select = document.getElementById('paymentPacienteSelect');
        if (!select) return;

        select.innerHTML = '<option value="">-- Selecciona un paciente --</option>' +
            this.state.pacientes
                .filter(p => p.estado === 'activo')
                .map(p => `<option value="${p.id}">${p.nombre} ${p.apellido} (${p.cedula})</option>`)
                .join('');

        select.addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadSaldoInfo(e.target.value);
                document.getElementById('paymentPacienteId').value = e.target.value;
            }
        });
    },

    // Cargar info de saldo del paciente
    loadSaldoInfo(pacienteId) {
        const saldo = this.state.saldosPacientes.find(s => s.pacienteId === pacienteId);
        const saldoInfoDiv = document.getElementById('saldoInfo');
        
        if (saldoInfoDiv && saldo) {
            saldoInfoDiv.innerHTML = `
                <div class="saldo-info-box">
                    <p><strong>Saldo Pendiente:</strong> <span class="amount negative">$${saldo.saldoPendiente.toFixed(2)}</span></p>
                    <p><strong>Total Acumulado:</strong> <span class="amount">$${saldo.totalAcumulado.toFixed(2)}</span></p>
                </div>
            `;
        }
    },

    // Guardar pago/abono
    savePayment() {
        const pacienteId = document.getElementById('paymentPacienteSelect').value;
        const monto = parseFloat(document.getElementById('paymentMonto').value) || 0;
        const tipo = document.getElementById('paymentTipo').value;
        const descripcion = document.getElementById('paymentDescripcion').value.trim();
        const fecha = document.getElementById('paymentFecha').value;

        if (!pacienteId || !monto || monto <= 0 || !fecha) {
            this.showNotification('⚠️ Por favor completa todos los campos', 'warning');
            return;
        }

        const saldo = this.state.saldosPacientes.find(s => s.pacienteId === pacienteId);
        if (!saldo) {
            this.showNotification('❌ Paciente sin saldo registrado', 'error');
            return;
        }

        // Registrar movimiento
        const movimento = {
            id: this.generateId('MOV'),
            pacienteId: pacienteId,
            tipo: tipo,
            monto: monto,
            descripcion: descripcion,
            fecha: fecha,
            factura: null // Para almacenar referencia a factura
        };

        this.state.movimientosPaciente.push(movimento);

        // Actualizar saldo
        if (tipo === 'Abono') {
            saldo.saldoPendiente -= monto;
            saldo.totalAbonos += monto;
            
            // Generar factura automática para abonos
            const paciente = this.state.pacientes.find(p => p.id === pacienteId);
            if (paciente) {
                const factura = this.generarFacturaAbono(paciente, monto, fecha, movimento.id);
                movimento.factura = factura.id;
            }
        } else if (tipo === 'Cargo') {
            saldo.saldoPendiente += monto;
            saldo.totalAcumulado += monto;
        }

        saldo.saldoPendiente = Math.max(0, saldo.saldoPendiente); // No negativos
        saldo.ultimaTransaccion = fecha;

        this.showNotification('✅ Pago registrado correctamente', 'success');
        this.saveToDB();
        this.closePaymentModal();
        this.renderSaldosPacientes();
    },

    // Generar factura individual para abono
    generarFacturaAbono(paciente, monto, fecha, movimientoId) {
        const facturas = this.loadFacturas();
        
        const factura = {
            id: this.generateId('FAC'),
            numeroFactura: `FAC-${new Date().getFullYear()}-${String(facturas.length + 1).padStart(5, '0')}`,
            pacienteId: paciente.id,
            pacienteNombre: `${paciente.nombre} ${paciente.apellidoPaterno} ${paciente.apellidoMaterno}`,
            pacienteDPI: paciente.dpi || '',
            movimientoId: movimientoId,
            monto: monto,
            fecha: fecha,
            concepto: 'Abono a cuenta de hospitalización',
            estado: 'emitida',
            fechaEmision: new Date().toISOString(),
            impreso: false
        };

        facturas.push(factura);
        localStorage.setItem('facturasAbonos', JSON.stringify(facturas));
        
        return factura;
    },

    // Cargar facturas del localStorage
    loadFacturas() {
        const facturasStr = localStorage.getItem('facturasAbonos');
        return facturasStr ? JSON.parse(facturasStr) : [];
    },

    // Descargar factura en PDF
    descargarFactura(facturaId) {
        const facturas = this.loadFacturas();
        const factura = facturas.find(f => f.id === facturaId);
        
        if (!factura) {
            this.showNotification('❌ Factura no encontrada', 'error');
            return;
        }

        let html = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${factura.numeroFactura}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                    .container { max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 30px; }
                    .header { text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 20px; }
                    .header h1 { margin: 0; color: #1e3a8a; }
                    .header p { margin: 5px 0; color: #666; }
                    .factura-numero { text-align: right; font-weight: bold; margin-bottom: 20px; }
                    .section { margin-bottom: 20px; }
                    .section-title { font-weight: bold; color: #1e3a8a; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
                    .info-row { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 8px; }
                    .info-label { font-weight: bold; color: #333; }
                    .info-value { color: #666; }
                    .tabla { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    .tabla th { background: #1e3a8a; color: white; padding: 10px; text-align: left; }
                    .tabla td { padding: 10px; border-bottom: 1px solid #ddd; }
                    .tabla tr:nth-child(even) { background: #f9f9f9; }
                    .total-row { font-weight: bold; font-size: 18px; background: #f0f0f0; }
                    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>FACTURA DE ABONO</h1>
                        <p>Sistema de Gestión Contable y Sanitaria</p>
                    </div>

                    <div class="factura-numero">
                        <p>Factura: <strong>${factura.numeroFactura}</strong></p>
                        <p>Fecha: ${new Date(factura.fechaEmision).toLocaleDateString('es-GT')}</p>
                    </div>

                    <div class="section">
                        <div class="section-title">DATOS DEL PACIENTE</div>
                        <div class="info-row">
                            <div>
                                <div class="info-label">Nombre:</div>
                                <div class="info-value">${factura.pacienteNombre}</div>
                            </div>
                            <div>
                                <div class="info-label">DPI:</div>
                                <div class="info-value">${factura.pacienteDPI || 'No registrado'}</div>
                            </div>
                        </div>
                    </div>

                    <table class="tabla">
                        <thead>
                            <tr>
                                <th style="width: 60%;">Descripción</th>
                                <th style="width: 20%;">Cantidad</th>
                                <th style="width: 20%; text-align: right;">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${factura.concepto}</td>
                                <td style="text-align: center;">1</td>
                                <td style="text-align: right;">Q. ${factura.monto.toFixed(2)}</td>
                            </tr>
                            <tr class="total-row">
                                <td colspan="2" style="text-align: right;">TOTAL:</td>
                                <td style="text-align: right;">Q. ${factura.monto.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="section">
                        <div class="section-title">OBSERVACIONES</div>
                        <p style="color: #666; margin: 10px 0;">
                            Abono parcial a cuenta de hospitalización. Esta factura documenta el pago realizado 
                            en la fecha indicada.
                        </p>
                    </div>

                    <div class="footer">
                        <p>Documento generado por sistema. Válido sin firma digital.</p>
                        <p>Emitido: ${new Date().toLocaleString('es-GT')}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${factura.numeroFactura}.html`;
        link.click();
        
        factura.impreso = true;
        localStorage.setItem('facturasAbonos', JSON.stringify(facturas));
        this.showNotification('✅ Factura descargada correctamente', 'success');
    },

    // Generar ID único
    generateId(prefix) {
        const timestamp = Date.now().toString(36);
        return `${prefix}-${timestamp}`;
    },

    // Guardar en DB (localStorage)
    saveToDB() {
        localStorage.setItem('saldosPacientes', JSON.stringify(this.state.saldosPacientes));
        localStorage.setItem('movimientosPaciente', JSON.stringify(this.state.movimientosPaciente));
    },

    // Mostrar notificación
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
};
