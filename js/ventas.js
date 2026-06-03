// ============================================
// MÓDULO DE VENTAS
// ============================================

const VentasModule = {
    state: {
        ventas: [],
        clientes: [],
        ordenes: []
    },

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        this.loadData();
        console.log('Módulo de Ventas inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        const newSaleBtn = document.getElementById('addSaleBtn');
        if (newSaleBtn) {
            newSaleBtn.addEventListener('click', () => this.openSaleModal());
        }

        const saveSaleBtn = document.getElementById('saveSaleBtn');
        if (saveSaleBtn) {
            saveSaleBtn.addEventListener('click', () => this.saveSale());
        }

        const clientFilter = document.getElementById('clientFilter');
        if (clientFilter) {
            clientFilter.addEventListener('change', () => this.filterVentas());
        }
    },

    // Cargar datos de ventas
    loadData() {
        this.state.ventas = [
            {
                id: 'VTA-001',
                cliente: 'Distribuidora Centro',
                fecha: '2026-05-15',
                items: [
                    { producto: 'Laptop Dell XPS 15', cantidad: 2, precio: 1200, subtotal: 2400 }
                ],
                total: 2400,
                estado: 'Completada',
                referencia: 'FAC-2026-001'
            },
            {
                id: 'VTA-002',
                cliente: 'Tienda Premium',
                fecha: '2026-05-14',
                items: [
                    { producto: 'Monitor LG 27"', cantidad: 5, precio: 350, subtotal: 1750 }
                ],
                total: 1750,
                estado: 'Completada',
                referencia: 'FAC-2026-002'
            },
            {
                id: 'VTA-003',
                cliente: 'Cliente Online',
                fecha: '2026-05-13',
                items: [
                    { producto: 'Ratón Logitech', cantidad: 3, precio: 65, subtotal: 195 }
                ],
                total: 195,
                estado: 'Completada',
                referencia: 'FAC-2026-003'
            },
            {
                id: 'VTA-004',
                cliente: 'Distribuidora Centro',
                fecha: '2026-05-12',
                items: [
                    { producto: 'Camiseta Premium Talla M', cantidad: 50, precio: 30, subtotal: 1500 },
                    { producto: 'Pantalón Vaquero Azul', cantidad: 30, precio: 55, subtotal: 1650 }
                ],
                total: 3150,
                estado: 'Completada',
                referencia: 'FAC-2026-004'
            },
            {
                id: 'VTA-005',
                cliente: 'Tienda Premium',
                fecha: '2026-05-11',
                items: [
                    { producto: 'Taladro Eléctrico 20V', cantidad: 3, precio: 150, subtotal: 450 },
                    { producto: 'Set de Destornilladores', cantidad: 10, precio: 35, subtotal: 350 }
                ],
                total: 800,
                estado: 'Completada',
                referencia: 'FAC-2026-005'
            },
            {
                id: 'VTA-006',
                cliente: 'Empresa XYZ',
                fecha: '2026-05-10',
                items: [
                    { producto: 'Laptop Dell XPS 15', cantidad: 10, precio: 1200, subtotal: 12000 }
                ],
                total: 12000,
                estado: 'Completada',
                referencia: 'FAC-2026-006'
            },
            {
                id: 'VTA-007',
                cliente: 'Cliente A',
                fecha: '2026-05-09',
                items: [
                    { producto: 'Teclado Mecánico RGB', cantidad: 5, precio: 120, subtotal: 600 }
                ],
                total: 600,
                estado: 'Pendiente',
                referencia: 'FAC-2026-007'
            }
        ];

        this.state.clientes = [
            { id: 1, nombre: 'Distribuidora Centro', email: 'contacto@distribuidora-centro.com', telefono: '+57 301 234 5678', ciudad: 'Bogotá' },
            { id: 2, nombre: 'Tienda Premium', email: 'ventas@tienda-premium.com', telefono: '+57 302 345 6789', ciudad: 'Medellín' },
            { id: 3, nombre: 'Cliente Online', email: 'cliente@online.com', telefono: '+57 303 456 7890', ciudad: 'Cali' },
            { id: 4, nombre: 'Empresa XYZ', email: 'contacto@empresa-xyz.com', telefono: '+57 304 567 8901', ciudad: 'Barranquilla' },
            { id: 5, nombre: 'Cliente A', email: 'clientea@example.com', telefono: '+57 305 678 9012', ciudad: 'Bogotá' }
        ];
    },

    // Abrir modal de nueva venta
    openSaleModal() {
        const modal = document.getElementById('saleModal');
        if (modal) {
            modal.style.display = 'block';
        }
    },

    // Guardar venta
    saveSale() {
        const client = document.getElementById('saleClient')?.value;
        const total = document.getElementById('saleTotal')?.value;
        const date = document.getElementById('saleDate')?.value;

        if (!client || !total || !date) {
            alert('Por favor, completa todos los campos obligatorios');
            return;
        }

        const newSale = {
            id: `VTA-${Date.now()}`,
            cliente: client,
            fecha: date,
            total: parseFloat(total),
            estado: 'Completada',
            items: []
        };

        this.state.ventas.push(newSale);
        this.refreshTable();

        const modal = document.getElementById('saleModal');
        if (modal) {
            modal.style.display = 'none';
        }
        alert('Venta registrada correctamente');
    },

    // Filtrar ventas
    filterVentas() {
        this.refreshTable();
    },

    // Actualizar tabla de ventas
    refreshTable() {
        const table = document.getElementById('ventasTable');
        if (!table) return;

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        tbody.innerHTML = this.state.ventas.map(venta => `
            <tr>
                <td>${venta.id}</td>
                <td>${venta.fecha}</td>
                <td>${venta.cliente}</td>
                <td>$${venta.total.toFixed(2)}</td>
                <td><span class="badge badge-completada">${venta.estado}</span></td>
                <td class="actions">
                    <button class="btn-icon" onclick="VentasModule.editSale('${venta.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="VentasModule.generateInvoice('${venta.id}')">
                        <i class="fas fa-file-invoice"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    // Editar venta
    editSale(id) {
        const venta = this.state.ventas.find(v => v.id === id);
        if (venta) {
            console.log('Editando venta:', venta);
        }
    },

    // Generar factura
    generateInvoice(id) {
        const venta = this.state.ventas.find(v => v.id === id);
        if (venta) {
            alert(`Generando factura para venta ${id}`);
            console.log('Generando PDF para:', venta);
        }
    },

    // Obtener resumen de ventas del día
    getDailySummary() {
        const today = new Date().toISOString().split('T')[0];
        const todaySales = this.state.ventas.filter(v => v.fecha === today);
        return {
            cantidad: todaySales.length,
            total: todaySales.reduce((sum, v) => sum + v.total, 0)
        };
    }
};
