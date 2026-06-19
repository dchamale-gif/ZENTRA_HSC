// ============================================
// MÓDULO DE AGENDA AVANZADA CON RESTRICCIONES
// ============================================

const AgendaAvanzadaModule = {
    state: {
        citas: [],
        doctores: [],
        especialidades: [],
        bloqueoPersonal: [], // Vacaciones, permisos, etc.
        horariosDoctores: {}, // { doctorId: { lunes: ['08:00-17:00'], ... } }
        restriccionesDoctor: {}, // { doctorId: { duracionCita: 30, maxPacientePorDia: 8, ... } }
        condicionesDoctor: [], // Condiciones médicas, especialidades secundarias
        horariosDisponibles: {}, // Cache de horas disponibles por doctor/fecha
        currentDate: new Date(),
        selectedDate: null,
        filterDoctor: '',
        filterSpecialty: ''
    },

    // Inicializar
    init() {
        this.setupEventListeners();
        this.loadData();
        this.loadFilters();
        this.renderCalendar();
        console.log('✓ Módulo de Agenda Avanzada inicializado');
    },

    // Event listeners
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

        // Cuando cambia la especialidad en el formulario, actualizar doctores
        const appointmentSpecialty = document.getElementById('appointmentSpecialty');
        if (appointmentSpecialty) {
            appointmentSpecialty.addEventListener('change', () => {
                this.updateDoctorsBySpecialty();
            });
        }

        // Cuando cambia el doctor, actualizar horas disponibles
        const appointmentDoctor = document.getElementById('appointmentDoctor');
        if (appointmentDoctor) {
            appointmentDoctor.addEventListener('change', () => {
                this.updateAvailableHours();
            });
        }

        // Cuando cambia la fecha, actualizar horas disponibles
        const appointmentDate = document.getElementById('appointmentDate');
        if (appointmentDate) {
            appointmentDate.addEventListener('change', () => {
                this.updateAvailableHours();
            });
        }
    },

    // Cargar datos iniciales
    loadData() {
        // Cargar de localStorage o usar datos por defecto
        const savedDoctores = localStorage.getItem('agendaDoctores');
        const savedBloqueos = localStorage.getItem('agendaBloqueos');
        const savedRestricciones = localStorage.getItem('agendaRestricciones');
        const savedCitas = localStorage.getItem('agendaCitas');

        if (savedDoctores) {
            this.state.doctores = JSON.parse(savedDoctores);
        } else {
            this.loadDefaultDoctores();
        }

        if (savedBloqueos) {
            this.state.bloqueoPersonal = JSON.parse(savedBloqueos);
        }

        if (savedRestricciones) {
            this.state.restriccionesDoctor = JSON.parse(savedRestricciones);
        }

        if (savedCitas) {
            this.state.citas = JSON.parse(savedCitas);
        }

        this.state.especialidades = [
            { id: 1, nombre: 'Cardiología', icon: 'fa-heart' },
            { id: 2, nombre: 'Dermatología', icon: 'fa-spa' },
            { id: 3, nombre: 'Neurología', icon: 'fa-brain' },
            { id: 4, nombre: 'Pediatría', icon: 'fa-child' },
            { id: 5, nombre: 'Oftalmología', icon: 'fa-eye' },
            { id: 6, nombre: 'Ginecología', icon: 'fa-female' },
            { id: 7, nombre: 'Urología', icon: 'fa-tint' },
            { id: 8, nombre: 'General', icon: 'fa-stethoscope' }
        ];

        // Inicializar restricciones por defecto
        this.initDefaultRestricciones();
    },

    // Doctores por defecto
    loadDefaultDoctores() {
        this.state.doctores = [
            {
                id: 'DOC-001',
                nombre: 'Dr. Juan García',
                especialidad: 'Cardiología',
                email: 'juan@clinic.com',
                telefono: '+584121234567',
                estado: 'activo',
                condiciones: ['Hipertensión', 'Arritmias'],
                horariosLaborales: {
                    'lunes': { inicio: '08:00', fin: '17:00' },
                    'martes': { inicio: '08:00', fin: '17:00' },
                    'miercoles': { inicio: '08:00', fin: '17:00' },
                    'jueves': { inicio: '08:00', fin: '17:00' },
                    'viernes': { inicio: '08:00', fin: '17:00' },
                    'sabado': { inicio: '09:00', fin: '13:00' },
                    'domingo': { inicio: null, fin: null }
                }
            },
            {
                id: 'DOC-002',
                nombre: 'Dra. María López',
                especialidad: 'Dermatología',
                email: 'maria@clinic.com',
                telefono: '+584125678901',
                estado: 'activo',
                condiciones: ['Dermatitis', 'Psoriasis', 'Acné'],
                horariosLaborales: {
                    'lunes': { inicio: '09:00', fin: '18:00' },
                    'martes': { inicio: '09:00', fin: '18:00' },
                    'miercoles': { inicio: '09:00', fin: '18:00' },
                    'jueves': { inicio: '09:00', fin: '18:00' },
                    'viernes': { inicio: '09:00', fin: '18:00' },
                    'sabado': { inicio: null, fin: null },
                    'domingo': { inicio: null, fin: null }
                }
            },
            {
                id: 'DOC-003',
                nombre: 'Dr. Roberto Martínez',
                especialidad: 'Neurología',
                email: 'roberto@clinic.com',
                telefono: '+584129876543',
                estado: 'activo',
                condiciones: ['Migrañas', 'Epilepsia', 'Parkinson'],
                horariosLaborales: {
                    'lunes': { inicio: '08:30', fin: '16:30' },
                    'martes': { inicio: '08:30', fin: '16:30' },
                    'miercoles': { inicio: '08:30', fin: '16:30' },
                    'jueves': { inicio: '08:30', fin: '16:30' },
                    'viernes': { inicio: '08:30', fin: '16:30' },
                    'sabado': { inicio: null, fin: null },
                    'domingo': { inicio: null, fin: null }
                }
            }
        ];
    },

    // Inicializar restricciones por defecto
    initDefaultRestricciones() {
        this.state.doctores.forEach(doc => {
            if (!this.state.restriccionesDoctor[doc.id]) {
                this.state.restriccionesDoctor[doc.id] = {
                    duracionCitaMinutos: 30,
                    maxPacientesPorDia: 8,
                    tiempoEntreRecitasMinutos: 10,
                    permitirTraslapoPaciente: false,
                    diasAnticipacionMínima: 0
                };
            }
        });
    },

    // Cargar filtros
    loadFilters() {
        const doctorSelect = document.getElementById('doctorFilter');
        if (doctorSelect) {
            doctorSelect.innerHTML = '<option value="">Todos los doctores</option>' +
                this.state.doctores
                    .filter(d => d.estado === 'activo')
                    .map(d => `<option value="${d.id}">${d.nombre}</option>`)
                    .join('');
        }

        const specialtySelect = document.getElementById('specialtyFilter');
        if (specialtySelect) {
            specialtySelect.innerHTML = '<option value="">Todas las especialidades</option>' +
                this.state.especialidades.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
        }

        // Cargar doctores en modal
        const appointmentSpecialty = document.getElementById('appointmentSpecialty');
        if (appointmentSpecialty) {
            appointmentSpecialty.innerHTML = '<option value="">Selecciona especialidad...</option>' +
                this.state.especialidades.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
        }
    },

    // Actualizar doctores según especialidad seleccionada
    updateDoctorsBySpecialty() {
        const specialtySelect = document.getElementById('appointmentSpecialty');
        const doctorSelect = document.getElementById('appointmentDoctor');

        if (!specialtySelect || !doctorSelect) return;

        const selectedSpecialty = specialtySelect.value;
        const specialty = this.state.especialidades.find(e => e.id == selectedSpecialty);

        if (!specialty) {
            doctorSelect.innerHTML = '<option value="">Selecciona especialidad primero...</option>';
            return;
        }

        const availableDoctors = this.state.doctores.filter(d =>
            d.estado === 'activo' && d.especialidad === specialty.nombre
        );

        if (availableDoctors.length === 0) {
            doctorSelect.innerHTML = '<option value="">No hay doctores disponibles</option>';
            return;
        }

        doctorSelect.innerHTML = '<option value="">Selecciona doctor...</option>' +
            availableDoctors.map(d => `<option value="${d.id}">${d.nombre}</option>`).join('');
    },

    // Actualizar horas disponibles
    updateAvailableHours() {
        const doctorSelect = document.getElementById('appointmentDoctor');
        const dateInput = document.getElementById('appointmentDate');
        const hoursSelect = document.getElementById('appointmentTime');

        if (!doctorSelect || !dateInput || !hoursSelect) return;

        const doctorId = doctorSelect.value;
        const dateStr = dateInput.value;

        if (!doctorId || !dateStr) {
            hoursSelect.innerHTML = '<option value="">Selecciona doctor y fecha...</option>';
            return;
        }

        const availableHours = this.getAvailableHours(doctorId, dateStr);

        if (availableHours.length === 0) {
            hoursSelect.innerHTML = '<option value="">No hay horas disponibles</option>';
            return;
        }

        hoursSelect.innerHTML = availableHours
            .map(hour => `<option value="${hour}">${hour}</option>`)
            .join('');
    },

    // Obtener horas disponibles para un doctor en una fecha
    getAvailableHours(doctorId, dateStr) {
        const doctor = this.state.doctores.find(d => d.id === doctorId);
        if (!doctor) return [];

        const date = new Date(dateStr);
        const dayName = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][date.getDay()];
        const horarios = doctor.horariosLaborales[dayName];

        // Si no trabaja ese día
        if (!horarios || !horarios.inicio) {
            return [];
        }

        // Verificar si hay bloqueo de personal
        const enBloqueo = this.state.bloqueoPersonal.some(bloqueo =>
            bloqueo.doctorId === doctorId &&
            this.isFechaEnRango(dateStr, bloqueo.fechaInicio, bloqueo.fechaFin)
        );

        if (enBloqueo) {
            return [];
        }

        const restricciones = this.state.restriccionesDoctor[doctorId];
        const duracion = restricciones?.duracionCitaMinutos || 30;

        // Generar horas disponibles
        const horas = [];
        const [startHour, startMin] = horarios.inicio.split(':').map(Number);
        const [endHour, endMin] = horarios.fin.split(':').map(Number);

        let currentTime = new Date();
        currentTime.setHours(startHour, startMin, 0, 0);
        const endTime = new Date();
        endTime.setHours(endHour, endMin, 0, 0);

        while (currentTime < endTime) {
            const timeStr = currentTime.toTimeString().substring(0, 5);
            const citaExistente = this.state.citas.some(cita =>
                cita.doctorId === doctorId &&
                cita.fecha === dateStr &&
                cita.hora === timeStr &&
                cita.estado !== 'Cancelada'
            );

            if (!citaExistente) {
                horas.push(timeStr);
            }

            currentTime.setMinutes(currentTime.getMinutes() + duracion);
        }

        return horas;
    },

    // Verificar si una fecha está en un rango
    isFechaEnRango(fecha, fechaInicio, fechaFin) {
        const f = new Date(fecha);
        const fi = new Date(fechaInicio);
        const ff = new Date(fechaFin);
        return f >= fi && f <= ff;
    },

    // Renderizar calendario
    renderCalendar() {
        const year = this.state.currentDate.getFullYear();
        const month = this.state.currentDate.getMonth();

        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const monthYearEl = document.getElementById('currentMonthYear');
        if (monthYearEl) {
            monthYearEl.textContent = `${monthNames[month]} ${year}`;
        }

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const calendarDays = document.getElementById('calendarDays');
        if (!calendarDays) return;
        calendarDays.innerHTML = '';

        // Días del mes anterior
        for (let i = (firstDay === 0 ? 6 : firstDay - 1); i > 0; i--) {
            const day = daysInPrevMonth - i + 1;
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day other-month';
            dayDiv.textContent = day;
            calendarDays.appendChild(dayDiv);
        }

        // Días del mes actual
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = date.toISOString().split('T')[0];
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day current-month';

            if (date.toDateString() === today.toDateString()) {
                dayDiv.classList.add('today');
            }

            if (this.state.selectedDate === dateStr) {
                dayDiv.classList.add('selected');
            }

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

        // Días del próximo mes
        const remainingDays = 42 - (calendarDays.children.length);
        for (let day = 1; day <= remainingDays; day++) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day other-month';
            dayDiv.textContent = day;
            calendarDays.appendChild(dayDiv);
        }
    },

    // Obtener citas para una fecha
    getAppointmentsForDate(dateStr) {
        return this.state.citas.filter(cita => {
            const matchDate = cita.fecha === dateStr;
            const matchDoctor = !this.state.filterDoctor || cita.doctorId === this.state.filterDoctor;
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
            ${appointments
                .sort((a, b) => a.hora.localeCompare(b.hora))
                .map(apt => {
                    const doctor = this.state.doctores.find(d => d.id === apt.doctorId);
                    return `
                        <div class="appointment-card">
                            <div class="appointment-time">
                                <i class="fas fa-clock"></i> ${apt.hora}
                            </div>
                            <div class="appointment-details">
                                <p class="patient-name"><strong>${apt.paciente}</strong></p>
                                <p class="doctor-name">${doctor?.nombre || 'Doctor'}</p>
                                <p class="specialty">${apt.especialidad}</p>
                                ${apt.condiciones ? `<p class="conditions"><i class="fas fa-stethoscope"></i> ${apt.condiciones}</p>` : ''}
                                <span class="badge badge-${apt.estado.toLowerCase()}">${apt.estado}</span>
                            </div>
                            <div class="appointment-actions">
                                <button class="btn-icon" onclick="AgendaAvanzadaModule.confirmAppointment('${apt.id}')" title="Confirmar">
                                    <i class="fas fa-check"></i>
                                </button>
                                <button class="btn-icon" onclick="AgendaAvanzadaModule.editAppointment('${apt.id}')" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-icon" onclick="AgendaAvanzadaModule.cancelAppointment('${apt.id}')" title="Cancelar">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
        `;
    },

    // Navegar meses
    previousMonth() {
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() - 1);
        this.state.selectedDate = null;
        this.renderCalendar();
        const container = document.getElementById('selectedDayAppointments');
        if (container) {
            container.innerHTML = '<p class="empty-message">Selecciona un día para ver las citas</p>';
        }
    },

    nextMonth() {
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() + 1);
        this.state.selectedDate = null;
        this.renderCalendar();
        const container = document.getElementById('selectedDayAppointments');
        if (container) {
            container.innerHTML = '<p class="empty-message">Selecciona un día para ver las citas</p>';
        }
    },

    // Abrir modal de nueva cita
    openAppointmentModal() {
        const modal = document.getElementById('appointmentModal');
        if (modal) {
            modal.style.display = 'block';
            document.getElementById('patientName').value = '';
            document.getElementById('patientEmail').value = '';
            document.getElementById('patientPhone').value = '';
            document.getElementById('appointmentSpecialty').value = '';
            document.getElementById('appointmentDoctor').value = '';
            document.getElementById('appointmentDate').value = '';
            document.getElementById('appointmentTime').value = '';
            document.getElementById('appointmentConditions').value = '';
            document.getElementById('appointmentNotes').value = '';
        }
    },

    // Guardar cita
    saveAppointment() {
        const patientName = document.getElementById('patientName')?.value;
        const email = document.getElementById('patientEmail')?.value;
        const phone = document.getElementById('patientPhone')?.value;
        const specialtyId = document.getElementById('appointmentSpecialty')?.value;
        const doctorId = document.getElementById('appointmentDoctor')?.value;
        const dateStr = document.getElementById('appointmentDate')?.value;
        const time = document.getElementById('appointmentTime')?.value;
        const conditions = document.getElementById('appointmentConditions')?.value;
        const notes = document.getElementById('appointmentNotes')?.value;

        if (!patientName || !doctorId || !dateStr || !time) {
            alert('Por favor completa todos los campos obligatorios');
            return;
        }

        // Validar disponibilidad
        const citaExistente = this.state.citas.some(c =>
            c.doctorId === doctorId &&
            c.fecha === dateStr &&
            c.hora === time &&
            c.estado !== 'Cancelada'
        );

        if (citaExistente) {
            alert('Esa hora ya está ocupada');
            return;
        }

        const doctor = this.state.doctores.find(d => d.id === doctorId);
        const specialty = this.state.especialidades.find(e => e.id == specialtyId);

        const newAppointment = {
            id: `CIT-${Date.now()}`,
            paciente: patientName,
            email: email,
            telefono: phone,
            doctorId: doctorId,
            doctorNombre: doctor?.nombre,
            especialidad: specialty?.nombre,
            especialidadId: specialtyId,
            fecha: dateStr,
            hora: time,
            condiciones: conditions,
            notas: notes,
            estado: 'Pendiente',
            fechaCreacion: new Date().toISOString(),
            pacienteId: null // Se puede integrar con módulo de pacientes
        };

        this.state.citas.push(newAppointment);
        this.saveCitasToStorage();
        this.renderCalendar();

        const modal = document.getElementById('appointmentModal');
        if (modal) {
            modal.style.display = 'none';
        }

        alert('✓ Cita agendada correctamente para ' + patientName);
        this.sendConfirmationEmail(newAppointment);
    },

    // Confirmar cita
    confirmAppointment(appointmentId) {
        const appointment = this.state.citas.find(c => c.id === appointmentId);
        if (appointment) {
            appointment.estado = 'Confirmada';
            appointment.fechaConfirmacion = new Date().toISOString();
            this.saveCitasToStorage();
            this.renderCalendar();
            if (this.state.selectedDate) {
                this.displayAppointmentsForDate(this.state.selectedDate);
            }
            alert('✓ Cita confirmada para ' + appointment.paciente);
        }
    },

    // Editar cita
    editAppointment(appointmentId) {
        const appointment = this.state.citas.find(c => c.id === appointmentId);
        if (appointment) {
            console.log('Editando cita:', appointment);
            alert('Funcionalidad de edición en desarrollo');
        }
    },

    // Cancelar cita
    cancelAppointment(appointmentId) {
        if (confirm('¿Estás seguro de cancelar esta cita?')) {
            const appointment = this.state.citas.find(c => c.id === appointmentId);
            if (appointment) {
                appointment.estado = 'Cancelada';
                appointment.fechaCancelacion = new Date().toISOString();
                this.saveCitasToStorage();
                this.renderCalendar();
                if (this.state.selectedDate) {
                    this.displayAppointmentsForDate(this.state.selectedDate);
                }
                alert('✓ Cita cancelada');
            }
        }
    },

    // Agregar bloqueo de personal
    addBloqueoPersonal(doctorId, fechaInicio, fechaFin, motivo) {
        const bloqueo = {
            id: `BLOQUEO-${Date.now()}`,
            doctorId: doctorId,
            fechaInicio: fechaInicio,
            fechaFin: fechaFin,
            motivo: motivo,
            fechaCreacion: new Date().toISOString()
        };

        this.state.bloqueoPersonal.push(bloqueo);
        this.saveBloqueoToStorage();
        return bloqueo;
    },

    // Guardar a localStorage
    saveCitasToStorage() {
        localStorage.setItem('agendaCitas', JSON.stringify(this.state.citas));
    },

    saveBloqueoToStorage() {
        localStorage.setItem('agendaBloqueos', JSON.stringify(this.state.bloqueoPersonal));
    },

    saveDoctorestoStorage() {
        localStorage.setItem('agendaDoctores', JSON.stringify(this.state.doctores));
    },

    saveRestriccionestoStorage() {
        localStorage.setItem('agendaRestricciones', JSON.stringify(this.state.restriccionesDoctor));
    },

    // Enviar email de confirmación
    sendConfirmationEmail(appointment) {
        console.log(`📧 Confirmación para ${appointment.email}:`, appointment);
    },

    // Obtener citas del día
    getTodayAppointments() {
        const today = new Date().toISOString().split('T')[0];
        return this.state.citas.filter(c => c.fecha === today && c.estado !== 'Cancelada');
    },

    // ========== MÉTODOS DE ADMINISTRACIÓN ==========

    // Abrir panel de administración
    openManagementPanel() {
        const modal = document.getElementById('agendaManagementModal');
        if (modal) {
            modal.style.display = 'block';
            this.renderDoctoresList();
            this.renderBloqueosList();
            this.loadRestrictionDoctors();
            this.loadBloqueoDoctors();
        }
    },

    // Mostrar/ocultar tabs de administración
    showManagementTab(tabName) {
        // Ocultar todos
        document.getElementById('mgmt-doctores').style.display = 'none';
        document.getElementById('mgmt-restricciones').style.display = 'none';
        document.getElementById('mgmt-bloqueos').style.display = 'none';

        // Mostrar seleccionado
        document.getElementById('mgmt-' + tabName).style.display = 'block';

        // Actualizar botones
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        event.target.closest('.tab-btn').classList.add('active');
    },

    // ========== GESTIÓN DE DOCTORES ==========

    renderDoctoresList() {
        const container = document.getElementById('doctoresList');
        if (!container) return;

        if (this.state.doctores.length === 0) {
            container.innerHTML = '<p class="empty-message">No hay doctores registrados</p>';
            return;
        }

        container.innerHTML = `
            <div class="doctors-grid">
                ${this.state.doctores.map(doc => `
                    <div class="doctor-card" style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div>
                                <h4>${doc.nombre}</h4>
                                <p style="margin: 5px 0; font-size: 13px; color: #666;">
                                    <i class="fas fa-stethoscope"></i> ${doc.especialidad}
                                </p>
                                <p style="margin: 5px 0; font-size: 13px;">
                                    <i class="fas fa-envelope"></i> ${doc.email}
                                </p>
                                <p style="margin: 5px 0; font-size: 13px;">
                                    <i class="fas fa-phone"></i> ${doc.telefono}
                                </p>
                                ${doc.condiciones && doc.condiciones.length > 0 ? `
                                    <p style="margin: 8px 0; font-size: 12px;">
                                        <strong>Condiciones:</strong> ${doc.condiciones.join(', ')}
                                    </p>
                                ` : ''}
                                <span class="badge badge-${doc.estado === 'activo' ? 'success' : 'danger'}" style="margin-top: 8px;">
                                    ${doc.estado === 'activo' ? 'Activo' : 'Inactivo'}
                                </span>
                            </div>
                            <div>
                                <button class="btn btn-sm btn-info" onclick="AgendaAvanzadaModule.editDoctorForm('${doc.id}')" style="display: block; margin-bottom: 5px;">
                                    <i class="fas fa-edit"></i> Editar
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="AgendaAvanzadaModule.removeDoctor('${doc.id}')">
                                    <i class="fas fa-trash"></i> Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    openAddDoctorForm() {
        document.getElementById('doctorName').value = '';
        document.getElementById('doctorSpecialty').value = '';
        document.getElementById('doctorEmail').value = '';
        document.getElementById('doctorPhone').value = '';
        document.getElementById('doctorActive').checked = true;

        this.renderDoctorConditionsCheckboxes();
        this.renderDoctorScheduleForm();

        const modal = document.getElementById('doctorModal');
        if (modal) {
            modal.style.display = 'block';
        }
    },

    editDoctorForm(doctorId) {
        const doctor = this.state.doctores.find(d => d.id === doctorId);
        if (!doctor) return;

        document.getElementById('doctorName').value = doctor.nombre;
        document.getElementById('doctorSpecialty').value = doctor.especialidad;
        document.getElementById('doctorEmail').value = doctor.email;
        document.getElementById('doctorPhone').value = doctor.telefono;
        document.getElementById('doctorActive').checked = doctor.estado === 'activo';

        this.renderDoctorConditionsCheckboxes(doctor.condiciones || []);
        this.renderDoctorScheduleForm(doctor.horariosLaborales);

        const modal = document.getElementById('doctorModal');
        if (modal) {
            modal.style.display = 'block';
            modal.dataset.doctorId = doctorId;
        }
    },

    renderDoctorConditionsCheckboxes(selectedConditions = []) {
        const container = document.getElementById('doctorConditions');
        if (!container) return;

        const allConditions = [
            'Hipertensión', 'Arritmias', 'Dermatitis', 'Psoriasis', 'Acné',
            'Migrañas', 'Epilepsia', 'Parkinson', 'Diabetes', 'Asma',
            'Alergias', 'Gastritis', 'Colesterol', 'Anemia', 'Artritis'
        ];

        container.innerHTML = allConditions.map(condition => `
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" value="${condition}" ${selectedConditions.includes(condition) ? 'checked' : ''} class="doctor-condition-checkbox">
                <span>${condition}</span>
            </label>
        `).join('');
    },

    renderDoctorScheduleForm(horarios = null) {
        const container = document.getElementById('doctorSchedule');
        if (!container) return;

        const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
        const horariosDefault = {
            'lunes': { inicio: '08:00', fin: '17:00' },
            'martes': { inicio: '08:00', fin: '17:00' },
            'miercoles': { inicio: '08:00', fin: '17:00' },
            'jueves': { inicio: '08:00', fin: '17:00' },
            'viernes': { inicio: '08:00', fin: '17:00' },
            'sabado': { inicio: '09:00', fin: '13:00' },
            'domingo': { inicio: null, fin: null }
        };

        const horariosActuales = horarios || horariosDefault;

        container.innerHTML = dias.map(dia => {
            const inicio = horariosActuales[dia]?.inicio || '';
            const fin = horariosActuales[dia]?.fin || '';

            return `
                <div style="display: grid; grid-template-columns: 100px 1fr 1fr 1fr; gap: 10px; align-items: center; padding: 10px; background: #f9f9f9; border-radius: 3px;">
                    <strong style="text-transform: capitalize;">${dia}</strong>
                    <label style="font-size: 12px;">Inicio</label>
                    <input type="time" value="${inicio}" class="form-input schedule-start-${dia}" style="padding: 5px;">
                    <input type="time" value="${fin}" class="form-input schedule-end-${dia}" style="padding: 5px;">
                </div>
            `;
        }).join('');
    },

    saveDoctorForm() {
        const name = document.getElementById('doctorName').value;
        const specialty = document.getElementById('doctorSpecialty').value;
        const email = document.getElementById('doctorEmail').value;
        const phone = document.getElementById('doctorPhone').value;
        const isActive = document.getElementById('doctorActive').checked;

        if (!name || !specialty || !email || !phone) {
            alert('Por favor completa los campos requeridos');
            return;
        }

        // Recopilar condiciones seleccionadas
        const selectedConditions = Array.from(document.querySelectorAll('.doctor-condition-checkbox:checked'))
            .map(cb => cb.value);

        // Recopilar horarios
        const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
        const horarios = {};
        dias.forEach(dia => {
            const inicio = document.querySelector(`.schedule-start-${dia}`)?.value;
            const fin = document.querySelector(`.schedule-end-${dia}`)?.value;
            horarios[dia] = {
                inicio: inicio || null,
                fin: fin || null
            };
        });

        const modal = document.getElementById('doctorModal');
        const doctorId = modal.dataset.doctorId;

        if (doctorId) {
            // Editar
            const doctor = this.state.doctores.find(d => d.id === doctorId);
            if (doctor) {
                doctor.nombre = name;
                doctor.especialidad = specialty;
                doctor.email = email;
                doctor.telefono = phone;
                doctor.condiciones = selectedConditions;
                doctor.horariosLaborales = horarios;
                doctor.estado = isActive ? 'activo' : 'inactivo';
            }
        } else {
            // Crear
            const newDoctor = {
                id: `DOC-${Date.now()}`,
                nombre: name,
                especialidad: specialty,
                email: email,
                telefono: phone,
                condiciones: selectedConditions,
                horariosLaborales: horarios,
                estado: isActive ? 'activo' : 'inactivo',
                fechaCreacion: new Date().toISOString()
            };
            this.state.doctores.push(newDoctor);
        }

        this.saveDoctorestoStorage();
        this.loadFilters();
        this.renderDoctoresList();

        if (modal) {
            modal.style.display = 'none';
            delete modal.dataset.doctorId;
        }

        alert('✓ Doctor guardado correctamente');
    },

    removeDoctor(doctorId) {
        if (confirm('¿Estás seguro de eliminar este doctor?')) {
            this.state.doctores = this.state.doctores.filter(d => d.id !== doctorId);
            this.saveDoctorestoStorage();
            this.renderDoctoresList();
            alert('✓ Doctor eliminado');
        }
    },

    // ========== GESTIÓN DE RESTRICCIONES ==========

    loadRestrictionDoctors() {
        const select = document.getElementById('restrictionDoctorSelect');
        if (!select) return;

        select.innerHTML = '<option value="">Selecciona doctor...</option>' +
            this.state.doctores.map(d => `<option value="${d.id}">${d.nombre}</option>`).join('');

        select.addEventListener('change', () => {
            const doctorId = select.value;
            if (doctorId) {
                this.showRestrictionForm(doctorId);
            } else {
                document.getElementById('restrictionForm').style.display = 'none';
            }
        });
    },

    showRestrictionForm(doctorId) {
        const restrictions = this.state.restriccionesDoctor[doctorId];
        if (!restrictions) return;

        document.getElementById('restrictionDuration').value = restrictions.duracionCitaMinutos || 30;
        document.getElementById('restrictionMaxPatients').value = restrictions.maxPacientesPorDia || 8;
        document.getElementById('restrictionBuffer').value = restrictions.tiempoEntreRecitasMinutos || 10;
        document.getElementById('restrictionOverlap').checked = restrictions.permitirTraslapoPaciente || false;

        document.getElementById('restrictionForm').style.display = 'block';
        document.getElementById('restrictionForm').dataset.doctorId = doctorId;
    },

    saveRestrictions() {
        const form = document.getElementById('restrictionForm');
        const doctorId = form.dataset.doctorId;

        if (!doctorId) {
            alert('Por favor selecciona un doctor');
            return;
        }

        this.state.restriccionesDoctor[doctorId] = {
            duracionCitaMinutos: parseInt(document.getElementById('restrictionDuration').value),
            maxPacientesPorDia: parseInt(document.getElementById('restrictionMaxPatients').value),
            tiempoEntreRecitasMinutos: parseInt(document.getElementById('restrictionBuffer').value),
            permitirTraslapoPaciente: document.getElementById('restrictionOverlap').checked,
            diasAnticipacionMínima: 0
        };

        this.saveRestriccionestoStorage();
        alert('✓ Restricciones guardadas');
    },

    // ========== GESTIÓN DE BLOQUEOS ==========

    loadBloqueoDoctors() {
        const select = document.getElementById('bloqueoDoctor');
        if (!select) return;

        select.innerHTML = '<option value="">Selecciona doctor...</option>' +
            this.state.doctores.map(d => `<option value="${d.id}">${d.nombre}</option>`).join('');
    },

    saveBloqueo() {
        const doctorId = document.getElementById('bloqueoDoctor').value;
        const motivo = document.getElementById('bloqueoMotivo').value;
        const fechaInicio = document.getElementById('bloqueoFechaInicio').value;
        const fechaFin = document.getElementById('bloqueoFechaFin').value;

        if (!doctorId || !motivo || !fechaInicio || !fechaFin) {
            alert('Por favor completa todos los campos');
            return;
        }

        if (new Date(fechaFin) < new Date(fechaInicio)) {
            alert('La fecha fin debe ser posterior a la fecha inicio');
            return;
        }

        this.addBloqueoPersonal(doctorId, fechaInicio, fechaFin, motivo);
        this.renderBloqueosList();

        document.getElementById('bloqueoDoctor').value = '';
        document.getElementById('bloqueoMotivo').value = '';
        document.getElementById('bloqueoFechaInicio').value = '';
        document.getElementById('bloqueoFechaFin').value = '';

        alert('✓ Bloqueo agregado');
    },

    renderBloqueosList() {
        const container = document.getElementById('bloqueosList');
        if (!container) return;

        if (this.state.bloqueoPersonal.length === 0) {
            container.innerHTML = '<p class="empty-message">No hay bloqueos registrados</p>';
            return;
        }

        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Doctor</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Motivo</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Desde</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Hasta</th>
                        <th style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.state.bloqueoPersonal.map(bloqueo => {
                        const doctor = this.state.doctores.find(d => d.id === bloqueo.doctorId);
                        return `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 10px;">${doctor?.nombre || 'Doctor'}</td>
                                <td style="padding: 10px;">${bloqueo.motivo}</td>
                                <td style="padding: 10px;">${bloqueo.fechaInicio}</td>
                                <td style="padding: 10px;">${bloqueo.fechaFin}</td>
                                <td style="padding: 10px; text-align: center;">
                                    <button class="btn btn-sm btn-danger" onclick="AgendaAvanzadaModule.removeBloqueo('${bloqueo.id}')" title="Eliminar">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    removeBloqueo(bloqueoId) {
        if (confirm('¿Estás seguro?')) {
            this.state.bloqueoPersonal = this.state.bloqueoPersonal.filter(b => b.id !== bloqueoId);
            this.saveBloqueoToStorage();
            this.renderBloqueosList();
            alert('✓ Bloqueo eliminado');
        }
    }
};
