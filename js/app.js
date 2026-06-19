// ============================================
// STOCK FLOW - APLICACIÓN PRINCIPAL
// ============================================

// Global state
let currentPage = 'dashboard';
let charts = {};

// ============================================
// PROTECCIÓN DE AUTENTICACIÓN
// ============================================

// Verificar autenticación al cargar la página
if (!authManager.isAuthenticated() || authManager.isTokenExpired()) {
    authManager.clearToken();
    authManager.clearUser();
    window.location.href = '/login.html';
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    initializeUserProfile();
    setupLogout();
});

function initializeApp() {
    // Initialize event listeners
    setupNavigation();
    setupModals();
    setupDashboard();
    setupInventory();
    setupTransactions();
    setupResponsive();
    updateCurrentDate();
    
    // Initialize Admin Modules
    PacientesModule.init();
    MedicinasModule.init();
    HistoriaClinicaModule.init();
    SaldoPacienteModule.init();
    HospitalizacionesModule.init();
    CodigosArticulosModule.init();
    CajaIntegradaModule.init();
    ComprasModule.init();
    AlertasModule.init();
    VentasModule.init();
    CajaModule.init();
    CuentasPorCobrarModule.init();
    EstadosDeCuentaModule.init();
    DashboardFinancieroModule.init();
    ReportsModule.init();
    
    // Initialize Agenda Modules
    AgendaAvanzadaModule.init();
    ReservasWebModule.init();
    ConfirmacionesModule.init();
    GoogleCalendarModule.init();
    AgendaAPIModule.init();
    
    console.log('Stock Flow initialized successfully');
}

// ============================================
// NAVEGACIÓN
// ============================================

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            navigateToPage(page);
        });
    });
}

function navigateToPage(pageId) {
    // Remove active class from all pages and nav items
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Add active class to selected page and nav item
    const page = document.getElementById(`page-${pageId}`);
    const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    
    if (page) {
        page.classList.add('active');
    }
    if (navItem) {
        navItem.classList.add('active');
    }

    // Update page title
    const titleMap = {
        'dashboard': 'Dashboard',
        'inventory': 'Gestión de Inventario',
        'compras': 'Gestión de Compras',
        'ventas': 'Gestión de Ventas',
        'caja': 'Gestión de Caja',
        'cuentas-por-cobrar': 'Cuentas por Cobrar',
        'estados-de-cuenta': 'Estados de Cuenta',
        'dashboard-financiero': 'Dashboard Financiero',
        'transactions': 'Transacciones',
        'reports': 'Reportes',
        'pacientes': 'Pacientes',
        'medicinas': 'Medicinas',
        'historia-clinica': 'Historia Clínica',
        'saldo-paciente': 'Saldo del Paciente',
        'hospitalizaciones': 'Hospitalizaciones',
        'codigos-articulos': 'Códigos de Artículos',
        'caja-integrada': 'Caja Integrada',
        'agenda': 'Agenda Médica',
        'reservas-web': 'Reservas desde Web',
        'confirmaciones': 'Confirmaciones Automáticas',
        'google-calendar': 'Integración Google Calendar',
        'settings': 'Configuración'
    };
    document.getElementById('pageTitle').textContent = titleMap[pageId];

    currentPage = pageId;

    // Close sidebar on mobile
    const sidebar = document.querySelector('.sidebar');
    if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
    }

    // Re-initialize charts if on dashboard or financial dashboard
    if (pageId === 'dashboard') {
        setTimeout(() => {
            initializeDashboardCharts();
        }, 100);
    }
    
    if (pageId === 'dashboard-financiero') {
        setTimeout(() => {
            DashboardFinancieroModule.renderCharts();
        }, 100);
    }
    
    // Refresh module data on navigation
    if (pageId === 'compras') {
        ComprasModule.refreshTable();
    }
    if (pageId === 'ventas') {
        VentasModule.refreshTable();
    }
    if (pageId === 'cuentas-por-cobrar') {
        CuentasPorCobrarModule.refreshTable();
    }
    if (pageId === 'saldo-paciente') {
        SaldoPacienteModule.renderSaldosPacientes();
    }
    if (pageId === 'hospitalizaciones') {
        HospitalizacionesModule.loadData();
    }
    if (pageId === 'estados-de-cuenta') {
        EstadosDeCuentaModule.loadStatement();
    }
    if (pageId === 'agenda') {
        setTimeout(() => {
            AgendaAvanzadaModule.renderCalendar();
        }, 100);
    }
    
    if (pageId === 'alertas') {
        AlertasModule.renderAlertas();
    }
}

// ============================================
// DASHBOARD
// ============================================

function setupDashboard() {
    populateRecentTransactions();
    initializeDashboardCharts();
}

