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
        filterSpecialty: '',
        filterEstado: '',
        busqueda: '',
        busquedaPacienteCampo: 'todo'
    },

    DIAS_SEMANA: ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],

    // Colores asignados a cada doctor según su posición
    PALETA_DOCTORES: [
        ['#0f766e', '#e6f4f2'], ['#1d4ed8', '#e8efff'], ['#b45309', '#fff4e5'],
        ['#7c3aed', '#f1eafe'], ['#be123c', '#fdeaf0'], ['#0e7490', '#e6f3f7'],
        ['#15803d', '#e8f5ec'], ['#9333ea', '#f5ebfe'], ['#c2410c', '#fdeee6']
    ],

    // 'YYYY-MM-DD' como fecha local (new Date('YYYY-MM-DD') usa UTC y en
    // Guatemala, UTC-6, cae en el día anterior)
    parseFechaLocal(dateStr) {
        const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
        return new Date(y, m - 1, d);
    },

    diaSemana(dateStr) {
        return this.DIAS_SEMANA[this.parseFechaLocal(dateStr).getDay()];
    },

    fechaISO(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },

    escapeHTML(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    getApiBase() {
        const apiHost = (authManager?.apiBaseUrl || 'http://178.128.72.110:3011').replace(/\/$/, '');
        return apiHost.endsWith('/api') ? apiHost : `${apiHost}/api`;
    },

    getDoctor(doctorId) {
        return this.state.doctores.find(d => String(d.id) === String(doctorId));
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
                this.aplicarFiltros();
            });
        }

        const specialtyFilter = document.getElementById('specialtyFilter');
        if (specialtyFilter) {
            specialtyFilter.addEventListener('change', (e) => {
                this.state.filterSpecialty = e.target.value;
                this.loadDoctorFilter();
                this.aplicarFiltros();
            });
        }

        document.getElementById('estadoCitaFilter')?.addEventListener('change', (e) => {
            this.state.filterEstado = e.target.value;
            this.aplicarFiltros();
        });

        document.getElementById('agendaBusqueda')?.addEventListener('input', (e) => {
            this.state.busqueda = e.target.value;
            this.aplicarFiltros();
        });

        document.getElementById('agendaLimpiarFiltros')?.addEventListener('click', () => this.limpiarFiltros());

        document.getElementById('patientSearchField')?.addEventListener('change', (e) => {
            this.state.busquedaPacienteCampo = e.target.value;
            const term = document.getElementById('patientSearch')?.value || '';
            if (term.trim()) this.handlePatientSearch(term);
        });

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
                this.syncSpecialtyFromDoctor();
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
        const savedBloqueos = localStorage.getItem('agendaBloqueos');
        const savedRestricciones = localStorage.getItem('agendaRestricciones');
        const savedCitas = localStorage.getItem('agendaCitas');

        if (savedBloqueos) this.state.bloqueoPersonal = JSON.parse(savedBloqueos);
        if (savedRestricciones) this.state.restriccionesDoctor = JSON.parse(savedRestricciones);
        if (savedCitas) this.state.citas = JSON.parse(savedCitas);

        // Doctores y especialidades salen del módulo Personal Médico
        this.loadDoctoresDesdeStorage();
        this.initDefaultRestricciones();
        this.loadDoctoresReales().then(() => this.loadCitasFromAPI());
    },

    // Convierte un registro de Personal Médico al formato que usa la agenda
    mapPersonalADoctor(personal, index) {
        const [color, bgColor] = this.PALETA_DOCTORES[index % this.PALETA_DOCTORES.length];
        const dias = personal.dias_disponibles ?? personal.diasDisponibles ?? [];
        const inicio = String(personal.horario_inicio ?? personal.horarioInicio ?? '08:00').slice(0, 5);
        const fin = String(personal.horario_fin ?? personal.horarioFin ?? '16:00').slice(0, 5);
        const horariosLaborales = {};
        this.DIAS_SEMANA.forEach(dia => {
            horariosLaborales[dia] = dias.includes(dia) ? { inicio, fin } : { inicio: null, fin: null };
        });

        const nombre = [personal.nombre, personal.apellido_paterno ?? personal.apellidoPaterno, personal.apellido_materno ?? personal.apellidoMaterno]
            .filter(Boolean).join(' ');

        return {
            id: String(personal.id),
            nombre,
            especialidad: personal.especialidad || '',
            especialidadId: Number(personal.especialidad_id ?? personal.especialidadId) || 0,
            numeroColegiado: personal.numero_colegiado ?? personal.numeroColegiado ?? '',
            email: personal.email || '',
            telefono: personal.telefono || '',
            estado: personal.estado || 'activo',
            color,
            bgColor,
            horariosLaborales,
            horarioTexto: `${inicio}–${fin}`,
            diasTexto: dias.map(d => d.slice(0, 3)).join(', ')
        };
    },

    setDoctores(personal, especialidades = []) {
        this.state.doctores = personal.map((p, i) => this.mapPersonalADoctor(p, i));

        const porId = new Map();
        especialidades.forEach(e => porId.set(Number(e.id), e.nombre));
        // Incluir especialidades de los doctores aunque el catálogo no cargue
        this.state.doctores.forEach(d => {
            if (d.especialidadId && !porId.has(d.especialidadId)) porId.set(d.especialidadId, d.especialidad);
        });
        this.state.especialidades = [...porId.entries()]
            .map(([id, nombre]) => ({ id, nombre }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

        this.initDefaultRestricciones();
        this.loadFilters();
        this.renderCalendar();
    },

    // Respaldo: lo último que guardó el módulo Personal Médico en este navegador
    loadDoctoresDesdeStorage() {
        try {
            const personal = JSON.parse(localStorage.getItem('personalMedico') || '[]');
            this.setDoctores(Array.isArray(personal) ? personal : []);
        } catch (error) {
            this.setDoctores([]);
        }
    },

    async loadDoctoresReales() {
        const token = authManager?.getToken?.();
        if (!token) return;

        try {
            const headers = { Authorization: `Bearer ${token}` };
            const [personalRes, especialidadesRes] = await Promise.all([
                fetch(`${this.getApiBase()}/personal-medico`, { headers }),
                fetch(`${this.getApiBase()}/personal-medico/especialidades`, { headers })
            ]);
            if (!personalRes.ok) throw new Error(`Personal médico respondió ${personalRes.status}`);

            const personalData = await personalRes.json();
            const especialidadesData = especialidadesRes.ok ? await especialidadesRes.json() : {};
            this.setDoctores(personalData.personal || [], especialidadesData.especialidades || []);
        } catch (error) {
            console.warn('No se pudo cargar el personal médico; se usa el respaldo local:', error);
        }
    },

    // Cargar citas desde API
    async loadCitasFromAPI() {
        const token = authManager?.getToken?.();
        const apiHost = authManager?.apiBaseUrl || 'http://178.128.72.110:3011';
        const apiBase = apiHost.endsWith('/api') ? apiHost : `${apiHost}/api`;

        if (!token) {
            console.warn('No hay token, se conserva la agenda local');
            return;
        }

        try {
            const response = await fetch(`${apiBase}/appointments`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const result = await response.json();
            if (!response.ok || !result.success || !Array.isArray(result.data)) {
                throw new Error(result.error || result.message || 'Respuesta inválida de la API');
            }

            const localById = new Map(this.state.citas.map(cita => [String(cita.id), cita]));
            this.state.citas = result.data.map(cita => this.mapCitaFromAPI(cita, localById.get(String(cita.id))));
            this.saveCitasToStorage();
            this.renderCalendar();
        } catch (error) {
            console.warn('No se pudo cargar la agenda desde la API; se conserva el respaldo local:', error);
        }
    },

    mapCitaFromAPI(cita, local = {}) {
        const personalId = cita.personal_medico_id ?? cita.personalMedicoId;
        const userDoctorId = cita.doctor_id ?? cita.doctorId;
        // Citas antiguas (sin personal médico) quedan ligadas al usuario que las registró
        const doctorId = personalId ? String(personalId) : (userDoctorId ? `user-${userDoctorId}` : (local.doctorId || ''));
        const doctor = this.getDoctor(doctorId);
        const rawStatus = String(cita.estado || 'pendiente').toLowerCase();
        const statuses = {
            pendiente: 'Pendiente',
            confirmada: 'Confirmada',
            activo: 'Confirmada',
            cancelada: 'Cancelada'
        };
        const status = statuses[rawStatus] || 'Pendiente';

        return {
            ...local,
            id: cita.id,
            pacienteId: cita.paciente_id || cita.pacienteId,
            paciente: cita.paciente_nombre
                ? `${cita.paciente_nombre} ${cita.apellido_paterno || ''}`.trim()
                : (cita.pacienteNombre || local.paciente || 'Paciente'),
            email: cita.email || local.email || '',
            telefono: cita.telefono || local.telefono || '',
            doctorId,
            doctorNombre: cita.doctor_nombre || cita.doctorNombre || doctor?.nombre || local.doctorNombre,
            doctorColor: doctor?.color || local.doctorColor,
            doctorBgColor: doctor?.bgColor || local.doctorBgColor,
            especialidad: cita.especialidad || doctor?.especialidad || local.especialidad || 'Sin especialidad',
            especialidadId: Number(cita.especialidad_id) || doctor?.especialidadId || local.especialidadId || 0,
            fecha: String(cita.fecha).slice(0, 10),
            hora: String(cita.hora).slice(0, 5),
            condiciones: cita.diagnostico || local.condiciones || '',
            notas: cita.observaciones || local.notas || '',
            estado: status,
            confirmada: status === 'Confirmada'
        };
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

    // Opciones de doctor agrupadas por especialidad
    doctorOptionsHTML(doctores) {
        const grupos = new Map();
        doctores.forEach(d => {
            const clave = d.especialidad || 'Sin especialidad';
            if (!grupos.has(clave)) grupos.set(clave, []);
            grupos.get(clave).push(d);
        });
        return [...grupos.entries()]
            .sort(([a], [b]) => a.localeCompare(b, 'es'))
            .map(([especialidad, lista]) => `<optgroup label="${this.escapeHTML(especialidad)}">${
                lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
                    .map(d => `<option value="${this.escapeHTML(d.id)}">${this.escapeHTML(d.nombre)}</option>`).join('')
            }</optgroup>`).join('');
    },

    doctoresActivos(especialidadId = '') {
        return this.state.doctores.filter(d =>
            d.estado === 'activo' && (!especialidadId || String(d.especialidadId) === String(especialidadId))
        );
    },

    loadDoctorFilter() {
        const doctorSelect = document.getElementById('doctorFilter');
        if (!doctorSelect) return;
        const doctores = this.doctoresActivos(this.state.filterSpecialty);
        doctorSelect.innerHTML = `<option value="">Todos los doctores (${doctores.length})</option>` + this.doctorOptionsHTML(doctores);
        if (doctores.some(d => d.id === this.state.filterDoctor)) {
            doctorSelect.value = this.state.filterDoctor;
        } else {
            this.state.filterDoctor = '';
        }
    },

    // Cargar filtros
    loadFilters() {
        const especialidadesOptions = this.state.especialidades
            .map(e => `<option value="${e.id}">${this.escapeHTML(e.nombre)}</option>`).join('');

        const specialtySelect = document.getElementById('specialtyFilter');
        if (specialtySelect) {
            specialtySelect.innerHTML = '<option value="">Todas las especialidades</option>' + especialidadesOptions;
            specialtySelect.value = this.state.filterSpecialty;
        }
        this.loadDoctorFilter();

        const appointmentSpecialty = document.getElementById('appointmentSpecialty');
        if (appointmentSpecialty) {
            const actual = appointmentSpecialty.value;
            appointmentSpecialty.innerHTML = '<option value="">Todas las especialidades</option>' + especialidadesOptions;
            appointmentSpecialty.value = actual;
        }
        this.updateDoctorsBySpecialty();
    },

    // Lista de doctores del formulario, filtrada por especialidad si se eligió una
    updateDoctorsBySpecialty() {
        const specialtySelect = document.getElementById('appointmentSpecialty');
        const doctorSelect = document.getElementById('appointmentDoctor');
        if (!specialtySelect || !doctorSelect) return;

        const actual = doctorSelect.value;
        const doctores = this.doctoresActivos(specialtySelect.value);

        if (this.state.doctores.length === 0) {
            doctorSelect.innerHTML = '<option value="">No hay personal médico registrado</option>';
        } else if (doctores.length === 0) {
            doctorSelect.innerHTML = '<option value="">No hay doctores activos en esta especialidad</option>';
        } else {
            doctorSelect.innerHTML = `<option value="">Selecciona doctor (${doctores.length})...</option>` + this.doctorOptionsHTML(doctores);
        }

        doctorSelect.value = doctores.some(d => d.id === actual) ? actual : '';
        this.renderDoctorInfo();
        this.updateAvailableHours();
    },

    // Al elegir doctor, mostrar su especialidad y horario
    syncSpecialtyFromDoctor() {
        const doctor = this.getDoctor(document.getElementById('appointmentDoctor')?.value);
        const specialtySelect = document.getElementById('appointmentSpecialty');
        if (doctor && specialtySelect && specialtySelect.value && String(specialtySelect.value) !== String(doctor.especialidadId)) {
            specialtySelect.value = String(doctor.especialidadId);
        }
        this.renderDoctorInfo();
    },

    renderDoctorInfo() {
        const info = document.getElementById('appointmentDoctorInfo');
        if (!info) return;
        const doctor = this.getDoctor(document.getElementById('appointmentDoctor')?.value);
        if (!doctor) {
            info.innerHTML = this.state.doctores.length === 0
                ? 'Registra doctores en <a href="#" onclick="event.preventDefault(); AgendaAvanzadaModule.irAPersonalMedico()">Personal Médico</a> para poder agendar.'
                : '';
            return;
        }
        info.innerHTML = `<i class="fas fa-stethoscope" aria-hidden="true"></i> ${this.escapeHTML(doctor.especialidad || 'Sin especialidad')}
            · <i class="fas fa-clock" aria-hidden="true"></i> ${this.escapeHTML(doctor.horarioTexto)} (${this.escapeHTML(doctor.diasTexto || 'sin días')})
            ${doctor.numeroColegiado ? `· Col. ${this.escapeHTML(doctor.numeroColegiado)}` : ''}`;
    },

    irAPersonalMedico() {
        document.querySelectorAll('#appointmentModal, #agendaManagementModal, #doctorModal').forEach(m => { m.style.display = 'none'; });
        navigateToPage('personal');
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

        const editingId = document.getElementById('appointmentModal')?.dataset.editingAppointmentId;
        const availableHours = this.getAvailableHours(doctorId, dateStr, editingId);
        const actual = hoursSelect.value;

        if (availableHours.length === 0) {
            const doctor = this.getDoctor(doctorId);
            const motivo = doctor && !doctor.horariosLaborales?.[this.diaSemana(dateStr)]?.inicio
                ? `No atiende los ${this.diaSemana(dateStr)}`
                : 'No hay horas disponibles';
            hoursSelect.innerHTML = `<option value="">${motivo}</option>`;
            return;
        }

        hoursSelect.innerHTML = '<option value="">Selecciona hora...</option>' + availableHours
            .map(hour => `<option value="${hour}">${hour}</option>`)
            .join('');
        if (availableHours.includes(actual)) hoursSelect.value = actual;
    },

    // Obtener horas disponibles para un doctor en una fecha
    getAvailableHours(doctorId, dateStr, excludedAppointmentId = null) {
        const doctor = this.getDoctor(doctorId);
        if (!doctor) return [];

        const dayName = this.diaSemana(dateStr);
        const horarios = doctor.horariosLaborales?.[dayName];

        // Si no trabaja ese día
        if (!horarios || !horarios.inicio) {
            return [];
        }

        // Verificar si hay bloqueo de personal
        const enBloqueo = this.state.bloqueoPersonal.some(bloqueo =>
            String(bloqueo.doctorId) === String(doctorId) &&
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
                String(cita.id) !== String(excludedAppointmentId) &&
                String(cita.doctorId) === String(doctorId) &&
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
        const f = this.parseFechaLocal(fecha);
        const fi = this.parseFechaLocal(fechaInicio);
        const ff = this.parseFechaLocal(fechaFin);
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
            const dateStr = this.fechaISO(date);
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
    normalizarTexto(valor) {
        return String(valor ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    },

    // Aplica doctor, especialidad, estado y búsqueda de paciente
    citaCoincideFiltros(cita) {
        const { filterDoctor, filterSpecialty, filterEstado, busqueda } = this.state;
        if (filterDoctor && String(cita.doctorId) !== String(filterDoctor)) return false;
        if (filterSpecialty) {
            const especialidadId = this.getDoctor(cita.doctorId)?.especialidadId || cita.especialidadId;
            if (String(especialidadId) !== String(filterSpecialty)) return false;
        }
        if (filterEstado) {
            if (cita.estado !== filterEstado) return false;
        } else if (cita.estado === 'Cancelada') {
            return false;
        }
        if (busqueda.trim()) {
            const termino = this.normalizarTexto(busqueda.trim());
            const paciente = this.getPacienteDeCita(cita);
            const texto = this.normalizarTexto([
                cita.paciente, cita.telefono, cita.email, cita.condiciones,
                paciente?.dpi, paciente?.telefono
            ].join(' '));
            if (!texto.includes(termino)) return false;
        }
        return true;
    },

    getPacienteDeCita(cita) {
        const pacientes = (typeof PacientesModule !== 'undefined' && PacientesModule.state?.pacientes) || [];
        return pacientes.find(p => String(p.id) === String(cita.pacienteId));
    },

    getAppointmentsForDate(dateStr) {
        return this.state.citas.filter(cita => cita.fecha === dateStr && this.citaCoincideFiltros(cita));
    },

    hayFiltrosActivos() {
        const { filterDoctor, filterSpecialty, filterEstado, busqueda } = this.state;
        return Boolean(filterDoctor || filterSpecialty || filterEstado || busqueda.trim());
    },

    aplicarFiltros() {
        this.renderCalendar();
        if (this.state.selectedDate) this.displayAppointmentsForDate(this.state.selectedDate);
        this.renderResultadosBusqueda();
    },

    limpiarFiltros() {
        Object.assign(this.state, { filterDoctor: '', filterSpecialty: '', filterEstado: '', busqueda: '' });
        ['agendaBusqueda', 'specialtyFilter', 'estadoCitaFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        this.loadDoctorFilter();
        this.aplicarFiltros();
    },

    // Lista de citas que coinciden con los filtros (próximas primero)
    renderResultadosBusqueda() {
        const panel = document.getElementById('agendaResultados');
        const limpiar = document.getElementById('agendaLimpiarFiltros');
        if (limpiar) limpiar.hidden = !this.hayFiltrosActivos();
        if (!panel) return;

        if (!this.hayFiltrosActivos()) {
            panel.hidden = true;
            panel.innerHTML = '';
            return;
        }

        const hoy = this.fechaISO(new Date());
        const citas = this.state.citas.filter(c => this.citaCoincideFiltros(c));
        const proximas = citas.filter(c => c.fecha >= hoy).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
        const pasadas = citas.filter(c => c.fecha < hoy).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
        const lista = [...proximas, ...pasadas].slice(0, 30);

        panel.hidden = false;
        if (lista.length === 0) {
            panel.innerHTML = '<p class="agenda-resultados-vacio">No hay citas con estos filtros.</p>';
            return;
        }

        panel.innerHTML = `
            <p class="agenda-resultados-titulo">${citas.length} cita${citas.length === 1 ? '' : 's'} encontrada${citas.length === 1 ? '' : 's'}${citas.length > lista.length ? ` · mostrando ${lista.length}` : ''}</p>
            <ul class="agenda-resultados-lista">
                ${lista.map(c => {
                    const doctor = this.getDoctor(c.doctorId);
                    return `<li><button type="button" class="agenda-resultado ${c.fecha < hoy ? 'pasada' : ''}" onclick="AgendaAvanzadaModule.irAFecha('${c.fecha}')">
                        <span class="agenda-resultado-fecha">${formatFecha(c.fecha, { weekday: 'short', day: '2-digit', month: 'short' })} · ${this.escapeHTML(c.hora)}</span>
                        <span class="agenda-resultado-paciente">${this.escapeHTML(c.paciente)}</span>
                        <span class="agenda-resultado-doctor" style="color: ${doctor?.color || 'inherit'}">${this.escapeHTML(doctor?.nombre || c.doctorNombre || 'Doctor')}</span>
                        <span class="agenda-estado agenda-estado-${String(c.estado).toLowerCase()}">${this.escapeHTML(c.estado)}</span>
                    </button></li>`;
                }).join('')}
            </ul>`;
    },

    irAFecha(dateStr) {
        const fecha = this.parseFechaLocal(dateStr);
        this.state.currentDate = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
        this.state.selectedDate = dateStr;
        this.renderCalendar();
        this.displayAppointmentsForDate(dateStr);
        document.getElementById('selectedDayAppointments')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
            <div class="date-header">${this.parseFechaLocal(dateStr).toLocaleDateString('es-GT', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}</div>
            ${appointments
                .sort((a, b) => a.hora.localeCompare(b.hora))
                .map(apt => {
                    const doctor = this.getDoctor(apt.doctorId);
                    const specialty = this.state.especialidades.find(e => e.id == (doctor?.especialidadId || apt.especialidadId));
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
                                <p class="doctor-name" style="color: ${doctorColor};"><i class="fas fa-user-md"></i> ${doctor?.nombre || apt.doctorNombre || 'Doctor'}</p>
                                <p class="specialty" style="background: ${specialtyBgColor}; color: ${specialtyColor}; padding: 4px 8px; border-radius: 3px; display: inline-block; font-size: 12px;">
                                    <i class="fas fa-stethoscope"></i> ${apt.especialidad}
                                </p>
                                ${apt.condiciones ? `<p class="conditions"><i class="fas fa-heart"></i> ${apt.condiciones}</p>` : ''}
                                <span class="badge badge-${apt.estado.toLowerCase()}">${apt.estado}</span>
                            </div>
                            <div class="appointment-actions">
                                <button class="btn-icon" onclick="confirmAppointmentAction('${apt.id}')" title="Confirmar">
                                    <i class="fas fa-check"></i>
                                </button>
                                <button class="btn-icon" onclick="editAppointmentAction('${apt.id}')" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-icon" onclick="cancelAppointmentAction('${apt.id}')" title="Cancelar">
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
            delete modal.dataset.editingAppointmentId;
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
            this.renderPacienteSeleccionado(null);
            // Si hay un día seleccionado en el calendario, proponerlo
            if (this.state.selectedDate && this.state.selectedDate >= this.fechaISO(new Date())) {
                document.getElementById('appointmentDate').value = this.state.selectedDate;
            }
            // Si se filtró por doctor, proponerlo
            if (this.state.filterSpecialty) document.getElementById('appointmentSpecialty').value = this.state.filterSpecialty;
            this.updateDoctorsBySpecialty();
            if (this.state.filterDoctor) {
                document.getElementById('appointmentDoctor').value = this.state.filterDoctor;
                this.syncSpecialtyFromDoctor();
                this.updateAvailableHours();
            }
            const saveBtn = document.getElementById('saveAppointmentBtn');
            if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save"></i> Agendar cita';
            setTimeout(() => document.getElementById('patientSearch')?.focus(), 50);
        }
    },
    
    // Búsqueda de pacientes con filtro por campo (nombre, DPI, teléfono, email)
    handlePatientSearch(searchTerm) {
        const suggestionsDiv = document.getElementById('patientSuggestions');
        if (!suggestionsDiv) return;

        // Si se escribe de nuevo, el paciente elegido deja de estar seleccionado
        if (document.getElementById('patientName')?.value !== searchTerm) {
            document.getElementById('patientId').value = '';
            this.renderPacienteSeleccionado(null);
        }

        if (!searchTerm.trim()) {
            suggestionsDiv.style.display = 'none';
            return;
        }

        const pacientes = (typeof PacientesModule !== 'undefined' && PacientesModule.state?.pacientes) || [];
        const termino = this.normalizarTexto(searchTerm.trim());
        const soloDigitos = termino.replace(/\D/g, '');
        const campo = this.state.busquedaPacienteCampo;

        const camposDe = p => ({
            nombre: this.normalizarTexto(`${p.nombre || ''} ${p.apellidoPaterno || p.apellido_paterno || ''} ${p.apellidoMaterno || p.apellido_materno || ''}`),
            dpi: String(p.dpi || p.cedula || '').replace(/\D/g, ''),
            telefono: String(p.telefono || '').replace(/\D/g, ''),
            email: this.normalizarTexto(p.email)
        });
        const coincide = (valor, esNumero) => esNumero ? (soloDigitos && valor.includes(soloDigitos)) : valor.includes(termino);

        const filtered = pacientes.filter(p => {
            const c = camposDe(p);
            if (campo === 'nombre') return coincide(c.nombre);
            if (campo === 'dpi') return coincide(c.dpi, true);
            if (campo === 'telefono') return coincide(c.telefono, true);
            if (campo === 'email') return coincide(c.email);
            return coincide(c.nombre) || coincide(c.email) || coincide(c.dpi, true) || coincide(c.telefono, true);
        }).slice(0, 8);

        if (filtered.length === 0) {
            suggestionsDiv.innerHTML = `<div class="patient-suggestion-empty">No hay pacientes que coincidan.
                <button type="button" class="btn btn-secondary btn-small" onclick="AgendaAvanzadaModule.createPatientQuick()"><i class="fas fa-user-plus" aria-hidden="true"></i> Registrar paciente</button></div>`;
            suggestionsDiv.style.display = 'block';
            return;
        }

        this._sugerencias = filtered;
        suggestionsDiv.innerHTML = filtered.map((p, i) => {
            const nombreCompleto = `${p.nombre || ''} ${p.apellidoPaterno || p.apellido_paterno || ''} ${p.apellidoMaterno || p.apellido_materno || ''}`.replace(/\s+/g, ' ').trim();
            const proxima = this.proximaCitaDePaciente(p.id);
            return `
                <button type="button" class="patient-suggestion" onmousedown="event.preventDefault()" onclick="AgendaAvanzadaModule.selectPatientIndex(${i})">
                    <strong>${this.escapeHTML(nombreCompleto)}</strong>
                    <span>DPI ${this.escapeHTML(p.dpi || p.cedula || '—')} · Tel. ${this.escapeHTML(p.telefono || '—')}</span>
                    ${proxima ? `<span class="patient-suggestion-cita"><i class="fas fa-calendar-check" aria-hidden="true"></i> Próxima cita: ${formatFecha(proxima.fecha)} ${this.escapeHTML(proxima.hora)}</span>` : ''}
                </button>
            `;
        }).join('');

        suggestionsDiv.style.display = 'block';
    },

    proximaCitaDePaciente(pacienteId) {
        const hoy = this.fechaISO(new Date());
        return this.state.citas
            .filter(c => String(c.pacienteId) === String(pacienteId) && c.fecha >= hoy && c.estado !== 'Cancelada')
            .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))[0];
    },

    selectPatientIndex(index) {
        const p = this._sugerencias?.[index];
        if (!p) return;
        const nombre = `${p.nombre || ''} ${p.apellidoPaterno || p.apellido_paterno || ''} ${p.apellidoMaterno || p.apellido_materno || ''}`.replace(/\s+/g, ' ').trim();
        this.selectPatient(p.id, nombre, p.email || '', p.telefono || '');
        this.renderPacienteSeleccionado(p);
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

    renderPacienteSeleccionado(p) {
        const info = document.getElementById('patientSelectedInfo');
        if (!info) return;
        if (!p) {
            info.hidden = true;
            info.innerHTML = '';
            return;
        }
        const proxima = this.proximaCitaDePaciente(p.id);
        info.hidden = false;
        info.innerHTML = `<i class="fas fa-circle-check" aria-hidden="true"></i>
            <span>DPI ${this.escapeHTML(p.dpi || '—')} · Tel. ${this.escapeHTML(p.telefono || '—')}${p.email ? ` · ${this.escapeHTML(p.email)}` : ''}
            ${proxima ? `<br>Ya tiene cita el ${formatFecha(proxima.fecha)} a las ${this.escapeHTML(proxima.hora)}` : ''}</span>`;
    },

    // Registrar un paciente nuevo en el módulo Pacientes (la cita necesita un paciente real)
    createPatientQuick() {
        document.getElementById('appointmentModal').style.display = 'none';
        navigateToPage('pacientes');
        setTimeout(() => document.getElementById('addPacientBtn')?.click(), 150);
    },

    // Guardar cita CON VALIDACIONES MEJORADAS
    saveAppointment() {
        const patientName = document.getElementById('patientName')?.value?.trim();
        const patientId = document.getElementById('patientId')?.value?.trim();
        const email = document.getElementById('patientEmail')?.value?.trim();
        const phone = document.getElementById('patientPhone')?.value?.trim();
        const specialtyId = document.getElementById('appointmentSpecialty')?.value;
        const doctorId = document.getElementById('appointmentDoctor')?.value;
        const dateStr = document.getElementById('appointmentDate')?.value;
        const time = document.getElementById('appointmentTime')?.value;
        const conditions = document.getElementById('appointmentConditions')?.value?.trim();
        const notes = document.getElementById('appointmentNotes')?.value?.trim();

        // Validación de campos obligatorios
        if (!patientName) {
            AlertasModule.mostrarError('Nombre del paciente es obligatorio');
            return;
        }
        if (!patientId || patientId.startsWith('PAC-TEMP-')) {
            AlertasModule.mostrarError('Selecciona un paciente registrado de la lista de resultados');
            return;
        }
        if (!doctorId) {
            AlertasModule.mostrarError('Selecciona un doctor');
            return;
        }
        if (!dateStr) {
            AlertasModule.mostrarError('Selecciona una fecha');
            return;
        }
        if (!time) {
            AlertasModule.mostrarError('Selecciona una hora');
            return;
        }
        if (!conditions) {
            AlertasModule.mostrarError('Describe la condición/motivo de la consulta');
            return;
        }

        // Validación de fecha (no puede ser en el pasado)
        const appointmentDate = this.parseFechaLocal(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (appointmentDate < today) {
            AlertasModule.mostrarError('No puedes agendar citas en fechas pasadas');
            return;
        }

        // Validación de disponibilidad del doctor
        const modal = document.getElementById('appointmentModal');
        const editingAppointmentId = modal?.dataset.editingAppointmentId;
        const validationResult = this.validateAvailability(doctorId, dateStr, time, editingAppointmentId);
        if (!validationResult.available) {
            AlertasModule.mostrarError(validationResult.message);
            return;
        }

        // Crear nueva cita
        const doctor = this.getDoctor(doctorId);
        const specialty = this.state.especialidades.find(e => e.id == (doctor?.especialidadId || specialtyId));

        const appointmentData = {
            pacienteId: patientId,
            paciente: patientName,
            email: email || '',
            telefono: phone || '',
            doctorId: doctorId,
            doctorNombre: doctor?.nombre,
            doctorColor: doctor?.color,
            doctorBgColor: doctor?.bgColor,
            especialidad: specialty?.nombre || 'Sin especialidad',
            especialidadId: doctor?.especialidadId || specialtyId || 0,
            especialidadColor: specialty?.color,
            especialidadBgColor: specialty?.bgColor,
            fecha: dateStr,
            hora: time,
            condiciones: conditions,
            notas: notes || '',
            estado: 'Pendiente',
            confirmada: false
        };

        let appointment;
        if (editingAppointmentId) {
            appointment = this.state.citas.find(cita => String(cita.id) === String(editingAppointmentId));
            if (!appointment) {
                AlertasModule.mostrarError('No se encontró la cita que deseas actualizar');
                return;
            }
            Object.assign(appointment, appointmentData);
            this.updateCitaInAPI(appointment);
        } else {
            appointment = {
                id: `CIT-${Date.now()}`,
                ...appointmentData,
                fechaCreacion: new Date().toISOString()
            };
            this.state.citas.push(appointment);
            this.saveCitaToAPI(appointment);
        }

        this.saveCitasToStorage();
        this.renderCalendar();

        if (modal) {
            delete modal.dataset.editingAppointmentId;
            modal.style.display = 'none';
        }

        const action = editingAppointmentId ? 'actualizada' : 'agendada';
        AlertasModule.mostrarExito(`✓ Cita ${action} para ${patientName} el ${dateStr} a las ${time}`);
        if (!editingAppointmentId) this.sendConfirmationEmail(appointment);
    },

    // Validar disponibilidad del doctor
    validateAvailability(doctorId, dateStr, timeStr, excludedAppointmentId = null) {
        const doctor = this.getDoctor(doctorId);
        
        // Verificar que el doctor existe
        if (!doctor) {
            return { available: false, message: 'El doctor seleccionado no existe' };
        }

        // Verificar que la fecha es válida
        const date = this.parseFechaLocal(dateStr);
        if (isNaN(date)) {
            return { available: false, message: 'Fecha inválida' };
        }

        // Verificar el día de la semana
        const dayName = this.diaSemana(dateStr);
        const horarios = doctor.horariosLaborales?.[dayName];

        if (!horarios || !horarios.inicio) {
            return { available: false, message: `El doctor no atiende los ${dayName}s` };
        }

        // Verificar si hay bloqueo de personal (vacaciones, permisos)
        const enBloqueo = this.state.bloqueoPersonal.some(bloqueo =>
            String(bloqueo.doctorId) === String(doctorId) &&
            this.isFechaEnRango(dateStr, bloqueo.fechaInicio, bloqueo.fechaFin)
        );

        if (enBloqueo) {
            return { available: false, message: `El doctor no está disponible en esa fecha (bloqueo de personal)` };
        }

        // Verificar disponibilidad de la hora específica
        const citaExistente = this.state.citas.some(c =>
            String(c.id) !== String(excludedAppointmentId) &&
            String(c.doctorId) === String(doctorId) &&
            c.fecha === dateStr &&
            c.hora === timeStr &&
            c.estado !== 'Cancelada'
        );

        if (citaExistente) {
            return { available: false, message: `Esa hora (${timeStr}) ya está reservada` };
        }

        // Verificar rango horario
        const [appHour, appMin] = timeStr.split(':').map(Number);
        const [startHour, startMin] = horarios.inicio.split(':').map(Number);
        const [endHour, endMin] = horarios.fin.split(':').map(Number);

        const appTime = appHour * 60 + appMin;
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        if (appTime < startTime || appTime >= endTime) {
            return { available: false, message: `Hora fuera del horario laboral (${horarios.inicio} - ${horarios.fin})` };
        }

        return { available: true, message: 'Disponible' };
    },

    // Guardar cita a API
    saveCitaToAPI(appointment) {
        try {
            const token = authManager?.getToken?.();
            const apiHost = authManager?.apiBaseUrl || 'http://178.128.72.110:3011';
            const apiBase = apiHost.endsWith('/api') ? apiHost : `${apiHost}/api`;

            if (!token) {
                console.warn('No hay token, cita solo guardada en localStorage');
                return;
            }

            fetch(`${apiBase}/appointments`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.mapCitaToAPI(appointment))
            })
                .then(async response => {
                    const result = await response.json();
                    if (!response.ok || !result.success) throw new Error(result.message || 'No se pudo crear la cita');
                    if (result.data?.id) appointment.id = result.data.id;
                    this.saveCitasToStorage();
                })
                .catch(error => {
                    console.warn('Cita conservada localmente; falló la API:', error);
                    AlertasModule.mostrarError('La cita quedó guardada localmente por falta de conexión');
                });
        } catch (error) {
            console.warn('Error intentando guardar a API:', error);
        }
    },

    // Confirmar cita
    confirmAppointment(appointmentId) {
        const appointment = this.state.citas.find(c => String(c.id) === String(appointmentId));
        if (appointment) {
            appointment.estado = 'Confirmada';
            appointment.confirmada = true;
            appointment.fechaConfirmacion = new Date().toISOString();
            
            this.saveCitasToStorage();
            this.updateCitaInAPI(appointment);
            this.renderCalendar();
            
            if (this.state.selectedDate) {
                this.displayAppointmentsForDate(this.state.selectedDate);
            }
            AlertasModule.mostrarExito(`✓ Cita confirmada para ${appointment.paciente}`);
        }
    },

    // Editar cita
    editAppointment(appointmentId) {
        const appointment = this.state.citas.find(c => String(c.id) === String(appointmentId));
        if (appointment) {
            // Llenar el formulario modal con los datos de la cita
            document.getElementById('patientName').value = appointment.paciente;
            document.getElementById('patientId').value = appointment.pacienteId;
            document.getElementById('patientEmail').value = appointment.email;
            document.getElementById('patientPhone').value = appointment.telefono;
            document.getElementById('patientSearch').value = appointment.paciente;
            document.getElementById('patientSuggestions').style.display = 'none';
            const paciente = this.getPacienteDeCita(appointment);
            this.renderPacienteSeleccionado(paciente || null);
            document.getElementById('appointmentSpecialty').value = '';
            this.updateDoctorsBySpecialty();
            document.getElementById('appointmentDoctor').value = appointment.doctorId;
            this.renderDoctorInfo();
            document.getElementById('appointmentDate').value = appointment.fecha;
            document.getElementById('appointmentConditions').value = appointment.condiciones;
            document.getElementById('appointmentNotes').value = appointment.notas || '';
            
            // Guardar el ID de la cita siendo editada
            const modal = document.getElementById('appointmentModal');
            if (modal) {
                modal.dataset.editingAppointmentId = appointmentId;
                modal.style.display = 'block';
            }
            this.updateAvailableHours();
            document.getElementById('appointmentTime').value = appointment.hora;
            
            // Cambiar botón de "Crear" a "Actualizar"
            const saveBtn = document.getElementById('saveAppointmentBtn');
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar cita';
            }
        }
    },

    // Cancelar cita
    cancelAppointment(appointmentId) {
        if (confirm('¿Estás seguro de cancelar esta cita?')) {
            const appointment = this.state.citas.find(c => String(c.id) === String(appointmentId));
            if (appointment) {
                appointment.estado = 'Cancelada';
                appointment.fechaCancelacion = new Date().toISOString();
                
                this.saveCitasToStorage();
                this.updateCitaInAPI(appointment);
                this.renderCalendar();
                
                if (this.state.selectedDate) {
                    this.displayAppointmentsForDate(this.state.selectedDate);
                }
                AlertasModule.mostrarExito('✓ Cita cancelada');
            }
        }
    },

    // Actualizar cita en API
    updateCitaInAPI(appointment) {
        try {
            const token = authManager?.getToken?.();
            const apiHost = authManager?.apiBaseUrl || 'http://178.128.72.110:3011';
            const apiBase = apiHost.endsWith('/api') ? apiHost : `${apiHost}/api`;

            if (!token) {
                console.warn('No hay token, cambio solo en localStorage');
                return;
            }

            fetch(`${apiBase}/appointments/${encodeURIComponent(appointment.id)}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.mapCitaToAPI(appointment))
            })
                .then(async response => {
                    const result = await response.json();
                    if (!response.ok || !result.success) throw new Error(result.message || 'No se pudo actualizar la cita');
                })
                .catch(error => {
                    console.warn('Cambio conservado localmente; falló la API:', error);
                    AlertasModule.mostrarError('El cambio quedó guardado localmente por falta de conexión');
                });
        } catch (error) {
            console.warn('Error intentando actualizar en API:', error);
        }
    },

    mapCitaToAPI(appointment) {
        const statuses = {
            Pendiente: 'pendiente',
            Confirmada: 'confirmada',
            Cancelada: 'cancelada'
        };
        return {
            paciente_id: appointment.pacienteId,
            // El doctor es un registro de Personal Médico; doctor_id (usuario) lo asigna el servidor
            personal_medico_id: /^\d+$/.test(String(appointment.doctorId)) ? Number(appointment.doctorId) : undefined,
            fecha: appointment.fecha,
            hora: appointment.hora,
            diagnostico: appointment.condiciones,
            observaciones: appointment.notas || '',
            estado: statuses[appointment.estado] || String(appointment.estado || 'pendiente').toLowerCase()
        };
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
            container.innerHTML = '<p class="empty-message">No hay personal médico registrado. Agrégalo en Personal Médico.</p>';
            return;
        }

        container.innerHTML = `
            <p class="form-hint">Estos doctores vienen de <strong>Personal Médico</strong>. Para agregar, editar o dar de baja, hazlo desde ese módulo.</p>
            <div class="doctors-grid">
                ${this.state.doctores.map(doc => {
                    const bgColor = doc.bgColor || '#f0f0f0';
                    const color = doc.color || '#666';
                    return `
                    <div class="doctor-card" style="border-left: 4px solid ${color}; background: linear-gradient(to right, ${bgColor}, white); padding: 15px; border-radius: 5px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div>
                                <h4 style="color: ${color}; margin: 0 0 8px 0;">${this.escapeHTML(doc.nombre)}</h4>
                                <p style="margin: 5px 0; font-size: 13px;"><i class="fas fa-clock"></i> ${this.escapeHTML(doc.horarioTexto || '')} · ${this.escapeHTML(doc.diasTexto || '')}</p>
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
                                <button class="btn btn-sm btn-info" onclick="editDoctorFormAction('${doc.id}')" style="display: block; margin-bottom: 5px;">
                                    <i class="fas fa-edit"></i> Editar
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
        // Los doctores se registran en Personal Médico (fuente única)
        this.irAPersonalMedico();
        setTimeout(() => document.getElementById('btnNuevoPersonal')?.click(), 150);
        return;
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
        this.irAPersonalMedico();
        return;
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
        // Las bajas se hacen en Personal Médico para no desincronizar la agenda
        this.irAPersonalMedico();
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
                                    <button class="btn btn-sm btn-danger" onclick="removeBloqueoAction('${bloqueo.id}')" title="Eliminar">
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
