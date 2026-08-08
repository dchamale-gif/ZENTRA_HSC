// ============================================
// API HELPER - Centralizado para todas las llamadas
// ============================================

const APIHelper = {
    baseURL: (() => {
        // Detectar URL del backend automáticamente
        const currentHost = window.location.hostname;
        if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
            return 'http://localhost:3011/api';
        }
        // Usar IP del servidor en producción
        return `http://${currentHost}:3011/api`;
    })(),

    // Obtener token de autenticación
    getToken() {
        // Usar authManager si está disponible, sino fallback a localStorage
        if (typeof authManager !== 'undefined') {
            return authManager.getToken() || '';
        }
        return localStorage.getItem('zentra_token') || '';
    },

    // Headers por defecto
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getToken()}`
        };
    },

    /**
     * PACIENTES
     */
    async fetchPacientes() {
        try {
            const res = await fetch(`${this.baseURL}/pacientes`, {
                headers: this.getHeaders()
            });
            const data = await res.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Error fetching pacientes:', error);
            return [];
        }
    },

    /**
     * MEDICINAS
     */
    async fetchMedicinas() {
        try {
            const res = await fetch(`${this.baseURL}/medicinas`, {
                headers: this.getHeaders()
            });
            const data = await res.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Error fetching medicinas:', error);
            return [];
        }
    },

    /**
     * PROVEEDORES
     */
    async fetchProveedores() {
        try {
            const res = await fetch(`${this.baseURL}/proveedores`, {
                headers: this.getHeaders()
            });
            const data = await res.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Error fetching proveedores:', error);
            return [];
        }
    },

    /**
     * DOCTORES
     */
    async fetchDoctors() {
        try {
            const res = await fetch(`${this.baseURL}/doctors`, {
                headers: this.getHeaders()
            });
            const data = await res.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Error fetching doctors:', error);
            return [];
        }
    },

    /**
     * ESPECIALIDADES
     */
    async fetchSpecialties() {
        try {
            const res = await fetch(`${this.baseURL}/doctors/specialties/list`, {
                headers: this.getHeaders()
            });
            const data = await res.json();
            return data.success ? data.data.map(s => s.nombre) : [];
        } catch (error) {
            console.error('Error fetching specialties:', error);
            return [];
        }
    },

    /**
     * CITAS
     */
    async fetchAppointmentsToday() {
        try {
            const res = await fetch(`${this.baseURL}/appointments/today`, {
                headers: this.getHeaders()
            });
            const data = await res.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Error fetching appointments:', error);
            return [];
        }
    },

    async fetchPatientAppointments(paciente_id) {
        try {
            const res = await fetch(`${this.baseURL}/appointments/patient/${paciente_id}`, {
                headers: this.getHeaders()
            });
            const data = await res.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Error fetching patient appointments:', error);
            return [];
        }
    },

    /**
     * COMPRAS (GASTOS)
     */
    async fetchExpenses(startDate, endDate) {
        try {
            const query = new URLSearchParams();
            if (startDate) query.append('startDate', startDate);
            if (endDate) query.append('endDate', endDate);

            const res = await fetch(`${this.baseURL}/expenses?${query}`, {
                headers: this.getHeaders()
            });
            const data = await res.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Error fetching expenses:', error);
            return [];
        }
    },

    /**
     * CUENTAS POR COBRAR
     */
    async fetchReceivables(status) {
        try {
            const query = status ? `?status=${status}` : '';
            const res = await fetch(`${this.baseURL}/receivables${query}`, {
                headers: this.getHeaders()
            });
            const data = await res.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Error fetching receivables:', error);
            return [];
        }
    },

    /**
     * ARTÍCULOS / CÓDIGOS
     */
    async fetchArticles() {
        try {
            const res = await fetch(`${this.baseURL}/codigos-articulos`, {
                headers: this.getHeaders()
            });
            const data = await res.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Error fetching articles:', error);
            return [];
        }
    },

    /**
     * REPORTES
     */
    async fetchFinancialSummary(startDate, endDate) {
        try {
            const query = new URLSearchParams();
            if (startDate) query.append('startDate', startDate);
            if (endDate) query.append('endDate', endDate);

            const res = await fetch(`${this.baseURL}/reports/financial-summary?${query}`, {
                headers: this.getHeaders()
            });
            const data = await res.json();
            return data.success ? data.data : null;
        } catch (error) {
            console.error('Error fetching financial summary:', error);
            return null;
        }
    },

    async fetchMonthlyData(months = 12) {
        try {
            const res = await fetch(`${this.baseURL}/reports/monthly-data?months=${months}`, {
                headers: this.getHeaders()
            });
            const data = await res.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Error fetching monthly data:', error);
            return [];
        }
    }
};

// Hacer accesible globalmente
window.APIHelper = APIHelper;