function initializeDashboardCharts() {
    if (charts.sales) charts.sales.destroy();
    if (charts.inventory) charts.inventory.destroy();

    // Sales Chart
    const salesCtx = document.getElementById('salesChart');
    if (salesCtx) {
        charts.sales = new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: demoData.salesByDay.map(d => d.day),
                datasets: [{
                    label: 'Ventas ($)',
                    data: demoData.salesByDay.map(d => d.sales),
                    borderColor: '#1e3a8a',
                    backgroundColor: 'rgba(30, 58, 138, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#f97316',
                    pointBorderColor: '#1e3a8a',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointHoverBackgroundColor: '#fb923c'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'Q.' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    // Inventory Distribution Chart
    const inventoryCtx = document.getElementById('inventoryChart');
    if (inventoryCtx) {
        charts.inventory = new Chart(inventoryCtx, {
            type: 'doughnut',
            data: {
                labels: demoData.inventoryByCategory.map(d => d.category),
                datasets: [{
                    data: demoData.inventoryByCategory.map(d => d.value),
                    backgroundColor: [
                        '#1e3a8a',
                        '#0891b2',
                        '#f97316',
                        '#22c55e'
                    ],
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
}

function populateRecentTransactions() {
    const tbody = document.getElementById('recentTransactions');
    if (!tbody) return;

    tbody.innerHTML = '';
    const recentTransactions = demoData.transactions.slice(0, 5);

    recentTransactions.forEach(transaction => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(transaction.date)}</td>
            <td>${transaction.description}</td>
            <td>
                <span style="display: flex; align-items: center; gap: 5px;">
                    <i class="${getTransactionTypeIcon(transaction.type)}"></i>
                    ${transaction.type}
                </span>
            </td>
            <td ${transaction.type === 'Compra' ? 'style="color: #ef4444"' : 'style="color: #22c55e"'}>
                ${transaction.type === 'Compra' ? '-' : '+'}${formatCurrency(transaction.amount)}
            </td>
            <td>
                <span class="status-badge ${getStatusBadgeClass(transaction.status)}">
                    ${transaction.status}
                </span>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// ============================================
// INVENTARIO
// ============================================

function setupInventory() {
    populateInventoryTable();

    const searchInput = document.getElementById('searchProduct');
    const categoryFilter = document.getElementById('categoryFilter');
    const addBtn = document.getElementById('addProductBtn');

    if (searchInput) searchInput.addEventListener('keyup', filterInventory);
    if (categoryFilter) categoryFilter.addEventListener('change', filterInventory);
    if (addBtn) addBtn.addEventListener('click', openProductModal);
}

function populateInventoryTable() {
    const tbody = document.getElementById('inventoryTable');
    if (!tbody) return;

    tbody.innerHTML = '';

    demoData.products.forEach(product => {
        const row = document.createElement('tr');
        const status = getProductStatus(product.stock, product.minStock);
        const statusClass = getProductStatusClass(product.stock, product.minStock);

        row.innerHTML = `
            <td><strong>${product.id}</strong></td>
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td>${product.stock} unidades</td>
            <td>${formatCurrency(product.price)}</td>
            <td><strong>${formatCurrency(product.price * product.stock)}</strong></td>
            <td>
                <span class="status-badge ${statusClass}">${status}</span>
            </td>
            <td>
                <button class="btn btn-small btn-secondary" onclick="editProduct('${product.id}')">Editar</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterInventory() {
    const searchTerm = document.getElementById('searchProduct')?.value.toLowerCase() || '';
    const category = document.getElementById('categoryFilter')?.value || '';

    const tbody = document.getElementById('inventoryTable');
    if (!tbody) return;

    let filteredProducts = demoData.products.filter(product => {
        const matchSearch = product.name.toLowerCase().includes(searchTerm) ||
                           product.id.toLowerCase().includes(searchTerm);
        const matchCategory = category === '' || product.category === category;
        return matchSearch && matchCategory;
    });

    tbody.innerHTML = '';

    filteredProducts.forEach(product => {
        const row = document.createElement('tr');
        const status = getProductStatus(product.stock, product.minStock);
        const statusClass = getProductStatusClass(product.stock, product.minStock);

        row.innerHTML = `
            <td><strong>${product.id}</strong></td>
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td>${product.stock} unidades</td>
            <td>${formatCurrency(product.price)}</td>
            <td><strong>${formatCurrency(product.price * product.stock)}</strong></td>
            <td>
                <span class="status-badge ${statusClass}">${status}</span>
            </td>
            <td>
                <button class="btn btn-small btn-secondary" onclick="editProduct('${product.id}')">Editar</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    if (filteredProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 30px;">No se encontraron productos</td></tr>';
    }
}

function editProduct(productId) {
    const product = getProduct(productId);
    if (product) {
        showNotification(`Editando: ${product.name}`, 'info');
    }
}

// ============================================
// TRANSACCIONES
// ============================================

function setupTransactions() {
    populateTransactionsTable();

    const typeFilter = document.getElementById('typeFilter');
    const dateFromFilter = document.getElementById('dateFromFilter');
    const dateToFilter = document.getElementById('dateToFilter');
    const addBtn = document.getElementById('addTransactionBtn');

    if (typeFilter) typeFilter.addEventListener('change', filterTransactions);
    if (dateFromFilter) dateFromFilter.addEventListener('change', filterTransactions);
    if (dateToFilter) dateToFilter.addEventListener('change', filterTransactions);
    if (addBtn) addBtn.addEventListener('click', openTransactionModal);

    // Setup transaction modal listeners
    setupTransactionModal();
    setupBulkTransactionModal();
}

function populateTransactionsTable() {
    const tbody = document.getElementById('transactionsTable');
    if (!tbody) return;

    tbody.innerHTML = '';

    demoData.transactions.forEach(transaction => {
        const product = getProduct(transaction.productId);
        const row = document.createElement('tr');

        row.innerHTML = `
            <td><strong>${transaction.id}</strong></td>
            <td>${formatDate(transaction.date)}</td>
            <td>
                <span style="display: flex; align-items: center; gap: 5px;">
                    <i class="${getTransactionTypeIcon(transaction.type)}"></i>
                    ${transaction.type}
                </span>
            </td>
            <td>${transaction.description}</td>
            <td>${transaction.quantity} unidades</td>
            <td ${transaction.type === 'Compra' ? 'style="color: #ef4444"' : 'style="color: #22c55e"'}>
                ${transaction.type === 'Compra' ? '-' : '+'}${formatCurrency(transaction.amount)}
            </td>
            <td>
                <span class="status-badge ${getStatusBadgeClass(transaction.status)}">
                    ${transaction.status}
                </span>
            </td>
            <td>
                <button class="btn btn-small btn-secondary" onclick="viewTransaction('${transaction.id}')">Ver</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterTransactions() {
    const type = document.getElementById('typeFilter')?.value || '';
    const dateFrom = document.getElementById('dateFromFilter')?.value || '';
    const dateTo = document.getElementById('dateToFilter')?.value || '';

    const tbody = document.getElementById('transactionsTable');
    if (!tbody) return;

    let filteredTransactions = demoData.transactions.filter(transaction => {
        const matchType = type === '' || transaction.type === type;
        const transactionDate = new Date(transaction.date);
        const matchDateFrom = dateFrom === '' || new Date(transaction.date) >= new Date(dateFrom);
        const matchDateTo = dateTo === '' || new Date(transaction.date) <= new Date(dateTo);

        return matchType && matchDateFrom && matchDateTo;
    });

    tbody.innerHTML = '';

    filteredTransactions.forEach(transaction => {
        const product = getProduct(transaction.productId);
        const row = document.createElement('tr');

        row.innerHTML = `
            <td><strong>${transaction.id}</strong></td>
            <td>${formatDate(transaction.date)}</td>
            <td>
                <span style="display: flex; align-items: center; gap: 5px;">
                    <i class="${getTransactionTypeIcon(transaction.type)}"></i>
                    ${transaction.type}
                </span>
            </td>
            <td>${transaction.description}</td>
            <td>${transaction.quantity} unidades</td>
            <td ${transaction.type === 'Compra' ? 'style="color: #ef4444"' : 'style="color: #22c55e"'}>
                ${transaction.type === 'Compra' ? '-' : '+'}${formatCurrency(transaction.amount)}
            </td>
            <td>
                <span class="status-badge ${getStatusBadgeClass(transaction.status)}">
                    ${transaction.status}
                </span>
            </td>
            <td>
                <button class="btn btn-small btn-secondary" onclick="viewTransaction('${transaction.id}')">Ver</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    if (filteredTransactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 30px;">No se encontraron transacciones</td></tr>';
    }
}

function viewTransaction(transactionId) {
    const transaction = demoData.transactions.find(t => t.id === transactionId);
    const product = getProduct(transaction.productId);
    
    if (transaction) {
        // Create detailed view
        const details = `
            ID: ${transaction.id}
            Producto: ${product.name}
            Tipo: ${transaction.type}
            Cantidad: ${transaction.quantity} unidades
            Monto: ${formatCurrency(transaction.amount)}
            Fecha: ${formatDate(transaction.date)}
            Estado: ${transaction.status}
            Descripción: ${transaction.description}
        `;
        
        alert(`DETALLES DE TRANSACCIÓN\n\n${details}`);
    }
}

// ============================================
// MODALES
// ============================================

function setupModals() {
    const modal = document.getElementById('productModal');
    const closeButtons = document.querySelectorAll('.modal-close, .modal-close-btn');
    const saveBtn = document.getElementById('saveProductBtn');

    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    }

    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) closeModal(modal);
        });
    });

    if (saveBtn) {
        saveBtn.addEventListener('click', saveProduct);
    }
}

function openProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.classList.add('active');
        // Clear form
        document.getElementById('productName').value = '';
        document.getElementById('productPrice').value = '';
        document.getElementById('productStock').value = '';
    }
}

// ============================================
// MODAL DE TRANSACCIONES - CONFIGURACIÓN
// ============================================

function setupTransactionModal() {
    const modal = document.getElementById('transactionModal');
    const typeSelect = document.getElementById('transactionType');
    const productSelect = document.getElementById('transactionProduct');
    const quantityInput = document.getElementById('transactionQuantity');
    const unitPriceInput = document.getElementById('transactionUnitPrice');
    const saveBtn = document.getElementById('saveTransactionBtn');

    // Populate products dropdown
    populateProductsDropdown();

    // Event listeners
    if (typeSelect) typeSelect.addEventListener('change', handleTransactionTypeChange);
    if (productSelect) productSelect.addEventListener('change', handleProductSelection);
    if (quantityInput) quantityInput.addEventListener('input', calculateTransactionAmount);
    if (unitPriceInput) unitPriceInput.addEventListener('change', calculateTransactionAmount);
    if (saveBtn) saveBtn.addEventListener('click', saveTransaction);

    // Set today's date by default
    const dateInput = document.getElementById('transactionDate');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
}

function populateProductsDropdown() {
    const select = document.getElementById('transactionProduct');
    if (!select) return;

    // Clear existing options (except first)
    while (select.options.length > 1) {
        select.remove(1);
    }

    demoData.products.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = `${product.name} - Stock: ${product.stock}`;
        option.dataset.price = product.price;
        option.dataset.stock = product.stock;
        select.appendChild(option);
    });
}

function handleTransactionTypeChange() {
    const typeSelect = document.getElementById('transactionType');
    const type = typeSelect.value;
    
    // Update quantity label based on type
    const quantityLabel = document.querySelector('label[for="transactionQuantity"]');
    if (quantityLabel) {
        if (type === 'Compra') {
            quantityLabel.innerHTML = 'Cantidad (entrante) <span class="required">*</span>';
        } else if (type === 'Devolución') {
            quantityLabel.innerHTML = 'Cantidad (devuelta) <span class="required">*</span>';
        } else {
            quantityLabel.innerHTML = 'Cantidad <span class="required">*</span>';
        }
    }
}

function handleProductSelection() {
    const productSelect = document.getElementById('transactionProduct');
    const selectedOption = productSelect.options[productSelect.selectedIndex];

    if (selectedOption.value === '') {
        document.getElementById('transactionUnitPrice').value = '';
        document.getElementById('transactionAmount').value = '';
        updateTransactionSummary(0, 0, 0);
        return;
    }

    const price = parseFloat(selectedOption.dataset.price);
    const stock = parseInt(selectedOption.dataset.stock);

    // Update unit price
    document.getElementById('transactionUnitPrice').value = price.toFixed(2);

    // Get selected quantity
    const quantity = parseInt(document.getElementById('transactionQuantity').value || 0);

    // Validate stock for sales
    const typeSelect = document.getElementById('transactionType');
    if (typeSelect.value === 'Venta' && quantity > stock) {
        showNotification(`Stock insuficiente. Disponible: ${stock} unidades`, 'warning');
    }

    calculateTransactionAmount();
}

function calculateTransactionAmount() {
    const quantity = parseInt(document.getElementById('transactionQuantity').value || 0);
    const unitPrice = parseFloat(document.getElementById('transactionUnitPrice').value || 0);

    if (quantity < 0 || unitPrice < 0) {
        showNotification('Cantidad y precio deben ser positivos', 'warning');
        document.getElementById('transactionAmount').value = '0.00';
        updateTransactionSummary(0, 0, 0);
        return;
    }

    const total = quantity * unitPrice;
    document.getElementById('transactionAmount').value = total.toFixed(2);

    updateTransactionSummary(unitPrice, quantity, total);
}

function updateTransactionSummary(unitPrice, quantity, total) {
    document.getElementById('summaryUnitPrice').textContent = formatCurrency(unitPrice);
    document.getElementById('summaryQuantity').textContent = `${quantity} unidades`;
    document.getElementById('summaryTotal').textContent = formatCurrency(total);
}

function openTransactionModal() {
    const modal = document.getElementById('transactionModal');
    if (modal) {
        modal.classList.add('active');
        // Clear form
        document.getElementById('transactionType').value = '';
        document.getElementById('transactionProduct').value = '';
        document.getElementById('transactionQuantity').value = '';
        document.getElementById('transactionUnitPrice').value = '';
        document.getElementById('transactionAmount').value = '';
        document.getElementById('transactionDescription').value = '';
        document.getElementById('transactionStatus').value = 'Completada';
        document.getElementById('transactionReference').value = '';
        
        // Reset date to today
        const dateInput = document.getElementById('transactionDate');
        if (dateInput) {
            dateInput.valueAsDate = new Date();
        }

        // Reset summary
        updateTransactionSummary(0, 0, 0);

        // Set focus to first field
        setTimeout(() => {
            document.getElementById('transactionType').focus();
        }, 100);
    }
}

function saveTransaction() {
    const type = document.getElementById('transactionType').value;
    const productId = document.getElementById('transactionProduct').value;
    const quantity = parseInt(document.getElementById('transactionQuantity').value || 0);
    const amount = parseFloat(document.getElementById('transactionAmount').value || 0);
    const description = document.getElementById('transactionDescription').value;
    const date = document.getElementById('transactionDate').value;
    const status = document.getElementById('transactionStatus').value;
    const reference = document.getElementById('transactionReference').value;

    // Validation
    if (!type) {
        showNotification('Por favor selecciona un tipo de transacción', 'error');
        return;
    }
    if (!productId) {
        showNotification('Por favor selecciona un producto', 'error');
        return;
    }
    if (quantity <= 0) {
        showNotification('La cantidad debe ser mayor a 0', 'error');
        return;
    }
    if (amount <= 0) {
        showNotification('El monto debe ser mayor a 0', 'error');
        return;
    }
    if (!description.trim()) {
        showNotification('Por favor ingresa una descripción', 'error');
        return;
    }
    if (!date) {
        showNotification('Por favor selecciona una fecha', 'error');
        return;
    }

    // Validate stock for sales
    const product = getProduct(productId);
    if (type === 'Venta' && quantity > product.stock) {
        showNotification(`Stock insuficiente. Disponible: ${product.stock} unidades`, 'error');
        return;
    }

    // Create new transaction
    const newTransaction = {
        id: 'TRN' + String(demoData.transactions.length + 1).padStart(3, '0'),
        date: date,
        type: type,
        description: description,
        quantity: quantity,
        amount: amount,
        status: status,
        productId: productId
    };

    // Add to data
    demoData.transactions.unshift(newTransaction);

    // Update stock based on type
    if (type === 'Venta') {
        product.stock -= quantity;
    } else if (type === 'Compra') {
        product.stock += quantity;
    } else if (type === 'Devolución') {
        product.stock += quantity;
    }

    // Update table
    populateTransactionsTable();
    closeModal(document.getElementById('transactionModal'));

    showNotification('Transacción guardada exitosamente', 'success');

    // Refresh dashboard if visible
    if (currentPage === 'dashboard') {
        populateRecentTransactions();
    }

    // Refresh inventory if visible
    if (currentPage === 'inventory') {
        populateInventoryTable();
    }
}

function closeModal(modal) {
    modal.classList.remove('active');
}

function saveProduct() {
    const name = document.getElementById('productName').value;
    const category = document.getElementById('productCategory').value;
    const price = document.getElementById('productPrice').value;
    const stock = document.getElementById('productStock').value;

    if (name && price && stock) {
        // Create new product
        const newProduct = {
            id: 'PRD' + String(demoData.products.length + 1).padStart(3, '0'),
            name: name,
            category: category,
            price: parseFloat(price),
            stock: parseInt(stock),
            minStock: 10,
            lastUpdated: new Date().toISOString().split('T')[0]
        };

        demoData.products.push(newProduct);
        populateInventoryTable();
        closeModal(document.getElementById('productModal'));
        
        showNotification(`Producto "${name}" agregado exitosamente`, 'success');
    } else {
        showNotification('Por favor completa todos los campos', 'error');
    }
}

// ============================================
// NOTIFICACIONES
// ============================================

function showNotification(message, type = 'info') {
    // Mapeo de iconos por tipo
    const icons = {
        'success': '✓',
        'error': '✕',
        'warning': '⚠',
        'info': 'ℹ'
    };

    // Mapeo de colores y gradientes por tipo
    const styles = {
        'success': {
            bg: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            icon: '✓',
            border: '#15803d'
        },
        'error': {
            bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            icon: '✕',
            border: '#7f1d1d'
        },
        'warning': {
            bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            icon: '⚠',
            border: '#92400e'
        },
        'info': {
            bg: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
            icon: 'ℹ',
            border: '#164e63'
        }
    };

    const style = styles[type] || styles.info;

    const notification = document.createElement('div');
    notification.className = `notification notification-${type} show`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${style.icon}</span>
            <span class="notification-text">${message}</span>
            <button class="notification-close">×</button>
        </div>
    `;

    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 0;
        background: ${style.bg};
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2), 0 0 1px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        animation: slideInRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        min-width: 320px;
        max-width: 450px;
        border-left: 4px solid ${style.border};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Estilos del contenido
    const contentDiv = notification.querySelector('.notification-content');
    contentDiv.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        width: 100%;
    `;

    const icon = notification.querySelector('.notification-icon');
    icon.style.cssText = `
        font-size: 20px;
        font-weight: bold;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background: rgba(255, 255, 255, 0.25);
        border-radius: 6px;
    `;

    const text = notification.querySelector('.notification-text');
    text.style.cssText = `
        flex: 1;
        font-size: 14px;
        font-weight: 500;
        line-height: 1.4;
        word-break: break-word;
    `;

    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: transform 0.2s ease;
        opacity: 0.7;
    `;

    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.opacity = '1';
        closeBtn.style.transform = 'scale(1.2)';
    });

    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.opacity = '0.7';
        closeBtn.style.transform = 'scale(1)';
    });

    closeBtn.addEventListener('click', () => {
        notification.style.animation = 'slideOutRight 0.3s cubic-bezier(0.6, -0.28, 0.735, 0.045)';
        setTimeout(() => notification.remove(), 300);
    });

    document.body.appendChild(notification);

    // Auto-remover después de 4 segundos
    const autoRemoveTimeout = setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s cubic-bezier(0.6, -0.28, 0.735, 0.045)';
            setTimeout(() => {
                if (notification.parentNode) notification.remove();
            }, 300);
        }
    }, 4000);

    // Cancelar auto-remover si el usuario cierra manualmente
    notification.addEventListener('click', (e) => {
        if (e.target.classList.contains('notification-close')) {
            clearTimeout(autoRemoveTimeout);
        }
    });
}

// ============================================
// BULK TRANSACTIONS
// ============================================

let bulkTransactions = [];

function setupBulkTransactionModal() {
    const bulkModal = document.getElementById('bulkTransactionModal');
    const addRowBtn = document.getElementById('addRowBtn');
    const selectAllCheckbox = document.getElementById('selectAllBulk');
    const closeBtn = bulkModal.querySelector('.modal-close-btn');
    const processBtn = document.getElementById('processBulkBtn');
    const bulkCargaBtn = document.getElementById('bulkTransactionBtn');

    if (bulkCargaBtn) bulkCargaBtn.addEventListener('click', openBulkTransactionModal);
    if (addRowBtn) addRowBtn.addEventListener('click', addBulkRow);
    if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', selectAllBulkRows);
    if (closeBtn) closeBtn.addEventListener('click', () => closeBulkModal());
    if (processBtn) processBtn.addEventListener('click', processBulkTransactions);

    // Initialize with 5 empty rows
    bulkTransactions = [];
    for (let i = 0; i < 5; i++) {
        addBulkRow(true); // true = don't render yet
    }
    renderBulkTable();
    updateBulkSummary();
}

function openBulkTransactionModal() {
    const modal = document.getElementById('bulkTransactionModal');
    if (modal) {
        modal.classList.add('active');
        // Set today's date on all date inputs
        const dateInputs = modal.querySelectorAll('.bulk-date-input');
        const today = new Date().toISOString().split('T')[0];
        dateInputs.forEach(input => {
            if (!input.value) input.value = today;
        });
    }
}

function closeBulkModal() {
    const modal = document.getElementById('bulkTransactionModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function addBulkRow(dontRender = false) {
    const newRow = {
        id: Date.now() + Math.random(),
        type: 'Venta',
        product: '',
        quantity: '',
        unitPrice: '',
        total: 0,
        date: new Date().toISOString().split('T')[0],
        description: '',
        status: 'pending',
        checked: false,
        errors: {}
    };

    bulkTransactions.push(newRow);

    if (!dontRender) {
        renderBulkTable();
        updateBulkSummary();
    }
}

function removeBulkRow(rowId) {
    bulkTransactions = bulkTransactions.filter(row => row.id !== rowId);
    renderBulkTable();
    updateBulkSummary();
}

function renderBulkTable() {
    const tbody = document.getElementById('bulkTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    bulkTransactions.forEach((row, index) => {
        const tr = document.createElement('tr');
        const hasErrors = Object.keys(row.errors).length > 0;
        if (hasErrors) tr.style.backgroundColor = '#fee2e2';

        // Checkbox column
        const checkboxTd = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = row.checked;
        checkbox.addEventListener('change', (e) => {
            row.checked = e.target.checked;
        });
        checkboxTd.appendChild(checkbox);
        tr.appendChild(checkboxTd);

        // Type column
        const typeTd = document.createElement('td');
        const typeSelect = document.createElement('select');
        typeSelect.className = 'bulk-type-select';
        const types = ['Venta', 'Compra', 'Devolución', 'Ajuste'];
        types.forEach(t => {
            const option = document.createElement('option');
            option.value = t;
            option.textContent = t;
            if (t === row.type) option.selected = true;
            typeSelect.appendChild(option);
        });
        typeSelect.addEventListener('change', (e) => {
            row.type = e.target.value;
        });
        typeTd.appendChild(typeSelect);
        tr.appendChild(typeTd);

        // Product column
        const productTd = document.createElement('td');
        productTd.className = row.errors.product ? 'error' : '';
        const productSelect = document.createElement('select');
        productSelect.className = 'bulk-product-select';
        
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Seleccionar...';
        productSelect.appendChild(emptyOption);

        demoData.products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.name}`;
            option.dataset.price = product.price;
            option.dataset.stock = product.stock;
            if (product.id === row.product) option.selected = true;
            productSelect.appendChild(option);
        });

        productSelect.addEventListener('change', (e) => {
            row.product = e.target.value;
            const selectedOption = e.target.options[e.target.selectedIndex];
            if (selectedOption && selectedOption.dataset.price) {
                row.unitPrice = parseFloat(selectedOption.dataset.price);
                calculateBulkRowTotal(row);
            }
            delete row.errors.product;
            renderBulkTable();
            updateBulkSummary();
        });
        productTd.appendChild(productSelect);
        tr.appendChild(productTd);

        // Quantity column
        const qtyTd = document.createElement('td');
        qtyTd.className = row.errors.quantity ? 'error' : '';
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.value = row.quantity;
        qtyInput.placeholder = '0';
        qtyInput.min = '1';
        qtyInput.addEventListener('change', (e) => {
            row.quantity = parseInt(e.target.value) || 0;
            if (row.quantity <= 0) {
                row.errors.quantity = 'Cantidad debe ser > 0';
            } else {
                delete row.errors.quantity;
            }
            calculateBulkRowTotal(row);
            renderBulkTable();
            updateBulkSummary();
        });
        qtyTd.appendChild(qtyInput);
        tr.appendChild(qtyTd);

        // Unit Price column
        const priceTd = document.createElement('td');
        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.value = row.unitPrice;
        priceInput.placeholder = '0.00';
        priceInput.step = '0.01';
        priceInput.disabled = true;
        priceInput.style.backgroundColor = '#f3f4f6';
        priceTd.appendChild(priceInput);
        tr.appendChild(priceTd);

        // Total column
        const totalTd = document.createElement('td');
        const totalInput = document.createElement('input');
        totalInput.type = 'number';
        totalInput.value = row.total.toFixed(2);
        totalInput.disabled = true;
        totalInput.style.backgroundColor = '#f3f4f6';
        totalInput.style.fontWeight = 'bold';
        totalInput.style.color = 'var(--primary-color)';
        totalTd.appendChild(totalInput);
        tr.appendChild(totalTd);

        // Date column
        const dateTd = document.createElement('td');
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.value = row.date;
        dateInput.className = 'bulk-date-input';
        dateInput.addEventListener('change', (e) => {
            row.date = e.target.value;
        });
        dateTd.appendChild(dateInput);
        tr.appendChild(dateTd);

        // Description column
        const descTd = document.createElement('td');
        const descInput = document.createElement('input');
        descInput.type = 'text';
        descInput.value = row.description;
        descInput.placeholder = 'Nota...';
        descInput.addEventListener('change', (e) => {
            row.description = e.target.value;
        });
        descTd.appendChild(descInput);
        tr.appendChild(descTd);

        // Status column
        const statusTd = document.createElement('td');
        const statusSpan = document.createElement('span');
        statusSpan.className = `status-badge status-${row.status}`;
        statusSpan.textContent = row.status === 'pending' ? '⏳ Pendiente' : 
                                 row.status === 'error' ? '❌ Error' : '✓ Válido';
        statusTd.appendChild(statusSpan);
        tr.appendChild(statusTd);

        // Actions column
        const actionsTd = document.createElement('td');
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove-row';
        removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
        removeBtn.addEventListener('click', () => removeBulkRow(row.id));
        actionsTd.appendChild(removeBtn);
        tr.appendChild(actionsTd);

        tbody.appendChild(tr);
    });
}

