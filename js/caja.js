// ============================================
// MÓDULO DE CAJA
// ============================================

const CajaModule = {
    state: {
        aperturasDelDia: [],
        movimientos: [],
        saldoActual: 0,
        cajaAbierta: false
    },

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        this.loadData();
        console.log('Módulo de Caja inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        const openCashBtn = document.getElementById('openCashBtn');
        if (openCashBtn) {
            openCashBtn.addEventListener('click', () => this.openCash());
        }

        const closeCashBtn = document.getElementById('closeCashBtn');
        if (closeCashBtn) {
            closeCashBtn.addEventListener('click', () => this.closeCash());
        }

        const addMovementBtn = document.getElementById('addMovementBtn');
        if (addMovementBtn) {
            addMovementBtn.addEventListener('click', () => this.openMovementModal());
        }
    },

    // Cargar datos de caja
    loadData() {
        this.state.aperturasDelDia = [
            {
                id: 'AP-001',
                fecha: '2026-05-15',
                hora: '08:00',
                saldoInicial: 5000,
                saldoFinal: 12350.50,
                usuario: 'Administrador'
            }
        ];
        this.state.movimientos = [
            {
                id: 'MOV-CAJ-001',
                tipo: 'Ingreso por Cobro',
                monto: 2400.00,
                descripcion: 'Pago factura FAC-2026-001',
                cliente: 'Distribuidora Centro',
                fecha: '2026-05-15',
                hora: '09:15',
                referencia: 'FAC-2026-001',
                usuario: 'Caja 1'
            },
            {
                id: 'MOV-CAJ-002',
                tipo: 'Egreso',
                monto: 500.00,
                descripcion: 'Compra de suministros',
                cliente: null,
                fecha: '2026-05-15',
                hora: '10:30',
                referencia: 'COMP-001',
                usuario: 'Administrador'
            },
            {
                id: 'MOV-CAJ-003',
                tipo: 'Ingreso por Cobro',
                monto: 1750.00,
                descripcion: 'Pago factura FAC-2026-002',
                cliente: 'Tienda Premium',
                fecha: '2026-05-15',
                hora: '11:00',
                referencia: 'FAC-2026-002',
                usuario: 'Caja 2'
            },
            {
                id: 'MOV-CAJ-004',
                tipo: 'Ingreso por Cobro',
                monto: 195.00,
                descripcion: 'Pago venta en línea',
                cliente: 'Cliente Online',
                fecha: '2026-05-15',
                hora: '12:45',
                referencia: 'FAC-2026-003',
                usuario: 'Caja 1'
            },
            {
                id: 'MOV-CAJ-005',
                tipo: 'Microfactura',
                monto: 450.00,
                descripcion: 'Venta al mostrador',
                cliente: null,
                fecha: '2026-05-15',
                hora: '14:20',
                referencia: 'MF-2026-001',
                usuario: 'Caja 2',
                detalles: [
                    { descripcion: 'Producto 1', monto: 250.00 },
                    { descripcion: 'Producto 2', monto: 200.00 }
                ]
            },
            {
                id: 'MOV-CAJ-006',
                tipo: 'Ingreso por Cobro',
                monto: 3150.00,
                descripcion: 'Pago factura FAC-2026-004',
                cliente: 'Distribuidora Centro',
                fecha: '2026-05-15',
                hora: '15:00',
                referencia: 'FAC-2026-004',
                usuario: 'Caja 1'
            },
            {
                id: 'MOV-CAJ-007',
                tipo: 'Egreso',
                monto: 200.00,
                descripcion: 'Reposición de efectivo caja 2',
                cliente: null,
                fecha: '2026-05-15',
                hora: '16:30',
                referencia: 'REPOSICION-001',
                usuario: 'Administrador'
            },
            {
                id: 'MOV-CAJ-008',
                tipo: 'Ingreso por Cobro',
                monto: 800.00,
                descripcion: 'Pago factura FAC-2026-005',
                cliente: 'Tienda Premium',
                fecha: '2026-05-15',
                hora: '17:15',
                referencia: 'FAC-2026-005',
                usuario: 'Caja 2'
            },
            {
                id: 'MOV-CAJ-009',
                tipo: 'Devolución',
                monto: 150.00,
                descripcion: 'Devolución de pago por error',
                cliente: 'Cliente A',
                fecha: '2026-05-15',
                hora: '17:45',
                referencia: 'DEV-CAJ-001',
                usuario: 'Administrador'
            }
        ];
        this.state.saldoActual = 5000;
        this.state.cajaAbierta = true;
    },

    // Abrir caja
    openCash() {
        const saldoInicial = document.getElementById('saldoInicial')?.value;

        if (!saldoInicial || isNaN(saldoInicial)) {
            alert('Por favor, ingresa un saldo inicial válido');
            return;
        }

        this.state.cajaAbierta = true;
        this.state.saldoActual = parseFloat(saldoInicial);
        
        const apertura = {
            id: `AP-${Date.now()}`,
            fecha: new Date().toISOString(),
            saldoInicial: parseFloat(saldoInicial),
            saldoFinal: null,
            usuario: 'Admin User'
        };

        this.state.aperturasDelDia.push(apertura);
        this.updateCashStatus();
        alert('Caja abierta correctamente');
    },

    // Cerrar caja
    closeCash() {
        if (!this.state.cajaAbierta) {
            alert('La caja no está abierta');
            return;
        }

        const totalMovimientos = this.state.movimientos.reduce((sum, mov) => {
            return sum + (mov.tipo === 'Ingreso' ? mov.monto : -mov.monto);
        }, 0);

        const saldoFinal = this.state.saldoActual + totalMovimientos;

        this.state.aperturasDelDia[this.state.aperturasDelDia.length - 1].saldoFinal = saldoFinal;
        this.state.cajaAbierta = false;
        this.state.movimientos = [];

        this.updateCashStatus();
        alert(`Caja cerrada. Saldo final: $${saldoFinal.toFixed(2)}`);
    },

    // Abrir modal de movimiento
    openMovementModal() {
        if (!this.state.cajaAbierta) {
            alert('Debes abrir la caja primero');
            return;
        }

        const modal = document.getElementById('movementModal');
        if (modal) {
            modal.style.display = 'block';
        }
    },

    // Agregar movimiento de caja
    addMovement() {
        const type = document.getElementById('movementType')?.value;
        const amount = document.getElementById('movementAmount')?.value;
        const description = document.getElementById('movementDescription')?.value;

        if (!type || !amount || !description) {
            alert('Por favor, completa todos los campos');
            return;
        }

        const movement = {
            id: `MOV-${Date.now()}`,
            tipo: type,
            monto: parseFloat(amount),
            descripcion: description,
            fecha: new Date().toISOString(),
            usuario: 'Admin User'
        };

        this.state.movimientos.push(movement);
        this.refreshMovementsTable();

        const modal = document.getElementById('movementModal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    // Actualizar tabla de movimientos
    refreshMovementsTable() {
        const table = document.getElementById('movementsTable');
        if (!table) return;

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        tbody.innerHTML = this.state.movimientos.map(mov => `
            <tr>
                <td>${mov.id}</td>
                <td>${new Date(mov.fecha).toLocaleString()}</td>
                <td>${mov.descripcion}</td>
                <td><span class="badge badge-${mov.tipo.toLowerCase()}">${mov.tipo}</span></td>
                <td>$${mov.monto.toFixed(2)}</td>
            </tr>
        `).join('');
    },

    // Actualizar estado de caja
    updateCashStatus() {
        const statusElement = document.getElementById('cashStatus');
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="cash-status-info">
                    <p><strong>Estado Caja:</strong> ${this.state.cajaAbierta ? '✓ Abierta' : '✗ Cerrada'}</p>
                    <p><strong>Saldo Actual:</strong> $${this.state.saldoActual.toFixed(2)}</p>
                    ${this.state.cajaAbierta ? 
                        `<button onclick="CajaModule.closeCash()" class="btn btn-warning">Cerrar Caja</button>` :
                        `<button onclick="CajaModule.openCash()" class="btn btn-primary">Abrir Caja</button>`
                    }
                </div>
            `;
        }
    },

    // Generar reporte de caja del día
    generateDailyReport() {
        const today = new Date().toISOString().split('T')[0];
        const totalIngresos = this.state.movimientos
            .filter(m => m.tipo === 'Ingreso')
            .reduce((sum, m) => sum + m.monto, 0);
        
        const totalEgresos = this.state.movimientos
            .filter(m => m.tipo === 'Egreso')
            .reduce((sum, m) => sum + m.monto, 0);

        return {
            fecha: today,
            saldoInicial: this.state.saldoActual,
            totalIngresos,
            totalEgresos,
            saldoFinal: this.state.saldoActual + totalIngresos - totalEgresos
        };
    }
};
