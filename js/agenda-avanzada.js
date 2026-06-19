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
        
        // Búsqueda de pacientes en modal
        const patientSearch = document.getElementById('patientSearch');
        if (patientSearch) {
            patientSearch.addEventListener('input', (e) => this.handlePatientSearch(e.target.value));
            patientSearch.addEventListener('blur', () => {
                setTimeout(() => {
                    const suggestions = document.getElementById('patientSuggestions');
                    if (suggestions) suggestions.style.display = 'none';
                }, 200);
            });
        }
        
        // Botón crear paciente rápido
        const createPatientBtn = document.getElementById('createPatientQuickBtn');
        if (createPatientBtn) {
            createPatientBtn.addEventListener('click', () => this.createPatientQuick());
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
            { id: 1, nombre: 'Psiquiatría General', icon: 'fa-brain', color: '#8E44AD', bgColor: '#EBD6F7' },
            { id: 2, nombre: 'Psiquiatría Infantil', icon: 'fa-child', color: '#3498DB', bgColor: '#D6EAF8' },
            { id: 3, nombre: 'Psicología Clínica', icon: 'fa-couch', color: '#E74C3C', bgColor: '#FADBD8' },
            { id: 4, nombre: 'Terapia Cognitivo-Conductual', icon: 'fa-lightbulb', color: '#F39C12', bgColor: '#FCF3CF' },
            { id: 5, nombre: 'Adicciones y Rehabilitación', icon: 'fa-leaf', color: '#27AE60', bgColor: '#D5F4E6' },
            { id: 6, nombre: 'Psiquiatría Forense', icon: 'fa-gavel', color: '#34495E', bgColor: '#D7DBDD' }
        ];

        // Inicializar restricciones por defecto
        this.initDefaultRestricciones();
    },

    // Doctores por defecto
    loadDefaultDoctores() {
        this.state.doctores = [
            {
                id: 'DOC-001',
                nombre: 'Dra. Carolina Mendoza',
                especialidad: 'Psiquiatría General',
                especialidadId: 1,
                email: 'carolina@clinic.com',
                telefono: '+584121234567',
                estado: 'activo',
                color: '#E91E63',
                bgColor: '#FCE4EC',
                condiciones: ['Depresión', 'Ansiedad', 'Trastornos del Sueño'],
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
                nombre: 'Dr. Luis Fernando Rodríguez',
                especialidad: 'Psiquiatría Infantil',
                especialidadId: 2,
                email: 'luis@clinic.com',
                telefono: '+584125678901',
                estado: 'activo',
                color: '#2196F3',
                bgColor: '#E3F2FD',
                condiciones: ['TDAH', 'Autismo', 'Problemas de Conducta'],
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
                nombre: 'Dra. Sofía García López',
                especialidad: 'Psicología Clínica',
                especialidadId: 3,
                email: 'sofia@clinic.com',
                telefono: '+584129876543',
                estado: 'activo',
                color: '#FF5722',
                bgColor: '#FFEBEE',
                condiciones: ['Terapia Individual', 'Trauma', 'Estrés Postraumático'],
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
            availableDoctors.map(d => {
                const bgColor = d.bgColor || '#f0f0f0';
                const color = d.color || '#666';
                return `<option value="${d.id}" style="background: ${bgColor}; color: ${color};">🟤 ${d.nombre}</option>`;
            }).join('');
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
                    const specialty = this.state.especialidades.find(e => e.id == apt.especialidadId);
                    const doctorColor = doctor?.color || '#666';
                    const doctorBgColor = doctor?.bgColor || '#f0f0f0';
                    const specialtyColor = specialty?.color || '#666';
                    const specialtyBgColor = specialty?.bgColor || '#f0f0f0';
                    
                    return `
                        <div class="appointment-card" style="border-left: 4px solid ${doctorColor}; background: linear-gradient(to right, ${doctorBgColor}, white);">
                            <div class="appointment-time" style="color: ${doctorColor}; font-weight: bold;">
                                <i class="fas fa-clock"></i> ${apt.hora}
                            </div>
                            <div class="appointment-details">
                                <p class="patient-name"><strong>${apt.paciente}</strong></p>
                                <p class="doctor-name" style="color: ${doctorColor};"><i class="fas fa-user-md"></i> ${doctor?.nombre || 'Doctor'}</p>
                                <p class="specialty" style="background: ${specialtyBgColor}; color: ${specialtyColor}; padding: 4px 8px; border-radius: 3px; display: inline-block; font-size: 12px;">
                                    <i class="fas fa-stethoscope"></i> ${apt.especialidad}
                                </p>
                                ${apt.condiciones ? `<p class="conditions"><i class="fas fa-heart"></i> ${apt.condiciones}</p>` : ''}
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
            document.getElementById('patientSearch').value = '';
            document.getElementById('patientId').value = '';
            document.getElementById('patientName').value = '';
            document.getElementById('patientEmail').value = '';
            document.getElementById('patientPhone').value = '';
            document.getElementById('appointmentSpecialty').value = '';
            document.getElementById('appointmentDoctor').value = '';
            document.getElementById('appointmentDate').value = '';
            document.getElementById('appointmentTime').value = '';
            document.getElementById('appointmentConditions').value = '';
            document.getElementById('appointmentNotes').value = '';
            document.getElementById('patientSuggestions').style.display = 'none';
        }
    },
    
    // Búsqueda de pacientes
    handlePatientSearch(searchTerm) {
        const suggestionsDiv = document.getElementById('patientSuggestions');
        if (!suggestionsDiv) return;
        
        if (!searchTerm.trim()) {
            suggestionsDiv.style.display = 'none';
            return;
        }
        
        // Obtener pacientes del módulo PacientesModule
        let pacientes = [];
        if (typeof PacientesModule !== 'undefined' && PacientesModule.state && PacientesModule.state.pacientes) {
            pacientes = PacientesModule.state.pacientes;
        }
        
        const filtered = pacientes.filter(p => 
            p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.cedula && p.cedula.includes(searchTerm)) ||
            (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase()))
        ).slice(0, 8);
        
        if (filtered.length === 0) {
            suggestionsDiv.innerHTML = '<div style="padding: 10px; color: #999;">No hay pacientes que coincidan</div>';
            suggestionsDiv.style.display = 'block';
            return;
        }
        
        suggestionsDiv.innerHTML = filtered.map(p => `
            <div style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; background: white;" onclick="AgendaAvanzadaModule.selectPatient('${p.id}', '${p.nombre.replace(/'/g, '\\'')}', '${(p.email || '').replace(/'/g, '\\'')}'​, '${(p.telefono || '').replace(/'/g, '\\'')}')" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
                <strong>${p.nombre}</strong>
                <div style="font-size: 12px; color: #666;">${p.cedula || 'Sin cédula'} | ${p.email || 'Sin email'}</div>
            </div>
        `).join('');
        
        suggestionsDiv.style.display = 'block';
    },
    
    // Seleccionar paciente
    selectPatient(patientId, nombre, email, telefono) {
        document.getElementById('patientSearch').value = nombre;
        document.getElementById('patientId').value = patientId;
        document.getElementById('patientName').value = nombre;
        document.getElementById('patientEmail').value = email;
        document.getElementById('patientPhone').value = telefono;
        document.getElementById('patientSuggestions').style.display = 'none';
    },
    
    // Crear paciente rápido
    createPatientQuick() {
        const searchTerm = document.getElementById('patientSearch').value.trim();
        if (!searchTerm) {
            alert('Por favor escribe el nombre del paciente');
            return;
        }
        
        const newPatientId = `PAC-${Date.now()}`;
        let nombre = searchTerm;
        let email = '';
        let telefono = '';
        
        // Llenar los campos
        this.selectPatient(newPatientId, nombre, email, telefono);
        
        alert(`✓ Paciente creado: ${nombre}\\n\\nPuedes completar más datos después de la consulta.`);
    },

    // Guardar cita
    saveAppointment() {
        const patientName = document.getElementById('patientName')?.value;
        const patientId = document.getElementById('patientId')?.value;
        const email = document.getElementById('patientEmail')?.value;
        const phone = document.getElementById('patientPhone')?.value;
        const specialtyId = document.getElementById('appointmentSpecialty')?.value;
        const doctorId = document.getElementById('appointmentDoctor')?.value;
        const dateStr = document.getElementById('appointmentDate')?.value;
        const time = document.getElementById('appointmentTime')?.value;
        const conditions = document.getElementById('appointmentConditions')?.value;
        const notes = document.getElementById('appointmentNotes')?.value;

        if (!patientName || !doctorId || !dateStr || !time || !conditions) {
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
            pacienteId: patientId,
            paciente: patientName,
            email: email,
            telefono: phone,
            doctorId: doctorId,
            doctorNombre: doctor?.nombre,
            doctorColor: doctor?.color,
            doctorBgColor: doctor?.bgColor,
            especialidad: specialty?.nombre,
            especialidadId: specialtyId,
            especialidadColor: specialty?.color,
            especialidadBgColor: specialty?.bgColor,
            fecha: dateStr,
            hora: time,
            condiciones: conditions,
            notas: notes,
            estado: 'Pendiente',
            fechaCreacion: new Date().toISOString()
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
                ${this.state.doctores.map(doc => {
                    const bgColor = doc.bgColor || '#f0f0f0';
                    const color = doc.color || '#666';
                    return `
                    <div class="doctor-card" style="border-left: 4px solid ${color}; background: linear-gradient(to right, ${bgColor}, white); padding: 15px; border-radius: 5px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div>
                                <h4 style="color: ${color}; margin: 0 0 8px 0;">${doc.nombre}</h4>
                                <p style="margin: 5px 0; font-size: 13px; color: ${color}; font-weight: bold;">
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
                                        <strong>Especialidades:</strong> ${doc.condiciones.join(', ')}
                                    </p>
                                ` : ''}
                                <span class="badge" style="background: ${color}; color: white; padding: 4px 8px; border-radius: 3px; margin-top: 8px; display: inline-block;">
                                    ${doc.estado === 'activo' ? '✓ Activo' : '✗ Inactivo'}
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
                `;
                }).join('')}
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
