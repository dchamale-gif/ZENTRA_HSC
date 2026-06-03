// ============================================
// MÓDULO DE AGENDA
// ============================================

const AgendaModule = {
    state: {
        citas: [],
        doctores: [],
        especialidades: [],
        horarios: {
            inicio: '08:00',
            fin: '18:00'
        },
        currentDate: new Date(),
        selectedDate: null,
        filterDoctor: '',
        filterSpecialty: ''
    },

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        this.loadData();
        this.loadFilters();
        this.renderCalendar();
        console.log('Módulo de Agenda inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        const newAppointmentBtn = document.getElementById('addAppointmentBtn');
        if (newAppointmentBtn) {
            newAppointmentBtn.addEventListener('click', () => this.openAppointmentModal());
        }

        const prevMonthBtn = document.getElementById('prevMonthBtn');
        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => this.previousMonth());
        }

        const nextMonthBtn = document.getElementById('nextMonthBtn');
        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => this.nextMonth());
        }

        const doctorFilter = document.getElementById('doctorFilter');
        if (doctorFilter) {
            doctorFilter.addEventListener('change', (e) => {
                this.state.filterDoctor = e.target.value;
                this.renderCalendar();
            });
        }

        const specialtyFilter = document.getElementById('specialtyFilter');
        if (specialtyFilter) {
            specialtyFilter.addEventListener('change', (e) => {
                this.state.filterSpecialty = e.target.value;
                this.renderCalendar();
            });
        }
    },

    // Cargar datos
    loadData() {
        this.state.doctores = [
            { id: 1, nombre: 'Dr. Juan García', especialidad: 'Cardiología', horarioInicio: '08:00', horarioFin: '17:00' },
            { id: 2, nombre: 'Dra. María López', especialidad: 'Dermatología', horarioInicio: '09:00', horarioFin: '18:00' },
            { id: 3, nombre: 'Dr. Roberto Martínez', especialidad: 'Neurología', horarioInicio: '08:30', horarioFin: '16:30' }
        ];

        this.state.especialidades = [
            { id: 1, nombre: 'Cardiología', icon: 'fa-heart' },
            { id: 2, nombre: 'Dermatología', icon: 'fa-spa' },
            { id: 3, nombre: 'Neurología', icon: 'fa-brain' },
            { id: 4, nombre: 'Pediatría', icon: 'fa-child' },
            { id: 5, nombre: 'Oftalmología', icon: 'fa-eye' }
        ];

        this.state.citas = [
            {
                id: 'CIT-001',
                paciente: 'Juan Pérez',
                doctor: 'Dr. Juan García',
                especialidad: 'Cardiología',
                fecha: '2026-05-10',
                hora: '10:00',
                estado: 'Confirmada',
                email: 'juan@example.com',
                telefono: '584121234567'
            },
            {
                id: 'CIT-002',
                paciente: 'María García',
                doctor: 'Dra. María López',
                especialidad: 'Dermatología',
                fecha: '2026-05-10',
                hora: '14:30',
                estado: 'Pendiente',
                email: 'maria@example.com',
                telefono: '584125678901'
            }
        ];
    },

    // Cargar filtros
    loadFilters() {
        const doctorSelect = document.getElementById('doctorFilter');
        if (doctorSelect) {
            doctorSelect.innerHTML = '<option value="">Todos los doctores</option>' +
                this.state.doctores.map(d => `<option value="${d.nombre}">${d.nombre}</option>`).join('');
        }

        const specialtySelect = document.getElementById('specialtyFilter');
        if (specialtySelect) {
            specialtySelect.innerHTML = '<option value="">Todas las especialidades</option>' +
                this.state.especialidades.map(e => `<option value="${e.nombre}">${e.nombre}</option>`).join('');
        }
    },

    // Renderizar calendario
    renderCalendar() {
        const year = this.state.currentDate.getFullYear();
        const month = this.state.currentDate.getMonth();

        // Actualizar título
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        document.getElementById('currentMonthYear').textContent = `${monthNames[month]} ${year}`;

        // Obtener primer día del mes y número de días
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const calendarDays = document.getElementById('calendarDays');
        calendarDays.innerHTML = '';

        // Agregar días del mes anterior
        for (let i = (firstDay === 0 ? 6 : firstDay - 1); i > 0; i--) {
            const day = daysInPrevMonth - i + 1;
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day other-month';
            dayDiv.textContent = day;
            calendarDays.appendChild(dayDiv);
        }

        // Agregar días del mes actual
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = date.toISOString().split('T')[0];
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day current-month';

            // Agregar clase si es hoy
            if (date.toDateString() === today.toDateString()) {
                dayDiv.classList.add('today');
            }

            // Agregar clase si está seleccionado
            if (this.state.selectedDate === dateStr) {
                dayDiv.classList.add('selected');
            }

            // Contar citas para este día
            const appointments = this.getAppointmentsForDate(dateStr);
            if (appointments.length > 0) {
                dayDiv.classList.add('has-appointments');
            }

            dayDiv.innerHTML = `
                <div class="day-number">${day}</div>
                ${appointments.length > 0 ? `<div class="appointment-indicator">${appointments.length}</div>` : ''}
            `;

            dayDiv.addEventListener('click', () => {
                this.state.selectedDate = dateStr;
                this.renderCalendar();
                this.displayAppointmentsForDate(dateStr);
            });

            calendarDays.appendChild(dayDiv);
        }

        // Agregar días del próximo mes
        const remainingDays = 42 - (calendarDays.children.length);
        for (let day = 1; day <= remainingDays; day++) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day other-month';
            dayDiv.textContent = day;
            calendarDays.appendChild(dayDiv);
        }
    },

    // Obtener citas para una fecha específica
    getAppointmentsForDate(dateStr) {
        return this.state.citas.filter(cita => {
            const matchDate = cita.fecha === dateStr;
            const matchDoctor = !this.state.filterDoctor || cita.doctor === this.state.filterDoctor;
            const matchSpecialty = !this.state.filterSpecialty || cita.especialidad === this.state.filterSpecialty;
            return matchDate && matchDoctor && matchSpecialty && cita.estado !== 'Cancelada';
        });
    },

    // Mostrar citas del día seleccionado
    displayAppointmentsForDate(dateStr) {
        const appointments = this.getAppointmentsForDate(dateStr);
        const container = document.getElementById('selectedDayAppointments');
        
        if (!container) return;

        if (appointments.length === 0) {
            container.innerHTML = '<p class="empty-message">No hay citas para este día</p>';
            return;
        }

        container.innerHTML = `
            <div class="date-header">${new Date(dateStr).toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })}</div>
            ${appointments.map(apt => `
                <div class="appointment-card">
                    <div class="appointment-time">
                        <i class="fas fa-clock"></i> ${apt.hora}
                    </div>
                    <div class="appointment-details">
                        <p class="patient-name"><strong>${apt.paciente}</strong></p>
                        <p class="doctor-name">${apt.doctor}</p>
                        <p class="specialty">${apt.especialidad}</p>
                        <span class="badge badge-${apt.estado.toLowerCase()}">${apt.estado}</span>
                    </div>
                    <div class="appointment-actions">
                        <button class="btn-icon" onclick="AgendaModule.confirmAppointment('${apt.id}')" title="Confirmar">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-icon" onclick="AgendaModule.editAppointment('${apt.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="AgendaModule.cancelAppointment('${apt.id}')" title="Cancelar">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `).join('')}
        `;
    },

    // Mes anterior
    previousMonth() {
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() - 1);
        this.state.selectedDate = null;
        this.renderCalendar();
        document.getElementById('selectedDayAppointments').innerHTML = 
            '<p class="empty-message">Selecciona un día para ver las citas</p>';
    },

    // Mes siguiente
    nextMonth() {
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() + 1);
        this.state.selectedDate = null;
        this.renderCalendar();
        document.getElementById('selectedDayAppointments').innerHTML = 
            '<p class="empty-message">Selecciona un día para ver las citas</p>';
    },
    openAppointmentModal() {
        const modal = document.getElementById('appointmentModal');
        if (modal) {
            modal.style.display = 'block';
            this.loadDoctorSelect();
        }
    },

    // Cargar doctores en el select
    loadDoctorSelect() {
        const select = document.getElementById('appointmentDoctor');
        if (!select) return;

        select.innerHTML = '<option value="">Selecciona un doctor...</option>' +
            this.state.doctores.map(d => `<option value="${d.id}">${d.nombre} - ${d.especialidad}</option>`).join('');
    },

    // Guardar nueva cita
    saveAppointment() {
        const patientName = document.getElementById('patientName')?.value;
        const doctorId = document.getElementById('appointmentDoctor')?.value;
        const appointmentDate = document.getElementById('appointmentDate')?.value;
        const appointmentTime = document.getElementById('appointmentTime')?.value;
        const email = document.getElementById('patientEmail')?.value;
        const phone = document.getElementById('patientPhone')?.value;

        if (!patientName || !doctorId || !appointmentDate || !appointmentTime) {
            alert('Por favor, completa todos los campos obligatorios');
            return;
        }

        const doctor = this.state.doctores.find(d => d.id == doctorId);
        if (!doctor) {
            alert('Doctor no válido');
            return;
        }

        const newAppointment = {
            id: `CIT-${Date.now()}`,
            paciente: patientName,
            doctor: doctor.nombre,
            especialidad: doctor.especialidad,
            fecha: appointmentDate,
            hora: appointmentTime,
            estado: 'Pendiente',
            email: email,
            telefono: phone
        };

        this.state.citas.push(newAppointment);
        this.renderCalendar();

        const modal = document.getElementById('appointmentModal');
        if (modal) {
            modal.style.display = 'none';
        }

        alert('Cita agendada correctamente. Se enviará confirmación al paciente.');
        this.sendConfirmationEmail(newAppointment);
    },

    // Confirmar cita
    confirmAppointment(appointmentId) {
        const appointment = this.state.citas.find(c => c.id === appointmentId);
        if (appointment) {
            appointment.estado = 'Confirmada';
            this.renderCalendar();
            if (this.state.selectedDate) {
                this.displayAppointmentsForDate(this.state.selectedDate);
            }
            this.sendConfirmationEmail(appointment);
            alert(`Cita confirmada para ${appointment.paciente}`);
        }
    },

    // Editar cita
    editAppointment(appointmentId) {
        const appointment = this.state.citas.find(c => c.id === appointmentId);
        if (appointment) {
            console.log('Editando cita:', appointment);
            alert(`Editando cita de ${appointment.paciente}`);
        }
    },

    // Cancelar cita
    cancelAppointment(appointmentId) {
        if (confirm('¿Estás seguro de que deseas cancelar esta cita?')) {
            const appointment = this.state.citas.find(c => c.id === appointmentId);
            if (appointment) {
                appointment.estado = 'Cancelada';
                this.renderCalendar();
                if (this.state.selectedDate) {
                    this.displayAppointmentsForDate(this.state.selectedDate);
                }
                alert(`Cita cancelada para ${appointment.paciente}`);
            }
        }
    },

    // Enviar email de confirmación
    sendConfirmationEmail(appointment) {
        console.log(`Enviando confirmación a ${appointment.email}:`, appointment);
        // Integración con servicio de email
    },

    // Obtener citas del día
    getTodayAppointments() {
        const today = new Date().toISOString().split('T')[0];
        return this.state.citas.filter(c => c.fecha === today && c.estado !== 'Cancelada');
    }
};
