// ============================================
// MÓDULO DASHBOARD FINANCIERO
// ============================================

const DashboardFinancieroModule = {
    state: {
        datos: {
            ingresos: 0,
            egresos: 0,
            ganancia: 0,
            flujoActual: 0
        },
        historico: []
    },


    init() {
        this.setupEventListeners();
        this.loadData().then(() => {
            this.renderCharts();
        }).catch(error => {
            console.error('Error al inicializar dashboard:', error);
            this.renderCharts(); // Renderizar con datos vacíos si hay error
        });
        console.log('Dashboard Financiero inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        const refreshBtn = document.getElementById('refreshFinancialBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refresh());
        }

        const exportBtn = document.getElementById('exportFinancialBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportReport());
        }
    },

    // Cargar datos desde la API
    async loadData() {
        try {
            // Obtener resumen financiero
            const summaryResponse = await fetch('/api/reports/financial-summary', {
                headers: this.getAuthHeaders()
            });
            const summaryData = await summaryResponse.json();

            if (summaryData.success) {
                this.state.datos = {
                    ingresos: summaryData.data.ingresos,
                    egresos: summaryData.data.egresos,
                    ganancia: summaryData.data.ganancia,
                    flujoActual: summaryData.data.ganancia,
                    margenNeto: summaryData.data.margenNeto,
                    ventasDelDia: 0,
                    gastosDelDia: 0,
                    numeroTransacciones: summaryData.data.numeroTransacciones,
                    ventasDelMes: summaryData.data.ingresos
                };
            }

            // Obtener datos mensuales históricos
            const monthlyResponse = await fetch('/api/reports/monthly-data?months=12', {
                headers: this.getAuthHeaders()
            });
            const monthlyData = await monthlyResponse.json();

            if (monthlyData.success) {
                this.state.historico = monthlyData.data;
            }

            // Obtener categorías de gastos
            const expenseResponse = await fetch('/api/reports/expenses-by-category', {
                headers: this.getAuthHeaders()
            });
            const expenseData = await expenseResponse.json();

            if (expenseData.success) {
                this.state.categoriaGastos = expenseData.data;
            }

            // Obtener categorías de ingresos
            const incomeResponse = await fetch('/api/reports/income-by-category', {
                headers: this.getAuthHeaders()
            });
            const incomeData = await incomeResponse.json();

            if (incomeData.success) {
                this.state.categoriaIngresos = incomeData.data;
            }

        } catch (error) {
            console.error('Error al cargar datos del dashboard:', error);
            this.showErrorNotification('Error al cargar datos del dashboard');
        }
    },

    // Obtener headers de autenticación
    getAuthHeaders() {
        const token = localStorage.getItem('auth_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    },

    // Mostrar notificación de error
    showErrorNotification(message) {
        const notif = document.getElementById('notification');
        if (notif) {
            notif.textContent = message;
            notif.className = 'alert alert-danger';
            notif.style.display = 'block';
            setTimeout(() => {
                notif.style.display = 'none';
            }, 3000);
        }
    },

    // Renderizar gráficos
    renderCharts() {
        // Inicializar datos vacíos si no existen
        if (!this.state.historico) this.state.historico = [];
        if (!this.state.categoriaGastos) this.state.categoriaGastos = [];
        if (!this.state.categoriaIngresos) this.state.categoriaIngresos = [];
        
        this.renderIncomeExpenseChart();
        this.renderCashFlowChart();
        this.renderMarginChart();
        this.renderExpenseCategoryChart();
        this.renderIncomeCategoryChart();
        this.updateKPIs();
    },

    // Gráfico de ingresos vs egresos
    renderIncomeExpenseChart() {
        const canvas = document.getElementById('incomeExpenseChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (window.incomeExpenseChart && typeof window.incomeExpenseChart.destroy === 'function') {
            window.incomeExpenseChart.destroy();
        }

        window.incomeExpenseChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.state.historico.map(h => h.mes),
                datasets: [
                    {
                        label: 'Ingresos',
                        data: this.state.historico.map(h => h.ingresos),
                        backgroundColor: '#28a745',
                        borderRadius: 5
                    },
                    {
                        label: 'Egresos',
                        data: this.state.historico.map(h => h.egresos),
                        backgroundColor: '#dc3545',
                        borderRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: true },
                    title: { display: true, text: 'Ingresos vs Egresos' }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    },

    // Gráfico de flujo de caja
    renderCashFlowChart() {
        const canvas = document.getElementById('cashFlowChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (window.cashFlowChart && typeof window.cashFlowChart.destroy === 'function') {
            window.cashFlowChart.destroy();
        }

        window.cashFlowChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.state.historico.map(h => h.mes),
                datasets: [
                    {
                        label: 'Ganancia Neta',
                        data: this.state.historico.map(h => h.ganancia),
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 5,
                        pointBackgroundColor: '#4CAF50'
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: true },
                    title: { display: true, text: 'Ganancia Neta' }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    },

    // Gráfico de márgenes
    renderMarginChart() {
        const canvas = document.getElementById('marginChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (window.marginChart && typeof window.marginChart.destroy === 'function') {
            window.marginChart.destroy();
        }

        const margins = this.state.historico.map(h => ((h.ganancia / h.ingresos) * 100).toFixed(1));

        window.marginChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Ganancia Neta', 'Costo de Venta'],
                datasets: [
                    {
                        data: [this.state.datos.ganancia, this.state.datos.egresos],
                        backgroundColor: ['#4CAF50', '#FF6B6B'],
                        borderRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: true },
                    title: { display: true, text: 'Distribución de Ganancia' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${percentage}%`;
                            }
                        }
                    }
                }
            }
        });
    },

    // Gráfico de categorías de gastos
    renderExpenseCategoryChart() {
        const container = document.getElementById('gastosCategoriaChart');
        if (!container) return;

        // Inicializar si no existe
        if (!this.state.categoriaGastos || this.state.categoriaGastos.length === 0) {
            container.innerHTML = '<p class="text-muted">Sin datos de gastos</p>';
            return;
        }

        // Limpiar contenedor si ya existe un canvas
        const existingCanvas = container.querySelector('canvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }

        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        if (window.expenseCategoryChart && typeof window.expenseCategoryChart.destroy === 'function') {
            window.expenseCategoryChart.destroy();
        }

        const labels = this.state.categoriaGastos.map(d => d.nombre);
        const montos = this.state.categoriaGastos.map(d => d.monto);
        const colores = ['#FF6B6B', '#FFA07A', '#FFB6C1', '#FFE4E1'];

        window.expenseCategoryChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: montos,
                    backgroundColor: colores,
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'right' },
                    title: { display: true, text: 'Distribución de Gastos' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: Q.${context.parsed.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    // Gráfico de categorías de ingresos
    renderIncomeCategoryChart() {
        const container = document.getElementById('ingresoCategoriaChart');
        if (!container) return;

        // Inicializar si no existe
        if (!this.state.categoriaIngresos || this.state.categoriaIngresos.length === 0) {
            container.innerHTML = '<p class="text-muted">Sin datos de ingresos</p>';
            return;
        }

        // Limpiar contenedor si ya existe un canvas
        const existingCanvas = container.querySelector('canvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }

        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        if (window.incomeCategoryChart && typeof window.incomeCategoryChart.destroy === 'function') {
            window.incomeCategoryChart.destroy();
        }

        const labels = this.state.categoriaIngresos.map(d => d.nombre);
        const montos = this.state.categoriaIngresos.map(d => d.monto);
        const colores = ['#66BB6A', '#29B6F6', '#AB47BC'];

        window.incomeCategoryChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: montos,
                    backgroundColor: colores,
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'right' },
                    title: { display: true, text: 'Distribución de Ingresos' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: Q.${context.parsed.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    // Actualizar KPIs
    updateKPIs() {
        const container = document.getElementById('financialKPIs');
        if (!container) return;

        // Calcular cambios porcentuales vs mes anterior
        const hist = this.state.historico;
        const mesActual = hist[hist.length - 1];
        const mesAnterior = hist[hist.length - 2];

        const cambioIngresos = ((mesActual.ingresos - mesAnterior.ingresos) / mesAnterior.ingresos * 100).toFixed(1);
        const cambioEgresos = ((mesActual.egresos - mesAnterior.egresos) / mesAnterior.egresos * 100).toFixed(1);
        const cambioGanancia = ((mesActual.ganancia - mesAnterior.ganancia) / mesAnterior.ganancia * 100).toFixed(1);
        
        const margenActual = (mesActual.ganancia / mesActual.ingresos * 100).toFixed(1);
        const margenAnterior = (mesAnterior.ganancia / mesAnterior.ingresos * 100).toFixed(1);
        const cambioMargen = (margenActual - margenAnterior).toFixed(1);

        const claseEgreso = cambioEgresos < 0 ? 'positive' : 'negative';

        container.innerHTML = `
            <div class="kpi-card kpi-ingresos">
                <div class="kpi-header">
                    <h3>Ingresos Totales</h3>
                    <i class="fas fa-arrow-up"></i>
                </div>
                <div class="kpi-value">Q.${this.state.datos.ingresos.toLocaleString()}</div>
                <div class="kpi-change positive">
                    <i class="fas fa-arrow-up"></i> ${cambioIngresos}% vs mes anterior
                </div>
            </div>

            <div class="kpi-card kpi-egresos">
                <div class="kpi-header">
                    <h3>Egresos Totales</h3>
                    <i class="fas fa-arrow-down"></i>
                </div>
                <div class="kpi-value">Q.${this.state.datos.egresos.toLocaleString()}</div>
                <div class="kpi-change ${claseEgreso}">
                    <i class="fas fa-arrow-${cambioEgresos < 0 ? 'down' : 'up'}"></i> ${Math.abs(cambioEgresos)}% vs mes anterior
                </div>
            </div>

            <div class="kpi-card kpi-ganancia">
                <div class="kpi-header">
                    <h3>Ganancia Neta</h3>
                    <i class="fas fa-money-bill-wave"></i>
                </div>
                <div class="kpi-value">Q.${this.state.datos.ganancia.toLocaleString()}</div>
                <div class="kpi-change positive">
                    <i class="fas fa-arrow-up"></i> ${cambioGanancia}% vs mes anterior
                </div>
            </div>

            <div class="kpi-card kpi-margen">
                <div class="kpi-header">
                    <h3>Margen Neto</h3>
                    <i class="fas fa-percentage"></i>
                </div>
                <div class="kpi-value">${margenActual}%</div>
                <div class="kpi-change ${cambioMargen > 0 ? 'positive' : 'negative'}">
                    <i class="fas fa-arrow-${cambioMargen > 0 ? 'up' : 'down'}"></i> ${Math.abs(cambioMargen)}pp vs mes anterior
                </div>
            </div>
        `;
    },

    // Refrescar dashboard
    refresh() {
        this.loadData();
        this.renderCharts();
        alert('Dashboard financiero actualizado');
    },

    // Exportar reporte
    exportReport() {
        let csv = 'Mes,Ingresos,Egresos,Ganancia\n';
        this.state.historico.forEach(h => {
            csv += `${h.mes},${h.ingresos},${h.egresos},${h.ganancia}\n`;
        });

        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
        element.setAttribute('download', `reporte_financiero_${new Date().toISOString().split('T')[0]}.csv`);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);

        alert('Reporte exportado correctamente');
    },

    // Obtener proyección de flujo de caja
    getCashFlowProjection() {
        const lastMonth = this.state.historico[this.state.historico.length - 1];
        const proyectado = lastMonth.ganancia * 1.05; // Proyección con 5% de crecimiento
        return proyectado;
    }
};
