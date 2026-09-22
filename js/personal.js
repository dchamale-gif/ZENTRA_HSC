// ============================================
// MÓDULO DE GESTIÓN DE PERSONAL MÉDICO
// ============================================
// Gestión de personal, especialidades, horarios, disponibilidad

const PersonalModule = {
    state: {
        personal: [],
        disponibilidad: [],
        especialidades: [
            { id: 1, nombre: 'Psiquiatría General', icon: 'fa-brain', color: '#8E44AD' },
            { id: 2, nombre: 'Psiquiatría Infantil', icon: 'fa-child', color: '#3498DB' },
            { id: 3, nombre: 'Psicología Clínica', icon: 'fa-couch', color: '#E74C3C' },
            { id: 4, nombre: 'Terapia Cognitivo-Conductual', icon: 'fa-lightbulb', color: '#F39C12' },
            { id: 5, nombre: 'Adicciones y Rehabilitación', icon: 'fa-leaf', color: '#27AE60' },
            { id: 6, nombre: 'Psiquiatría Forense', icon: 'fa-gavel', color: '#34495E' }
        ],
        searchTerm: '',
        filtroEspecialidad: '',
        filtroEstado: 'activos',
        personalSeleccionado: null
    },

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        this.loadData();
        console.log('Módulo de Gestión de Personal inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        const searchInput = document.getElementById('searchPersonal');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.state.searchTerm = e.target.value;
                this.renderPersonal();
            });
        }

        const filterEspecialidad = document.getElementById('filterEspecialidadPersonal');
        if (filterEspecialidad) {
            filterEspecialidad.addEventListener('change', (e) => {
                this.state.filtroEspecialidad = e.target.value;
                this.renderPersonal();
            });
        }

        const filterEstado = document.getElementById('filterEstadoPersonal');
        if (filterEstado) {
            filterEstado.addEventListener('change', (e) => {
                this.state.filtroEstado = e.target.value;
                this.renderPersonal();
            });
        }

        const btnNuevoPersonal = document.getElementById('btnNuevoPersonal');
        if (btnNuevoPersonal) {
            btnNuevoPersonal.addEventListener('click', () => this.openNuevoPersonalModal());
        }
    },

    getApiUrl(path = '') {
        const configuredUrl = typeof authManager !== 'undefined'
            ? authManager.apiBaseUrl
            : 'http://178.128.72.110:3011';
        const apiRoot = configuredUrl.replace(/\/$/, '').replace(/\/api$/, '');
        return `${apiRoot}/api/personal-medico${path}`;
    },

    getAuthToken() {
        return typeof authManager !== 'undefined' ? authManager.getToken() : null;
    },

    normalizePersonal(personal) {
        return {
            id: String(personal.id),
            nombre: personal.nombre || '',
            apellidoPaterno: personal.apellido_paterno ?? personal.apellidoPaterno ?? '',
            apellidoMaterno: personal.apellido_materno ?? personal.apellidoMaterno ?? '',
            especialidad: personal.especialidad || '',
            especialidadId: Number(personal.especialidad_id ?? personal.especialidadId),
            licenciaProf: personal.licencia_profesional ?? personal.licenciaProf ?? '',
            telefono: personal.telefono || '',
            email: personal.email || '',
            horarioInicio: String(personal.horario_inicio ?? personal.horarioInicio ?? '08:00').slice(0, 5),
            horarioFin: String(personal.horario_fin ?? personal.horarioFin ?? '16:00').slice(0, 5),
            diasDisponibles: personal.dias_disponibles ?? personal.diasDisponibles ?? [],
            estado: personal.estado || 'activo',
            createdAt: personal.created_at ?? personal.createdAt ?? ''
        };
    },

    // Cargar datos desde API
    async loadData() {
        try {
            const token = this.getAuthToken();
            if (!token) throw new Error('No hay token de autenticación');

            const [personalResponse, especialidadesResponse] = await Promise.all([
                fetch(this.getApiUrl(), { headers: { Authorization: `Bearer ${token}` } }),
                fetch(this.getApiUrl('/especialidades'), { headers: { Authorization: `Bearer ${token}` } })
            ]);
            if (!personalResponse.ok) throw new Error(`No se pudo cargar personal (${personalResponse.status})`);
            if (!especialidadesResponse.ok) throw new Error(`No se pudieron cargar especialidades (${especialidadesResponse.status})`);

            const personalData = await personalResponse.json();
            const especialidadesData = await especialidadesResponse.json();
            this.state.personal = (personalData.personal || []).map(personal => this.normalizePersonal(personal));
            this.state.especialidades = (especialidadesData.especialidades || []).map(especialidad => ({
                ...especialidad,
                id: Number(especialidad.id)
            }));
            this.savePersonalToDB();
        } catch (error) {
            console.warn('Error cargando de API, usando localStorage:', error);
            this.loadDataFromLocalStorage();
        }

        this.renderPersonal();
    },

    // Cargar datos desde localStorage
    loadDataFromLocalStorage() {
        const personalFromStorage = localStorage.getItem('personalMedico');
        this.state.personal = personalFromStorage
            ? JSON.parse(personalFromStorage).map(personal => this.normalizePersonal(personal))
            : [];

        const disponibilidadFromStorage = localStorage.getItem('disponibilidadPersonal');
        if (disponibilidadFromStorage) {
            this.state.disponibilidad = JSON.parse(disponibilidadFromStorage);
        }
    },

    // Cargar personal por defecto
    loadDefaultPersonal() {
        this.state.personal = [
            {
                id: 'PER-001',
                nombre: 'Carlos',
                apellidoPaterno: 'García',
                apellidoMaterno: 'López',
                especialidad: 'Psiquiatría General',
                especialidadId: 1,
                licenciaProf: 'LIC-2020-001',
                telefono: '+503 7000-1234',
                email: 'carlos.garcia@medico.sv',
                horarioInicio: '08:00',
                horarioFin: '16:00',
                diasDisponibles: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
                estado: 'activo',
                createdAt: new Date().toISOString()
            },
            {
                id: 'PER-002',
                nombre: 'María',
                apellidoPaterno: 'González',
                apellidoMaterno: 'Martínez',
                especialidad: 'Psicología Clínica',
                especialidadId: 3,
                licenciaProf: 'LIC-2019-005',
                telefono: '+503 7000-5678',
                email: 'maria.gonzalez@medico.sv',
                horarioInicio: '09:00',
                horarioFin: '17:00',
                diasDisponibles: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
                estado: 'activo',
                createdAt: new Date().toISOString()
            },
            {
                id: 'PER-003',
                nombre: 'Roberto',
                apellidoPaterno: 'Sánchez',
                apellidoMaterno: 'Ramírez',
                especialidad: 'Adicciones y Rehabilitación',
                especialidadId: 5,
                licenciaProf: 'LIC-2018-012',
                telefono: '+503 7000-9012',
                email: 'roberto.sanchez@medico.sv',
                horarioInicio: '08:00',
                horarioFin: '15:00',
                diasDisponibles: ['lunes', 'martes', 'miercoles', 'viernes'],
                estado: 'activo',
                createdAt: new Date().toISOString()
            }
        ];

        this.savePersonalToDB();
    },

    // Guardar datos a localStorage
    savePersonalToDB() {
        localStorage.setItem('personalMedico', JSON.stringify(this.state.personal));
    },

    savDisponibilidadToDB() {
        localStorage.setItem('disponibilidadPersonal', JSON.stringify(this.state.disponibilidad));
    },

    // Renderizar tabla de personal
    renderPersonal() {
        const container = document.getElementById('personalTable');
        if (!container) return;

        // Filtrar personal
        let personalFiltered = this.state.personal.filter(p => {
            // Filtro por búsqueda
            const searchLower = this.state.searchTerm.toLowerCase();
            const nombreCompleto = `${p.nombre || ''} ${p.apellidoPaterno || ''}`.toLowerCase();
            const busquedaMatch = nombreCompleto.includes(searchLower) ||
                                p.email.toLowerCase().includes(searchLower) ||
                                (p.licenciaProf || '').toLowerCase().includes(searchLower);

            // Filtro por especialidad
            const especialidadMatch = !this.state.filtroEspecialidad || p.especialidadId == this.state.filtroEspecialidad;

            // Filtro por estado
            let estadoMatch = true;
            if (this.state.filtroEstado === 'activos') {
                estadoMatch = p.estado === 'activo';
            } else if (this.state.filtroEstado === 'inactivos') {
                estadoMatch = p.estado !== 'activo';
            }

            return busquedaMatch && especialidadMatch && estadoMatch;
        });

        // Ordenar alfabéticamente por apellido
        personalFiltered.sort((a, b) => 
            (a.apellidoPaterno || '').localeCompare(b.apellidoPaterno || '')
        );

        // Renderizar tabla
        if (personalFiltered.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <i class="fas fa-users" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                    <p style="font-size: 16px; margin: 10px 0;">
                        ${this.state.searchTerm ? 'No se encontró personal' : 'No hay personal registrado'}
                    </p>
                    <small>${this.state.searchTerm ? 'Intenta con otro término de búsqueda' : 'Registra nuevo personal médico'}</small>
                </div>
            `;
            return;
        }

        let html = `
            <table style="width: 100%; border-collapse: collapse; background: white;">
                <thead style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <tr>
                        <th style="padding: 15px; text-align: left; font-weight: 600;">Nombre</th>
                        <th style="padding: 15px; text-align: left; font-weight: 600;">Especialidad</th>
                        <th style="padding: 15px; text-align: left; font-weight: 600;">Licencia</th>
                        <th style="padding: 15px; text-align: left; font-weight: 600;">Contacto</th>
                        <th style="padding: 15px; text-align: left; font-weight: 600;">Horario</th>
                        <th style="padding: 15px; text-align: center; font-weight: 600;">Estado</th>
                        <th style="padding: 15px; text-align: center; font-weight: 600;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
        `;

        personalFiltered.forEach(personal => {
            const especialidad = this.state.especialidades.find(e => e.id == personal.especialidadId);
            const estadoBgColor = personal.estado === 'activo' ? '#4caf50' : '#f44336';
            const estadoTextColor = '#fff';

            html += `
                <tr style="border-bottom: 1px solid #eee; transition: background 0.2s;"
                    onmouseover="this.style.background='#f5f5f5'"
                    onmouseout="this.style.background='white'">
                    <td style="padding: 12px 15px; font-weight: 600;">
                        ${personal.nombre} ${personal.apellidoPaterno || ''} ${personal.apellidoMaterno || ''}
                    </td>
                    <td style="padding: 12px 15px;">
                        <span style="background: #f0f4f8; color: #667eea; padding: 4px 8px; border-radius: 3px; font-size: 12px;">
                            ${especialidad?.nombre || 'Sin especialidad'}
                        </span>
                    </td>
                    <td style="padding: 12px 15px;">
                        <small>${personal.licenciaProf || 'N/A'}</small>
                    </td>
                    <td style="padding: 12px 15px; font-size: 12px;">
                        <div>${personal.email}</div>
                        <small style="color: #666;">${personal.telefono}</small>
                    </td>
                    <td style="padding: 12px 15px; font-size: 12px;">
                        ${personal.horarioInicio} - ${personal.horarioFin}
                    </td>
                    <td style="padding: 12px 15px; text-align: center;">
                        <span style="background: ${estadoBgColor}; color: ${estadoTextColor}; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                            ${personal.estado.charAt(0).toUpperCase() + personal.estado.slice(1)}
                        </span>
                    </td>
                    <td style="padding: 12px 15px; text-align: center;">
                        <button class="btn btn-sm btn-info" onclick="PersonalModule.verDetalles('${personal.id}')" title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="PersonalModule.editarPersonal('${personal.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="PersonalModule.eliminarPersonal('${personal.id}')" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn btn-sm btn-success" onclick="PersonalModule.verDisponibilidad('${personal.id}')" title="Ver disponibilidad">
                            <i class="fas fa-calendar-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
            <div style="padding: 15px; background: #f5f5f5; text-align: right; font-size: 12px; color: #666;">
                Total: <strong>${personalFiltered.length}</strong> de <strong>${this.state.personal.length}</strong> personal
            </div>
        `;

        container.innerHTML = html;
    },

    // Abrir modal para nuevo personal
    openNuevoPersonalModal() {
        const modal = document.getElementById('personalModal');
        if (!modal) {
            showNotification('Modal no encontrado', 'error');
            return;
        }

        // Limpiar formulario
        document.getElementById('personalNombre').value = '';
        document.getElementById('personalApellidoPaterno').value = '';
        document.getElementById('personalApellidoMaterno').value = '';
        document.getElementById('personalEspecialidad').value = '';
        document.getElementById('personalLicencia').value = '';
        document.getElementById('personalEmail').value = '';
        document.getElementById('personalTelefono').value = '';
        document.getElementById('personalHorarioInicio').value = '08:00';
        document.getElementById('personalHorarioFin').value = '16:00';
        document.getElementById('personalEstado').value = 'activo';
        this.setDiasLaborales(['lunes', 'martes', 'miercoles', 'jueves', 'viernes']);

        // Cargar especialidades
        this.cargarEspecialidades();

        // Guardar que es creación nueva
        modal.dataset.personalId = '';

        // Actualizar título
        const titleElement = modal.querySelector('.modal-header h2');
        if (titleElement) {
            titleElement.innerHTML = '<i class="fas fa-user-plus"></i> Nuevo Personal Médico';
        }

        modal.style.display = 'block';
    },

    // Cargar especialidades en select
    cargarEspecialidades() {
        const select = document.getElementById('personalEspecialidad');
        if (!select) return;

        select.innerHTML = '<option value="">-- Selecciona especialidad --</option>' +
            this.state.especialidades.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
    },

    getDiasLaboralesSeleccionados() {
        return Array.from(document.querySelectorAll('input[name="personalDiaLaboral"]:checked'))
            .map(input => input.value);
    },

    setDiasLaborales(dias) {
        const seleccionados = new Set(dias || []);
        document.querySelectorAll('input[name="personalDiaLaboral"]').forEach(input => {
            input.checked = seleccionados.has(input.value);
        });
    },

    // Guardar personal
    async guardarPersonal() {
        const nombre = document.getElementById('personalNombre')?.value?.trim();
        const apellidoPaterno = document.getElementById('personalApellidoPaterno')?.value?.trim();
        const apellidoMaterno = document.getElementById('personalApellidoMaterno')?.value?.trim();
        const especialidadId = document.getElementById('personalEspecialidad')?.value;
        const licencia = document.getElementById('personalLicencia')?.value?.trim();
        const email = document.getElementById('personalEmail')?.value?.trim();
        const telefono = document.getElementById('personalTelefono')?.value?.trim();
        const horarioInicio = document.getElementById('personalHorarioInicio')?.value;
        const horarioFin = document.getElementById('personalHorarioFin')?.value;
        const estado = document.getElementById('personalEstado')?.value;
        const diasLaborales = this.getDiasLaboralesSeleccionados();

        // Validaciones
        if (!nombre) {
            showNotification('Nombre es obligatorio', 'error');
            return;
        }

        if (!apellidoPaterno) {
            showNotification('Apellido paterno es obligatorio', 'error');
            return;
        }

        if (!especialidadId) {
            showNotification('Selecciona una especialidad', 'error');
            return;
        }

        if (!email || !email.includes('@')) {
            showNotification('Email válido es obligatorio', 'error');
            return;
        }

        if (!telefono) {
            showNotification('Teléfono es obligatorio', 'error');
            return;
        }

        if (!licencia) {
            showNotification('Licencia profesional es obligatoria', 'error');
            return;
        }

        if (diasLaborales.length === 0) {
            showNotification('Selecciona al menos un día laboral', 'error');
            return;
        }

        if (!horarioInicio || !horarioFin || horarioFin <= horarioInicio) {
            showNotification('La hora de fin debe ser posterior a la hora de inicio', 'error');
            return;
        }

        // Validar que licencia sea única
        const modal = document.getElementById('personalModal');
        const personalId = modal?.dataset.personalId;
        const licenciaExiste = this.state.personal.some(p => 
            p.licenciaProf === licencia && String(p.id) !== String(personalId)
        );

        if (licenciaExiste) {
            showNotification('Esta licencia ya está registrada', 'error');
            return;
        }

        const saveButton = modal.querySelector('button[onclick*="guardarPersonal"]');
        if (saveButton) saveButton.disabled = true;

        try {
            const token = this.getAuthToken();
            if (!token) throw new Error('No hay token de autenticación');

            const response = await fetch(this.getApiUrl(personalId ? `/${personalId}` : ''), {
                method: personalId ? 'PUT' : 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nombre,
                    apellido_paterno: apellidoPaterno,
                    apellido_materno: apellidoMaterno,
                    especialidad_id: Number(especialidadId),
                    licencia_profesional: licencia,
                    email,
                    telefono,
                    horario_inicio: horarioInicio,
                    horario_fin: horarioFin,
                    dias_disponibles: diasLaborales,
                    estado
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Error ${response.status}`);

            const personalGuardado = this.normalizePersonal(data.personal);
            if (personalId) {
                this.state.personal = this.state.personal.map(personal =>
                    String(personal.id) === String(personalId) ? personalGuardado : personal
                );
            } else {
                this.state.personal.push(personalGuardado);
            }
            this.savePersonalToDB();
            this.renderPersonal();
            modal.style.display = 'none';
            showNotification(`✓ Personal ${personalId ? 'actualizado' : 'registrado'}: ${nombre} ${apellidoPaterno}`, 'success');
        } catch (error) {
            console.error('Error guardando personal médico:', error);
            showNotification(`No se pudo guardar: ${error.message}`, 'error');
        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    },

    // Ver detalles de personal
    verDetalles(personalId) {
        const personal = this.state.personal.find(p => String(p.id) === String(personalId));
        if (!personal) {
            showNotification('Personal no encontrado', 'error');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog" style="max-width: 600px;">
                <div class="modal-header">
                    <h2><i class="fas fa-user-md"></i> Detalles del Personal</h2>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; gap: 15px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                                <strong style="color: #667eea;">Nombre Completo</strong><br>
                                <p style="margin: 5px 0;">${personal.nombre} ${personal.apellidoPaterno} ${personal.apellidoMaterno || ''}</p>
                            </div>
                            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                                <strong style="color: #667eea;">Especialidad</strong><br>
                                <p style="margin: 5px 0;">${personal.especialidad}</p>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                                <strong style="color: #667eea;">Licencia Profesional</strong><br>
                                <p style="margin: 5px 0;">${personal.licenciaProf}</p>
                            </div>
                            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                                <strong style="color: #667eea;">Estado</strong><br>
                                <p style="margin: 5px 0;">
                                    <span style="background: ${personal.estado === 'activo' ? '#4caf50' : '#f44336'}; color: white; padding: 4px 8px; border-radius: 3px;">
                                        ${personal.estado.charAt(0).toUpperCase() + personal.estado.slice(1)}
                                    </span>
                                </p>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                                <strong style="color: #667eea;">Email</strong><br>
                                <p style="margin: 5px 0; font-size: 13px;">${personal.email}</p>
                            </div>
                            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                                <strong style="color: #667eea;">Teléfono</strong><br>
                                <p style="margin: 5px 0;">${personal.telefono}</p>
                            </div>
                        </div>

                        <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                            <strong style="color: #667eea;">Horario Laboral</strong><br>
                            <p style="margin: 5px 0;">${personal.horarioInicio} - ${personal.horarioFin}</p>
                            <small style="color: #666;">Días: ${(personal.diasDisponibles || []).join(', ')}</small>
                        </div>

                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
                            <button type="button" class="btn btn-info" onclick="PersonalModule.editarPersonal('${personal.id}'); this.closest('.modal-overlay').remove();">
                                <i class="fas fa-edit"></i> Editar
                            </button>
                            <button type="button" class="btn btn-success" onclick="PersonalModule.verDisponibilidad('${personal.id}'); this.closest('.modal-overlay').remove();">
                                <i class="fas fa-calendar-alt"></i> Ver Disponibilidad
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    // Editar personal
    editarPersonal(personalId) {
        const personal = this.state.personal.find(p => String(p.id) === String(personalId));
        if (!personal) {
            showNotification('Personal no encontrado', 'error');
            return;
        }

        // Llenar formulario
        this.cargarEspecialidades();
        document.getElementById('personalNombre').value = personal.nombre;
        document.getElementById('personalApellidoPaterno').value = personal.apellidoPaterno;
        document.getElementById('personalApellidoMaterno').value = personal.apellidoMaterno || '';
        document.getElementById('personalEspecialidad').value = personal.especialidadId;
        document.getElementById('personalLicencia').value = personal.licenciaProf;
        document.getElementById('personalEmail').value = personal.email;
        document.getElementById('personalTelefono').value = personal.telefono;
        document.getElementById('personalHorarioInicio').value = personal.horarioInicio;
        document.getElementById('personalHorarioFin').value = personal.horarioFin;
        document.getElementById('personalEstado').value = personal.estado;
        this.setDiasLaborales(personal.diasDisponibles);

        // Guardar ID para edición
        const modal = document.getElementById('personalModal');
        modal.dataset.personalId = personalId;

        // Actualizar título
        const titleElement = modal.querySelector('.modal-header h2');
        if (titleElement) {
            titleElement.innerHTML = '<i class="fas fa-user-edit"></i> Editar Personal';
        }

        modal.style.display = 'block';
    },

    // Eliminar personal
    async eliminarPersonal(personalId) {
        const personal = this.state.personal.find(p => String(p.id) === String(personalId));

        if (!personal) {
            showNotification('Personal no encontrado', 'error');
            return;
        }

        if (confirm(`¿Deseas eliminar a ${personal.nombre} ${personal.apellidoPaterno}?`)) {
            try {
                const token = this.getAuthToken();
                if (!token) throw new Error('No hay token de autenticación');
                const response = await fetch(this.getApiUrl(`/${personalId}`), {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || `Error ${response.status}`);

                this.state.personal = this.state.personal.filter(p => String(p.id) !== String(personalId));
                this.savePersonalToDB();
                this.renderPersonal();
                showNotification('✓ Personal eliminado', 'success');
            } catch (error) {
                console.error('Error eliminando personal médico:', error);
                showNotification(`No se pudo eliminar: ${error.message}`, 'error');
            }
        }
    },

    // Ver disponibilidad de personal
    verDisponibilidad(personalId) {
        const personal = this.state.personal.find(p => String(p.id) === String(personalId));
        if (!personal) {
            showNotification('Personal no encontrado', 'error');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog" style="max-width: 600px;">
                <div class="modal-header">
                    <h2><i class="fas fa-calendar-alt"></i> Disponibilidad - ${personal.nombre}</h2>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; gap: 15px;">
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                            <h4 style="margin: 0 0 15px 0; color: #667eea;">Horario Laboral</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div>
                                    <strong>Entrada</strong><br>
                                    <p style="margin: 5px 0; font-size: 18px;">${personal.horarioInicio}</p>
                                </div>
                                <div>
                                    <strong>Salida</strong><br>
                                    <p style="margin: 5px 0; font-size: 18px;">${personal.horarioFin}</p>
                                </div>
                            </div>
                        </div>

                        <div style="background: #e8f5e9; padding: 15px; border-radius: 5px;">
                            <h4 style="margin: 0 0 10px 0; color: #27ae60;">Días Disponibles</h4>
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                                ${['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map(dia => {
                                    const disponible = (personal.diasDisponibles || []).includes(dia);
                                    return `
                                        <div style="background: ${disponible ? '#4caf50' : '#ddd'}; color: ${disponible ? 'white' : '#666'}; padding: 10px; border-radius: 4px; text-align: center; font-weight: 600;">
                                            ${dia.charAt(0).toUpperCase() + dia.slice(1)}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px;">
                            <h4 style="margin: 0 0 10px 0; color: #1976d2;">Próximas Citas Disponibles</h4>
                            <p style="margin: 5px 0; color: #666; font-size: 13px;">
                                Próximas 5 horas disponibles para agendar citas médicas.
                            </p>
                            <ul style="margin: 10px 0; padding-left: 20px; font-size: 12px;">
                                <li>Hoy: 14:00 - 16:00 (2 horas)</li>
                                <li>Mañana: 08:00 - 16:00 (8 horas)</li>
                                <li>Miércoles: 08:00 - 16:00 (8 horas)</li>
                            </ul>
                        </div>

                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
                            <button type="button" class="btn btn-info" onclick="PersonalModule.editarDisponibilidad('${personal.id}'); this.closest('.modal-overlay').remove();">
                                <i class="fas fa-pencil-alt"></i> Editar Disponibilidad
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    // Editar disponibilidad de personal (Placeholder para futuro)
    editarDisponibilidad(personalId) {
        AlertasModule.mostrarInfo('Funcionalidad de edición de disponibilidad en desarrollo');
    }
};

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof PersonalModule !== 'undefined') {
            PersonalModule.init();
        }
    });
} else {
    if (typeof PersonalModule !== 'undefined') {
        PersonalModule.init();
    }
}
