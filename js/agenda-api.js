// ============================================
// MÓDULO DE API PARA CONECTAR WEB
// ============================================

const AgendaAPIModule = {
    state: {
        apiUrl: CONFIG.API.baseURL,  // http://178.128.72.110:3011/api
        apiKey: 'your-api-key-here',
        endpoints: {
            appointments: '/appointments',
            doctors: '/doctors',
            specialties: '/specialties',
            availability: '/availability',
            bookings: '/bookings'
        }
    },

    // Inicializar el módulo
    init() {
        console.log('Módulo de API de Agenda inicializado');
        this.verifyConnection();
    },

    // Verificar conexión con la API
    verifyConnection() {
        // Intentar conectar al health check del servidor
        const healthUrl = CONFIG.API.baseURL.replace('/api', '') + '/health';
        fetch(healthUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(response => {
            if (response.ok) {
                console.log('✅ Servidor backend disponible');
            } else {
                console.warn('⚠️ Servidor backend no responde correctamente:', response.status);
            }
        }).catch(err => {
            console.warn('⚠️ Servidor backend no disponible:', err.message);
        });
    },

    // =====================================================
    // MÉTODOS HTTP BÁSICOS
    // =====================================================

    // GET Request
    get(endpoint, params = {}) {
        // Si el endpoint es absoluto (empieza con http), usarlo directamente
        let url;
        if (endpoint.startsWith('http')) {
            url = new URL(endpoint);
        } else {
            url = new URL(this.state.apiUrl + endpoint);
        }
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        return fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.state.apiKey}`,
                'Content-Type': 'application/json'
            }
        }).then(response => {
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            return response.json();
        });
    },,

    // POST Request
    post(endpoint, data = {}) {
        return fetch(this.state.apiUrl + endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.state.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).then(response => {
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            return response.json();
        });
    },

    // PUT Request
    put(endpoint, data = {}) {
        return fetch(this.state.apiUrl + endpoint, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.state.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).then(response => {
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            return response.json();
        });
    },

    // DELETE Request
    delete(endpoint) {
        return fetch(this.state.apiUrl + endpoint, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.state.apiKey}`,
                'Content-Type': 'application/json'
            }
        }).then(response => {
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            return response.json();
        });
    },

    // =====================================================
    // MÉTODOS DE CITAS
    // =====================================================

    // Obtener todas las citas
    getAppointments() {
        return this.get(this.state.endpoints.appointments);
    },

    // Obtener cita por ID
    getAppointment(id) {
        return this.get(`${this.state.endpoints.appointments}/${id}`);
    },

    // Crear nueva cita
    createAppointment(appointmentData) {
        return this.post(this.state.endpoints.appointments, appointmentData);
    },

    // Actualizar cita
    updateAppointment(id, appointmentData) {
        return this.put(`${this.state.endpoints.appointments}/${id}`, appointmentData);
    },

    // Cancelar cita
    cancelAppointment(id) {
        return this.put(`${this.state.endpoints.appointments}/${id}`, { estado: 'Cancelada' });
    },

    // Obtener citas por doctor
    getAppointmentsByDoctor(doctorId) {
        return this.get(this.state.endpoints.appointments, { doctor_id: doctorId });
    },

    // Obtener citas por fecha
    getAppointmentsByDate(date) {
        return this.get(this.state.endpoints.appointments, { fecha: date });
    },

    // =====================================================
    // MÉTODOS DE DOCTORES
    // =====================================================

    // Obtener todos los doctores
    getDoctors() {
        return this.get(this.state.endpoints.doctors);
    },

    // Obtener doctor por ID
    getDoctor(id) {
        return this.get(`${this.state.endpoints.doctors}/${id}`);
    },

    // Obtener doctores por especialidad
    getDoctorsBySpecialty(specialty) {
        return this.get(this.state.endpoints.doctors, { especialidad: specialty });
    },

    // =====================================================
    // MÉTODOS DE ESPECIALIDADES
    // =====================================================

    // Obtener todas las especialidades
    getSpecialties() {
        return this.get(this.state.endpoints.specialties);
    },

    // =====================================================
    // MÉTODOS DE DISPONIBILIDAD
    // =====================================================

    // Obtener horas disponibles
    getAvailability(doctorId, date) {
        return this.get(this.state.endpoints.availability, {
            doctor_id: doctorId,
            fecha: date
        });
    },

    // =====================================================
    // MÉTODOS DE RESERVAS
    // =====================================================

    // Crear reserva (desde web)
    createBooking(bookingData) {
        return this.post(this.state.endpoints.bookings, bookingData);
    },

    // Obtener reservas
    getBookings() {
        return this.get(this.state.endpoints.bookings);
    },

    // Confirmar reserva
    confirmBooking(bookingId) {
        return this.put(`${this.state.endpoints.bookings}/${bookingId}`, { estado: 'Confirmada' });
    },

    // Cancelar reserva
    cancelBooking(bookingId) {
        return this.delete(`${this.state.endpoints.bookings}/${bookingId}`);
    },

    // =====================================================
    // MÉTODOS DE INTEGRACIÓN WEB
    // =====================================================

    // Obtener disponibilidad para formulario de web
    getWebFormAvailability() {
        return this.get('/web/availability');
    },

    // Enviar reserva desde web
    submitWebBooking(formData) {
        return this.post('/web/bookings', {
            nombre: formData.nombre,
            email: formData.email,
            telefono: formData.telefono,
            doctor_id: formData.doctorId,
            fecha: formData.fecha,
            hora: formData.hora,
            razon: formData.razon
        });
    },

    // Confirmar código de reserva
    verifyBookingCode(code) {
        return this.get('/web/verify', { code });
    },

    // =====================================================
    // MÉTODOS DE UTILIDAD
    // =====================================================

    // Configurar URL base de la API
    setApiUrl(url) {
        this.state.apiUrl = url;
    },

    // Configurar API Key
    setApiKey(key) {
        this.state.apiKey = key;
    },

    // Obtener estadísticas
    getStatistics() {
        return this.get('/statistics');
    },

    // Obtener reporte de citas
    getAppointmentReport(startDate, endDate) {
        return this.get('/reports/appointments', {
            start_date: startDate,
            end_date: endDate
        });
    },

    // Webhook para notificaciones
    registerWebhook(event, url) {
        return this.post('/webhooks', {
            evento: event,
            url: url
        });
    },

    // Sincronizar datos
    syncData() {
        return Promise.all([
            this.getDoctors(),
            this.getSpecialties(),
            this.getAppointments()
        ]);
    }
};

// Exportar para uso en Node.js/módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgendaAPIModule;
}
