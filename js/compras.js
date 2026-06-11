// ============================================
// MÓDULO DE COMPRAS
// ============================================

const ComprasModule = {
    state: {
        compras: [],
        proveedores: [],
        ordenes: []
    },

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        this.loadData();
        console.log('Módulo de Compras inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        const newPurchaseBtn = document.getElementById('addPurchaseBtn');
        if (newPurchaseBtn) {
            newPurchaseBtn.addEventListener('click', () => this.openPurchaseModal());
        }

        const savePurchaseBtn = document.getElementById('savePurchaseBtn');
        if (savePurchaseBtn) {
            savePurchaseBtn.addEventListener('click', () => this.savePurchase());
        }

        // Filters
        const providerFilter = document.getElementById('providerFilter');
        if (providerFilter) {
            providerFilter.addEventListener('change', () => this.filterCompras());
        }

        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.filterCompras());
        }
    },

    // Cargar datos de compras
    async loadData() {
        // Cargar compras (datos iniciales hardcodeados por ahora)
        this.state.compras = [
            {
                id: 'OC-001',
                proveedor: 'Tech Supply',
                fecha: '2026-05-15',
                items: [
                    { producto: 'Teclado Mecánico RGB', cantidad: 50, precio: 120, subtotal: 6000 }
                ],
                total: 6000,
                estado: 'Entregado',
                referencia: 'ORD-001'
            },
            {
                id: 'OC-002',
                proveedor: 'Fashion Store',
                fecha: '2026-05-14',
                items: [
                    { producto: 'Camiseta Premium Talla M', cantidad: 100, precio: 30, subtotal: 3000 }
                ],
                total: 3000,
                estado: 'Entregado',
                referencia: 'ORD-002'
            },
            {
                id: 'OC-003',
                proveedor: 'Food Co',
                fecha: '2026-05-13',
                items: [
                    { producto: 'Café Premium 250g', cantidad: 200, precio: 8.50, subtotal: 1700 }
                ],
                total: 1700,
                estado: 'Entregado',
                referencia: 'ORD-003'
            },
            {
                id: 'OC-004',
                proveedor: 'Tools Plus',
                fecha: '2026-05-12',
                items: [
                    { producto: 'Taladro Eléctrico 20V', cantidad: 8, precio: 150, subtotal: 1200 }
                ],
                total: 1200,
                estado: 'Entregado',
                referencia: 'ORD-004'
            },
            {
                id: 'OC-005',
                proveedor: 'Aceites Premium',
                fecha: '2026-05-11',
                items: [
                    { producto: 'Aceite Oliva Extra Virgen', cantidad: 50, precio: 12, subtotal: 600 }
                ],
                total: 600,
                estado: 'Entregado',
                referencia: 'ORD-005'
            },
            {
                id: 'OC-006',
                proveedor: 'Distribuidora Electrónica',
                fecha: '2026-05-10',
                items: [
                    { producto: 'Monitor LG 27"', cantidad: 15, precio: 350, subtotal: 5250 }
                ],
                total: 5250,
                estado: 'Pendiente',
                referencia: 'ORD-006'
            },
            {
                id: 'OC-007',
                proveedor: 'Tech Supply',
                fecha: '2026-05-09',
                items: [
                    { producto: 'Ratón Logitech', cantidad: 100, precio: 65, subtotal: 6500 }
                ],
                total: 6500,
                estado: 'Entregado',
                referencia: 'ORD-007'
            }
        ];
        
        // Cargar proveedores desde API
        try {
            const token = authManager.getToken();
            if (!token) {
                console.warn('⚠️ No hay token de autenticación para cargar proveedores');
                this.state.proveedores = []; // Fallback vacío
                return;
            }

            const response = await fetch(`${authManager.apiBaseUrl}/api/proveedores`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.state.proveedores = data.proveedores || [];
            console.log(`✅ ${this.state.proveedores.length} proveedores cargados desde BD`);
        } catch (error) {
            console.error('⚠️ Error cargando proveedores:', error);
            this.state.proveedores = []; // Fallback vacío
        }
    },

    // Abrir modal de nueva compra
    openPurchaseModal() {
        const modal = document.getElementById('purchaseModal');
        if (modal) {
            modal.style.display = 'block';
        }
    },

    // Guardar compra
    savePurchase() {
        const type = document.getElementById('purchaseType')?.value;
        const provider = document.getElementById('purchaseProvider')?.value;
        const total = document.getElementById('purchaseTotal')?.value;
        const date = document.getElementById('purchaseDate')?.value;

        if (!type || !provider || !total || !date) {
            alert('Por favor, completa todos los campos obligatorios');
            return;
        }

        const newPurchase = {
            id: `OC-${Date.now()}`,
            proveedor: provider,
            fecha: date,
            total: parseFloat(total),
            estado: 'Pendiente',
            items: [],
            tipo: type
        };

        this.state.compras.push(newPurchase);
        this.refreshTable();
        
        const modal = document.getElementById('purchaseModal');
        if (modal) {
            modal.style.display = 'none';
        }
        alert('Compra registrada correctamente');
    },

    // Filtrar compras
    filterCompras() {
        this.refreshTable();
    },

    // Actualizar tabla de compras
    refreshTable() {
        const table = document.getElementById('comprasTable');
        if (!table) return;

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        tbody.innerHTML = this.state.compras.map(compra => `
            <tr>
                <td>${compra.id}</td>
                <td>${compra.fecha}</td>
                <td>${compra.proveedor}</td>
                <td>$${compra.total.toFixed(2)}</td>
                <td><span class="badge badge-${compra.estado.toLowerCase()}">${compra.estado}</span></td>
                <td class="actions">
                    <button class="btn-icon" onclick="ComprasModule.editPurchase('${compra.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="ComprasModule.deletePurchase('${compra.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    // Editar compra
    editPurchase(id) {
        const compra = this.state.compras.find(c => c.id === id);
        if (compra) {
            console.log('Editando compra:', compra);
            // Llenar el modal con los datos de la compra
        }
    },

    // Eliminar compra
    deletePurchase(id) {
        if (confirm('¿Estás seguro de que deseas eliminar esta compra?')) {
            this.state.compras = this.state.compras.filter(c => c.id !== id);
            this.refreshTable();
        }
    },

    // Generar reporte de compras
    generateReport() {
        console.log('Generando reporte de compras...');
        // Lógica para generar reporte
    }
};
