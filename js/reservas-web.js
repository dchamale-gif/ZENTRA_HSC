// ============================================
// MÓDULO DE RESERVAS DESDE PÁGINA WEB
// ============================================

const ReservasWebModule = {
    state: {
        reservas: [],
        formularioConfig: {
            camposRequeridos: ['nombre', 'email', 'telefono', 'doctor', 'fecha', 'hora'],
            horarioAtencion: { inicio: '08:00', fin: '18:00' },
            diasAdelanto: 30,
            duracionCita: 30
        }
    },

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        this.loadData();
        console.log('Módulo de Reservas Web inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        const bookingForm = document.getElementById('bookingForm');
        if (bookingForm) {
            bookingForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitReservation();
            });
        }

        const doctorSelect = document.getElementById('bookingDoctor');
        if (doctorSelect) {
            doctorSelect.addEventListener('change', () => this.loadAvailableHours());
        }

        const dateInput = document.getElementById('bookingDate');
        if (dateInput) {
            dateInput.addEventListener('change', () => this.loadAvailableHours());
        }
    },

    // Cargar datos
    loadData() {
        this.state.reservas = [
            {
                id: 'RES-001',
                nombre: 'Carlos Rodríguez',
                email: 'carlos@example.com',
                telefono: '584121234567',
                doctor: 'Dr. Juan García',
                fecha: '2026-05-15',
                hora: '10:00',
                estado: 'Confirmada',
                codigoConfirmacion: 'CONF-2026-001',
                fechaCreacion: '2026-04-01'
            }
        ];
    },

    // Enviar reserva
    submitReservation() {
        const nombre = document.getElementById('bookingName')?.value;
        const email = document.getElementById('bookingEmail')?.value;
        const telefono = document.getElementById('bookingPhone')?.value;
        const doctor = document.getElementById('bookingDoctor')?.value;
        const fecha = document.getElementById('bookingDate')?.value;
        const hora = document.getElementById('bookingHour')?.value;
        const razon = document.getElementById('bookingReason')?.value;

        // Validación
        if (!nombre || !email || !telefono || !doctor || !fecha || !hora) {
            alert('Por favor, completa todos los campos obligatorios');
            return;
        }

        if (!this.validateEmail(email)) {
            alert('Por favor, ingresa un email válido');
            return;
        }

        if (!this.validatePhone(telefono)) {
            alert('Por favor, ingresa un teléfono válido');
            return;
        }

        // Crear reserva
        const codigoConfirmacion = `CONF-${Date.now()}`;
        const newReservation = {
            id: `RES-${Date.now()}`,
            nombre,
            email,
            telefono,
            doctor,
            fecha,
            hora,
            razon: razon || 'Consulta general',
            estado: 'Pendiente',
            codigoConfirmacion,
            fechaCreacion: new Date().toISOString(),
            recordatorioEnviado: false
        };

        this.state.reservas.push(newReservation);

        // Enviar confirmación
        this.sendConfirmationEmail(newReservation);
        this.sendConfirmationSMS(newReservation);

        // Mostrar resultado
        this.showConfirmationMessage(newReservation);

        // Limpiar formulario
        document.getElementById('bookingForm').reset();
    },

    // Cargar horas disponibles
    loadAvailableHours() {
        const doctor = document.getElementById('bookingDoctor')?.value;
        const fecha = document.getElementById('bookingDate')?.value;

        if (!doctor || !fecha) {
            return;
        }

        const hoursSelect = document.getElementById('bookingHour');
        if (!hoursSelect) return;

        // Generar horas disponibles
        const availableHours = this.getAvailableHours(fecha, doctor);

        hoursSelect.innerHTML = '<option value="">Selecciona una hora...</option>' +
            availableHours.map(hour => `<option value="${hour}">${hour}</option>`).join('');
    },

    // Obtener horas disponibles
    getAvailableHours(fecha, doctor) {
        const hours = [];
        const { inicio, fin } = this.state.formularioConfig.horarioAtencion;
        const duracion = this.state.formularioConfig.duracionCita;

        const [inicioHora, inicioMin] = inicio.split(':').map(Number);
        const [finHora, finMin] = fin.split(':').map(Number);

        let currentHour = inicioHora;
        let currentMin = inicioMin;

        while (currentHour < finHora || (currentHour === finHora && currentMin < finMin)) {
            const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
            
            // Verificar si la hora está disponible (no reservada)
            if (!this.isTimeBooked(fecha, doctor, timeStr)) {
                hours.push(timeStr);
            }

            currentMin += duracion;
            if (currentMin >= 60) {
                currentHour += Math.floor(currentMin / 60);
                currentMin = currentMin % 60;
            }
        }

        return hours;
    },

    // Verificar si una hora está reservada
    isTimeBooked(fecha, doctor, hora) {
        return this.state.reservas.some(r => 
            r.fecha === fecha && 
            r.doctor === doctor && 
            r.hora === hora && 
            r.estado !== 'Cancelada'
        );
    },

    // Enviar email de confirmación
    sendConfirmationEmail(reservation) {
        const emailContent = `
            <h2>Reserva Confirmada</h2>
            <p>Hola ${reservation.nombre},</p>
            <p>Tu reserva ha sido registrada correctamente.</p>
            <p><strong>Detalles:</strong></p>
            <ul>
                <li>Doctor: ${reservation.doctor}</li>
                <li>Fecha: ${reservation.fecha}</li>
                <li>Hora: ${reservation.hora}</li>
                <li>Código de Confirmación: ${reservation.codigoConfirmacion}</li>
            </ul>
            <p>Por favor, presenta este código en tu cita.</p>
        `;

        console.log(`Enviando email a ${reservation.email}:`, emailContent);
        // Integración con servicio de email
    },

    // Enviar SMS de confirmación
    sendConfirmationSMS(reservation) {
        const smsContent = `Reserva confirmada. Doctor: ${reservation.doctor}, Fecha: ${reservation.fecha} ${reservation.hora}. Código: ${reservation.codigoConfirmacion}`;
        
        console.log(`Enviando SMS a ${reservation.telefono}: ${smsContent}`);
        // Integración con servicio de SMS (Twilio, AWS SNS, etc)
    },

    // Mostrar mensaje de confirmación
    showConfirmationMessage(reservation) {
        const confirmationDiv = document.getElementById('confirmationMessage');
        if (!confirmationDiv) return;

        confirmationDiv.innerHTML = `
            <div class="alert alert-success">
                <h3>¡Reserva Confirmada!</h3>
                <p>Reserva número: <strong>${reservation.id}</strong></p>
                <p>Código de confirmación: <strong>${reservation.codigoConfirmacion}</strong></p>
                <p>Se ha enviado una confirmación a <strong>${reservation.email}</strong></p>
                <p>Te enviaremos un recordatorio 24 horas antes de tu cita.</p>
            </div>
        `;

        confirmationDiv.style.display = 'block';
        setTimeout(() => {
            confirmationDiv.style.display = 'none';
        }, 5000);
    },

    // Validar email
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // Validar teléfono
    validatePhone(phone) {
        const phoneRegex = /^[\d\s\(\)\+\-]{7,}$/;
        return phoneRegex.test(phone);
    },

    // Enviar recordatorios automáticos
    sendReminders() {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const appointmentsTomorrow = this.state.reservas.filter(r => 
            r.fecha === tomorrow && 
            r.estado === 'Confirmada' &&
            !r.recordatorioEnviado
        );

        appointmentsTomorrow.forEach(appointment => {
            this.sendConfirmationEmail(appointment);
            this.sendConfirmationSMS(appointment);
            appointment.recordatorioEnviado = true;
            console.log(`Recordatorio enviado para ${appointment.nombre}`);
        });
    },

    // Cancelar reserva
    cancelReservation(reservationId) {
        const reservation = this.state.reservas.find(r => r.id === reservationId);
        if (reservation) {
            reservation.estado = 'Cancelada';
            console.log('Reserva cancelada:', reservation);
            alert('Reserva cancelada correctamente');
        }
    }
};

// Ejecutar recordatorios cada hora
setInterval(() => {
    if (window.ReservasWebModule) {
        ReservasWebModule.sendReminders();
    }
}, 3600000); // Cada hora
