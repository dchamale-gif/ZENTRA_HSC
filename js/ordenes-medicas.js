// ============================================
// MÓDULO DE ÓRDENES MÉDICAS
// ============================================
// Gestión de órdenes médicas, servicios solicitados, vinculación con historia clínica

const OrdenesmedicasModule = {
    state: {
        ordenes: [],
        pacientes: [],
        servicios: [
            { id: 1, nombre: 'Radiografía', categoria: 'Imágenes', costo: 150 },
            { id: 2, nombre: 'Tomografía', categoria: 'Imágenes', costo: 500 },
            { id: 3, nombre: 'Resonancia Magnética', categoria: 'Imágenes', costo: 800 },
            { id: 4, nombre: 'Análisis de Sangre', categoria: 'Laboratorio', costo: 50 },
            { id: 5, nombre: 'Análisis de Orina', categoria: 'Laboratorio', costo: 30 },
            { id: 6, nombre: 'Electrocardiograma', categoria: 'Cardiología', costo: 100 },
            { id: 7, nombre: 'Ecografía', categoria: 'Imágenes', costo: 200 },
            { id: 8, nombre: 'Endoscopia', categoria: 'Gastroenterología', costo: 350 },
            { id: 9, nombre: 'Colonoscopia', categoria: 'Gastroenterología', costo: 400 },
            { id: 10, nombre: 'Psicometría', categoria: 'Psicología', costo: 200 }
        ],
        searchTerm: '',
        pacienteSearch: '',
        filtroEstado: 'todos',
        filtroFecha: 'todos',
        filtroPaciente: '',
        ordenSeleccionada: null
    },

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        this.loadData();
        console.log('Módulo de Órdenes Médicas inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        const searchInput = document.getElementById('searchOrdenMedica');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.state.searchTerm = e.target.value;
                this.renderOrdenes();
            });
        }

        const filterEstado = document.getElementById('filterEstadoOrden');
        if (filterEstado) {
            filterEstado.addEventListener('change', (e) => {
                this.state.filtroEstado = e.target.value;
                this.renderOrdenes();
            });
        }

        const filterFecha = document.getElementById('filterFechaOrden');
        if (filterFecha) {
            filterFecha.addEventListener('change', (e) => {
                this.state.filtroFecha = e.target.value;
                this.renderOrdenes();
            });
        }

        const btnNuevaOrden = document.getElementById('btnNuevaOrdenMedica');
        if (btnNuevaOrden) {
            btnNuevaOrden.addEventListener('click', () => this.openNuevaOrdenModal());
        }

        const buscarPaciente = document.getElementById('buscarPacienteOrden');
        if (buscarPaciente) {
            buscarPaciente.addEventListener('input', (e) => {
                this.state.pacienteSearch = e.target.value;
                this.cargarPacientes();
            });
        }
    },

    getApiUrl(path) {
        const configuredUrl = typeof authManager !== 'undefined'
            ? authManager.apiBaseUrl
            : 'http://178.128.72.110:3011';
        const apiRoot = configuredUrl.replace(/\/$/, '').replace(/\/api$/, '');
        return `${apiRoot}/api${path}`;
    },

    getAuthToken() {
        return typeof authManager !== 'undefined' ? authManager.getToken() : null;
    },

    normalizeOrden(orden) {
        return {
            id: String(orden.id),
            pacienteId: String(orden.paciente_id ?? orden.pacienteId),
            doctor: orden.doctor || '',
            descripcion: orden.descripcion || '',
            notas: orden.notas || '',
            servicios: Array.isArray(orden.servicios) ? orden.servicios : [],
            estado: orden.estado || 'pendiente',
            fechaOrden: (orden.fecha_orden || orden.fechaOrden || orden.created_at || '').split('T')[0],
            fechaCreacion: orden.created_at || orden.fechaCreacion || ''
        };
    },

    async fetchPacientes() {
        const response = await fetch(this.getApiUrl('/pacientes'), {
            headers: { Authorization: `Bearer ${this.getAuthToken()}` }
        });
        if (!response.ok) throw new Error(`No se pudieron cargar pacientes (${response.status})`);

        const data = await response.json();
        const pacientes = Array.isArray(data.pacientes) ? data.pacientes : [];
        return typeof DataNormalizer !== 'undefined'
            ? DataNormalizer.normalizePacientes(pacientes)
            : pacientes;
    },

    async fetchOrdenes() {
        const response = await fetch(this.getApiUrl('/ordenes'), {
            headers: { Authorization: `Bearer ${this.getAuthToken()}` }
        });
        if (!response.ok) throw new Error(`No se pudieron cargar órdenes (${response.status})`);

        const data = await response.json();
        const ordenes = Array.isArray(data.ordenes) ? data.ordenes : data;
        return Array.isArray(ordenes) ? ordenes.map(orden => this.normalizeOrden(orden)) : [];
    },

    // Cargar pacientes y órdenes desde la API
    async loadData() {
        try {
            if (!this.getAuthToken()) throw new Error('No hay token de autenticación');

            const [pacientes, ordenes] = await Promise.all([
                this.fetchPacientes(),
                this.fetchOrdenes()
            ]);
            this.state.pacientes = pacientes;
            this.state.ordenes = ordenes;
            localStorage.setItem('pacientes', JSON.stringify(pacientes));
            this.saveToDB();
        } catch (error) {
            console.warn('Error cargando de API, usando localStorage:', error);
            this.loadDataFromLocalStorage();
        }

        this.renderOrdenes();
    },

    // Cargar datos desde localStorage
    loadDataFromLocalStorage() {
        // Cargar pacientes SOLO del módulo PacientesModule
        if (typeof PacientesModule !== 'undefined' && PacientesModule.state && PacientesModule.state.pacientes) {
            this.state.pacientes = PacientesModule.state.pacientes;
        } else {
            this.state.pacientes = JSON.parse(localStorage.getItem('pacientes') || '[]');
        }

        // Cargar órdenes desde localStorage
        const ordenesFromStorage = localStorage.getItem('ordenesMedicas');
        if (ordenesFromStorage) {
            this.state.ordenes = JSON.parse(ordenesFromStorage);
        }
    },

    // Guardar datos a localStorage
    saveToDB() {
        localStorage.setItem('ordenesMedicas', JSON.stringify(this.state.ordenes));
    },

    // Renderizar tabla de órdenes
    renderOrdenes() {
        const container = document.getElementById('ordenesTable');
        if (!container) return;

        // Filtrar órdenes
        let ordenesFiltered = this.state.ordenes.filter(orden => {
            // Filtro por búsqueda
            const searchLower = this.state.searchTerm.toLowerCase();
            const paciente = this.state.pacientes.find(p => String(p.id) === String(orden.pacienteId));
            const nombrePaciente = paciente ? `${paciente.nombre || ''} ${paciente.apellidoPaterno || paciente.apellido_paterno || ''}`.toLowerCase() : '';
            const busquedaMatch = nombrePaciente.includes(searchLower) ||
                                orden.id.toLowerCase().includes(searchLower) ||
                                (orden.descripcion || '').toLowerCase().includes(searchLower);

            // Filtro por estado
            const estadoMatch = this.state.filtroEstado === 'todos' || orden.estado === this.state.filtroEstado;

            // Filtro por fecha
            let fechaMatch = true;
            if (this.state.filtroFecha !== 'todos') {
                const hoy = new Date();
                const fechaOrden = new Date(orden.fechaOrden);

                if (this.state.filtroFecha === 'hoy') {
                    fechaMatch = fechaOrden.toDateString() === hoy.toDateString();
                } else if (this.state.filtroFecha === 'semana') {
                    const hace7dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
                    fechaMatch = fechaOrden >= hace7dias && fechaOrden <= hoy;
                } else if (this.state.filtroFecha === 'mes') {
                    const hacemeses = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
                    fechaMatch = fechaOrden >= hacemeses && fechaOrden <= hoy;
                }
            }

            return busquedaMatch && estadoMatch && fechaMatch;
        });

        // Ordenar por fecha (más reciente primero)
        ordenesFiltered.sort((a, b) => new Date(b.fechaOrden) - new Date(a.fechaOrden));

        // Renderizar tabla
        if (ordenesFiltered.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <i class="fas fa-file-medical" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                    <p style="font-size: 16px; margin: 10px 0;">
                        ${this.state.searchTerm ? 'No se encontraron órdenes' : 'No hay órdenes médicas registradas'}
                    </p>
                    <small>${this.state.searchTerm ? 'Intenta con otro término de búsqueda' : 'Crea una nueva orden médica'}</small>
                </div>
            `;
            return;
        }

        let html = `
            <table style="width: 100%; border-collapse: collapse; background: white;">
                <thead style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <tr>
                        <th style="padding: 15px; text-align: left; font-weight: 600;">ID Orden</th>
                        <th style="padding: 15px; text-align: left; font-weight: 600;">Paciente</th>
                        <th style="padding: 15px; text-align: left; font-weight: 600;">Fecha</th>
                        <th style="padding: 15px; text-align: left; font-weight: 600;">Doctor</th>
                        <th style="padding: 15px; text-align: left; font-weight: 600;">Servicios</th>
                        <th style="padding: 15px; text-align: center; font-weight: 600;">Estado</th>
                        <th style="padding: 15px; text-align: center; font-weight: 600;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
        `;

        ordenesFiltered.forEach(orden => {
            const paciente = this.state.pacientes.find(p => String(p.id) === String(orden.pacienteId));
            const nombrePaciente = paciente ? `${paciente.nombre || ''} ${paciente.apellidoPaterno || paciente.apellido_paterno || ''}`.trim() : 'Sin paciente';
            const numServicios = (orden.servicios || []).length;
            
            // Color del estado
            let estadoBgColor = '#e0e0e0';
            let estadoTextColor = '#333';
            
            if (orden.estado === 'pendiente') {
                estadoBgColor = '#ffc107';
                estadoTextColor = '#000';
            } else if (orden.estado === 'completada') {
                estadoBgColor = '#4caf50';
                estadoTextColor = '#fff';
            } else if (orden.estado === 'cancelada') {
                estadoBgColor = '#f44336';
                estadoTextColor = '#fff';
            }

            html += `
                <tr style="border-bottom: 1px solid #eee; transition: background 0.2s;"
                    onmouseover="this.style.background='#f5f5f5'"
                    onmouseout="this.style.background='white'">
                    <td style="padding: 12px 15px; font-weight: 600; color: #667eea;">${orden.id}</td>
                    <td style="padding: 12px 15px;">${nombrePaciente}</td>
                    <td style="padding: 12px 15px;">${orden.fechaOrden}</td>
                    <td style="padding: 12px 15px;">${orden.doctor || 'Sin asignar'}</td>
                    <td style="padding: 12px 15px;">
                        <span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 3px; font-size: 12px;">
                            ${numServicios} servicio${numServicios !== 1 ? 's' : ''}
                        </span>
                    </td>
                    <td style="padding: 12px 15px; text-align: center;">
                        <span style="background: ${estadoBgColor}; color: ${estadoTextColor}; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                            ${orden.estado.charAt(0).toUpperCase() + orden.estado.slice(1)}
                        </span>
                    </td>
                    <td style="padding: 12px 15px; text-align: center;">
                        <button class="btn btn-sm btn-info" onclick="OrdenesmedicasModule.verDetalles('${orden.id}')" title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="OrdenesmedicasModule.editarOrden('${orden.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="OrdenesmedicasModule.eliminarOrden('${orden.id}')" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn btn-sm btn-success" onclick="OrdenesmedicasModule.descargarPDF('${orden.id}')" title="Descargar PDF">
                            <i class="fas fa-file-pdf"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
            <div style="padding: 15px; background: #f5f5f5; text-align: right; font-size: 12px; color: #666;">
                Total: <strong>${ordenesFiltered.length}</strong> de <strong>${this.state.ordenes.length}</strong> órdenes
            </div>
        `;

        container.innerHTML = html;
    },

    // Abrir modal para nueva orden
    async openNuevaOrdenModal() {
        const modal = document.getElementById('ordenMedicaModal');
        if (!modal) {
            AlertasModule.mostrarError('Modal no encontrado');
            return;
        }

        // Limpiar formulario
        document.getElementById('ordenPacienteId').value = '';
        document.getElementById('ordenDoctor').value = '';
        document.getElementById('ordenMedicaDescripcion').value = '';
        document.getElementById('ordenNotas').value = '';
        document.getElementById('buscarPacienteOrden').value = '';
        this.state.pacienteSearch = '';
        document.getElementById('serviciosSeleccionados').innerHTML = '<p style="text-align: center; color: #999;">No hay servicios seleccionados</p>';
        document.getElementById('serviciosSeleccionados').dataset.servicios = '';

        // Guardar que es creación nueva (no edición)
        modal.dataset.ordenId = '';
        modal.dataset.titulo = 'Nueva Orden Médica';

        // Actualizar título del modal
        const titleElement = modal.querySelector('.modal-header h2');
        if (titleElement) {
            titleElement.innerHTML = '<i class="fas fa-file-medical-alt"></i> Nueva Orden Médica';
        }

        // Mostrar el modal mientras se actualiza la lista de pacientes
        modal.style.display = 'block';
        await this.cargarPacientesDesdeAPI();

        // Cargar servicios disponibles
        this.cargarServicios();
    },

    async cargarPacientesDesdeAPI() {
        const resultado = document.getElementById('resultadoPacientesOrden');
        if (resultado) resultado.textContent = 'Cargando pacientes...';

        try {
            if (!this.getAuthToken()) throw new Error('No hay token de autenticación');
            this.state.pacientes = await this.fetchPacientes();
            localStorage.setItem('pacientes', JSON.stringify(this.state.pacientes));
        } catch (error) {
            console.warn('No se pudo actualizar pacientes desde API:', error);
            if (this.state.pacientes.length === 0) {
                this.state.pacientes = JSON.parse(localStorage.getItem('pacientes') || '[]');
            }
        }

        this.cargarPacientes();
    },

    // Cargar servicios disponibles en select
    cargarServicios() {
        const select = document.getElementById('serviciosDisponibles');
        if (!select) return;

        select.innerHTML = '<option value="">-- Selecciona servicio --</option>' +
            this.state.servicios.map(s => {
                return `<option value="${s.id}">${s.nombre} (${s.categoria}) - $${s.costo}</option>`;
            }).join('');
    },

    // Cargar pacientes en select
    cargarPacientes() {
        const select = document.getElementById('ordenPacienteId');
        if (!select) return;

        const selectedValue = select.value;
        const search = this.state.pacienteSearch.trim().toLocaleLowerCase('es');
        const coincidencias = this.state.pacientes.filter(p => {
            const texto = `${p.nombre || ''} ${p.apellidoPaterno || p.apellido_paterno || ''} ${p.apellidoMaterno || p.apellido_materno || ''} ${p.dpi || p.cedula || ''}`;
            return !search || texto.toLocaleLowerCase('es').includes(search);
        });
        const visibles = coincidencias.slice(0, 50);

        select.replaceChildren(new Option('-- Selecciona un paciente --', ''));
        visibles.forEach(paciente => {
            const nombre = `${paciente.nombre || ''} ${paciente.apellidoPaterno || paciente.apellido_paterno || ''} ${paciente.apellidoMaterno || paciente.apellido_materno || ''}`.trim();
            select.add(new Option(`${nombre} (DPI: ${paciente.dpi || paciente.cedula || 'N/A'})`, String(paciente.id)));
        });

        if (visibles.some(paciente => String(paciente.id) === selectedValue)) {
            select.value = selectedValue;
        }

        const resultado = document.getElementById('resultadoPacientesOrden');
        if (resultado) {
            resultado.textContent = coincidencias.length > 50
                ? `Mostrando 50 de ${coincidencias.length}; escribe para filtrar.`
                : `${coincidencias.length} paciente${coincidencias.length === 1 ? '' : 's'} encontrado${coincidencias.length === 1 ? '' : 's'}.`;
        }
    },

    // Agregar servicio a la orden
    agregarServicio() {
        const selectServicios = document.getElementById('serviciosDisponibles');
        if (!selectServicios || !selectServicios.value) {
            AlertasModule.mostrarError('Selecciona un servicio');
            return;
        }

        const servicioId = parseInt(selectServicios.value);
        const servicio = this.state.servicios.find(s => s.id === servicioId);

        if (!servicio) {
            AlertasModule.mostrarError('Servicio no encontrado');
            return;
        }

        // Obtener servicios seleccionados
        let serviciosSeleccionados = [];
        const container = document.getElementById('serviciosSeleccionados');
        if (container.dataset.servicios) {
            serviciosSeleccionados = JSON.parse(container.dataset.servicios);
        }

        // Validar que no esté duplicado
        if (serviciosSeleccionados.some(s => s.id === servicioId)) {
            AlertasModule.mostrarAdvertencia('Este servicio ya está seleccionado');
            return;
        }

        // Agregar servicio
        serviciosSeleccionados.push(servicio);
        container.dataset.servicios = JSON.stringify(serviciosSeleccionados);

        // Renderizar servicios seleccionados
        this.renderServiciosSeleccionados();
    },

    // Renderizar servicios seleccionados
    renderServiciosSeleccionados() {
        const container = document.getElementById('serviciosSeleccionados');
        if (!container) return;

        const servicios = container.dataset.servicios ? JSON.parse(container.dataset.servicios) : [];
        
        if (servicios.length === 0) {
            container.innerHTML = '<p style="color: #999; text-align: center;">No hay servicios seleccionados</p>';
            return;
        }

        let totalCosto = 0;
        let html = '<div style="display: grid; gap: 10px;">';

        servicios.forEach((servicio, idx) => {
            totalCosto += servicio.costo || 0;
            html += `
                <div style="background: #f5f5f5; padding: 10px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${servicio.nombre}</strong>
                        <br>
                        <small style="color: #666;">${servicio.categoria} - $${servicio.costo || 0}</small>
                    </div>
                    <button type="button" class="btn btn-sm btn-danger" 
                            onclick="OrdenesmedicasModule.removerServicio(${idx})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });

        html += '</div>';
        html += `
            <div style="margin-top: 15px; padding: 10px; background: #e8f5e9; border-radius: 4px; text-align: right;">
                <strong>Total: $${totalCosto.toFixed(2)}</strong>
            </div>
        `;

        container.innerHTML = html;
    },

    // Remover servicio
    removerServicio(index) {
        const container = document.getElementById('serviciosSeleccionados');
        const servicios = container.dataset.servicios ? JSON.parse(container.dataset.servicios) : [];
        
        servicios.splice(index, 1);
        container.dataset.servicios = JSON.stringify(servicios);
        this.renderServiciosSeleccionados();
    },

    // Guardar orden médica
    async guardarOrden() {
        const pacienteId = document.getElementById('ordenPacienteId')?.value?.trim();
        const doctor = document.getElementById('ordenDoctor')?.value?.trim();
        const descripcion = document.getElementById('ordenMedicaDescripcion')?.value?.trim();
        const notas = document.getElementById('ordenNotas')?.value?.trim();
        const container = document.getElementById('serviciosSeleccionados');
        const servicios = container.dataset.servicios ? JSON.parse(container.dataset.servicios) : [];

        // Validaciones
        if (!pacienteId) {
            AlertasModule.mostrarError('Selecciona un paciente');
            return;
        }

        if (!doctor) {
            AlertasModule.mostrarError('Nombre del doctor es obligatorio');
            return;
        }

        if (!descripcion) {
            AlertasModule.mostrarError('Descripción de la orden es obligatoria');
            return;
        }

        if (servicios.length === 0) {
            AlertasModule.mostrarError('Debes agregar al menos un servicio');
            return;
        }

        // Obtener ID de orden si es edición
        const modal = document.getElementById('ordenMedicaModal');
        const ordenId = modal?.dataset.ordenId;

        const saveButton = modal.querySelector('button[onclick*="guardarOrden"]');
        if (saveButton) saveButton.disabled = true;

        try {
            if (!this.getAuthToken()) throw new Error('No hay token de autenticación');
            const response = await fetch(this.getApiUrl(ordenId ? `/ordenes/${ordenId}` : '/ordenes'), {
                method: ordenId ? 'PUT' : 'POST',
                headers: {
                    Authorization: `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    paciente_id: pacienteId,
                    tipo: 'medica',
                    doctor,
                    descripcion,
                    notas,
                    servicios,
                    estado: ordenId ? this.state.ordenes.find(o => String(o.id) === String(ordenId))?.estado : 'pendiente',
                    fecha_orden: new Date().toISOString().split('T')[0]
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Error ${response.status}`);

            const ordenGuardada = this.normalizeOrden(data.orden || data);
            if (ordenId) {
                this.state.ordenes = this.state.ordenes.map(orden => String(orden.id) === String(ordenId) ? ordenGuardada : orden);
            } else {
                this.state.ordenes.unshift(ordenGuardada);
            }
            this.saveToDB();
            this.renderOrdenes();
            modal.style.display = 'none';

            const paciente = this.state.pacientes.find(p => String(p.id) === pacienteId);
            AlertasModule.mostrarExito(`✓ Orden médica ${ordenId ? 'actualizada' : 'creada'} para ${paciente?.nombre || 'paciente'}`);
        } catch (error) {
            console.error('Error guardando orden médica:', error);
            AlertasModule.mostrarError(`No se pudo guardar la orden: ${error.message}`);
        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    },

    // Ver detalles de orden
    verDetalles(ordenId) {
        const orden = this.state.ordenes.find(o => String(o.id) === String(ordenId));
        const paciente = this.state.pacientes.find(p => String(p.id) === String(orden?.pacienteId));

        if (!orden || !paciente) {
            AlertasModule.mostrarError('Orden o paciente no encontrado');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog" style="max-width: 600px;">
                <div class="modal-header">
                    <h2><i class="fas fa-file-medical-alt"></i> Detalles de Orden Médica</h2>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; gap: 15px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                                <strong style="color: #667eea;">ID Orden</strong><br>
                                <p style="margin: 5px 0;">${orden.id}</p>
                            </div>
                            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                                <strong style="color: #667eea;">Fecha</strong><br>
                                <p style="margin: 5px 0;">${orden.fechaOrden}</p>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                                <strong style="color: #667eea;">Paciente</strong><br>
                                <p style="margin: 5px 0;">${paciente.nombre} ${paciente.apellidoPaterno || paciente.apellido_paterno || ''}</p>
                                <small style="color: #666;">DPI: ${paciente.dpi || paciente.cedula || 'N/A'}</small>
                            </div>
                            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                                <strong style="color: #667eea;">Doctor</strong><br>
                                <p style="margin: 5px 0;">${orden.doctor}</p>
                            </div>
                        </div>

                        <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                            <strong style="color: #667eea;">Descripción</strong><br>
                            <p style="margin: 5px 0; white-space: pre-wrap;">${orden.descripcion}</p>
                        </div>

                        <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                            <strong style="color: #667eea;">Servicios Solicitados (${orden.servicios?.length || 0})</strong><br>
                            ${(orden.servicios || []).map(s => `
                                <div style="padding: 8px; background: white; margin: 8px 0; border-radius: 3px;">
                                    <strong>${s.nombre}</strong> - ${s.categoria}
                                    <div style="text-align: right; color: #667eea; font-weight: 600;">$${s.costo || 0}</div>
                                </div>
                            `).join('')}
                            <div style="margin-top: 10px; padding-top: 10px; border-top: 2px solid #ddd; text-align: right;">
                                <strong>Total: $${((orden.servicios || []).reduce((sum, s) => sum + (s.costo || 0), 0)).toFixed(2)}</strong>
                            </div>
                        </div>

                        ${orden.notas ? `
                            <div style="background: #fff3cd; padding: 12px; border-radius: 4px;">
                                <strong style="color: #856404;">Notas</strong><br>
                                <p style="margin: 5px 0; white-space: pre-wrap;">${orden.notas}</p>
                            </div>
                        ` : ''}

                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
                            <button type="button" class="btn btn-info" onclick="OrdenesmedicasModule.editarOrden('${orden.id}'); this.closest('.modal-overlay').remove();">
                                <i class="fas fa-edit"></i> Editar
                            </button>
                            <button type="button" class="btn btn-success" onclick="OrdenesmedicasModule.descargarPDF('${orden.id}'); this.closest('.modal-overlay').remove();">
                                <i class="fas fa-file-pdf"></i> Descargar PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    // Editar orden
    editarOrden(ordenId) {
        const orden = this.state.ordenes.find(o => String(o.id) === String(ordenId));
        if (!orden) {
            AlertasModule.mostrarError('Orden no encontrada');
            return;
        }

        // Llenar formulario
        document.getElementById('ordenPacienteId').value = orden.pacienteId;
        document.getElementById('ordenDoctor').value = orden.doctor;
        document.getElementById('ordenMedicaDescripcion').value = orden.descripcion;
        document.getElementById('ordenNotas').value = orden.notas || '';

        // Establecer servicios seleccionados
        const container = document.getElementById('serviciosSeleccionados');
        container.dataset.servicios = JSON.stringify(orden.servicios || []);
        this.renderServiciosSeleccionados();

        // Guardar ID de orden para edición
        const modal = document.getElementById('ordenMedicaModal');
        modal.dataset.ordenId = ordenId;

        // Actualizar título
        const titleElement = modal.querySelector('.modal-header h2');
        if (titleElement) {
            titleElement.innerHTML = '<i class="fas fa-file-medical-alt"></i> Editar Orden Médica';
        }

        modal.style.display = 'block';
    },

    // Eliminar orden
    async eliminarOrden(ordenId) {
        const orden = this.state.ordenes.find(o => String(o.id) === String(ordenId));
        const paciente = this.state.pacientes.find(p => String(p.id) === String(orden?.pacienteId));

        if (!orden) {
            AlertasModule.mostrarError('Orden no encontrada');
            return;
        }

        if (confirm(`¿Deseas eliminar la orden médica de ${paciente?.nombre || 'paciente'}?`)) {
            try {
                if (!this.getAuthToken()) throw new Error('No hay token de autenticación');
                const response = await fetch(this.getApiUrl(`/ordenes/${ordenId}`), {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${this.getAuthToken()}` }
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || `Error ${response.status}`);

                this.state.ordenes = this.state.ordenes.filter(o => String(o.id) !== String(ordenId));
                this.saveToDB();
                this.renderOrdenes();
                AlertasModule.mostrarExito('✓ Orden médica eliminada');
            } catch (error) {
                console.error('Error eliminando orden médica:', error);
                AlertasModule.mostrarError(`No se pudo eliminar la orden: ${error.message}`);
            }
        }
    },

    // Descargar PDF de orden
    descargarPDF(ordenId) {
        const orden = this.state.ordenes.find(o => String(o.id) === String(ordenId));
        const paciente = this.state.pacientes.find(p => String(p.id) === String(orden?.pacienteId));

        if (!orden || !paciente) {
            AlertasModule.mostrarError('Orden o paciente no encontrado');
            return;
        }

        // Crear contenido HTML del PDF
        const contenidoHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Orden Médica - ${orden.id}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { background: #667eea; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
                    .section { margin-bottom: 20px; }
                    .section-title { background: #f5f5f5; padding: 10px; font-weight: bold; margin-bottom: 10px; }
                    .field { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px; }
                    .field-item { }
                    .label { font-weight: bold; color: #667eea; }
                    .value { margin-top: 5px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background: #f5f5f5; }
                    .total { text-align: right; font-weight: bold; }
                    .footer { margin-top: 30px; border-top: 2px solid #ddd; padding-top: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>ORDEN MÉDICA</h1>
                    <p>ID: ${orden.id}</p>
                </div>

                <div class="section">
                    <div class="section-title">Información General</div>
                    <div class="field">
                        <div class="field-item">
                            <div class="label">Fecha</div>
                            <div class="value">${orden.fechaOrden}</div>
                        </div>
                        <div class="field-item">
                            <div class="label">Estado</div>
                            <div class="value">${orden.estado.toUpperCase()}</div>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Información del Paciente</div>
                    <div class="field">
                        <div class="field-item">
                            <div class="label">Nombre</div>
                            <div class="value">${paciente.nombre} ${paciente.apellidoPaterno || paciente.apellido_paterno || ''}</div>
                        </div>
                        <div class="field-item">
                            <div class="label">DPI</div>
                            <div class="value">${paciente.dpi || paciente.cedula || 'N/A'}</div>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Información Médica</div>
                    <div class="field">
                        <div class="field-item">
                            <div class="label">Doctor</div>
                            <div class="value">${orden.doctor}</div>
                        </div>
                    </div>
                    <div class="field-item">
                        <div class="label">Descripción</div>
                        <div class="value" style="white-space: pre-wrap;">${orden.descripcion}</div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Servicios Solicitados</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Servicio</th>
                                <th>Categoría</th>
                                <th style="text-align: right;">Costo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(orden.servicios || []).map(s => `
                                <tr>
                                    <td>${s.nombre}</td>
                                    <td>${s.categoria}</td>
                                    <td style="text-align: right;">$${s.costo || 0}</td>
                                </tr>
                            `).join('')}
                            <tr style="background: #f5f5f5;">
                                <td colspan="2" class="total">TOTAL:</td>
                                <td class="total">$${((orden.servicios || []).reduce((sum, s) => sum + (s.costo || 0), 0)).toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                ${orden.notas ? `
                    <div class="section">
                        <div class="section-title">Notas Adicionales</div>
                        <div style="white-space: pre-wrap;">${orden.notas}</div>
                    </div>
                ` : ''}

                <div class="footer">
                    <p style="text-align: center; color: #999; font-size: 12px;">
                        Generado el: ${new Date().toLocaleString()}
                    </p>
                </div>
            </body>
            </html>
        `;

        // Abrir en nueva ventana e imprimir
        const ventana = window.open('', '_blank');
        ventana.document.write(contenidoHTML);
        ventana.document.close();
        
        setTimeout(() => {
            ventana.print();
        }, 250);
    },

    // Mostrar notificación
    showNotification(message, type = 'info') {
        if (typeof AlertasModule !== 'undefined' && AlertasModule.showNotification) {
            AlertasModule.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
};

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof OrdenesmedicasModule !== 'undefined') {
            OrdenesmedicasModule.init();
        }
    });
} else {
    if (typeof OrdenesmedicasModule !== 'undefined') {
        OrdenesmedicasModule.init();
    }
}
