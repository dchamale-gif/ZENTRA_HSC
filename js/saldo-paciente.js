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
                    <h3>${pacient.nombre} ${pacient.apellidoPaterno} ${pacient.apellidoMaterno || ''}</h3>
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
                        <h4>Histórico de Transacciones</h4>
                        <div class="movimientos-list">
                            ${movimientos.map(m => `
                                <div class="movimiento-item">
                                    <div class="mov-header">
                                        <strong>${m.tipo}</strong>
                                        <span class="badge badge-info">${m.fecha}</span>
                                    </div>
                                    <div class="mov-details">
                                        <span class="mov-desc">${m.descripcion}</span>
                                        <span class="mov-amount ${m.tipo === 'Abono' ? 'positive' : 'negative'}">
                                            ${m.tipo === 'Abono' ? '+' : '-'}$${m.monto.toFixed(2)}
                                        </span>
                                    </div>
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
            fecha: fecha
        };

        this.state.movimientosPaciente.push(movimento);

        // Actualizar saldo
        if (tipo === 'Abono') {
            saldo.saldoPendiente -= monto;
            saldo.totalAbonos += monto;
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