function calculateBulkRowTotal(row) {
    if (row.quantity && row.unitPrice) {
        row.total = row.quantity * row.unitPrice;
    } else {
        row.total = 0;
    }
}

function updateBulkSummary() {
    const rowCountSpan = document.getElementById('bulkRowCount');
    const totalAmountSpan = document.getElementById('bulkTotalAmount');
    const statusSpan = document.getElementById('bulkStatus');

    if (rowCountSpan) rowCountSpan.textContent = bulkTransactions.length;

    const totalAmount = bulkTransactions.reduce((sum, row) => sum + (row.total || 0), 0);
    if (totalAmountSpan) totalAmountSpan.textContent = formatCurrency(totalAmount);

    const validRows = bulkTransactions.filter(row => validateBulkRow(row, true)).length;
    if (statusSpan) {
        statusSpan.className = validRows === bulkTransactions.length ? 'status-info' : 'status-info status-error';
        statusSpan.textContent = `${validRows}/${bulkTransactions.length} filas válidas`;
    }
}

function validateBulkRow(row, checkOnly = false) {
    const errors = {};

    if (!row.type || row.type.trim() === '') {
        errors.type = 'Tipo requerido';
    }

    if (!row.product || row.product.trim() === '') {
        errors.product = 'Producto requerido';
    }

    if (!row.quantity || row.quantity <= 0) {
        errors.quantity = 'Cantidad inválida';
    }

    if (!row.unitPrice || row.unitPrice <= 0) {
        errors.unitPrice = 'Precio inválido';
    }

    if (!row.date || row.date.trim() === '') {
        errors.date = 'Fecha requerida';
    }

    if (!checkOnly) {
        row.errors = errors;
        row.status = Object.keys(errors).length === 0 ? 'valid' : 'error';
    }

    return Object.keys(errors).length === 0;
}

