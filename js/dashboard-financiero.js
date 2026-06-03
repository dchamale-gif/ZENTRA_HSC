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

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        this.loadData();
        this.renderCharts();
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

    // Cargar datos
    loadData() {
        this.state.datos = {
            ingresos: 412152,
            egresos: 189696,
            ganancia: 222456,
            flujoActual: 32760,
            margenNeto: 53.9,
            ventasDelDia: 26910,
            gastosDelDia: 9672,
            numeroTransacciones: 187,
            ventasDelMes: 412152
        };

        this.state.historico = [
            { 
                mes: 'Enero', 
                ingresos: 273000, 
                egresos: 140400, 
                ganancia: 132600,
                ventas: 42,
                transacciones: 156
            },
            { 
                mes: 'Febrero', 
                ingresos: 327600, 
                egresos: 156000, 
                ganancia: 171600,
                ventas: 58,
                transacciones: 168
            },
            { 
                mes: 'Marzo', 
                ingresos: 351000, 
                egresos: 163800, 
                ganancia: 187200,
                ventas: 63,
                transacciones: 175
            },
            { 
                mes: 'Abril', 
                ingresos: 378300, 
                egresos: 173940, 
                ganancia: 204360,
                ventas: 72,
                transacciones: 182
            },
            { 
                mes: 'Mayo', 
                ingresos: 412152, 
                egresos: 189696, 
                ganancia: 222456,
                ventas: 81,
                transacciones: 187
            }
        ];

        // Datos adicionales por categoría
        this.state.categoriaGastos = [
            { nombre: 'Compras', monto: 97500, porcentaje: 51.4 },
            { nombre: 'Nómina', monto: 53040, porcentaje: 27.9 },
            { nombre: 'Servicios', monto: 21840, porcentaje: 11.5 },
            { nombre: 'Otros', monto: 17316, porcentaje: 9.2 }
        ];

        this.state.categoriaIngresos = [
            { nombre: 'Ventas Directas', monto: 296160, porcentaje: 71.8 },
            { nombre: 'Servicios', monto: 81900, porcentaje: 19.8 },
            { nombre: 'Otros Ingresos', monto: 33852, porcentaje: 8.4 }
        ];

        // Proyecciones
        this.state.proyecciones = {
            junio: 438360,
            julio: 466440,
            agosto: 495310
        };
    },

    // Renderizar gráficos
    renderCharts() {
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
        if (window.incomeExpenseChart) {
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
        if (window.cashFlowChart) {
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
        if (window.marginChart) {
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

        // Limpiar contenedor si ya existe un canvas
        const existingCanvas = container.querySelector('canvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }

        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        if (window.expenseCategoryChart) {
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

        // Limpiar contenedor si ya existe un canvas
        const existingCanvas = container.querySelector('canvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }

        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        if (window.incomeCategoryChart) {
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
