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
        const searchInput = document.getElementById('searchSaldo');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.renderSaldosPacientes();
            });
        }

        const filterSelect = document.getElementById('filterEstado');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filtroEstado = e.target.value;
                this.renderSaldosPacientes();
            });
        }
    },

    // Cargar datos
    loadData() {
        try {
            const demoData = window.DemoData || {};
            this.state.pacientes = JSON.parse(JSON.stringify(demoData.pacientes || []));
            this.state.saldosPacientes = JSON.parse(JSON.stringify(demoData.saldosPacientes || []));
            this.state.movimientosPaciente = JSON.parse(JSON.stringify(demoData.movimientosPaciente || []));
            this.renderSaldosPacientes();
        } catch (error) {
            console.error('Error cargando datos de saldos:', error);
        }
    },

    // Renderizar tabla de saldos
    renderSaldosPacientes() {
        const tbody = document.getElementById('tablaSaldos');
        if (!tbody) {
            console.error('Tabla tablaSaldos no encontrada en HTML');
            return;
        }

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
                const pacient = this.state.pacientes.find(p => p.id === parseInt(s.pacienteId, 10));
                return pacient && (
                    pacient.nombre.toLowerCase().includes(this.searchTerm) ||
                    (pacient.apellido_paterno || pacient.apellidoPaterno || '').toLowerCase().includes(this.searchTerm) ||
                    (pacient.dpi || pacient.cedula || '').includes(this.searchTerm)
                );
            });
        }

        // Limpiar tabla y renderizar filas
        tbody.innerHTML = '';
        
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay pacientes registrados</td></tr>';
            return;
        }

        // Renderizar filas de la tabla
        tbody.innerHTML = filtered.map(saldo => this.renderSaldoRow(saldo)).join('');
    },

    // Renderizar fila de saldo
    renderSaldoRow(saldo) {
        const pacient = this.state.pacientes.find(p => p.id === parseInt(saldo.pacienteId, 10));
        if (!pacient) return '';

        const estadoBadge = saldo.saldoPendiente === 0
            ? '<span class="badge badge-success">Pagado</span>'
            : '<span class="badge badge-warning">Deudor</span>';

        const apellidos = `${pacient.apellido_paterno || pacient.apellidoPaterno || ''} ${pacient.apellido_materno || pacient.apellidoMaterno || ''}`.trim();
        const abonosRealizados = saldo.abonosRealizados || saldo.totalAbonos || 0;

        return `
            <tr>
                <td><strong>${pacient.nombre} ${apellidos}</strong></td>
                <td>${pacient.dpi || pacient.cedula || 'N/A'}</td>
                <td><span class="amount ${saldo.saldoPendiente > 0 ? 'negative' : 'positive'}">Q${saldo.saldoPendiente.toFixed(2)}</span></td>
                <td>Q${saldo.totalAcumulado.toFixed(2)}</td>
                <td>Q${abonosRealizados.toFixed(2)}</td>
                <td>${saldo.ultimaTransaccion}</td>
                <td>${estadoBadge}</td>
                <td class="actions">
                    <button class="btn-icon btn-view" title="Ver Detalles" onclick="SaldoPacienteModule.viewSaldoDetails('${saldo.pacienteId}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon btn-info" title="Imprimir Saldo" onclick="SaldoPacienteModule.imprimirSaldo('${saldo.pacienteId}')">
                        <i class="fas fa-print"></i>
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
        // Convertir a número para comparación correcta
        const pacienteIdNum = parseInt(pacienteId, 10);
        const saldo = this.state.saldosPacientes.find(s => s.pacienteId === pacienteIdNum);
        const pacient = this.state.pacientes.find(p => p.id === pacienteIdNum);
        const movimientos = this.state.movimientosPaciente.filter(m => m.pacienteId === pacienteIdNum);

        if (!saldo || !pacient) return;

        const detailsModal = document.getElementById('saldoDetailsModal');
        const detailsContent = document.getElementById('saldoDetailsContent');
        if (!detailsModal || !detailsContent) return;

        detailsContent.innerHTML = `
            <div class="saldo-details-card">
                <div class="saldo-header">
                    <h3>Estado de Cuenta - ${pacient.nombre} ${pacient.apellido_paterno || pacient.apellidoPaterno || ''} ${pacient.apellido_materno || pacient.apellidoMaterno || ''}</h3>
                    ${saldo.saldoPendiente === 0 
                        ? '<span class="badge badge-success">SIN DEUDA</span>'
                        : '<span class="badge badge-danger">DEUDOR</span>'
                    }
                    <button onclick="SaldoPacienteModule.cargarEstadoCuentaCompleto('${pacienteId}')" class="btn-small" style="background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 12px; margin-left: auto;">
                        🔄 Cargar Estado Completo
                    </button>
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
                .map(p => `<option value="${p.id}">${p.nombre} ${p.apellido_paterno || p.apellido || ''} (${p.dpi || p.cedula})</option>`)
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
        const pacienteIdNum = parseInt(pacienteId, 10);
        const saldo = this.state.saldosPacientes.find(s => s.pacienteId === pacienteIdNum);
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
        const pacienteId = parseInt(document.getElementById('paymentPacienteSelect').value, 10);
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
            pacienteNombre: `${paciente.nombre} ${paciente.apellido_paterno || paciente.apellidoPaterno || ''} ${paciente.apellido_materno || paciente.apellidoMaterno || ''}`,
            pacienteDPI: `${paciente.dpi || paciente.cedula || ''}`,
            pacienteEdad: `${paciente.edad || ''}`,
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

    // Imprimir saldo del paciente
    imprimirSaldo(pacienteId) {
        const pacienteIdNum = parseInt(pacienteId, 10);
        const saldo = this.state.saldosPacientes.find(s => s.pacienteId === pacienteIdNum);
        const pacient = this.state.pacientes.find(p => p.id === pacienteIdNum);

        if (!saldo || !pacient) {
            this.showNotification('Datos de paciente no encontrados', 'error');
            return;
        }

        const ventana = window.open('', '_blank', 'width=850,height=900');
        const fechaActual = new Date();
        const fechaFormato = fechaActual.toLocaleDateString('es-GT', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const apellidos = `${pacient.apellido_paterno || pacient.apellidoPaterno || ''} ${pacient.apellido_materno || pacient.apellidoMaterno || ''}`.trim();

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>ESTADO DE CUENTA - ${pacient.nombre}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        padding: 40px;
                        background: white;
                        color: #333;
                    }
                    .container {
                        max-width: 900px;
                        margin: 0 auto;
                    }
                    .header-top {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 3px solid #0066cc;
                        padding-bottom: 15px;
                        margin-bottom: 20px;
                    }
                    .logo-section {
                        text-align: left;
                        flex: 1;
                    }
                    .logo-circle {
                        width: 60px;
                        height: 60px;
                        border: 2px solid #0066cc;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 28px;
                        margin-bottom: 8px;
                    }
                    .institution {
                        font-size: 11px;
                        font-weight: bold;
                        color: #0066cc;
                        line-height: 1.3;
                    }
                    .title {
                        text-align: center;
                        flex: 1;
                    }
                    .title h1 {
                        font-size: 32px;
                        font-weight: bold;
                        color: #333;
                        letter-spacing: 2px;
                    }
                    .expediente {
                        text-align: right;
                        flex: 1;
                        font-size: 13px;
                    }
                    .expediente-num {
                        font-weight: bold;
                        color: #0066cc;
                        font-size: 14px;
                    }
                    .patient-info {
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr;
                        gap: 20px;
                        margin: 25px 0;
                        padding: 20px;
                        background: #f9f9f9;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                    }
                    .info-block {
                        border-left: 3px solid #0066cc;
                        padding-left: 12px;
                    }
                    .info-block-icon {
                        font-size: 18px;
                        margin-bottom: 6px;
                    }
                    .info-label {
                        font-size: 11px;
                        color: #0066cc;
                        font-weight: bold;
                        text-transform: uppercase;
                        margin-bottom: 4px;
                    }
                    .info-value {
                        font-size: 14px;
                        color: #333;
                        font-weight: 600;
                    }
                    .section-title {
                        background: #0066cc;
                        color: white;
                        padding: 12px 15px;
                        font-weight: bold;
                        font-size: 13px;
                        text-transform: uppercase;
                        border-radius: 4px 4px 0 0;
                        margin-top: 25px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 25px;
                    }
                    table thead {
                        background: #f0f0f0;
                    }
                    table th {
                        padding: 12px;
                        text-align: left;
                        font-size: 12px;
                        font-weight: bold;
                        color: #333;
                        border-bottom: 2px solid #ddd;
                        text-transform: uppercase;
                    }
                    table td {
                        padding: 12px;
                        font-size: 13px;
                        border-bottom: 1px solid #eee;
                    }
                    .amount {
                        text-align: right;
                        font-family: 'Courier New', monospace;
                    }
                    .summary-section {
                        display: grid;
                        grid-template-columns: 2fr 1fr;
                        gap: 30px;
                        margin-top: 30px;
                    }
                    .summary-box {
                        background: #f9f9f9;
                        padding: 20px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                    }
                    .summary-title {
                        font-weight: bold;
                        color: #0066cc;
                        font-size: 12px;
                        text-transform: uppercase;
                        margin-bottom: 15px;
                        border-bottom: 2px solid #0066cc;
                        padding-bottom: 8px;
                    }
                    .summary-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 8px;
                        font-size: 13px;
                    }
                    .summary-label {
                        font-weight: 600;
                        color: #333;
                    }
                    .summary-value {
                        text-align: right;
                        font-family: 'Courier New', monospace;
                    }
                    .total-box {
                        background: #0066cc;
                        color: white;
                        padding: 25px;
                        border-radius: 6px;
                        text-align: center;
                    }
                    .total-label {
                        font-size: 12px;
                        text-transform: uppercase;
                        opacity: 0.9;
                        margin-bottom: 8px;
                    }
                    .total-amount {
                        font-size: 32px;
                        font-weight: bold;
                        margin-bottom: 8px;
                        font-family: 'Courier New', monospace;
                    }
                    .total-note {
                        font-size: 11px;
                        opacity: 0.8;
                        border-top: 1px solid rgba(255,255,255,0.3);
                        padding-top: 8px;
                        margin-top: 8px;
                    }
                    .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                        text-align: center;
                        font-size: 11px;
                        color: #666;
                    }
                    .status-badge {
                        display: inline-block;
                        padding: 4px 10px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: bold;
                    }
                    .status-deudor {
                        background: #ffcccc;
                        color: #cc0000;
                    }
                    .status-pagado {
                        background: #ccffcc;
                        color: #00cc00;
                    }
                    @media print {
                        body { padding: 20px; }
                        .footer { display: block; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <!-- HEADER -->
                    <div class="header-top">
                        <div class="logo-section">
                            <div class="logo-circle">🏥</div>
                            <div class="institution">
                                SISTEMA CONTABLE<br>
                                Gestión Integral
                            </div>
                        </div>
                        <div class="title">
                            <h1>ESTADO DE CUENTA</h1>
                        </div>
                        <div class="expediente">
                            Expediente:<br>
                            <div class="expediente-num">${pacienteIdNum.toString().padStart(4, '0')}</div>
                        </div>
                    </div>

                    <!-- INFORMACIÓN DEL PACIENTE -->
                    <div class="patient-info">
                        <div class="info-block">
                            <div class="info-block-icon">👤</div>
                            <div class="info-label">Paciente:</div>
                            <div class="info-value">${pacient.nombre} ${apellidos}</div>
                        </div>
                        <div class="info-block">
                            <div class="info-block-icon">📋</div>
                            <div class="info-label">Documento:</div>
                            <div class="info-value">${pacient.dpi || pacient.cedula || 'N/A'}</div>
                        </div>
                        <div class="info-block">
                            <div class="info-block-icon">📅</div>
                            <div class="info-label">Estado de Cuenta al:</div>
                            <div class="info-value">${fechaFormato}</div>
                        </div>
                    </div>

                    <!-- TABLA DE SALDO -->
                    <div class="section-title">📊 ESTADO ACTUAL</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Concepto</th>
                                <th class="amount">Monto (Q)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>Total Deuda Acumulada</strong></td>
                                <td class="amount"><strong>Q${parseFloat(saldo.totalAcumulado || saldo.total_deuda).toFixed(2)}</strong></td>
                            </tr>
                            <tr>
                                <td><strong>Abonos Realizados</strong></td>
                                <td class="amount"><strong style="color: #27ae60;">Q${parseFloat(saldo.abonosRealizados || saldo.totalAbonos || 0).toFixed(2)}</strong></td>
                            </tr>
                            <tr style="background: #f0f0f0; font-weight: bold;">
                                <td><strong>Saldo Pendiente</strong></td>
                                <td class="amount" style="color: ${saldo.saldoPendiente > 0 ? '#e74c3c' : '#27ae60'};"><strong>Q${parseFloat(saldo.saldoPendiente).toFixed(2)}</strong></td>
                            </tr>
                        </tbody>
                    </table>

                    <!-- RESUMEN Y TOTAL -->
                    <div class="summary-section">
                        <div class="summary-box">
                            <div class="summary-title">📌 Resumen Financiero</div>
                            <div class="summary-row">
                                <span class="summary-label">Subtotal:</span>
                                <span class="summary-value">Q${parseFloat(saldo.totalAcumulado || saldo.total_deuda).toFixed(2)}</span>
                            </div>
                            <div class="summary-row">
                                <span class="summary-label">Descuentos:</span>
                                <span class="summary-value">Q0.00</span>
                            </div>
                            <div class="summary-row">
                                <span class="summary-label">IVA (12%):</span>
                                <span class="summary-value">Q${(parseFloat(saldo.totalAcumulado || saldo.total_deuda) * 0.12).toFixed(2)}</span>
                            </div>
                            <div class="summary-row" style="font-weight: bold; border-top: 2px solid #ddd; padding-top: 8px; margin-top: 8px;">
                                <span class="summary-label">TOTAL A PAGAR:</span>
                                <span class="summary-value" style="color: #0066cc; font-size: 15px;">Q${parseFloat(saldo.saldoPendiente).toFixed(2)}</span>
                            </div>
                            <div class="summary-row">
                                <span class="summary-label">Abonos:</span>
                                <span class="summary-value" style="color: #27ae60;">(Q${parseFloat(saldo.abonosRealizados || saldo.totalAbonos || 0).toFixed(2)})</span>
                            </div>
                            <div class="summary-row" style="color: ${saldo.saldoPendiente > 0 ? '#e74c3c' : '#27ae60'}; font-weight: bold; border-top: 1px solid #ddd; padding-top: 8px; margin-top: 8px;">
                                <span>Saldo a Favor del Paciente:</span>
                                <span class="summary-value">Q${Math.max(0, saldo.saldoPendiente).toFixed(2)}</span>
                            </div>
                        </div>

                        <div class="total-box">
                            <div class="total-label">TOTAL A PAGAR</div>
                            <div class="total-amount">Q${parseFloat(saldo.saldoPendiente).toFixed(2)}</div>
                            <div class="total-note">
                                ${saldo.saldoPendiente === 0 ? '✓ SALDO PAGADO' : '⚠ DEUDA PENDIENTE'}
                            </div>
                            <div class="status-badge ${saldo.saldoPendiente === 0 ? 'status-pagado' : 'status-deudor'}" style="margin-top: 12px;">
                                ${saldo.saldoPendiente === 0 ? '✓ PAGADO' : '⚠ DEUDOR'}
                            </div>
                        </div>
                    </div>

                    <!-- FOOTER -->
                    <div class="footer">
                        <p><strong>Sistema de Gestión Integral</strong></p>
                        <p>Documento generado automáticamente - ${fechaFormato}</p>
                        <p style="margin-top: 10px; font-size: 10px; color: #999;">
                            Este estado de cuenta refleja el saldo actual al momento de su emisión.
                            Para cualquier consulta, contacte a administración.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;

        ventana.document.write(html);
        ventana.document.close();
        setTimeout(() => ventana.print(), 500);
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
    },

    // Cargar Estado de Cuenta Completo desde API
    async cargarEstadoCuentaCompleto(pacienteId) {
        try {
            this.showNotification('Cargando Estado de Cuenta...', 'info');
            const pacienteIdNum = parseInt(pacienteId, 10);
            console.log('📋 Cargando Estado de Cuenta para paciente:', pacienteIdNum);
            
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:3011/api/billing/estado-cuenta-detallado/${pacienteIdNum}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                console.warn('API no disponible, mostrando demo data');
                this.showNotification('Estado de Cuenta (datos locales)', 'info');
                return;
            }
            
            const result = await response.json();
            console.log('✅ Estado de Cuenta cargado:', result);
            
            if (result.success && result.data) {
                this.mostrarEstadoCuentaCompleto(result.data);
                this.showNotification('Estado de Cuenta cargado exitosamente', 'success');
            } else {
                this.showNotification('No hay datos disponibles', 'warning');
            }
        } catch (error) {
            console.error('Error cargando Estado de Cuenta:', error);
            this.showNotification('No se pudo cargar el Estado de Cuenta desde API', 'warning');
        }
    },

    // Mostrar Estado de Cuenta Completo en modal
    mostrarEstadoCuentaCompleto(estadoCuenta) {
        const detailsContent = document.getElementById('saldoDetailsContent');
        if (!detailsContent) return;

        const paciente = estadoCuenta.paciente || {};
        const facturas = estadoCuenta.facturas || [];
        const totales = estadoCuenta.totales || {};

        let facturasHTML = '';
        if (facturas.length > 0) {
            facturasHTML = `
                <div class="facturas-section" style="margin-top: 20px; border-top: 2px solid #ddd; padding-top: 20px;">
                    <h4>📄 Facturas/Ventas</h4>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <thead>
                                <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
                                    <th style="padding: 10px; text-align: left;">Número</th>
                                    <th style="padding: 10px; text-align: center;">Fecha</th>
                                    <th style="padding: 10px; text-align: right;">Subtotal</th>
                                    <th style="padding: 10px; text-align: right;">Descuento</th>
                                    <th style="padding: 10px; text-align: right;">Impuesto</th>
                                    <th style="padding: 10px; text-align: right;">Total</th>
                                    <th style="padding: 10px; text-align: center;">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${facturas.map(f => `
                                    <tr style="border-bottom: 1px solid #eee;">
                                        <td style="padding: 10px;"><strong>${f.numero_factura || f.numero_venta || '-'}</strong></td>
                                        <td style="padding: 10px; text-align: center;">${f.fecha || '-'}</td>
                                        <td style="padding: 10px; text-align: right;">Q${parseFloat(f.subtotal || 0).toFixed(2)}</td>
                                        <td style="padding: 10px; text-align: right;">Q${parseFloat(f.total_descuentos || f.descuento || 0).toFixed(2)}</td>
                                        <td style="padding: 10px; text-align: right;">Q${parseFloat(f.total_impuestos || f.impuesto || 0).toFixed(2)}</td>
                                        <td style="padding: 10px; text-align: right; font-weight: bold;">Q${parseFloat(f.total || 0).toFixed(2)}</td>
                                        <td style="padding: 10px; text-align: center;">
                                            <span style="background: #d4edda; color: #155724; padding: 3px 8px; border-radius: 3px; font-size: 11px;">
                                                ${f.estado || 'Activa'}
                                            </span>
                                        </td>
                                    </tr>
                                    ${f.items && f.items.length > 0 ? `
                                        <tr style="background: #f9f9f9;">
                                            <td colspan="7" style="padding: 10px;">
                                                <strong>Ítems:</strong>
                                                ${f.items.map(item => `
                                                    <div style="padding: 5px; margin-left: 20px; font-size: 11px;">
                                                        • ${item.descripcion} x${item.cantidad} @ Q${parseFloat(item.precio_unitario || 0).toFixed(2)} = Q${parseFloat(item.subtotal || 0).toFixed(2)}
                                                    </div>
                                                `).join('')}
                                            </td>
                                        </tr>
                                    ` : ''}
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        const totalesHTML = `
            <div class="totales-section" style="margin-top: 20px; background: #f5f5f5; padding: 15px; border-radius: 5px;">
                <h4 style="margin-top: 0;">💰 Totales</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
                    <div>
                        <label style="color: #666;">Subtotal:</label>
                        <p style="margin: 5px 0; font-weight: bold; font-size: 16px;">Q${parseFloat(totales.subtotal || 0).toFixed(2)}</p>
                    </div>
                    <div>
                        <label style="color: #666;">Total Descuentos:</label>
                        <p style="margin: 5px 0; font-weight: bold; font-size: 16px; color: #e74c3c;">-Q${parseFloat(totales.total_descuentos || totales.descuentos || 0).toFixed(2)}</p>
                    </div>
                    <div>
                        <label style="color: #666;">Total Impuestos:</label>
                        <p style="margin: 5px 0; font-weight: bold; font-size: 16px;">Q${parseFloat(totales.total_impuestos || totales.impuestos || 0).toFixed(2)}</p>
                    </div>
                    <div>
                        <label style="color: #666;">TOTAL GENERAL:</label>
                        <p style="margin: 5px 0; font-weight: bold; font-size: 18px; background: #d4edda; padding: 8px; border-radius: 3px; color: #155724;">Q${parseFloat(totales.total || 0).toFixed(2)}</p>
                    </div>
                </div>
            </div>
        `;

        detailsContent.innerHTML += facturasHTML + totalesHTML;
        console.log('✅ Estado de Cuenta mostrado en modal');
    }
};