function selectAllBulkRows() {
    const selectAllCheckbox = document.getElementById('selectAllBulkCheckbox');
    const isChecked = selectAllCheckbox.checked;

    bulkTransactions.forEach(row => {
        row.checked = isChecked;
    });

    renderBulkTable();
}

function processBulkTransactions() {
    const checkedTransactions = bulkTransactions.filter(row => row.checked);

    if (checkedTransactions.length === 0) {
        showNotification('Selecciona al menos una transacción', 'error');
        return;
    }

    let validCount = 0;
    let errorCount = 0;
    const processedIds = new Set();

    checkedTransactions.forEach(row => {
        if (validateBulkRow(row)) {
            // Find product
            const product = demoData.products.find(p => p.id === row.product);
            if (!product) {
                row.status = 'error';
                row.errors.product = 'Producto no encontrado';
                errorCount++;
                return;
            }

            // Check stock for sales/devoluciones
            if ((row.type === 'Venta' || row.type === 'Devolución') && product.stock < row.quantity) {
                row.status = 'error';
                row.errors.quantity = `Stock insuficiente. Stock: ${product.stock}`;
                errorCount++;
                return;
            }

            // Create transaction
            const newTransaction = {
                id: 'TRX' + String(demoData.transactions.length + 1).padStart(4, '0'),
                type: row.type,
                product: row.product,
                quantity: row.quantity,
                unitPrice: row.unitPrice,
                monto: row.total,
                date: row.date,
                description: row.description,
                user: 'Sistema',
                status: 'completado'
            };

            // Update stock
            if (row.type === 'Venta') {
                if (!processedIds.has(product.id)) {
                    product.stock -= row.quantity;
                    processedIds.add(product.id);
                }
            } else if (row.type === 'Compra') {
                if (!processedIds.has(product.id)) {
                    product.stock += row.quantity;
                    processedIds.add(product.id);
                }
            } else if (row.type === 'Devolución') {
                if (!processedIds.has(product.id)) {
                    product.stock += row.quantity;
                    processedIds.add(product.id);
                }
            }

            demoData.transactions.push(newTransaction);
            row.status = 'success';
            validCount++;
        } else {
            errorCount++;
        }
    });

    renderBulkTable();
    updateBulkSummary();

    if (validCount > 0) {
        showNotification(`✓ ${validCount} transacciones procesadas correctamente`, 'success');
        
        // Clear checked rows after 1.5 seconds and show updated data
        setTimeout(() => {
            bulkTransactions = bulkTransactions.filter(row => !row.checked);
            for (let i = 0; i < 5; i++) {
                addBulkRow(true);
            }
            renderBulkTable();
            updateBulkSummary();

            // Refresh other sections
            if (currentPage === 'inventory') {
                populateInventoryTable();
            }
            populateRecentTransactions();
            updateDashboard();
        }, 1500);
    }

    if (errorCount > 0) {
        showNotification(`⚠ ${errorCount} transacciones con errores. Revisa los detalles.`, 'error');
    }
}

