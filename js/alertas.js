// ============================================
// MÓDULO DE ALERTAS
// ============================================
// Sistema centralizado de alertas para el sistema
// Alertas de compras, pacientes, etc.

const AlertasModule = {
    state: {
        alertas: [], // Alertas globales del sistema
        filtroTipo: 'todas', // todas, compra, paciente, sistema
        filtroLeidas: 'sin-leer' // sin-leer, leidas, todas
    },

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        this.loadData();
        console.log('Módulo de Alertas inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        // Event listeners para los filtros en la página de alertas
        const filterTipo = document.getElementById('filterTipo');
        if (filterTipo) {
            filterTipo.addEventListener('change', (e) => {
                this.filtroTipo = e.target.value;
                this.renderAlertas();
            });
        }

        const filterLeidas = document.getElementById('filterLeidas');
        if (filterLeidas) {
            filterLeidas.addEventListener('change', (e) => {
                this.filtroLeidas = e.target.value;
                this.renderAlertas();
            });
        }

        // Botones de acciones
        const markAllBtn = document.getElementById('markAllAsReadBtn');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => this.marcarTodasComoLeidas());
        }

        const clearBtn = document.getElementById('clearAlertsBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.limpiarAlertas());
        }
    },

    // Cargar datos
    loadData() {
        const alertasFromStorage = localStorage.getItem('alertasGlobales');
        if (alertasFromStorage) {
            this.state.alertas = JSON.parse(alertasFromStorage);
        } else {
            this.state.alertas = [];
        }
        this.renderAlertas();
        this.updateBadge();
    },

    // Crear alerta
    crearAlerta(config) {
        const alerta = {
            id: this.generateId('ALRT'),
            tipo: config.tipo || 'sistema', // compra, paciente, sistema, otro
            titulo: config.titulo || 'Nueva alerta',
            descripcion: config.descripcion || '',
            prioridad: config.prioridad || 'baja', // alta, media, baja
            leida: false,
            fechaCreacion: new Date().toISOString(),
            referencia: config.referencia || null,
            referenciaType: config.referenciaType || null // compra, paciente, etc.
        };

        this.state.alertas.unshift(alerta); // Agregar al inicio
        this.saveToDB();
        this.updateBadge();
        this.mostrarNotificacion(alerta);

        // Notificación visual
        this.showNotification(alerta.titulo, 'warning');

        return alerta;
    },

    // Mostrar notificación en tiempo real
    mostrarNotificacion(alerta) {
        // Crear notificación desktop si está disponible
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(alerta.titulo, {
                body: alerta.descripcion,
                tag: alerta.id,
                requireInteraction: alerta.prioridad === 'alta'
            });
        }

        // Mostrar toast visual
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getPrioridadColor(alerta.prioridad)};
            color: white;
            padding: 16px 20px;
            border-radius: 5px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;

        const titulo = document.createElement('strong');
        titulo.textContent = alerta.titulo;
        titulo.style.display = 'block';

        const desc = document.createElement('small');
        desc.textContent = alerta.descripcion;
        desc.style.display = 'block';
        desc.style.marginTop = '5px';

        toast.appendChild(titulo);
        toast.appendChild(desc);
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    },

    // Marcar alerta como leída
    marcarComoLeida(alertaId) {
        const alerta = this.state.alertas.find(a => a.id === alertaId);
        if (alerta) {
            alerta.leida = true;
            this.saveToDB();
            this.renderAlertas();
            this.updateBadge();
        }
    },

    // Marcar todas como leídas
    marcarTodasComoLeidas() {
        this.state.alertas.forEach(a => a.leida = true);
        this.saveToDB();
        this.renderAlertas();
        this.updateBadge();
    },

    // Eliminar alerta
    eliminarAlerta(alertaId) {
        this.state.alertas = this.state.alertas.filter(a => a.id !== alertaId);
        this.saveToDB();
        this.renderAlertas();
        this.updateBadge();
        this.showNotification('✅ Alerta eliminada', 'success');
    },

    // Eliminar todas las alertas leídas
    limpiarAlertas() {
        if (confirm('¿Deseas eliminar todas las alertas leídas?')) {
            this.state.alertas = this.state.alertas.filter(a => !a.leida);
            this.saveToDB();
            this.renderAlertas();
            this.updateBadge();
            this.showNotification('✅ Alertas limpiadas', 'success');
        }
    },

    // Renderizar alertas
    renderAlertas() {
        const container = document.getElementById('alertasContainer');
        if (!container) return;

        let alertasFiltradas = this.state.alertas;

        // Filtrar por tipo
        if (this.filtroTipo !== 'todas') {
            alertasFiltradas = alertasFiltradas.filter(a => a.tipo === this.filtroTipo);
        }

        // Filtrar por lectura
        if (this.filtroLeidas === 'sin-leer') {
            alertasFiltradas = alertasFiltradas.filter(a => !a.leida);
        } else if (this.filtroLeidas === 'leidas') {
            alertasFiltradas = alertasFiltradas.filter(a => a.leida);
        }

        if (alertasFiltradas.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 30px; color: #999;">No hay alertas</div>';
            return;
        }

        container.innerHTML = alertasFiltradas.map(alerta => `
            <div style="background: ${alerta.leida ? '#f5f5f5' : '#fff'}; border-left: 4px solid ${this.getPrioridadColor(alerta.prioridad)}; padding: 15px; margin-bottom: 10px; border-radius: 3px; opacity: ${alerta.leida ? 0.7 : 1};">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <strong style="color: #2c3e50;">${this.getTipoIcon(alerta.tipo)} ${alerta.titulo}</strong>
                            <span style="padding: 2px 6px; background: ${this.getPrioridadColor(alerta.prioridad)}; color: white; font-size: 11px; border-radius: 3px; font-weight: bold;">
                                ${alerta.prioridad.toUpperCase()}
                            </span>
                            ${alerta.leida ? '<span style="color: #27ae60; font-size: 12px;">✓ Leída</span>' : ''}
                        </div>
                        <p style="margin: 8px 0 0 0; color: #555;">${alerta.descripcion}</p>
                        <small style="color: #999; margin-top: 5px; display: block;">
                            ${new Date(alerta.fechaCreacion).toLocaleString()}
                        </small>
                    </div>
                    <div style="display: flex; gap: 5px; margin-left: 10px;">
                        ${!alerta.leida ? `<button onclick="AlertasModule.marcarComoLeida('${alerta.id}')" style="background: #3498db; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px;">✓ Marcar</button>` : ''}
                        ${alerta.referenciaType === 'compra' ? `<button onclick="app.navigate('compras'); setTimeout(() => app.searchCompra('${alerta.referencia}'), 500);" style="background: #27ae60; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px;">Ver</button>` : ''}
                        <button onclick="AlertasModule.eliminarAlerta('${alerta.id}')" style="color: #e74c3c; background: none; border: none; cursor: pointer; font-size: 16px;">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    // Actualizar badge de alertas sin leer
    updateBadge() {
        const badge = document.getElementById('alertasBadge');
        if (badge) {
            const sinLeer = this.state.alertas.filter(a => !a.leida).length;
            badge.textContent = sinLeer;
            badge.style.display = sinLeer > 0 ? 'inline-block' : 'none';
        }
    },

    // Obtener color según prioridad
    getPrioridadColor(prioridad) {
        switch(prioridad) {
            case 'alta': return '#e74c3c';
            case 'media': return '#f39c12';
            case 'baja': return '#3498db';
            default: return '#95a5a6';
        }
    },

    // Obtener icono según tipo
    getTipoIcon(tipo) {
        switch(tipo) {
            case 'compra': return '🛒';
            case 'paciente': return '👨‍⚕️';
            case 'sistema': return '⚙️';
            default: return '📌';
        }
    },

    // Generar ID único
    generateId(prefix) {
        return `${prefix}-${Date.now()}`;
    },

    // Guardar en BD
    saveToDB() {
        localStorage.setItem('alertasGlobales', JSON.stringify(this.state.alertas));
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

    // Pedir permiso para notificaciones
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
};

// Agregar estilos de animación
const styleAlertasElement = document.createElement('style');
styleAlertasElement.textContent = `
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
document.head.appendChild(styleAlertasElement);
