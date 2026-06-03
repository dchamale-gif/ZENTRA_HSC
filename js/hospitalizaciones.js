// ============================================
// MÓDULO DE HOSPITALIZACIONES
// ============================================
// Gestión de pacientes hospitalizados
// Ubicación de pacientes en habitaciones/camas

const HospitalizacionesModule = {
    state: {
        pacientes: [],
        hospitalizaciones: [], // {id, pacienteId, habitacion, cama, fechaIngreso, diagnostico, estado}
        filtros: {
            piso: '',
            estado: 'activos'
        }
    },

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        this.loadData();
        console.log('Módulo de Hospitalizaciones inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        const addBtn = document.getElementById('addHospitalizacionBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.openAddModal());
        }

        const filterPiso = document.getElementById('filterPiso');
        if (filterPiso) {
            filterPiso.addEventListener('change', (e) => {
                this.state.filtros.piso = e.target.value;
                this.render();
            });
        }

        const filterEstado = document.getElementById('filterEstadoHosp');
        if (filterEstado) {
            filterEstado.addEventListener('change', (e) => {
                this.state.filtros.estado = e.target.value;
                this.render();
            });
        }
    },

    // Cargar datos
    loadData() {
        const demoData = window.DemoData || {};
        this.state.pacientes = JSON.parse(JSON.stringify(demoData.pacientes || []));
        
        // Cargar hospitalizaciones desde localStorage si existen
        const hospFromStorage = localStorage.getItem('hospitalizaciones');
        if (hospFromStorage) {
            this.state.hospitalizaciones = JSON.parse(hospFromStorage);
        } else {
            // Cargar demo data si existe
            this.state.hospitalizaciones = JSON.parse(JSON.stringify(demoData.hospitalizaciones || []));
        }
        
        this.render();
    },

    // Guardar datos a localStorage
    saveToDB() {
        localStorage.setItem('hospitalizaciones', JSON.stringify(this.state.hospitalizaciones));
    },

    // Renderizar vista principal
    render() {
        this.renderHabitaciones();
        this.renderTable();
    },

    // Renderizar layout visual de habitaciones
    renderHabitaciones() {
        const container = document.getElementById('habitacionesContainer');
        if (!container) return;

        // Definir layout de habitaciones
        const pisos = {
            '1': {
                nombre: 'Piso 1',
                habitaciones: Array.from({length: 8}, (_, i) => ({
                    id: `1-${i+1}`,
                    numero: i + 1,
                    camas: 2,
                    piso: '1'
                }))
            },
            '2': {
                nombre: 'Piso 2',
                habitaciones: Array.from({length: 8}, (_, i) => ({
                    id: `2-${i+1}`,
                    numero: i + 1,
                    camas: 2,
                    piso: '2'
                }))
            },
            '3': {
                nombre: 'Piso 3',
                habitaciones: Array.from({length: 6}, (_, i) => ({
                    id: `3-${i+1}`,
                    numero: i + 1,
                    camas: 2,
                    piso: '3'
                }))
            }
        };

        let html = '';
        const pisoFiltro = this.state.filtros.piso;

        // Determinar qué pisos mostrar
        const pisosAMostrar = pisoFiltro ? [pisoFiltro] : ['1', '2', '3'];

        pisosAMostrar.forEach(numeroPiso => {
            const piso = pisos[numeroPiso];
            html += `
                <div style="margin-bottom: 40px;">
                    <h3 style="color: #1e3a8a; margin-bottom: 20px; padding: 10px; background: #f0f4f8; border-radius: 5px;">
                        <i class="fas fa-building"></i> ${piso.nombre}
                    </h3>
                    <div class="habitaciones-flex">
            `;

            piso.habitaciones.forEach(habitacion => {
                html += this.renderHabitacion(habitacion);
            });

            html += `
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        
        // Agregar event listeners para drag and drop
        this.setupDragAndDrop();
    },

    // Configurar event listeners para drag and drop
    setupDragAndDrop() {
        // Event listeners para elementos arrastrables (pacientes)
        document.querySelectorAll('.cama-ocupada[draggable="true"]').forEach(elem => {
            elem.addEventListener('dragstart', (e) => this.handleDragStart(e));
            elem.addEventListener('dragend', (e) => this.handleDragEnd(e));
        });

        // Event listeners para zonas de drop (camas libres)
        document.querySelectorAll('.drop-zone').forEach(elem => {
            elem.addEventListener('dragover', (e) => this.handleDragOver(e));
            elem.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            elem.addEventListener('drop', (e) => this.handleDrop(e));
        });
    },

    // Manejar inicio del arrastre
    handleDragStart(e) {
        const cama = e.target.closest('[data-hosp-id]');
        if (!cama) return;

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('hospId', cama.dataset.hospId);
        e.dataTransfer.setData('pacienteId', cama.dataset.pacienteId);
        e.dataTransfer.setData('camaOrigen', cama.dataset.camaOrigen);
        
        cama.style.opacity = '0.5';
        cama.classList.add('dragging');
    },

    // Manejar fin del arrastre
    handleDragEnd(e) {
        const cama = e.target.closest('[data-hosp-id]');
        if (cama) {
            cama.style.opacity = '1';
            cama.classList.remove('dragging');
        }

        // Remover clase visual de todas las zonas de drop
        document.querySelectorAll('.drop-zone').forEach(elem => {
            elem.classList.remove('drag-over');
        });
    },

    // Manejar drag over
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.target.closest('.drop-zone')?.classList.add('drag-over');
    },

    // Manejar drag leave
    handleDragLeave(e) {
        e.target.closest('.drop-zone')?.classList.remove('drag-over');
    },

    // Manejar drop
    handleDrop(e) {
        e.preventDefault();
        
        const dropZone = e.target.closest('.drop-zone');
        if (!dropZone) return;

        const camadestino = dropZone.dataset.camaDestino;
        const hospId = e.dataTransfer.getData('hospId');
        const pacienteId = e.dataTransfer.getData('pacienteId');
        const camaOrigen = e.dataTransfer.getData('camaOrigen');

        dropZone.classList.remove('drag-over');

        // Validar que no sea la misma cama
        if (camadestino === camaOrigen) {
            return;
        }

        // Abrir modal para pedir la razón del traslado
        this.openModalTraslado(hospId, pacienteId, camaOrigen, camadestino);
    },

    // Abrir modal para la razón del traslado
    openModalTraslado(hospId, pacienteId, camaOrigen, camaDestino) {
        const hosp = this.state.hospitalizaciones.find(h => h.id === hospId);
        const paciente = this.state.pacientes.find(p => p.id === pacienteId);

        if (!hosp || !paciente) return;

        const camaOrigenInfo = camaOrigen.split('-');
        const camaDestinoInfo = camaDestino.split('-');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog" style="max-width: 500px;">
                <div class="modal-header">
                    <h2><i class="fas fa-exchange-alt"></i> Traslado de Paciente</h2>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; gap: 15px;">
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                            <strong>Paciente</strong><br>
                            <p style="margin: 5px 0;">${paciente.nombre} ${paciente.apellido}</p>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center;">
                            <div style="background: #fff3cd; padding: 10px; border-radius: 5px; text-align: center;">
                                <small style="color: #856404;">Origen</small><br>
                                <strong>Piso ${camaOrigenInfo[0]}, Hab. ${camaOrigenInfo[1]}</strong>
                            </div>
                            <div style="text-align: center; font-size: 20px; color: #2196F3;">
                                <i class="fas fa-arrow-right"></i>
                            </div>
                            <div style="background: #d4edda; padding: 10px; border-radius: 5px; text-align: center;">
                                <small style="color: #155724;">Destino</small><br>
                                <strong>Piso ${camaDestinoInfo[0]}, Hab. ${camaDestinoInfo[1]}</strong>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Razón del Traslado <span class="required">*</span></label>
                            <select id="razonTraslado" class="form-input" required>
                                <option value="">-- Selecciona una razón --</option>
                                <option value="cambio-solicitud">Cambio solicitado por paciente</option>
                                <option value="cambio-medico">Recomendación médica</option>
                                <option value="cambio-higiene">Motivos de higiene/sanitarios</option>
                                <option value="cambio-luz">Mejor luminosidad</option>
                                <option value="cambio-ruido">Reducir exposición a ruido</option>
                                <option value="cambio-acceso">Mejor acceso a servicios</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Detalles (opcional)</label>
                            <textarea id="detallesTraslado" class="form-input" placeholder="Detalles adicionales del traslado..." rows="3"></textarea>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="HospitalizacionesModule.confirmarTraslado('${hospId}', '${camaDestino}')">
                                <i class="fas fa-check"></i> Confirmar Traslado
                            </button>
                        </div>
                    </div>
                </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // Confirmar traslado de paciente
    confirmarTraslado(hospId, camaDestino) {
        const razonSelect = document.getElementById('razonTraslado');
        const detallesArea = document.getElementById('detallesTraslado');

        if (!razonSelect.value) {
            alert('Por favor selecciona la razón del traslado');
            return;
        }

        const hosp = this.state.hospitalizaciones.find(h => h.id === hospId);
        if (!hosp) return;

        // Validar que la cama destino esté libre
        const camaOcupada = this.state.hospitalizaciones.find(h => 
            h.cama === camaDestino && h.estado === 'activa'
        );

        if (camaOcupada) {
            alert('La cama destino ya está ocupada. Por favor recarga la página.');
            document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
            this.render();
            return;
        }

        // Actualizar hospitalización
        const camaDestinoInfo = camaDestino.split('-');
        hosp.camaAnterior = hosp.cama;
        hosp.cama = camaDestino;
        hosp.habitacion = `${camaDestinoInfo[0]}-${camaDestinoInfo[1]}`;
        hosp.traslados = hosp.traslados || [];
        hosp.traslados.push({
            fecha: new Date().toISOString().split('T')[0],
            hora: new Date().toTimeString().split(' ')[0],
            desde: hosp.camaAnterior,
            hacia: camaDestino,
            razon: razonSelect.value,
            detalles: detallesArea.value || ''
        });

        this.saveToDB();
        this.render();

        // Cerrar modal
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

        this.showNotification(`Paciente trasladado exitosamente a Piso ${camaDestinoInfo[0]}, Habitación ${camaDestinoInfo[1]}`, 'success');
    },

    // Renderizar una habitación individual
    renderHabitacion(habitacion) {
        const hospitalizacionesEnHabitacion = this.state.hospitalizaciones.filter(h => 
            h.habitacion === habitacion.id && h.estado === 'activa'
        );

        let html = `
            <div class="habitacion-card">
                <div class="habitacion-header">
                    <h4>Habitación ${habitacion.numero}</h4>
                    <span class="ocupacion-badge">${hospitalizacionesEnHabitacion.length}/${habitacion.camas}</span>
                </div>
                <div class="camas-container">
        `;

        // Renderizar camas
        for (let i = 1; i <= habitacion.camas; i++) {
            const cama = `${habitacion.id}-${i}`;
            const hospitalizacion = hospitalizacionesEnHabitacion.find(h => h.cama === cama);
            const paciente = this.state.pacientes.find(p => p.id === hospitalizacion?.pacienteId);

            if (hospitalizacion && paciente) {
                html += `
                    <div class="cama-ocupada" draggable="true" data-hosp-id="${hospitalizacion.id}" data-paciente-id="${paciente.id}" data-cama-origen="${cama}">
                        <div class="cama-numero">Cama ${i}</div>
                        <div class="paciente-info">
                            <strong>${paciente.nombre} ${paciente.apellido}</strong>
                            <small>${paciente.cedula}</small>
                        </div>
                        <div class="diagnostico-badge">${hospitalizacion.diagnostico}</div>
                        <div class="dias-internacion">
                            <small>Desde: ${this.formatDate(hospitalizacion.fechaIngreso)}</small>
                        </div>
                        <button class="btn btn-sm btn-danger" onclick="HospitalizacionesModule.darDeAlta('${hospitalizacion.id}')">
                            <i class="fas fa-sign-out-alt"></i> Alta
                        </button>
                    </div>
                `;
            } else {
                html += `
                    <div class="cama-libre drop-zone" data-cama-destino="${cama}">
                        <div class="cama-numero">Cama ${i}</div>
                        <div class="estado-libre">LIBRE</div>
                        <button class="btn btn-sm btn-success" onclick="HospitalizacionesModule.openAddCamaModal('${cama}')">
                            <i class="fas fa-plus"></i> Ingresar
                        </button>
                    </div>
                `;
            }
        }

        html += `
                </div>
            </div>
        `;

        return html;
    },

    // Renderizar tabla de hospitalizados
    renderTable() {
        const container = document.getElementById('hospTableContainer');
        if (!container) return;

        // Filtrar hospitalizaciones
        let hospitalizados = this.state.hospitalizaciones;
        
        if (this.state.filtros.estado === 'activos') {
            hospitalizados = hospitalizados.filter(h => h.estado === 'activa');
        }

        if (this.state.filtros.piso) {
            hospitalizados = hospitalizados.filter(h => h.habitacion.startsWith(this.state.filtros.piso));
        }

        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Paciente</th>
                        <th>Cédula</th>
                        <th>Habitación</th>
                        <th>Cama</th>
                        <th>Diagnóstico</th>
                        <th>Fecha Ingreso</th>
                        <th>Días Internado</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (hospitalizados.length === 0) {
            html += `
                <tr>
                    <td colspan="9" style="text-align: center; color: #999; padding: 20px;">
                        <i class="fas fa-info-circle"></i> No hay pacientes hospitalizados
                    </td>
                </tr>
            `;
        } else {
            hospitalizados.forEach(hosp => {
                const paciente = this.state.pacientes.find(p => p.id === hosp.pacienteId);
                if (paciente) {
                    const dias = this.calcularDiasInternacion(hosp.fechaIngreso);
                    const habNumero = hosp.habitacion.split('-')[1];
                    const cama = hosp.cama.split('-')[2];

                    html += `
                        <tr>
                            <td><strong>${paciente.nombre} ${paciente.apellido}</strong></td>
                            <td>${paciente.cedula}</td>
                            <td>Hab. ${habNumero}</td>
                            <td>Cama ${cama}</td>
                            <td>${hosp.diagnostico}</td>
                            <td>${this.formatDate(hosp.fechaIngreso)}</td>
                            <td><strong>${dias}</strong></td>
                            <td><span class="badge badge-success">${hosp.estado === 'activa' ? 'Hospitalizado' : 'Alta'}</span></td>
                            <td class="actions">
                                <button class="btn-icon btn-view" onclick="HospitalizacionesModule.verDetalles('${hosp.id}')" title="Ver detalles">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn-icon btn-delete" onclick="HospitalizacionesModule.darDeAlta('${hosp.id}')" title="Dar de alta">
                                    <i class="fas fa-sign-out-alt"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }
            });
        }

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    },

    // Calcular días de internación
    calcularDiasInternacion(fechaIngreso) {
        const hoy = new Date();
        const fechaIng = new Date(fechaIngreso);
        const diferencia = hoy - fechaIng;
        const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
        return dias < 0 ? 0 : dias;
    },

    // Formatear fecha
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        });
    },

    // Generar ID único
    generateId(prefix) {
        return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
    },

    // Abrir modal para nuevo ingreso
    openAddModal() {
        // Crear modal dinámico
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-header">
                    <h2><i class="fas fa-user-plus"></i> Nuevo Ingreso - Seleccionar Habitación</h2>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;">
                        ${this.renderHabitacionesSelectable()}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // Renderizar habitaciones seleccionables
    renderHabitacionesSelectable() {
        const pisos = [
            { piso: '1', habitaciones: 8 },
            { piso: '2', habitaciones: 8 },
            { piso: '3', habitaciones: 6 }
        ];

        let html = '';
        pisos.forEach(piso => {
            for (let i = 1; i <= piso.habitaciones; i++) {
                const habId = `${piso.piso}-${i}`;
                const ocupadas = this.state.hospitalizaciones.filter(h => 
                    h.habitacion === habId && h.estado === 'activa'
                ).length;
                
                html += `
                    <div style="border: 2px solid #ddd; padding: 10px; border-radius: 5px; text-align: center; cursor: pointer; transition: all 0.2s;" 
                         onclick="HospitalizacionesModule.openHabitacionModal('${habId}')"
                         onmouseover="this.style.borderColor='#2196F3'; this.style.background='#f0f8ff';"
                         onmouseout="this.style.borderColor='#ddd'; this.style.background='white';">
                        <strong>Piso ${piso.piso}</strong><br>
                        Hab. ${i}<br>
                        <small>${ocupadas}/2 camas</small>
                    </div>
                `;
            }
        });
        return html;
    },

    // Abrir modal para seleccionar cama en habitación
    openHabitacionModal(habitacionId) {
        const habNumero = habitacionId.split('-')[1];
        const piso = habitacionId.split('-')[0];

        // Cerrar modal anterior
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

        // Crear nuevo modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog" style="max-width: 600px;">
                <div class="modal-header">
                    <h2><i class="fas fa-bed"></i> Piso ${piso} - Habitación ${habNumero} - Seleccionar Cama</h2>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                        ${this.renderCamasSelectable(habitacionId)}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // Renderizar camas seleccionables
    renderCamasSelectable(habitacionId) {
        const cama1 = `${habitacionId}-1`;
        const cama2 = `${habitacionId}-2`;

        let html = '';
        
        [cama1, cama2].forEach((cama, idx) => {
            const ocupada = this.state.hospitalizaciones.find(h => 
                h.cama === cama && h.estado === 'activa'
            );

            if (ocupada) {
                const paciente = this.state.pacientes.find(p => p.id === ocupada.pacienteId);
                html += `
                    <div style="border: 2px solid #ff6b6b; padding: 15px; border-radius: 5px; background: #ffe0e0;">
                        <strong>Cama ${idx + 1}</strong><br>
                        <span style="color: #ff6b6b;">OCUPADA</span><br>
                        <small>${paciente?.nombre} ${paciente?.apellido}</small>
                    </div>
                `;
            } else {
                html += `
                    <button class="btn btn-success" onclick="HospitalizacionesModule.openPacienteModal('${cama}')" 
                            style="height: 100px; font-size: 16px; border: 2px dashed #4CAF50;">
                        <i class="fas fa-bed" style="display: block; font-size: 24px; margin-bottom: 5px;"></i>
                        Cama ${idx + 1} - LIBRE<br>
                        <small>(Click para ingresar)</small>
                    </button>
                `;
            }
        });

        return html;
    },

    // Abrir modal para seleccionar paciente
    openPacienteModal(camaId) {
        // Cerrar modales anteriores
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

        // Crear modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog" style="max-width: 600px;">
                <div class="modal-header">
                    <h2><i class="fas fa-user-check"></i> Seleccionar Paciente</h2>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
                        ${this.renderPacientesSeleccionables(camaId)}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // Renderizar pacientes disponibles para hospitalización
    renderPacientesSeleccionables(camaId) {
        // Filtrar pacientes que no están hospitalizados o que están dados de alta
        const pacientesDisponibles = this.state.pacientes.filter(p => {
            const yaHospitalizado = this.state.hospitalizaciones.find(h => 
                h.pacienteId === p.id && h.estado === 'activa'
            );
            return !yaHospitalizado;
        });

        let html = '';
        pacientesDisponibles.forEach(paciente => {
            html += `
                <div style="border: 1px solid #ddd; padding: 12px; border-radius: 5px; cursor: pointer; transition: all 0.2s;"
                     onclick="HospitalizacionesModule.openDatosHospitalizacion('${paciente.id}', '${camaId}')"
                     onmouseover="this.style.background='#f5f5f5'; this.style.borderColor='#2196F3';"
                     onmouseout="this.style.background='white'; this.style.borderColor='#ddd';">
                    <strong>${paciente.nombre} ${paciente.apellido}</strong><br>
                    <small>Cédula: ${paciente.cedula} | Edad: ${paciente.edad} años | ${paciente.genero}</small>
                </div>
            `;
        });

        if (pacientesDisponibles.length === 0) {
            html = '<div style="text-align: center; color: #999; padding: 20px;"><i class="fas fa-info-circle"></i> No hay pacientes disponibles</div>';
        }

        return html;
    },

    // Abrir modal final para datos de hospitalización
    openDatosHospitalizacion(pacienteId, camaId) {
        const paciente = this.state.pacientes.find(p => p.id === pacienteId);
        const habInfo = camaId.split('-');
        const piso = habInfo[0];
        const habitacion = habInfo[1];
        const cama = habInfo[2];

        // Obtener diagnóstico previo si existe en la historia clínica
        let diagnosticoPrevio = '';
        if (window.HistoriaClinicaModule && window.HistoriaClinicaModule.state) {
            const historia = window.HistoriaClinicaModule.state.historiasClinicas?.find(h => h.pacienteId === pacienteId);
            if (historia && historia.prescripciones && historia.prescripciones.length > 0) {
                // Obtener el diagnóstico de la prescripción más reciente
                const ultimaPrescripcion = historia.prescripciones[historia.prescripciones.length - 1];
                diagnosticoPrevio = ultimaPrescripcion.diagnostico || '';
            }
        }

        // Cerrar modales anteriores
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

        // Crear modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog" style="max-width: 500px;">
                <div class="modal-header">
                    <h2><i class="fas fa-hospital-user"></i> Registrar Hospitalización</h2>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="hospForm">
                        <div class="form-group">
                            <label><strong>Paciente</strong></label>
                            <input type="text" class="form-input" value="${paciente.nombre} ${paciente.apellido}" readonly>
                        </div>
                        <div class="form-group">
                            <label><strong>Ubicación</strong></label>
                            <input type="text" class="form-input" value="Piso ${piso}, Habitación ${habitacion}, Cama ${cama}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Diagnóstico <span class="required">*</span></label>
                            <textarea id="hospDiagnostico" class="form-input" placeholder="Diagnóstico médico..." required>${diagnosticoPrevio}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Observaciones</label>
                            <textarea id="hospObservaciones" class="form-input" placeholder="Observaciones adicionales..." rows="3"></textarea>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="HospitalizacionesModule.confirmarHospitalizacion('${pacienteId}', '${camaId}')">
                                <i class="fas fa-check"></i> Confirmar Ingreso
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // Confirmar hospitalización
    confirmarHospitalizacion(pacienteId, camaId) {
        const diagnostico = document.getElementById('hospDiagnostico').value;
        const observaciones = document.getElementById('hospObservaciones').value;

        if (!diagnostico.trim()) {
            alert('Por favor ingresa el diagnóstico');
            return;
        }

        // Validar que el paciente no esté ya hospitalizado
        const yaHospitalizado = this.state.hospitalizaciones.find(h => 
            h.pacienteId === pacienteId && h.estado === 'activa'
        );
        
        if (yaHospitalizado) {
            alert('Este paciente ya está hospitalizado. Por favor verifica su estado actual.');
            return;
        }

        const habInfo = camaId.split('-');
        const hospitalizacion = {
            id: this.generateId('HOSP'),
            pacienteId: pacienteId,
            habitacion: `${habInfo[0]}-${habInfo[1]}`,
            cama: camaId,
            fechaIngreso: new Date().toISOString().split('T')[0],
            diagnostico: diagnostico,
            observaciones: observaciones,
            estado: 'activa'
        };

        this.state.hospitalizaciones.push(hospitalizacion);
        this.saveToDB();
        this.render();

        // Cerrar modal
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

        this.showNotification('Paciente hospitalizado exitosamente', 'success');
    },

    // Abrir modal para agregar desde cama libre
    openAddCamaModal(camaId) {
        this.openPacienteModal(camaId);
    },

    // Dar de alta a un paciente
    darDeAlta(hospitalizacionId) {
        if (confirm('¿Deseas dar de alta a este paciente?')) {
            const hosp = this.state.hospitalizaciones.find(h => h.id === hospitalizacionId);
            if (hosp) {
                hosp.estado = 'alta';
                hosp.fechaAlta = new Date().toISOString().split('T')[0];
                this.saveToDB();
                this.render();
                this.showNotification('Paciente dado de alta', 'success');
            }
        }
    },

    // Ver detalles de hospitalización
    verDetalles(hospitalizacionId) {
        const hosp = this.state.hospitalizaciones.find(h => h.id === hospitalizacionId);
        const paciente = this.state.pacientes.find(p => p.id === hosp?.pacienteId);

        if (!hosp || !paciente) return;

        const habInfo = hosp.habitacion.split('-');
        const camaInfo = hosp.cama.split('-');
        const dias = this.calcularDiasInternacion(hosp.fechaIngreso);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog" style="max-width: 500px;">
                <div class="modal-header">
                    <h2><i class="fas fa-hospital-user"></i> Detalles de Hospitalización</h2>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; gap: 15px;">
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                            <strong>Paciente</strong><br>
                            <p style="margin: 5px 0;">${paciente.nombre} ${paciente.apellido}</p>
                            <small style="color: #666;">Cédula: ${paciente.cedula}</small>
                        </div>
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                            <strong>Ubicación</strong><br>
                            <p style="margin: 5px 0;">Piso ${habInfo[0]}, Habitación ${habInfo[1]}, Cama ${camaInfo[2]}</p>
                        </div>
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                            <strong>Diagnóstico</strong><br>
                            <p style="margin: 5px 0;">${hosp.diagnostico}</p>
                        </div>
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                            <strong>Internación</strong><br>
                            <p style="margin: 5px 0;">Ingreso: ${this.formatDate(hosp.fechaIngreso)}</p>
                            <p style="margin: 5px 0; color: #2196F3; font-weight: bold;">Días: ${dias}</p>
                            ${hosp.fechaAlta ? `<p style="margin: 5px 0;">Alta: ${this.formatDate(hosp.fechaAlta)}</p>` : ''}
                        </div>
                        ${hosp.observaciones ? `
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                            <strong>Observaciones</strong><br>
                            <p style="margin: 5px 0;">${hosp.observaciones}</p>
                        </div>
                        ` : ''}
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
                            ${hosp.estado === 'activa' ? `
                            <button type="button" class="btn btn-danger" onclick="HospitalizacionesModule.darDeAlta('${hosp.id}')">
                                <i class="fas fa-sign-out-alt"></i> Dar de Alta
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
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
    }
};