// ============================================
// RESPONSIVE
// ============================================

function setupResponsive() {
    const toggleBtn = document.getElementById('toggleSidebar');
    const sidebar = document.querySelector('.sidebar');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }

    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('active');
        }
    });
}

// ============================================
// UTILIDADES
// ============================================

function updateCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        const today = new Date();
        dateElement.textContent = formatDate(today);
    }
}

// Add CSS animations dynamically
const styleElement = document.createElement('style');
styleElement.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(styleElement);

// ============================================
// FUNCIONES PARA GESTIÓN DE PACIENTES
// ============================================

function switchPacientTab(tabName) {
    // Ocultar todos los tabs
    document.querySelectorAll('#pacientModal .tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('#pacientModal .tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostrar el tab seleccionado
    const tabElement = document.getElementById('tab-' + tabName);
    const button = event.target;
    
    if (tabElement) {
        tabElement.classList.add('active');
        button.classList.add('active');
    }
}

function toggleClasificacionPaciente() {
    const tipoServicio = document.getElementById('pacientTipoServicio').value;
    const clasificacionGroup = document.getElementById('clasificacionAguoCronicoGroup');
    const coexGroup = document.getElementById('coexSegmentoGroup');
    const clasificacionSelect = document.getElementById('pacientClasificacion');
    const coexSegmento = document.getElementById('pacientCOEXSegmento');
    
    // Elementos condicionales del historial médico
    const seccionAguoCronico = document.getElementById('seccionAguoCronico');
    const seccionCOEX = document.getElementById('seccionCOEX');

    // Mostrar u ocultar campo de clasificación para Agudo/Crónico
    if (['agudo', 'cronico'].includes(tipoServicio)) {
        clasificacionGroup.style.display = 'block';
        clasificacionSelect.required = true;
        coexGroup.style.display = 'none';
        coexSegmento.required = false;
        coexSegmento.value = '';
        
        // Mostrar sección de Agudo/Crónico, ocultar COEX
        if (seccionAguoCronico) seccionAguoCronico.style.display = 'block';
        if (seccionCOEX) seccionCOEX.style.display = 'none';
    }
    // Mostrar u ocultar campo de segmento para COEX
    else if (tipoServicio === 'coex') {
        coexGroup.style.display = 'block';
        coexSegmento.required = true;
        clasificacionGroup.style.display = 'none';
        clasificacionSelect.required = false;
        clasificacionSelect.value = '';
        
        // Mostrar sección de COEX, ocultar Agudo/Crónico
        if (seccionAguoCronico) seccionAguoCronico.style.display = 'none';
        if (seccionCOEX) seccionCOEX.style.display = 'block';
    }
    // Ocultar ambos si no hay selección
    else {
        clasificacionGroup.style.display = 'none';
        coexGroup.style.display = 'none';
        clasificacionSelect.required = false;
        coexSegmento.required = false;
        clasificacionSelect.value = '';
        coexSegmento.value = '';
        
        // Ocultar ambas secciones
        if (seccionAguoCronico) seccionAguoCronico.style.display = 'none';
        if (seccionCOEX) seccionCOEX.style.display = 'none';
    }
}

// Mostrar/ocultar campos condicionales en historial médico
document.addEventListener('DOMContentLoaded', function() {
    // Padece enfermedad crónica
    if (document.getElementById('padeceCronica')) {
        document.getElementById('padeceCronica').addEventListener('change', function() {
            document.getElementById('especificacionCronica').style.display = this.checked ? 'block' : 'none';
        });
    }
    
    // Toma medicamentos
    if (document.getElementById('tomaMedicamento')) {
        document.getElementById('tomaMedicamento').addEventListener('change', function() {
            document.getElementById('especificacionMedicamento').style.display = this.checked ? 'block' : 'none';
        });
    }
    
    // Padece alergias
    if (document.getElementById('padaceAlergia')) {
        document.getElementById('padaceAlergia').addEventListener('change', function() {
            document.getElementById('especificacionAlergia').style.display = this.checked ? 'block' : 'none';
        });
    }
    
    // Utiliza prótesis
    if (document.getElementById('utilizaProtesis')) {
        document.getElementById('utilizaProtesis').addEventListener('change', function() {
            document.getElementById('especificacionProtesis').style.display = this.checked ? 'block' : 'none';
        });
    }
    
    // Ha convulsionado
    if (document.getElementById('haConvulsionado')) {
        document.getElementById('haConvulsionado').addEventListener('change', function() {
            document.getElementById('especificacionConvulsion').style.display = this.checked ? 'block' : 'none';
        });
    }
    
    // Comorbilidad (COEX)
    if (document.getElementById('comorbilidad')) {
        document.getElementById('comorbilidad').addEventListener('change', function() {
            document.getElementById('especificacionComorbilidad').style.display = this.checked ? 'block' : 'none';
        });
    }
    
    // Antecedentes legales (COEX)
    if (document.getElementById('antecedentesLegales')) {
        document.getElementById('antecedentesLegales').addEventListener('change', function() {
            document.getElementById('especificacionLegales').style.display = this.checked ? 'block' : 'none';
        });
    }
});

// ============================================
// FUNCIONES PARA GASTOS Y SERVICIOS
// ============================================

function switchGastosTab(tabName) {
    // Ocultar todos los tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostrar el tab seleccionado
    const tabElement = document.getElementById('tab-' + tabName);
    if (tabElement) {
        tabElement.classList.add('active');
    }

    // Marcar botón como activo
    event.target.closest('.tab-button').classList.add('active');
}

function agregarPago() {
    const concepto = document.getElementById('selectConcepto').value;
    const proveedor = document.getElementById('selectProveedor').value;
    const monto = document.getElementById('inputMonto').value;
    const fecha = document.getElementById('inputFecha').value;
    const numeroFactura = document.getElementById('inputNumeroFactura').value;
    const requisicion = document.getElementById('inputRequisicion').value;
    const referencia = document.getElementById('inputReferencia').value;

    if (!concepto || !proveedor || !monto || !fecha || !numeroFactura) {
        alert('Por favor complete todos los campos requeridos (incluyendo número de factura)');
        return;
    }

    if (gastosModule.addPago(concepto, proveedor, monto, fecha, numeroFactura, requisicion, referencia)) {
        // Limpiar formulario
        document.getElementById('selectConcepto').value = '';
        document.getElementById('selectProveedor').value = '';
        document.getElementById('inputMonto').value = '';
        document.getElementById('inputFecha').value = '';
        document.getElementById('inputNumeroFactura').value = '';
        document.getElementById('inputRequisicion').value = '';
        document.getElementById('inputReferencia').value = '';

        // Actualizar vista
        gastosModule.render();
        showNotification('Pago registrado correctamente', 'success');
    }
}

function agregarProveedor() {
    const nombre = document.getElementById('inputProveedorNombre').value;
    const contacto = document.getElementById('inputProveedorContacto').value;
    const telefono = document.getElementById('inputProveedorTelefono').value;
    const referencia = document.getElementById('inputProveedorReferencia').value;

    if (!nombre || !contacto) {
        alert('Por favor ingrese el nombre del proveedor y el contacto');
        return;
    }

    if (gastosModule.addProveedor(nombre, contacto, referencia, telefono)) {
        // Limpiar formulario
        document.getElementById('inputProveedorNombre').value = '';
        document.getElementById('inputProveedorContacto').value = '';
        document.getElementById('inputProveedorTelefono').value = '';
        document.getElementById('inputProveedorReferencia').value = '';

        // Actualizar vista
        gastosModule.render();
        showNotification('Proveedor agregado correctamente', 'success');
    }
}

function setGastosPeriodo(periodo) {
    gastosModule.setPeriodo(periodo);
    gastosModule.render();

    // Actualizar botones activos
    document.querySelectorAll('.periodo-buttons .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.btn').classList.add('active');
}

// Variable global para almacenar el proveedor a dar de baja
let proveedorEnBaja = null;

function abrirModalBajaProveedor(proveedorId, proveedorNombre) {
    proveedorEnBaja = proveedorId;
    document.getElementById('bajaProveedorNombre').textContent = `¿Dar de baja a: ${proveedorNombre}?`;
    document.getElementById('inputFechaBaja').value = new Date().toISOString().split('T')[0];
    document.getElementById('selectMotivoBaja').value = '';
    document.getElementById('inputDetallesBaja').value = '';
    
    const modal = document.getElementById('bajaProveedorModal');
    modal.style.display = 'flex';
}

function confirmarBajaProveedor() {
    if (!proveedorEnBaja) {
        alert('Error: No se especificó el proveedor');
        return;
    }

    const fechaBaja = document.getElementById('inputFechaBaja').value;
    const motivo = document.getElementById('selectMotivoBaja').value;
    const detalles = document.getElementById('inputDetallesBaja').value;

    if (!fechaBaja || !motivo) {
        alert('Por favor complete la fecha y el motivo de la baja');
        return;
    }

    const motivoCompleto = detalles ? `${motivo} - ${detalles}` : motivo;

    if (gastosModule.darDeBajaProveedor(proveedorEnBaja, motivoCompleto, fechaBaja)) {
        gastosModule.render();
        showNotification('Proveedor dado de baja correctamente', 'success');
        document.getElementById('bajaProveedorModal').style.display = 'none';
        proveedorEnBaja = null;
    }
}

// ============================================
// AUTENTICACIÓN - FUNCIONES DE USUARIO
// ============================================

/**
 * Inicializar perfil de usuario en la UI
 */
function initializeUserProfile() {
    const user = authManager.getUser();
    
    if (!user) return;

    // Buscar elemento para mostrar el nombre del usuario
    const userNameElement = document.getElementById('userName');
    const userEmailElement = document.getElementById('userEmail');
    const userRoleElement = document.getElementById('userRole');

    if (userNameElement) {
        userNameElement.textContent = user.nombre || 'Usuario';
    }

    if (userEmailElement) {
        userEmailElement.textContent = user.email || '';
    }

    if (userRoleElement && user.roles && user.roles.length > 0) {
        userRoleElement.textContent = user.roles[0] || '';
    }

    console.log('✓ Perfil de usuario cargado:', user.nombre);
}

/**
 * Configurar funcionalidad de logout
 */
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutLink = document.querySelector('[data-action="logout"]');
    const userMenu = document.getElementById('userMenu');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', performLogout);
    }

    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            performLogout();
        });
    }

    // Toggle user menu
    if (userMenu) {
        userMenu.addEventListener('click', function(e) {
            e.stopPropagation();
            const menu = document.getElementById('userDropdown');
            if (menu) {
                menu.classList.toggle('active');
            }
        });
    }

    // Cerrar menú al hacer click fuera
    document.addEventListener('click', function() {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) {
            dropdown.classList.remove('active');
        }
    });
}

/**
 * Ejecutar logout
 */
async function performLogout() {
    if (!confirm('¿Estás seguro que deseas cerrar sesión?')) {
        return;
    }

    const result = await authManager.logout();

    if (result.success) {
        showNotification('Sesión cerrada correctamente', 'success');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 1500);
    }
}

/**
 * Actualizar información del usuario en tiempo real
 */
async function refreshUserProfile() {
    const result = await authManager.getProfile();

    if (result.success) {
        initializeUserProfile();
        console.log('✓ Perfil de usuario actualizado');
    } else {
        console.error('Error actualizando perfil:', result.error);
    }
}

// Initialize the application
console.log('Zentra MED v1.0');
console.log('Demo Mode - All transactions are simulated');
