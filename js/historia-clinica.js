// ============================================
// MÓDULO DE HISTORIA CLÍNICA
// ============================================
// Expediente médico completo del paciente
// Vinculado al paciente, con histórico completo

const HistoriaClinicaModule = {
    state: {
        pacientes: [],
        medicinas: [],
        medicamentosAsignados: [],
        historiasClinicas: [],
        prescripciones: [],
        medicos: [],
        pacienteSeleccionado: null,
        editingNoteId: null,
        editingPrescripcionId: null,
        searchTerm: '',
        filtroEstado: 'activos', // activos, todos
        agendaWeekStart: new Date(), // Se inicializa correctamente en init()
        agendaWeekStartGeneral: new Date(), // Para la vista general
        filtroAgendaPaciente: '', // Filtro de paciente en agenda general
        // Registro de administración: { dosis: { clave: {estado, registrado} }, suspensiones: { prescId|medId: {...} } }
        administracion: { dosis: {}, suspensiones: {} }
    },

    // Inicializar el módulo
    init() {
        // Inicializar agendaWeekStart correctamente
        this.state.agendaWeekStart = this.getStartOfWeek(new Date());
        this.state.agendaWeekStartGeneral = this.getStartOfWeek(new Date());
        
        this.setupEventListeners();
        this.loadData();
        
        // Cerrar dropdowns cuando se hace clic fuera
        document.addEventListener('click', (e) => {
            if (!e.target.classList.contains('med-search')) {
                document.querySelectorAll('.medicine-dropdown').forEach(dropdown => {
                    dropdown.style.display = 'none';
                });
            }
        });
        
        console.log('Módulo de Historia Clínica inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        const searchPacient = document.getElementById('searchPacientHistoria');
        if (searchPacient) {
            searchPacient.addEventListener('input', (e) => {
                this.state.searchTerm = e.target.value.toLowerCase();
                this.renderPacientes();
            });
        }

        const filterState = document.getElementById('filterEstadoHistoria');
        if (filterState) {
            filterState.addEventListener('change', (e) => {
                this.state.filtroEstado = e.target.value;
                this.renderPacientes();
            });
        }

        const addNoteBtn = document.getElementById('addNoteBtn');
        if (addNoteBtn) {
            addNoteBtn.addEventListener('click', () => this.openNoteModal());
        }

    },

    // Cargar datos
    async loadData() {
        try {
            if (typeof authManager === 'undefined' || typeof DataNormalizer === 'undefined') {
                throw new Error('Servicios de API no disponibles');
            }

            const token = authManager.getToken();
            if (!token) throw new Error('No hay token de autenticación');

            const response = await fetch(`${authManager.apiBaseUrl}/api/pacientes`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`No se pudieron cargar pacientes (${response.status})`);
            }

            const data = await response.json();
            if (!Array.isArray(data.pacientes)) {
                throw new Error('Respuesta de pacientes con formato inválido');
            }

            this.state.pacientes = DataNormalizer.normalizePacientes(data.pacientes);
            console.log(`✅ Historia Clínica: ${this.state.pacientes.length} pacientes cargados desde API`);

            if (typeof PacientesModule !== 'undefined' && PacientesModule.state) {
                PacientesModule.state.pacientes = JSON.parse(JSON.stringify(this.state.pacientes));
            }
            
            // Cargar historial clínico desde localStorage
            const historiasFromStorage = localStorage.getItem('historiasClinicas');
            if (historiasFromStorage) {
                this.state.historiasClinicas = JSON.parse(historiasFromStorage);
            } else {
                console.warn('⚠️ No hay historias clínicas en localStorage');
                this.state.historiasClinicas = [];
            }

            this.state.prescripciones = this.state.historiasClinicas.flatMap(historia =>
                (historia.prescripciones || []).map(prescripcion => ({
                    ...prescripcion,
                    pacienteId: prescripcion.pacienteId ?? historia.pacienteId
                }))
            );
            
            // Cargar medicamentos asignados desde localStorage
            const medicamentosFromStorage = localStorage.getItem('medicamentosAsignados');
            if (medicamentosFromStorage) {
                this.state.medicamentosAsignados = JSON.parse(medicamentosFromStorage);
            } else {
                console.warn('⚠️ No hay medicamentos asignados en localStorage');
                this.state.medicamentosAsignados = [];
            }
            
            // Cargar medicinas SOLO desde MedicinasModule o localStorage
            if (typeof MedicinasModule !== 'undefined' && MedicinasModule.state && MedicinasModule.state.medicinas) {
                this.state.medicinas = JSON.parse(JSON.stringify(MedicinasModule.state.medicinas));
            } else {
                const medicinasFromStorage = localStorage.getItem('medicinas');
                if (medicinasFromStorage) {
                    this.state.medicinas = JSON.parse(medicinasFromStorage);
                } else {
                    console.warn('⚠️ No hay medicinas disponibles');
                    this.state.medicinas = [];
                }
            }
            
            // Datos opcionales (pueden estar vacíos)
            this.state.medicos = [];
            
            this.renderPacientes();
        } catch (error) {
            console.error('❌ Error cargando datos de historia clínica:', error);
            this.state.pacientes = [];
            this.renderPacientes();
            this.showNotification(`❌ Error al cargar pacientes desde la API: ${error.message}`, 'error');
        }
    },

    // Renderizar lista de pacientes
    renderPacientes() {
        const container = document.getElementById('pacientesHistoriaList');
        if (!container) return;

        let filtered = [...this.state.pacientes];

        // Filtro por estado
        if (this.state.filtroEstado === 'activos') {
            filtered = filtered.filter(p => p.estado === 'activo' || !p.estado);
        }

        // Búsqueda equivalente al listado principal de pacientes
        if (this.state.searchTerm) {
            const palabras = this.state.searchTerm.trim().split(/\s+/).filter(word => word.length > 0);

            filtered = filtered.filter(p => {
                const textoCompleto = [
                    p.nombre || '',
                    p.apellidoPaterno || '',
                    p.apellidoMaterno || '',
                    p.dpi || '',
                    p.email || '',
                    p.telefono || ''
                ].join(' ').toLowerCase();

                return palabras.every(palabra => textoCompleto.includes(palabra));
            });
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No hay pacientes registrados</p></div>';
            return;
        }

        container.innerHTML = `
            <div class="pacientes-list">
                ${filtered.map(pacient => this.renderPacientCard(pacient)).join('')}
            </div>
        `;
    },

    // Renderizar tarjeta de paciente
    renderPacientCard(pacient) {
        const historiasCount = this.state.historiasClinicas
            .filter(h => String(h.pacienteId ?? h.pacientId) === String(pacient.id)).length;
        const notasCount = this.state.historiasClinicas
            .filter(h => String(h.pacienteId ?? h.pacientId) === String(pacient.id))
            .reduce((sum, h) => sum + (h.notas ? h.notas.length : 0), 0);
        
        const medicamentosCount = this.state.medicamentosAsignados
            .filter(m => String(m.pacienteId) === String(pacient.id) && m.estado === 'activo').length;

        return `
            <div class="pacient-card" onclick="HistoriaClinicaModule.selectPacient('${pacient.id}')">
                <div class="card-header">
                    <h3>${pacient.nombre} ${pacient.apellidoPaterno} ${pacient.apellidoMaterno || ''}</h3>
                </div>
                <div class="card-body">
                    <p><strong>Cédula/DPI:</strong> ${pacient.dpi || pacient.pasaporte || 'N/A'}</p>
                    <p><strong>Edad:</strong> ${this.calculateAge(pacient.fechaNacimiento)} años</p>
                    <p><strong>Género:</strong> ${pacient.genero}</p>
                </div>
                <div class="card-footer">
                    <span class="stat">📋 ${historiasCount} registro(s)</span>
                    <span class="stat">� ${notasCount} evolución(es)</span>
                    <span class="stat">💊 ${medicamentosCount} medicamento(s)</span>
                </div>
            </div>
        `;
    },

    // Seleccionar paciente
    selectPacient(pacienteId) {
        // Intentar obtener del estado actual primero
        let paciente = this.state.pacientes.find(p => String(p.id) === String(pacienteId));
        
        // Si no existe, intentar desde PacientesModule (datos más actualizados)
        if (!paciente && typeof PacientesModule !== 'undefined' && PacientesModule.state) {
            paciente = PacientesModule.state.pacientes.find(p => String(p.id) === String(pacienteId));
            if (paciente) {
                // Actualizar local state
                const idx = this.state.pacientes.findIndex(p => String(p.id) === String(pacienteId));
                if (idx >= 0) {
                    this.state.pacientes[idx] = JSON.parse(JSON.stringify(paciente));
                } else {
                    this.state.pacientes.push(JSON.parse(JSON.stringify(paciente)));
                }
            }
        }
        
        if (paciente) {
            this.state.pacienteSeleccionado = JSON.parse(JSON.stringify(paciente));
            this.renderHistoriaClinica();
        } else {
            console.warn(`Paciente con ID ${pacienteId} no encontrado`);
        }
    },

    // Renderizar historia clínica completa
    renderHistoriaClinica() {
        const container = document.getElementById('historiaClinicaContent');
        const buttonBar = document.getElementById('historiaButtonBar');
        if (!container || !this.state.pacienteSeleccionado) return;

        const pacient = this.state.pacienteSeleccionado;
        const historia = this.state.historiasClinicas.find(h =>
            String(h.pacienteId ?? h.pacientId) === String(pacient.id)
        );
        const medicamentosActivos = this.state.medicamentosAsignados
            .filter(m => String(m.pacienteId) === String(pacient.id) && m.estado === 'activo');

        // Mostrar botón de agregar nota
        if (buttonBar) {
            buttonBar.style.display = 'flex';
        }

        // Obtener color por tipo de paciente
        let tipoColor = '#4CAF50';
        let tipoBg = '#c8e6c9';
        if (pacient.tipoServicio === 'agudo') {
            tipoColor = '#f44336';
            tipoBg = '#ffcdd2';
        } else if (pacient.tipoServicio === 'coex') {
            tipoColor = '#ff9800';
            tipoBg = '#ffe0b2';
        }

        container.innerHTML = `
            <div class="historia-container">
                <!-- Header con datos del paciente -->
                <div class="historia-header" style="background-color: ${tipoBg}; border-left: 5px solid ${tipoColor};">
                    <div class="pacient-info">
                        <div style="display: flex; gap: 20px; align-items: flex-start;">
                            <div style="flex-shrink: 0;">
                                ${pacient.foto ? `<img src="${pacient.foto}" alt="Foto ${pacient.nombre}" style="width: 120px; height: 120px; border-radius: 10px; object-fit: cover; border: 3px solid ${tipoColor};">` : `<div style="width: 120px; height: 120px; background: #e0e0e0; border-radius: 10px; display: flex; align-items: center; justify-content: center; border: 3px solid ${tipoColor};"><i class="fas fa-user" style="font-size: 40px; color: #999;"></i></div>`}
                            </div>
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                    <h1>${pacient.nombre} ${pacient.apellidoPaterno} ${pacient.apellidoMaterno || ''}</h1>
                                    <span style="background-color: ${tipoColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">
                                        ${pacient.tipoServicio === 'agudo' ? '🚨 AGUDO' : pacient.tipoServicio === 'cronico' ? '📋 CRÓNICO' : '⚠️ COEX'}
                                    </span>
                                </div>
                                <div class="info-grid">
                                    <div class="info-item">
                                        <label>Cédula/DPI</label>
                                        <p>${pacient.dpi || pacient.pasaporte || 'N/A'}</p>
                                    </div>
                                    <div class="info-item">
                                        <label>Edad</label>
                                        <p>${this.calculateAge(pacient.fechaNacimiento)} años</p>
                                    </div>
                                    <div class="info-item">
                                        <label>Género</label>
                                        <p>${pacient.genero}</p>
                                    </div>
                                    <div class="info-item">
                                        <label>Teléfono</label>
                                        <p>${pacient.telefono}</p>
                                    </div>
                                    <div class="info-item">
                                        <label>Email</label>
                                        <p>${pacient.email}</p>
                                    </div>
                                    <div class="info-item">
                                        <label>Ciudad</label>
                                        <p>${pacient.municipio || 'No especificado'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                ${!historia ? '' : `
                    <!-- Antecedentes Médicos -->
                    ${historia.antecedentesMedicos ? `
                        <div class="section-card">
                            <h2><i class="fas fa-history"></i> Antecedentes Médicos</h2>
                            <div class="section-content">
                                <p>${historia.antecedentesMedicos}</p>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Antecedentes Familiares -->
                    ${historia.antecedentesfamiliares ? `
                        <div class="section-card">
                            <h2><i class="fas fa-users"></i> Antecedentes Familiares</h2>
                            <div class="section-content">
                                <p>${historia.antecedentesfamiliares}</p>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Alergias -->
                    ${historia.alergias ? `
                        <div class="section-card alert-section">
                            <h2><i class="fas fa-exclamation-triangle"></i> ⚠️ Alergias Conocidas</h2>
                            <div class="section-content">
                                <p><strong>${historia.alergias}</strong></p>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Diagnósticos Activos -->
                    ${historia.diagnosticosActivos && historia.diagnosticosActivos.length > 0 ? `
                        <div class="section-card">
                            <h2><i class="fas fa-stethoscope"></i> Diagnósticos Activos</h2>
                            <div class="diagnosticos-list">
                                ${historia.diagnosticosActivos.map(d => `
                                    <div class="diagnostico-item">
                                        <div class="diagnostico-header">
                                            <strong>${d.nombre}</strong>
                                            <span class="badge badge-info">${d.fecha}</span>
                                        </div>
                                        <p class="text-muted">${d.descripcion}</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                `}

                <!-- Medicamentos Actuales -->
                ${medicamentosActivos.length > 0 ? `
                    <div class="section-card">
                        <h2><i class="fas fa-pills"></i> Medicamentos en Tratamiento</h2>
                        <div class="medicamentos-list">
                            ${medicamentosActivos.map(m => {
                                const med = this.state.medicinas.find(med => med.id === m.medicineId);
                                return `
                                    <div class="medicamento-item">
                                        <div class="med-header">
                                            <strong>${med?.nombre || m.medicineName || 'Medicamento'}</strong>
                                            <div class="hc-acciones">
                                                <span class="badge badge-success">Activo</span>
                                                <button type="button" class="btn btn-sm btn-secondary" onclick="HistoriaClinicaModule.editarMedicamento('${m.id}')" title="Editar medicamento" aria-label="Editar medicamento">
                                                    <i class="fas fa-pen"></i>
                                                </button>
                                                <button type="button" class="btn btn-sm btn-secondary hc-btn-borrar" onclick="HistoriaClinicaModule.quitarMedicamento('${m.id}')" title="Quitar del tratamiento" aria-label="Quitar del tratamiento">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                        <div class="med-details">
                                            <p><strong>Dosis:</strong> ${m.dosis || 'N/A'}</p>
                                            <p><strong>Frecuencia:</strong> ${m.frecuencia || 'N/A'}</p>
                                            ${m.duracion ? `<p><strong>Duración:</strong> ${m.duracion}</p>` : ''}
                                            <p><strong>Desde:</strong> ${m.fechaInicio || m.fechaAsignacion || 'N/A'}</p>
                                            ${m.notas ? `<p><strong>Notas:</strong> ${m.notas}</p>` : ''}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Evolución del Paciente -->
                ${historia && historia.notas && historia.notas.length > 0 ? `
                    <div class="section-card">
                        <h2><i class="fas fa-chart-line"></i> Evolución del Paciente</h2>
                        <div class="notas-timeline">
                            ${[...historia.notas].reverse().map((nota, idx) => `
                                <div class="nota-item">
                                    <div class="nota-header">
                                        <strong>${nota.tipo}</strong>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span class="nota-fecha">${nota.fecha}</span>
                                            <button type="button" class="btn btn-sm btn-secondary" onclick="HistoriaClinicaModule.editNote('${historia.pacienteId ?? historia.pacientId}', '${nota.id}')" title="Editar nota" aria-label="Editar nota">
                                                <i class="fas fa-pen"></i>
                                            </button>
                                            <button type="button" class="btn btn-sm btn-secondary hc-btn-borrar" onclick="HistoriaClinicaModule.deleteNote('${historia.pacienteId ?? historia.pacientId}', '${nota.id}')" title="Borrar nota" aria-label="Borrar nota">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <p>${nota.contenido}</p>
                                    ${nota.medico ? `<p class="text-muted">Por: ${nota.medico}</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Prescripciones Médicas -->
                ${historia && historia.prescripciones && historia.prescripciones.length > 0 ? `
                    <div class="section-card">
                        <h2><i class="fas fa-prescription-bottle"></i> Prescripciones Médicas</h2>
                        <div class="prescripciones-timeline">
                            ${[...historia.prescripciones].reverse().map((presc) => `
                                <div class="prescripcion-item">
                                    <div class="prescripcion-header">
                                        <strong>${presc.id}</strong>
                                        <span class="nota-fecha">${presc.fecha}</span>
                                        <span class="badge badge-primary">${presc.estado}</span>
                                        <div class="hc-acciones">
                                            <button type="button" class="btn btn-sm btn-secondary" onclick="HistoriaClinicaModule.editPrescripcion('${presc.id}')" title="Editar prescripción" aria-label="Editar prescripción">
                                                <i class="fas fa-pen"></i>
                                            </button>
                                            <button type="button" class="btn btn-sm btn-secondary hc-btn-borrar" onclick="HistoriaClinicaModule.deletePrescripcion('${presc.id}')" title="Borrar prescripción" aria-label="Borrar prescripción">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <p><strong>Diagnóstico:</strong> ${presc.diagnostico}</p>
                                    <div class="medicinas-prescripcion">
                                        <strong>Medicinas Prescritas:</strong>
                                        <table class="prescripcion-table" style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                                            <thead>
                                                <tr style="background: #f5f5f5;">
                                                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Medicina</th>
                                                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Cantidad</th>
                                                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Dosis</th>
                                                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Frecuencia</th>
                                                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Duración</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${presc.medicinas.map(m => `
                                                    <tr>
                                                        <td style="border: 1px solid #ddd; padding: 8px;">${m.medicinaNombre}</td>
                                                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${m.cantidad}</td>
                                                        <td style="border: 1px solid #ddd; padding: 8px;">${m.dosis}</td>
                                                        <td style="border: 1px solid #ddd; padding: 8px;">${m.frecuencia}</td>
                                                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${m.duracion}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // Abrir modal de nueva nota/prescripción
    async openNoteModal() {
        if (!this.state.pacienteSeleccionado) {
            this.showNotification('⚠️ Selecciona un paciente primero', 'warning');
            return;
        }

        const modal = document.getElementById('noteModal');
        const noteForm = document.getElementById('editNoteForm');
        const prescForm = document.getElementById('prescripcionForm');
        if (!modal) return;

        // Limpiar formulario de notas
        this.state.editingNoteId = null;
        noteForm.reset();
        document.getElementById('noteModalTitle').innerHTML = '<i class="fas fa-pen-medical"></i> Nueva nota médica';
        document.getElementById('noteTipo').value = 'Observación';
        document.getElementById('noteFecha').valueAsDate = new Date();
        document.getElementById('saveNoteBtn').innerHTML = '<i class="fas fa-save"></i> Guardar Nota';

        // Limpiar formulario de prescripción
        this.state.editingPrescripcionId = null;
        document.getElementById('savePrescBtn').innerHTML = '<i class="fas fa-save"></i> Guardar Prescripción';
        prescForm.reset();
        document.getElementById('prescFecha').valueAsDate = new Date();
        document.getElementById('prescMedicinesTable').innerHTML = '';

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        await this.loadModalCatalogs();
    },

    // Abrir una nota existente en el formulario
    async editNote(pacienteId, noteId) {
        const historia = this.state.historiasClinicas.find(h =>
            String(h.pacienteId ?? h.pacientId) === String(pacienteId)
        );
        const nota = historia?.notas?.find(item => String(item.id) === String(noteId));
        const paciente = this.state.pacientes.find(item => String(item.id) === String(pacienteId));

        if (!nota || !paciente) {
            this.showNotification('No se pudo encontrar la nota seleccionada', 'error');
            return;
        }

        this.state.pacienteSeleccionado = JSON.parse(JSON.stringify(paciente));
        await this.openNoteModal();
        this.state.editingNoteId = noteId;
        this.switchTab('nota');
        document.getElementById('noteModalTitle').innerHTML = '<i class="fas fa-pen-medical"></i> Editar nota médica';
        document.getElementById('noteTipo').value = nota.tipo;
        document.getElementById('noteFecha').value = nota.fecha;
        document.getElementById('noteContenido').value = nota.contenido;
        const medicoSelect = document.getElementById('noteMedico');
        if (nota.medico && ![...medicoSelect.options].some(option => option.value === nota.medico)) {
            medicoSelect.add(new Option(`${nota.medico} (registro histórico)`, nota.medico));
        }
        medicoSelect.value = nota.medico || '';
        document.getElementById('saveNoteBtn').innerHTML = '<i class="fas fa-save"></i> Actualizar Nota';
    },

    // Cerrar modal
    closeNoteModal() {
        const modal = document.getElementById('noteModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        this.state.editingNoteId = null;
        this.state.editingPrescripcionId = null;
    },

    // Guardar nota
    saveNote() {
        if (!this.state.pacienteSeleccionado) return;

        const tipo = document.getElementById('noteTipo').value;
        const contenido = document.getElementById('noteContenido').value.trim();
        const fecha = document.getElementById('noteFecha').value;
        const medico = document.getElementById('noteMedico').value.trim();

        if (!tipo || !contenido || !fecha) {
            this.showNotification('⚠️ Por favor completa todos los campos requeridos', 'warning');
            return;
        }

        // Obtener o crear historia clínica
        let historia = this.state.historiasClinicas.find(h =>
            String(h.pacienteId ?? h.pacientId) === String(this.state.pacienteSeleccionado.id)
        );
        
        if (!historia) {
            historia = {
                id: this.generateId('HC'),
                pacienteId: this.state.pacienteSeleccionado.id,
                antecedentesMedicos: '',
                antecedentesfamiliares: '',
                alergias: '',
                diagnosticosActivos: [],
                notas: [],
                fechaCreacion: new Date().toISOString().split('T')[0]
            };
            this.state.historiasClinicas.push(historia);
        }

        const editingNote = historia.notas.find(nota => String(nota.id) === String(this.state.editingNoteId));
        if (this.state.editingNoteId && !editingNote) {
            this.showNotification('La nota cambió o ya no existe. Cierra el editor e inténtalo de nuevo.', 'error');
            return;
        }

        if (editingNote) {
            Object.assign(editingNote, { tipo, contenido, fecha, medico });
            this.showNotification('Nota actualizada correctamente', 'success');
        } else {
            historia.notas.push({
                id: this.generateId('NOTE'),
                tipo: tipo,
                contenido: contenido,
                fecha: fecha,
                medico: medico
            });
            this.showNotification('Nota registrada correctamente', 'success');
        }

        this.saveToDB();
        this.closeNoteModal();
        this.renderHistoriaClinica();
        if (typeof PacientesModule !== 'undefined' && document.getElementById('evolucionList')) {
            PacientesModule.loadEvolucion(this.state.pacienteSeleccionado.id);
        }
    },

    // Calcular edad
    calculateAge(birthDate) {
        if (!birthDate) return 'N/A';
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    },

    // Generar ID único
    generateId(prefix) {
        const timestamp = Date.now().toString(36);
        return `${prefix}-${timestamp}`;
    },

    // Guardar en DB (localStorage)
    saveToDB() {
        localStorage.setItem('historiasClinicas', JSON.stringify(this.state.historiasClinicas));
    },

    // Cambiar entre pestañas (Notas / Prescripciones / Agenda)
    switchTab(tabName) {
        // Ocultar/mostrar contenido
        const forms = document.querySelectorAll('.tab-content-historia');
        forms.forEach(f => f.style.display = 'none');
        
        if (tabName === 'nota') {
            document.getElementById('editNoteForm').style.display = 'block';
            document.getElementById('saveNoteBtn').style.display = 'block';
            document.getElementById('savePrescBtn').style.display = 'none';
        } else if (tabName === 'prescripcion') {
            document.getElementById('prescripcionForm').style.display = 'block';
            document.getElementById('saveNoteBtn').style.display = 'none';
            document.getElementById('savePrescBtn').style.display = 'block';
            this.populateMedicos();
        } else if (tabName === 'agenda') {
            document.getElementById('agendaContent').style.display = 'block';
            document.getElementById('saveNoteBtn').style.display = 'none';
            document.getElementById('savePrescBtn').style.display = 'none';
            this.renderAgendaSemanal();
        }
        
        // Actualizar botones de tab
        const buttons = document.querySelectorAll('.tab-btn-historia');
        buttons.forEach(btn => {
            btn.style.color = '#666';
            btn.style.borderBottom = '3px solid transparent';
        });
        
        // Marcar el botón actual como activo
        if (tabName === 'nota') {
            buttons[0].style.color = '#1e3a8a';
            buttons[0].style.borderBottom = '3px solid #1e3a8a';
        } else if (tabName === 'prescripcion') {
            buttons[1].style.color = '#1e3a8a';
            buttons[1].style.borderBottom = '3px solid #1e3a8a';
        } else if (tabName === 'agenda') {
            buttons[2].style.color = '#1e3a8a';
            buttons[2].style.borderBottom = '3px solid #1e3a8a';
        }
    },

    // Cargar personal médico y medicinas disponibles desde la API
    async loadModalCatalogs() {
        const noteSelect = document.getElementById('noteMedico');
        const prescriptionSelect = document.getElementById('prescMedico');
        const addMedicineButton = document.getElementById('addPrescMedicineBtn');

        if (noteSelect) noteSelect.innerHTML = '<option value="">Cargando personal médico...</option>';
        if (prescriptionSelect) prescriptionSelect.innerHTML = '<option value="">Cargando personal médico...</option>';
        if (addMedicineButton) addMedicineButton.disabled = true;

        try {
            if (typeof authManager === 'undefined') throw new Error('Servicio de autenticación no disponible');

            const token = authManager.getToken();
            if (!token) throw new Error('No hay token de autenticación');

            const headers = { Authorization: `Bearer ${token}` };
            const [personalResponse, medicinasResponse] = await Promise.all([
                fetch(`${authManager.apiBaseUrl}/api/personal-medico`, { headers }),
                fetch(`${authManager.apiBaseUrl}/api/medicinas?activo=true`, { headers })
            ]);

            if (!personalResponse.ok) {
                throw new Error(`No se pudo cargar el personal médico (${personalResponse.status})`);
            }
            if (!medicinasResponse.ok) {
                throw new Error(`No se pudieron cargar las medicinas (${medicinasResponse.status})`);
            }

            const personalData = await personalResponse.json();
            const medicinasData = await medicinasResponse.json();
            if (!Array.isArray(personalData.personal) || !Array.isArray(medicinasData.medicinas)) {
                throw new Error('La API devolvió catálogos con formato inválido');
            }

            this.state.medicos = personalData.personal
                .map(personal => typeof PersonalModule !== 'undefined' && PersonalModule.normalizePersonal
                    ? PersonalModule.normalizePersonal(personal)
                    : {
                        id: String(personal.id),
                        nombre: personal.nombre || '',
                        apellidoPaterno: personal.apellido_paterno || '',
                        apellidoMaterno: personal.apellido_materno || '',
                        especialidad: personal.especialidad || '',
                        numeroColegiado: personal.numero_colegiado || '',
                        estado: personal.estado || 'activo'
                    })
                .filter(personal => personal.estado === 'activo');

            this.state.medicinas = medicinasData.medicinas
                .map(medicina => ({
                    ...medicina,
                    codigo: medicina.codigo || medicina.codigo_interno || medicina.codigo_externo || medicina.codigo_barra || '',
                    stock: Number(medicina.stock ?? medicina.cantidad) || 0,
                    precioUnitario: Number(medicina.precio_venta ?? medicina.precioVenta ?? medicina.precio ?? medicina.precio_unitario) || 0
                }))
                .filter(medicina => medicina.activo !== false && medicina.stock > 0);

            this.populateMedicos();
            console.log(`✅ Modal Historia Clínica: ${this.state.medicos.length} médicos y ${this.state.medicinas.length} medicinas con stock cargados desde API`);
        } catch (error) {
            this.state.medicos = [];
            this.state.medicinas = [];
            this.populateMedicos();
            this.showNotification(`❌ Error cargando datos del modal: ${error.message}`, 'error');
        } finally {
            if (addMedicineButton) addMedicineButton.disabled = false;
        }
    },

    // Poblar los selectores de personal médico
    populateMedicos() {
        const noteSelect = document.getElementById('noteMedico');
        const prescriptionSelect = document.getElementById('prescMedico');
        const medicos = this.state.medicos || [];

        [noteSelect, prescriptionSelect].forEach(select => {
            if (select) select.innerHTML = '<option value="">-- Seleccionar médico --</option>';
        });

        medicos.forEach(medico => {
            const nombreCompleto = [medico.nombre, medico.apellidoPaterno, medico.apellidoMaterno]
                .filter(Boolean)
                .join(' ');
            const detalle = [medico.especialidad, medico.numeroColegiado ? `Colegiado: ${medico.numeroColegiado}` : '']
                .filter(Boolean)
                .join(' - ');
            const etiqueta = detalle ? `${nombreCompleto} (${detalle})` : nombreCompleto;

            if (noteSelect) {
                const option = document.createElement('option');
                option.value = nombreCompleto;
                option.textContent = etiqueta;
                noteSelect.appendChild(option);
            }

            if (prescriptionSelect) {
                const option = document.createElement('option');
                option.value = medico.id;
                option.textContent = etiqueta;
                prescriptionSelect.appendChild(option);
            }
        });
    },

    // Agregar fila de medicina
    addMedicineRow() {
        if (!this.state.medicinas || this.state.medicinas.length === 0) {
            this.showNotification('⚠️ No hay medicinas con existencias disponibles', 'warning');
            return;
        }

        const tbody = document.getElementById('prescMedicinesTable');
        if (!tbody) return;
        
        this._rowSeq = (this._rowSeq || 0) + 1;
        const rowId = `med-${Date.now()}-${this._rowSeq}`;
        const row = document.createElement('tr');
        row.id = rowId;
        row.style.borderBottom = '1px solid #ddd';
        
        row.innerHTML = `
            <td style="border: 1px solid #ddd; padding: 8px; position: relative;">
                <div class="medicine-search-container" style="position: relative; display: flex; align-items: center; gap: 5px;">
                    <input type="text" class="med-search" style="flex: 1; padding: 5px; font-size: 12px;" 
                           placeholder="Buscar medicina..." 
                           onkeyup="HistoriaClinicaModule.filterMedicines('${rowId}')"
                           required>
                    <button type="button" style="background: #007bff; color: white; border: none; padding: 5px 8px; 
                                               border-radius: 3px; cursor: pointer; font-size: 12px;"
                            onclick="HistoriaClinicaModule.showAllMedicines('${rowId}')" title="Ver todas las medicinas">
                        <i class="fas fa-search"></i>
                    </button>
                    <div class="medicine-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; 
                                                         background: white; border: 1px solid #ddd; 
                                                         max-height: 150px; overflow-y: auto; z-index: 1000;
                                                         box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <!-- Opciones de medicinas se muestran aquí -->
                    </div>
                    <input type="hidden" class="med-id" value="">
                </div>
            </td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                <input type="number" class="med-cantidad" style="width: 60px; padding: 5px;" value="1" min="1" required>
            </td>
            <td style="border: 1px solid #ddd; padding: 8px;">
                <input type="text" class="med-dosis" style="width: 85px; padding: 5px; font-size: 12px;" placeholder="Ej: 500mg">
            </td>
            <td style="border: 1px solid #ddd; padding: 8px;">
                <input type="text" class="med-frecuencia" style="width: 90px; padding: 5px; font-size: 12px;" placeholder="Cada 8 h">
            </td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                <input type="text" class="med-duracion" style="width: 60px; padding: 5px; font-size: 12px;" placeholder="5 días">
            </td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                <button type="button" class="btn btn-sm btn-danger" onclick="HistoriaClinicaModule.removeMedicineRow('${rowId}')" style="padding: 4px 8px; font-size: 12px;">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
        return row;
    },

    // Mostrar todas las medicinas disponibles (al hacer clic en la lupa)
    showAllMedicines(rowId) {
        const row = document.getElementById(rowId);
        if (!row) return;
        
        const medicinas = this.state.medicinas;
        
        if (medicinas.length === 0) {
            this.showNotification('⚠️ No hay medicinas disponibles', 'warning');
            return;
        }
        
        // Crear un modal modal con la lista de medicinas
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 5000;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 20px;
            max-width: 500px;
            max-height: 600px;
            overflow-y: auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            width: 90%;
        `;
        
        let html = `
            <h2 style="margin-top: 0; margin-bottom: 15px;">
                <i class="fas fa-pills"></i> Catálogo de Medicinas
            </h2>
            <div style="margin-bottom: 15px;">
                <input type="text" placeholder="Filtrar medicinas..." 
                       id="filterMedicinesModal" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                       onkeyup="this.closest('div').parentElement.querySelectorAll('.medicine-item').forEach(item => {
                           const term = this.value.toLowerCase();
                           item.style.display = item.textContent.toLowerCase().includes(term) ? '' : 'none';
                       })">
            </div>
            <div style="border-top: 1px solid #eee; padding-top: 15px;">
        `;
        
        medicinas.forEach(med => {
            html += `
                <div class="medicine-item" style="padding: 10px; border-bottom: 1px solid #f0f0f0; cursor: pointer; 
                                                   border-radius: 4px; transition: background 0.2s;"
                     onmouseover="this.style.background='#f5f5f5'"
                     onmouseout="this.style.background='white'"
                     onclick="HistoriaClinicaModule.selectMedicineFromModal('${rowId}', '${med.id}', '${med.nombre}'); 
                              this.closest('[style*=fixed]').remove();">
                    <strong>${med.nombre}</strong>
                    <br><small style="color: #666;">Código: ${med.codigo || 'N/A'} | Stock disponible: ${med.stock}</small>
                </div>
            `;
        });
        
        html += `
            </div>
            <div style="margin-top: 15px; text-align: right;">
                <button style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;"
                        onclick="this.closest('[style*=fixed]').remove();">
                    Cerrar
                </button>
            </div>
        `;
        
        dialog.innerHTML = html;
        modal.appendChild(dialog);
        document.body.appendChild(modal);
    },

    // Seleccionar medicina del modal
    selectMedicineFromModal(rowId, medicineId, medicineName) {
        const row = document.getElementById(rowId);
        if (!row) return;
        
        const searchInput = row.querySelector('.med-search');
        searchInput.value = medicineName;
        row.querySelector('.med-id').value = medicineId;
    },

    // Filtrar medicinas según búsqueda
    filterMedicines(rowId) {
        const row = document.getElementById(rowId);
        if (!row) return;
        
        const searchInput = row.querySelector('.med-search');
        const dropdown = row.querySelector('.medicine-dropdown');
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        if (searchTerm.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        const medicinas = this.state.medicinas;
        
        const filtered = medicinas.filter(med => 
            `${med.nombre || ''} ${med.codigo || ''}`.toLowerCase().includes(searchTerm)
        );
        
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div style="padding: 8px; color: #999; text-align: center;">No se encontraron medicinas</div>';
            dropdown.style.display = 'block';
            return;
        }
        
        dropdown.innerHTML = filtered.map(med => `
            <div style="padding: 8px; border-bottom: 1px solid #f0f0f0; cursor: pointer; 
                        font-size: 12px; hover: background #f5f5f5;"
                 onmouseover="this.style.background='#f5f5f5'" 
                 onmouseout="this.style.background='white'"
                 onclick="HistoriaClinicaModule.selectMedicine('${rowId}', '${med.id}', '${med.nombre}')">
                <strong>${med.nombre}</strong>
                <br><small style="color: #666;">Código: ${med.codigo || 'N/A'} | Stock disponible: ${med.stock}</small>
            </div>
        `).join('');
        
        dropdown.style.display = 'block';
    },

    // Seleccionar una medicina del dropdown
    selectMedicine(rowId, medicineId, medicineName) {
        const row = document.getElementById(rowId);
        if (!row) return;
        
        const searchInput = row.querySelector('.med-search');
        const dropdown = row.querySelector('.medicine-dropdown');
        const hiddenId = row.querySelector('.med-id');
        
        searchInput.value = medicineName;
        hiddenId.value = medicineId;
        dropdown.style.display = 'none';
    },

    // Actualizar subtotal de una fila (ahora no hace nada, pero se mantiene por compatibilidad)
    updateRowTotal(rowId) {
        // Ya no hay cálculo de precios
    },

    // Actualizar monto total de prescripción (ahora no hace nada, pero se mantiene por compatibilidad)
    updatePrescripcionTotal() {
        // Ya no hay cálculo de totales
    },

    // Remover fila de medicina
    removeMedicineRow(rowId) {
        const row = document.getElementById(rowId);
        if (row) {
            row.remove();
        }
    },

    // Guardar prescripción
    async savePrescripcion() {
        if (!this.state.pacienteSeleccionado) return;
        
        const medicoId = document.getElementById('prescMedico').value;
        const diagnostico = document.getElementById('prescDiagnostico').value.trim();
        const fecha = document.getElementById('prescFecha').value;
        const saveButton = document.getElementById('savePrescBtn');
        
        if (!medicoId || !diagnostico || !fecha) {
            this.showNotification('⚠️ Por favor completa: Médico, Diagnóstico y Fecha', 'warning');
            return;
        }
        
        const tbody = document.getElementById('prescMedicinesTable');
        const medicineRows = tbody.querySelectorAll('tr');
        
        if (medicineRows.length === 0) {
            this.showNotification('⚠️ Agrega al menos una medicina', 'warning');
            return;
        }
        
        // Construir prescripción
        const medicinas = [];
        for (const row of medicineRows) {
            const medicineId = row.querySelector('.med-id').value;
            const medicinaNombre = row.querySelector('.med-search').value;
            const cantidad = parseFloat(row.querySelector('.med-cantidad').value);
            const dosis = row.querySelector('.med-dosis').value;
            const frecuencia = row.querySelector('.med-frecuencia').value;
            const duracion = row.querySelector('.med-duracion').value;
            const medicinaCatalogo = this.state.medicinas.find(medicina => String(medicina.id) === String(medicineId));
            
            if (!medicineId || !medicinaNombre || !medicinaCatalogo) {
                this.showNotification('⚠️ Por favor selecciona medicinas válidas', 'warning');
                return;
            }

            // Al editar, lo ya prescrito de esa medicina sigue disponible para esta receta
            const yaPrescrito = Number(row.dataset.cantidadOriginal) || 0;
            const disponible = (Number(medicinaCatalogo.stock) || 0) + yaPrescrito;
            if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > disponible) {
                this.showNotification(`⚠️ Cantidad inválida para ${medicinaNombre}. Disponible: ${disponible}`, 'warning');
                return;
            }

            if (medicinaCatalogo.precioUnitario <= 0) {
                this.showNotification(`⚠️ ${medicinaNombre} no tiene precio de venta configurado`, 'warning');
                return;
            }

            // Una medicina ya prescrita conserva el precio con el que se cobró
            const precioUnitario = Number(row.dataset.precioOriginal) || medicinaCatalogo.precioUnitario;
            medicinas.push({
                medicineId,
                medicinaNombre,
                cantidad,
                dosis,
                frecuencia,
                duracion,
                precioUnitario,
                subtotal: cantidad * precioUnitario
            });
        }

        if (this.state.editingPrescripcionId) {
            return this.actualizarPrescripcion(this.state.editingPrescripcionId, { medicoId, diagnostico, fecha, medicinas });
        }
        
        const prescripcionId = this.generateId('PRESC');
        const pacienteId = this.state.pacienteSeleccionado.id;
        
        // Crear prescripción
        const prescripcion = {
            id: prescripcionId,
            pacienteId,
            medicoId,
            diagnostico,
            medicinas,
            fecha,
            estado: 'Activa'
        };
        
        try {
            if (saveButton) saveButton.disabled = true;

            await this.registrarCargoPrescripcion(prescripcion);

            if (!this.state.prescripciones) this.state.prescripciones = [];
            this.state.prescripciones.push(prescripcion);
            this.guardarPrescripcionEnHistorial(prescripcion);
            this.registrarMedicamentosAsignados(prescripcion);

            this.showNotification(`✅ Prescripción ${prescripcionId} registrada y cargada al estado de cuenta`, 'success');
            this.closeNoteModal();
            this.renderHistoriaClinica();
            this.renderPacientes();

            if (typeof SaldoPacienteFacturacion !== 'undefined' && SaldoPacienteFacturacion.refrescarSaldoDelPaciente) {
                await SaldoPacienteFacturacion.refrescarSaldoDelPaciente(pacienteId);
            }
        } catch (error) {
            console.error('❌ Error guardando la prescripción:', error);
            this.showNotification(`❌ No se guardó la prescripción: ${error.message}`, 'error');
        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    },

    // ============================================
    // EDITAR / BORRAR NOTAS, MEDICAMENTOS Y PRESCRIPCIONES
    // ============================================

    getHistoria(pacienteId) {
        return this.state.historiasClinicas.find(h =>
            String(h.pacienteId ?? h.pacientId) === String(pacienteId)
        );
    },

    getHistoriaDePrescripcion(prescripcionId) {
        return this.state.historiasClinicas.find(h =>
            (h.prescripciones || []).some(p => String(p.id) === String(prescripcionId))
        );
    },

    guardarMedicamentosAsignados() {
        localStorage.setItem('medicamentosAsignados', JSON.stringify(this.state.medicamentosAsignados));
        if (typeof MedicinasModule !== 'undefined' && MedicinasModule.state) {
            MedicinasModule.state.medicamentosAsignados = JSON.parse(JSON.stringify(this.state.medicamentosAsignados));
        }
    },

    refrescarVistas(pacienteId) {
        this.saveToDB();
        this.renderHistoriaClinica();
        this.renderPacientes();
        if (typeof PacientesModule !== 'undefined' && document.getElementById('evolucionList')) {
            PacientesModule.loadEvolucion(pacienteId);
        }
    },

    async apiFetch(path, options = {}) {
        const token = authManager?.getToken?.();
        if (!token) throw new Error('No hay token de autenticación');
        const response = await fetch(`${authManager.apiBaseUrl}${path}`, {
            ...options,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.success === false) {
            throw new Error(result.error || result.message || `Error ${response.status}`);
        }
        return result;
    },

    // ---------- Notas ----------
    deleteNote(pacienteId, noteId) {
        const historia = this.getHistoria(pacienteId);
        const nota = historia?.notas?.find(item => String(item.id) === String(noteId));
        if (!nota) {
            this.showNotification('No se encontró la nota', 'error');
            return;
        }
        if (!confirm(`¿Borrar la nota "${nota.tipo}" del ${nota.fecha}? Esta acción no se puede deshacer.`)) return;

        historia.notas = historia.notas.filter(item => String(item.id) !== String(noteId));
        this.refrescarVistas(pacienteId);
        this.showNotification('Nota borrada', 'success');
    },

    // ---------- Medicamentos en tratamiento ----------
    editarMedicamento(asignacionId) {
        const asignacion = this.state.medicamentosAsignados.find(a => String(a.id) === String(asignacionId));
        if (!asignacion) {
            this.showNotification('No se encontró el medicamento', 'error');
            return;
        }
        const nombre = this.state.medicinas.find(m => String(m.id) === String(asignacion.medicineId))?.nombre
            || asignacion.medicineName || 'Medicamento';
        const e = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

        document.getElementById('hcMedicamentoModal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'hcMedicamentoModal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 480px;">
                <div class="modal-header">
                    <h2><i class="fas fa-pills" aria-hidden="true"></i> Editar medicamento</h2>
                    <button type="button" class="modal-close" aria-label="Cerrar" onclick="document.getElementById('hcMedicamentoModal').remove()">&times;</button>
                </div>
                <form class="modal-body" id="hcMedicamentoForm">
                    <p style="margin-bottom: 12px;"><strong>${e(nombre)}</strong></p>
                    <div class="form-group"><label for="hcMedDosis">Dosis</label>
                        <input id="hcMedDosis" class="form-input" value="${e(asignacion.dosis)}" placeholder="Ej: 50 mg"></div>
                    <div class="form-group"><label for="hcMedFrecuencia">Frecuencia</label>
                        <input id="hcMedFrecuencia" class="form-input" value="${e(asignacion.frecuencia)}" placeholder="Ej: Cada 8 h"></div>
                    <div class="form-group"><label for="hcMedDuracion">Duración</label>
                        <input id="hcMedDuracion" class="form-input" value="${e(asignacion.duracion)}" placeholder="Ej: 30 días"></div>
                    <div class="form-group"><label for="hcMedNotas">Notas</label>
                        <textarea id="hcMedNotas" class="form-input" rows="3">${e(asignacion.notas)}</textarea></div>
                </form>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('hcMedicamentoModal').remove()">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="hcMedGuardar"><i class="fas fa-save" aria-hidden="true"></i> Guardar cambios</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.querySelector('#hcMedGuardar').addEventListener('click', () => {
            Object.assign(asignacion, {
                dosis: document.getElementById('hcMedDosis').value.trim(),
                frecuencia: document.getElementById('hcMedFrecuencia').value.trim(),
                duracion: document.getElementById('hcMedDuracion').value.trim(),
                notas: document.getElementById('hcMedNotas').value.trim()
            });
            // Mantener la misma información en la prescripción de origen
            const historia = this.getHistoriaDePrescripcion(asignacion.prescripcionId);
            const medPresc = historia?.prescripciones
                ?.find(p => String(p.id) === String(asignacion.prescripcionId))
                ?.medicinas?.find(m => String(m.medicineId) === String(asignacion.medicineId));
            if (medPresc) Object.assign(medPresc, { dosis: asignacion.dosis, frecuencia: asignacion.frecuencia, duracion: asignacion.duracion });

            this.guardarMedicamentosAsignados();
            modal.remove();
            this.refrescarVistas(asignacion.pacienteId);
            this.showNotification('Medicamento actualizado', 'success');
        });
        document.getElementById('hcMedDosis').focus();
    },

    // Quita el medicamento del tratamiento activo. No toca el cobro: la medicina ya se entregó.
    quitarMedicamento(asignacionId) {
        const asignacion = this.state.medicamentosAsignados.find(a => String(a.id) === String(asignacionId));
        if (!asignacion) {
            this.showNotification('No se encontró el medicamento', 'error');
            return;
        }
        const nombre = this.state.medicinas.find(m => String(m.id) === String(asignacion.medicineId))?.nombre
            || asignacion.medicineName || 'este medicamento';
        if (!confirm(`¿Quitar ${nombre} del tratamiento del paciente?\n\nEl cobro en el estado de cuenta no cambia. Para anularlo, edita o borra la prescripción.`)) return;

        this.state.medicamentosAsignados = this.state.medicamentosAsignados.filter(a => String(a.id) !== String(asignacionId));
        this.guardarMedicamentosAsignados();
        this.refrescarVistas(asignacion.pacienteId);
        this.showNotification('Medicamento quitado del tratamiento', 'success');
    },

    // ---------- Prescripciones ----------
    async getCargosPrescripcion(prescripcionId, pacienteId) {
        const result = await this.apiFetch(
            `/api/billing/prescripciones/${encodeURIComponent(prescripcionId)}/cargos?paciente_id=${encodeURIComponent(pacienteId)}`
        );
        return result.data || [];
    },

    // Busca el cargo de una medicina de la prescripción (por id de medicina o por descripción)
    tomarCargo(cargos, medicina) {
        const index = cargos.findIndex(c =>
            (c.medicina_id && String(c.medicina_id) === String(medicina.medicineId)) ||
            c.descripcion === `Medicamento: ${medicina.medicinaNombre}`
        );
        return index === -1 ? null : cargos.splice(index, 1)[0];
    },

    async anularCargo(cargo, pacienteId, motivo) {
        await this.apiFetch(`/api/billing/cargos/${encodeURIComponent(cargo.id)}/anular`, {
            method: 'POST',
            body: JSON.stringify({ paciente_id: pacienteId, motivo })
        });
    },

    async editPrescripcion(prescripcionId) {
        const historia = this.getHistoriaDePrescripcion(prescripcionId);
        const presc = historia?.prescripciones?.find(p => String(p.id) === String(prescripcionId));
        const pacienteId = historia?.pacienteId ?? historia?.pacientId;
        const paciente = this.state.pacientes.find(p => String(p.id) === String(pacienteId));
        if (!presc || !paciente) {
            this.showNotification('No se encontró la prescripción', 'error');
            return;
        }

        this.state.pacienteSeleccionado = JSON.parse(JSON.stringify(paciente));
        await this.openNoteModal();
        this.switchTab('prescripcion');
        this.state.editingPrescripcionId = presc.id;

        document.getElementById('noteModalTitle').innerHTML = `<i class="fas fa-prescription-bottle"></i> Editar prescripción ${presc.id}`;
        document.getElementById('savePrescBtn').innerHTML = '<i class="fas fa-save"></i> Actualizar prescripción';
        const medicoSelect = document.getElementById('prescMedico');
        if (presc.medicoId && ![...medicoSelect.options].some(o => String(o.value) === String(presc.medicoId))) {
            medicoSelect.add(new Option(`Médico ${presc.medicoId} (registro histórico)`, presc.medicoId));
        }
        medicoSelect.value = presc.medicoId || '';
        document.getElementById('prescDiagnostico').value = presc.diagnostico || '';
        document.getElementById('prescFecha').value = presc.fecha || '';

        const tbody = document.getElementById('prescMedicinesTable');
        tbody.innerHTML = '';
        (presc.medicinas || []).forEach(med => {
            const row = this.addMedicineRow();
            if (!row) return;
            row.dataset.cantidadOriginal = med.cantidad;
            row.dataset.precioOriginal = med.precioUnitario;
            row.querySelector('.med-search').value = med.medicinaNombre;
            row.querySelector('.med-id').value = med.medicineId;
            row.querySelector('.med-cantidad').value = med.cantidad;
            row.querySelector('.med-dosis').value = med.dosis || '';
            row.querySelector('.med-frecuencia').value = med.frecuencia || '';
            row.querySelector('.med-duracion').value = med.duracion || '';
        });
    },

    // Aplica la edición: ajusta, anula o crea cargos según cambien las cantidades
    async actualizarPrescripcion(prescripcionId, cambios) {
        const historia = this.getHistoriaDePrescripcion(prescripcionId);
        const presc = historia?.prescripciones?.find(p => String(p.id) === String(prescripcionId));
        if (!presc) {
            this.showNotification('La prescripción ya no existe', 'error');
            return;
        }
        const pacienteId = historia.pacienteId ?? historia.pacientId;
        const saveButton = document.getElementById('savePrescBtn');
        if (saveButton) saveButton.disabled = true;

        try {
            const cargos = await this.getCargosPrescripcion(prescripcionId, pacienteId);
            const pendientes = [...cambios.medicinas];
            const nuevas = [];
            let ajustes = 0, anulados = 0;

            // Medicinas que ya estaban: ajustar cantidad o anular si se quitaron
            for (const original of presc.medicinas || []) {
                const idx = pendientes.findIndex(m => String(m.medicineId) === String(original.medicineId));
                const actual = idx === -1 ? null : pendientes.splice(idx, 1)[0];
                const cargo = this.tomarCargo(cargos, original);

                if (!actual) {
                    if (cargo) {
                        await this.anularCargo(cargo, pacienteId, `Medicina retirada de la prescripción ${prescripcionId}`);
                        anulados++;
                    }
                } else if (!cargo) {
                    nuevas.push(actual); // su cargo ya no existe: se vuelve a cobrar
                } else if (Number(cargo.cantidad) !== Number(actual.cantidad)) {
                    await this.apiFetch(`/api/billing/cargos/${encodeURIComponent(cargo.id)}`, {
                        method: 'PUT',
                        body: JSON.stringify({ paciente_id: pacienteId, cantidad: actual.cantidad, precio_unitario: cargo.precio_unitario })
                    });
                    actual.precioUnitario = cargo.precio_unitario;
                    actual.subtotal = actual.cantidad * cargo.precio_unitario;
                    ajustes++;
                }
            }
            nuevas.push(...pendientes);

            // Medicinas agregadas: se cobran en una factura ligada a la misma prescripción
            if (nuevas.length) {
                await this.registrarCargoPrescripcion({ id: prescripcionId, pacienteId, diagnostico: cambios.diagnostico, medicinas: nuevas });
            }

            Object.assign(presc, {
                medicoId: cambios.medicoId,
                diagnostico: cambios.diagnostico,
                fecha: cambios.fecha,
                medicinas: cambios.medicinas
            });
            const enEstado = this.state.prescripciones.find(p => String(p.id) === String(prescripcionId));
            if (enEstado) Object.assign(enEstado, presc);

            // Sincronizar los medicamentos en tratamiento de esta prescripción
            const idsActuales = new Set(cambios.medicinas.map(m => String(m.medicineId)));
            this.state.medicamentosAsignados = this.state.medicamentosAsignados.filter(a =>
                a.prescripcionId !== prescripcionId || idsActuales.has(String(a.medicineId))
            );
            cambios.medicinas.forEach(m => {
                const asignacion = this.state.medicamentosAsignados.find(a =>
                    a.prescripcionId === prescripcionId && String(a.medicineId) === String(m.medicineId)
                );
                if (asignacion) {
                    Object.assign(asignacion, { cantidad: m.cantidad, dosis: m.dosis, frecuencia: m.frecuencia, duracion: m.duracion, precioUnitario: m.precioUnitario, subtotal: m.subtotal });
                }
            });
            this.registrarMedicamentosAsignados({ ...presc, pacienteId }); // agrega las nuevas

            this.closeNoteModal();
            this.refrescarVistas(pacienteId);
            const detalle = [ajustes && `${ajustes} cargo(s) ajustado(s)`, anulados && `${anulados} anulado(s)`, nuevas.length && `${nuevas.length} medicina(s) cobrada(s)`]
                .filter(Boolean).join(', ');
            this.showNotification(`✅ Prescripción actualizada${detalle ? `: ${detalle}` : ''}`, 'success');

            if (typeof SaldoPacienteFacturacion !== 'undefined' && SaldoPacienteFacturacion.refrescarSaldoDelPaciente) {
                await SaldoPacienteFacturacion.refrescarSaldoDelPaciente(pacienteId);
            }
        } catch (error) {
            console.error('Error actualizando la prescripción:', error);
            this.showNotification(`❌ No se pudo actualizar la prescripción: ${error.message}. Revisa el estado de cuenta del paciente.`, 'error');
        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    },

    // Borra la prescripción y anula sus cargos en el estado de cuenta
    async deletePrescripcion(prescripcionId) {
        const historia = this.getHistoriaDePrescripcion(prescripcionId);
        const presc = historia?.prescripciones?.find(p => String(p.id) === String(prescripcionId));
        if (!presc) {
            this.showNotification('No se encontró la prescripción', 'error');
            return;
        }
        const pacienteId = historia.pacienteId ?? historia.pacientId;

        let cargos;
        try {
            cargos = await this.getCargosPrescripcion(prescripcionId, pacienteId);
        } catch (error) {
            this.showNotification(`❌ No se pudieron consultar los cargos: ${error.message}`, 'error');
            return;
        }
        const total = cargos.reduce((suma, c) => suma + (Number(c.total) || 0), 0);
        const aviso = cargos.length
            ? `Se anularán ${cargos.length} cargo(s) por ${formatQ(total)} en el estado de cuenta.`
            : 'No tiene cargos activos en el estado de cuenta.';
        if (!confirm(`¿Borrar la prescripción ${prescripcionId} (${presc.diagnostico})?\n\n${aviso}\nEsta acción no se puede deshacer.`)) return;

        try {
            for (const cargo of cargos) {
                await this.anularCargo(cargo, pacienteId, `Prescripción ${prescripcionId} eliminada de la historia clínica`);
            }
        } catch (error) {
            this.showNotification(`❌ No se pudo anular un cargo: ${error.message}. La prescripción no se borró.`, 'error');
            return;
        }

        historia.prescripciones = historia.prescripciones.filter(p => String(p.id) !== String(prescripcionId));
        this.state.prescripciones = this.state.prescripciones.filter(p => String(p.id) !== String(prescripcionId));
        this.state.medicamentosAsignados = this.state.medicamentosAsignados.filter(a => a.prescripcionId !== prescripcionId);
        this.guardarMedicamentosAsignados();
        this.refrescarVistas(pacienteId);
        this.showNotification(`Prescripción borrada${cargos.length ? ` y ${formatQ(total)} anulados del estado de cuenta` : ''}`, 'success');

        if (typeof SaldoPacienteFacturacion !== 'undefined' && SaldoPacienteFacturacion.refrescarSaldoDelPaciente) {
            await SaldoPacienteFacturacion.refrescarSaldoDelPaciente(pacienteId);
        }
    },

    // Crear una factura que incremente el estado de cuenta del paciente
    async registrarCargoPrescripcion(prescripcion) {
        if (typeof authManager === 'undefined') throw new Error('Servicio de autenticación no disponible');

        const token = authManager.getToken();
        if (!token) throw new Error('No hay token de autenticación');

        const items = prescripcion.medicinas.map(medicina => ({
            descripcion: `Medicamento: ${medicina.medicinaNombre}`,
            cantidad: medicina.cantidad,
            precio_unitario: medicina.precioUnitario,
            subtotal: medicina.subtotal,
            descuento_total: 0,
            total_item: medicina.subtotal,
            tipo_item: 'medicina',
            medicina_id: medicina.medicineId
        }));
        const subtotal = items.reduce((total, item) => total + item.subtotal, 0);
        const total = subtotal;
        const baseImpuesto = Number((total / 1.12).toFixed(2));
        const impuestosIncluidos = Number((total - baseImpuesto).toFixed(2));

        const response = await fetch(`${authManager.apiBaseUrl}/api/billing/facturas-mejorada`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                paciente_id: prescripcion.pacienteId,
                items,
                totales: {
                    subtotal,
                    total_descuentos: 0,
                    base_impuesto: baseImpuesto,
                    total_impuestos: impuestosIncluidos,
                    total_neto: total
                },
                metodo_pago: 'credito',
                observaciones: `Prescripción ${prescripcion.id}: ${prescripcion.diagnostico}`
            })
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
            throw new Error(result.error || result.message || `Error ${response.status} al cargar el estado de cuenta`);
        }

        return result.data;
    },

    // Registrar las medicinas de la prescripción para el contador del paciente
    registrarMedicamentosAsignados(prescripcion) {
        prescripcion.medicinas.forEach(medicina => {
            const yaRegistrada = this.state.medicamentosAsignados.some(asignacion =>
                asignacion.prescripcionId === prescripcion.id &&
                String(asignacion.medicineId) === String(medicina.medicineId)
            );
            if (yaRegistrada) return;

            this.state.medicamentosAsignados.push({
                id: this.generateId('ASG'),
                pacienteId: prescripcion.pacienteId,
                medicineId: medicina.medicineId,
                medicineName: medicina.medicinaNombre,
                cantidad: medicina.cantidad,
                dosis: medicina.dosis,
                frecuencia: medicina.frecuencia,
                duracion: medicina.duracion,
                precioUnitario: medicina.precioUnitario,
                subtotal: medicina.subtotal,
                prescripcionId: prescripcion.id,
                estado: 'activo',
                fechaAsignacion: prescripcion.fecha
            });
        });

        localStorage.setItem('medicamentosAsignados', JSON.stringify(this.state.medicamentosAsignados));

        if (typeof MedicinasModule !== 'undefined' && MedicinasModule.state) {
            MedicinasModule.state.medicamentosAsignados = JSON.parse(JSON.stringify(this.state.medicamentosAsignados));
        }
    },

    // Guardar prescripción en historial clínico
    guardarPrescripcionEnHistorial(prescripcion) {
        // Obtener o crear historia clínica
        let historia = this.state.historiasClinicas.find(h => String(h.pacienteId) === String(prescripcion.pacienteId));
        
        if (!historia) {
            historia = {
                id: this.generateId('HC'),
                pacienteId: prescripcion.pacienteId,
                antecedentesMedicos: '',
                antecedentesfamiliares: '',
                alergias: '',
                diagnosticosActivos: [],
                notas: [],
                prescripciones: [],
                fechaCreacion: new Date().toISOString().split('T')[0]
            };
            this.state.historiasClinicas.push(historia);
        }

        // Agregar prescripción al historial
        if (!historia.prescripciones) {
            historia.prescripciones = [];
        }
        
        historia.prescripciones.push({
            id: prescripcion.id,
            diagnostico: prescripcion.diagnostico,
            medicinas: prescripcion.medicinas,
            fecha: prescripcion.fecha,
            medicoId: prescripcion.medicoId,
            estado: prescripcion.estado
        });

        // Prescripción guardada en historial local
        console.log(`✅ Prescripción guardada para paciente ${prescripcion.pacienteId}`);
        this.saveToDB();
    },

    // Registrar movimientos de stock
    registrarMovimientosStock(medicinas, prescripcionId) {
        // Registrar movimientos en localStorage
        let movimientosStock = JSON.parse(localStorage.getItem('movimientosStock') || '[]');

        medicinas.forEach(medicina => {
            // Crear movimiento de salida (prescripción)
            const movimiento = {
                id: 'MOV-STK-' + Date.now() + '-' + Math.random(),
                medicineId: medicina.medicineId,
                medicinaNombre: medicina.medicinaNombre,
                tipo: 'Salida',
                cantidad: medicina.cantidad,
                dosis: medicina.dosis,
                frecuencia: medicina.frecuencia,
                duracion: medicina.duracion,
                motivo: 'Prescripción médica',
                referencia: prescripcionId,
                fecha: new Date().toISOString().split('T')[0],
                precio: medicina.precioUnitario,
                subtotal: medicina.subtotal
            };

            movimientosStock.push(movimiento);
        });

        // Guardar en localStorage
        localStorage.setItem('movimientosStock', JSON.stringify(movimientosStock));
        console.log(`✅ ${medicinas.length} movimientos de stock registrados`);
    },

    // Cargar monto a paciente (Sincronización con Saldo)
    cargarMontoAPaciente(pacienteId, monto, prescripcionId, descripcion) {
        // Crear movimiento
        const nuevoMovimiento = {
            id: 'MOV-' + Date.now(),
            pacienteId,
            tipo: 'Cargo',
            monto,
            descripcion: `Prescripción médica - ${descripcion}`,
            fecha: new Date().toISOString().split('T')[0],
            referencia: prescripcionId,
            medicamento: true,
            hospitalizado: true
        };
        
        // Guardar en localStorage
        let movimientos = JSON.parse(localStorage.getItem('movimientosPaciente') || '[]');
        movimientos.push(nuevoMovimiento);
        localStorage.setItem('movimientosPaciente', JSON.stringify(movimientos));
        
        // Actualizar/crear saldo
        let saldos = JSON.parse(localStorage.getItem('saldosPacientes') || '[]');
        
        let saldo = saldos.find(s => s.pacienteId === pacienteId);
        if (saldo) {
            saldo.totalAcumulado = (saldo.totalAcumulado || 0) + monto;
            saldo.saldoPendiente = (saldo.saldoPendiente || 0) + monto;
        } else {
            saldo = {
                pacienteId,
                totalAcumulado: monto,
                totalAbonos: 0,
                saldoPendiente: monto,
                ultimaTransaccion: new Date().toISOString().split('T')[0]
            };
            saldos.push(saldo);
        }
        
        localStorage.setItem('saldosPacientes', JSON.stringify(saldos));
        
        // Sincronizar con SaldoPacienteModule si está disponible
        if (SaldoPacienteModule && SaldoPacienteModule.loadData) {
            SaldoPacienteModule.loadData();
        }
        
        console.log(`✅ Cargo de ${monto} registrado para paciente ${pacienteId}`);
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
    },

    // ============ FUNCIONES PARA AGENDA SEMANAL ============

    // Obtener el inicio de la semana (lunes)
    getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar cuando el domingo
        return new Date(d.setDate(diff));
    },

    // Obtener los 7 días de la semana
    getWeekDays(startDate) {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            days.push(new Date(date));
        }
        return days;
    },

    // Parsear frecuencia a número de aplicaciones por día
    parseFrequencia(frecuencia) {
        if (!frecuencia) return 1;

        const freq = frecuencia.toLowerCase();
        // "Cada 8 h", "cada 8 horas", "c/12h", "cada 6hrs"
        const cadaHoras = freq.match(/(?:cada|c\/)\s*(\d+)\s*(?:h|hr|hrs|hora|horas)\b/);
        if (cadaHoras) {
            const horas = Number(cadaHoras[1]);
            if (horas > 0 && horas <= 24) return Math.max(1, Math.round(24 / horas));
        }
        const vecesDia = freq.match(/(\d+)\s*(?:veces|vez)/);
        if (vecesDia) return Math.max(1, Number(vecesDia[1]));
        if (freq.includes('dos veces')) return 2;
        if (freq.includes('tres veces')) return 3;
        if (freq.includes('cuatro veces')) return 4;

        return 1; // diario, una vez, noche, mañana, etc.
    },

    // Parsear duración a número de días
    parseDuracion(duracion) {
        if (!duracion) return 1;
        
        const dur = duracion.toLowerCase();
        const match = dur.match(/\d+/);
        
        if (match) {
            return parseInt(match[0]);
        }
        return 1;
    },

    // Calcular medicinas por día
    calculateMedicinesByDay(weekStartDate = null) {
        const medicinesByDay = {};
        const startDate = weekStartDate || this.state.agendaWeekStart;
        const weekDays = this.getWeekDays(startDate);
        
        // Inicializar los 7 días (fecha local de Guatemala, no UTC)
        weekDays.forEach(day => {
            medicinesByDay[this.fechaKey(day)] = [];
        });

        // Procesar todas las prescripciones activas
        if (!this.state.prescripciones || this.state.prescripciones.length === 0) {
            return medicinesByDay;
        }

        this.state.prescripciones.forEach(presc => {
            if (!presc.medicinas || presc.medicinas.length === 0) return;
            
            const paciente = this.state.pacientes.find(p => String(p.id) === String(presc.pacienteId));
            if (!paciente) return;

            const prescDate = this.parseFechaLocal(presc.fecha);

            // Procesar cada medicina en la prescripción
            presc.medicinas.forEach(med => {
                const appsByDay = this.parseFrequencia(med.frecuencia);
                const duration = this.parseDuracion(med.duracion);
                
                // Para cada día de la prescripción
                let currentDate = new Date(prescDate);
                for (let d = 0; d < duration; d++) {
                    const dateKey = this.fechaKey(currentDate);
                    
                    // Verificar que la fecha esté en la semana actual
                    if (medicinesByDay[dateKey]) {
                        for (let app = 0; app < appsByDay; app++) {
                            medicinesByDay[dateKey].push({
                                pacienteNombre: [paciente.nombre, paciente.apellidoPaterno, paciente.apellidoMaterno]
                                    .filter(Boolean)
                                    .join(' '),
                                pacienteId: paciente.id,
                                medicineId: med.medicineId,
                                fecha: dateKey,
                                aplicacionesDia: appsByDay,
                                medicinaNombre: med.medicinaNombre,
                                dosis: med.dosis,
                                cantidad: med.cantidad,
                                frecuencia: med.frecuencia,
                                aplicacion: app + 1,
                                prescripcionId: presc.id,
                                diagnostico: presc.diagnostico
                            });
                        }
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            });
        });

        return medicinesByDay;
    },

    // Renderizar agenda semanal
    renderAgendaSemanal() {
        const weekDays = this.getWeekDays(this.state.agendaWeekStart);
        const medicinesByDay = this.calculateMedicinesByDay();
        
        // Actualizar display de semana
        const startDate = weekDays[0];
        const endDate = weekDays[6];
        const startStr = startDate.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
        const endStr = endDate.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
        const monthYear = startDate.toLocaleDateString('es-GT', { year: 'numeric', month: 'long' });
        
        document.getElementById('weekDisplay').textContent = `Semana del ${startStr} al ${endStr} de ${monthYear}`;

        // Renderizar los 7 días
        const agendaWeekly = document.getElementById('agendaWeekly');
        agendaWeekly.innerHTML = '';

        weekDays.forEach(day => {
            const dateKey = this.fechaKey(day);
            const dayName = day.toLocaleDateString('es-GT', { weekday: 'short' });
            const dayNum = day.toLocaleDateString('es-GT', { day: '2-digit' });
            const medicines = medicinesByDay[dateKey] || [];
            
            const dayCard = document.createElement('div');
            dayCard.className = 'day-card-agenda';
            dayCard.style.cssText = `
                background: #fff;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                padding: 10px;
                min-height: 200px;
                display: flex;
                flex-direction: column;
            `;

            const isToday = dateKey === this.fechaKey(new Date());
            if (isToday) {
                dayCard.style.borderColor = '#4CAF50';
                dayCard.style.background = '#f1f8f4';
            }

            const header = document.createElement('div');
            header.style.cssText = `
                font-weight: bold;
                margin-bottom: 8px;
                padding-bottom: 8px;
                border-bottom: 2px solid #eee;
                color: ${isToday ? '#2e7d32' : '#333'};
            `;
            header.innerHTML = `<i class="fas fa-calendar-day"></i> ${dayName.toUpperCase()}<br><span style="font-size: 14px;">${dayNum}</span>`;
            dayCard.appendChild(header);

            const medicinesContainer = document.createElement('div');
            medicinesContainer.style.cssText = `
                flex: 1;
                overflow-y: auto;
                font-size: 12px;
            `;

            if (medicines.length === 0) {
                medicinesContainer.innerHTML = '<div style="color: #999; text-align: center; padding: 20px 5px;">Sin medicinas</div>';
            } else {
                medicines.forEach((med, idx) => {
                    const medItem = document.createElement('div');
                    medItem.style.cssText = `
                        background: #f5f5f5;
                        padding: 8px;
                        margin-bottom: 6px;
                        border-left: 4px solid #2196F3;
                        border-radius: 3px;
                    `;
                    medItem.innerHTML = `
                        <strong>${med.medicinaNombre}</strong><br>
                        <span style="color: #666; font-size: 11px;">${med.pacienteNombre}</span><br>
                        <span style="color: #2196F3;">Dosis: ${med.dosis}</span><br>
                        <span style="color: #999; font-size: 11px;">Aplicación ${med.aplicacion}</span>
                    `;
                    medicinesContainer.appendChild(medItem);
                });
            }
            dayCard.appendChild(medicinesContainer);

            const count = document.createElement('div');
            count.style.cssText = `
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid #eee;
                font-size: 11px;
                color: #999;
                text-align: center;
            `;
            count.textContent = `${medicines.length} aplicación${medicines.length !== 1 ? 'es' : ''}`;
            dayCard.appendChild(count);

            agendaWeekly.appendChild(dayCard);
        });

        // Renderizar resumen
        this.renderAgendaSummary(medicinesByDay);
    },

    // Renderizar resumen de medicinas
    renderAgendaSummary(medicinesByDay) {
        const summary = document.getElementById('agendaSummary');
        const medSummary = {};
        const patientSummary = {};

        // Contar aplicaciones por medicina y por paciente
        Object.values(medicinesByDay).forEach(dayMeds => {
            dayMeds.forEach(med => {
                // Por medicina
                if (!medSummary[med.medicinaNombre]) {
                    medSummary[med.medicinaNombre] = {
                        count: 0,
                        dosis: med.dosis,
                        cantidad: med.cantidad
                    };
                }
                medSummary[med.medicinaNombre].count++;

                // Por paciente
                const pacKey = `${med.pacienteNombre} (${med.pacienteId})`;
                if (!patientSummary[pacKey]) {
                    patientSummary[pacKey] = { count: 0, medicines: [] };
                }
                patientSummary[pacKey].count++;
                if (!patientSummary[pacKey].medicines.includes(med.medicinaNombre)) {
                    patientSummary[pacKey].medicines.push(med.medicinaNombre);
                }
            });
        });

        let html = '<div style="columns: 2; gap: 15px;">';
        
        html += '<h4 style="column-span: all; margin-top: 0;"><i class="fas fa-pills"></i> Medicinas</h4>';
        Object.entries(medSummary).forEach(([med, data]) => {
            html += `
                <div style="background: #e3f2fd; padding: 8px; margin-bottom: 8px; border-radius: 4px; page-break-inside: avoid;">
                    <strong>${med}</strong><br>
                    <span style="color: #666; font-size: 11px;">Dosis: ${data.dosis}</span><br>
                    <span style="color: #1976d2; font-weight: bold;">${data.count} aplicaciones</span>
                </div>
            `;
        });

        html += '<h4><i class="fas fa-user-md"></i> Pacientes</h4>';
        Object.entries(patientSummary).forEach(([patient, data]) => {
            html += `
                <div style="background: #f3e5f5; padding: 8px; margin-bottom: 8px; border-radius: 4px; page-break-inside: avoid;">
                    <strong>${patient}</strong><br>
                    <span style="color: #666; font-size: 11px;">${data.medicines.join(', ')}</span><br>
                    <span style="color: #7b1fa2; font-weight: bold;">${data.count} aplicaciones</span>
                </div>
            `;
        });

        html += '</div>';
        summary.innerHTML = html;
    },

    // Navegar a semana anterior
    previousWeek() {
        const newDate = new Date(this.state.agendaWeekStart);
        newDate.setDate(newDate.getDate() - 7);
        this.state.agendaWeekStart = newDate;
        this.renderAgendaSemanal();
    },

    // Navegar a semana siguiente
    nextWeek() {
        const newDate = new Date(this.state.agendaWeekStart);
        newDate.setDate(newDate.getDate() + 7);
        this.state.agendaWeekStart = newDate;
        this.renderAgendaSemanal();
    },

    // ============ VISTA AGENDA GENERAL (TODO EL MÓDULO) ============

    // Crear contenedor de filtro de paciente
    createFilterContainer() {
        const vistaAgenda = document.getElementById('vistaAgendaGeneral');
        const filterContainer = document.createElement('div');
        filterContainer.id = 'agendaFilterPaciente';
        if (vistaAgenda.firstChild) {
            vistaAgenda.insertBefore(filterContainer, vistaAgenda.firstChild);
        } else {
            vistaAgenda.appendChild(filterContainer);
        }
        return filterContainer;
    },

    // Cambiar entre vista de paciente y vista de agenda general
    switchVistaHistoria(vista) {
        const vistaPaciente = document.getElementById('vistaPaciente');
        const vistaAgenda = document.getElementById('vistaAgendaGeneral');
        const tabs = document.querySelectorAll('.tab-vista-historia');

        if (vista === 'paciente') {
            vistaPaciente.style.display = 'flex';
            vistaAgenda.style.display = 'none';
            tabs[0].style.color = '#1e3a8a';
            tabs[0].style.borderBottom = '3px solid #1e3a8a';
            tabs[1].style.color = '#666';
            tabs[1].style.borderBottom = '3px solid transparent';
        } else if (vista === 'agenda') {
            vistaPaciente.style.display = 'none';
            vistaAgenda.style.display = 'block';
            tabs[0].style.color = '#666';
            tabs[0].style.borderBottom = '3px solid transparent';
            tabs[1].style.color = '#1e3a8a';
            tabs[1].style.borderBottom = '3px solid #1e3a8a';
            this.renderAgendaSemanalGeneral();
        }
    },

    // Renderizar agenda semanal general (todos los pacientes)
    renderAgendaSemanalGeneral() {
        const weekDays = this.getWeekDays(this.state.agendaWeekStartGeneral);
        const medicinesByDay = this.calculateMedicinesByDay(this.state.agendaWeekStartGeneral);
        
        // Obtener lista única de pacientes para filtro
        const pacientesUnicos = new Map();
        this.state.prescripciones.forEach(presc => {
            const paciente = this.state.pacientes.find(p => String(p.id) === String(presc.pacienteId));
            if (paciente && !pacientesUnicos.has(paciente.id)) {
                pacientesUnicos.set(paciente.id, paciente);
            }
        });
        
        // Actualizar display de semana
        const startDate = weekDays[0];
        const endDate = weekDays[6];
        const startStr = startDate.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
        const endStr = endDate.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
        const monthYear = startDate.toLocaleDateString('es-GT', { year: 'numeric', month: 'long' });
        
        document.getElementById('weekDisplayGeneral').textContent = `Semana del ${startStr} al ${endStr} de ${monthYear}`;
        
        // Renderizar filtro de paciente
        const filterContainer = document.getElementById('agendaFilterPaciente') || this.createFilterContainer();
        let filterHTML = `
            <div style="margin-bottom: 20px; background: #f5f5f5; padding: 15px; border-radius: 8px;">
                <label style="display: block; margin-bottom: 8px; font-weight: bold;">Filtrar por Paciente:</label>
                <select id="selectPacienteAgendaGeneral" class="form-input" style="width: 100%; max-width: 400px;">
                    <option value="">-- Todos los pacientes --</option>
        `;
        pacientesUnicos.forEach(paciente => {
            filterHTML += `<option value="${paciente.id}">${paciente.nombre} ${paciente.apellidoPaterno}</option>`;
        });
        filterHTML += `</select></div>`;
        filterContainer.innerHTML = filterHTML;
        
        const selectPaciente = document.getElementById('selectPacienteAgendaGeneral');
        if (selectPaciente && !selectPaciente._listenerAdded) {
            selectPaciente.addEventListener('change', (e) => {
                this.state.filtroAgendaPaciente = e.target.value;
                this.renderAgendaSemanalGeneral();
            });
            selectPaciente._listenerAdded = true;
        }

        // Renderizar los 7 días
        const agendaWeekly = document.getElementById('agendaWeeklyGeneral');
        agendaWeekly.innerHTML = '';
        
        // Aplicar filtro de paciente si existe
        let medicinesByDayFiltered = medicinesByDay;
        if (this.state.filtroAgendaPaciente) {
            medicinesByDayFiltered = {};
            Object.keys(medicinesByDay).forEach(dateKey => {
                medicinesByDayFiltered[dateKey] = medicinesByDay[dateKey].filter(med => 
                    String(med.pacienteId) === String(this.state.filtroAgendaPaciente)
                );
            });
        }

        this.cargarAdministracion();
        this.setupAgendaAdministracion(agendaWeekly);

        weekDays.forEach(day => {
            const dateKey = this.fechaKey(day);
            const dayName = day.toLocaleDateString('es-GT', { weekday: 'short' });
            const dayNum = day.toLocaleDateString('es-GT', { day: '2-digit' });
            const medicines = medicinesByDayFiltered[dateKey] || [];
            
            const dayCard = document.createElement('div');
            dayCard.className = 'day-card-agenda';
            dayCard.style.cssText = `
                background: #fff;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                padding: 10px;
                min-height: 200px;
                display: flex;
                flex-direction: column;
            `;

            const isToday = dateKey === this.fechaKey(new Date());
            if (isToday) {
                dayCard.style.borderColor = '#4CAF50';
                dayCard.style.background = '#f1f8f4';
            }

            const header = document.createElement('div');
            header.style.cssText = `
                font-weight: bold;
                margin-bottom: 8px;
                padding-bottom: 8px;
                border-bottom: 2px solid #eee;
                color: ${isToday ? '#2e7d32' : '#333'};
            `;
            header.innerHTML = `<i class="fas fa-calendar-day"></i> ${dayName.toUpperCase()}<br><span style="font-size: 14px;">${dayNum}</span>`;
            dayCard.appendChild(header);

            const medicinesContainer = document.createElement('div');
            medicinesContainer.style.cssText = `
                flex: 1;
                overflow-y: auto;
                font-size: 12px;
            `;

            if (medicines.length === 0) {
                medicinesContainer.innerHTML = '<div style="color: #999; text-align: center; padding: 20px 5px;">Sin medicinas</div>';
            } else {
                medicines.forEach(med => {
                    medicinesContainer.appendChild(this.renderDosisItem(med));
                });
            }
            dayCard.appendChild(medicinesContainer);

            const count = document.createElement('div');
            count.style.cssText = `
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid #eee;
                font-size: 11px;
                color: #999;
                text-align: center;
            `;
            const dadas = medicines.filter(med => this.estadoDosis(med) === 'dado').length;
            const suspendidas = medicines.filter(med => this.estadoDosis(med) === 'suspendido').length;
            const activas = medicines.length - suspendidas;
            count.textContent = medicines.length
                ? `${dadas} de ${activas} dada${activas !== 1 ? 's' : ''}${suspendidas ? ` · ${suspendidas} suspendida${suspendidas !== 1 ? 's' : ''}` : ''}`
                : '0 aplicaciones';
            dayCard.appendChild(count);

            agendaWeekly.appendChild(dayCard);
        });

        // Renderizar resumen
        this.renderAgendaSummaryGeneral(medicinesByDay);
    },

    // Renderizar resumen de medicinas general
    renderAgendaSummaryGeneral(medicinesByDay) {
        const summary = document.getElementById('agendaSummaryGeneral');
        const medicamentosPorPaciente = {};

        // Agrupar medicamentos por paciente desde prescripciones
        this.state.prescripciones.forEach(presc => {
            const paciente = this.state.pacientes.find(p => String(p.id) === String(presc.pacienteId));
            if (paciente && presc.medicinas && presc.medicinas.length > 0) {
                const pacKey = [paciente.nombre, paciente.apellidoPaterno, paciente.apellidoMaterno]
                    .filter(Boolean)
                    .join(' ');
                if (!medicamentosPorPaciente[pacKey]) {
                    medicamentosPorPaciente[pacKey] = {
                        paciente: paciente,
                        prescripciones: []
                    };
                }
                medicamentosPorPaciente[pacKey].prescripciones.push(presc);
            }
        });

        let html = `
            <div style="padding: 0;">
                <h4 style="margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #2196F3; padding-bottom: 10px;">
                    <i class="fas fa-pills"></i> Medicamentos por Paciente
                </h4>
        `;

        if (Object.keys(medicamentosPorPaciente).length === 0) {
            html += '<div style="color: #999; text-align: center; padding: 20px;">No hay medicamentos prescritos</div>';
        } else {
            Object.entries(medicamentosPorPaciente).forEach(([pacKey, data], idx) => {
                html += `
                    <div style="background: #f9f9f9; padding: 12px; margin-bottom: 12px; border-left: 4px solid #4CAF50; border-radius: 4px;">
                        <div style="font-weight: bold; color: #1976d2; margin-bottom: 8px;">
                            <i class="fas fa-user-circle"></i> ${pacKey}
                        </div>
                `;
                
                data.prescripciones.forEach(presc => {
                    const medCount = presc.medicinas.length;
                    html += `
                        <div style="background: white; padding: 10px; margin-bottom: 8px; border-radius: 3px; border: 1px solid #e0e0e0;">
                            <small style="color: #666;">Prescripción: ${presc.id} - ${presc.fecha}</small><br>
                    `;
                    
                    presc.medicinas.forEach(med => {
                        const susp = this.getSuspension(presc.id, med.medicineId);
                        html += `
                            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #f0f0f0;">
                                <strong style="color: #333;">${med.medicinaNombre}</strong>
                                ${susp ? `<span class="mar-suspendido-tag">Suspendido desde ${formatFecha(susp.desde)}: ${this.escapeHTML(susp.motivo)}</span>` : ''}<br>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; color: #666; margin-top: 4px;">
                                    <span><i class="fas fa-cube"></i> Cant: ${med.cantidad}</span>
                                    <span><i class="fas fa-weight"></i> Dosis: ${med.dosis}</span>
                                    <span><i class="fas fa-clock"></i> ${med.frecuencia}</span>
                                    <span><i class="fas fa-calendar"></i> ${med.duracion}</span>
                                </div>
                            </div>
                        `;
                    });
                    
                    html += `
                            <small style="color: #2196F3; font-weight: bold; display: block; margin-top: 8px;">
                                → ${medCount} medicamento${medCount !== 1 ? 's' : ''} prescrito${medCount !== 1 ? 's' : ''}
                            </small>
                        </div>
                    `;
                });
                
                html += '</div>';
            });
        }

        html += '</div>';
        summary.innerHTML = html;
    },

    // ============================================
    // REGISTRO DE ADMINISTRACIÓN DE MEDICAMENTOS
    // ============================================

    fechaKey(date) {
        const d = date instanceof Date ? date : new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    // 'YYYY-MM-DD' como fecha local (new Date('YYYY-MM-DD') usa UTC)
    parseFechaLocal(valor) {
        const texto = String(valor || '').slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
            const [y, m, d] = texto.split('-').map(Number);
            return new Date(y, m - 1, d);
        }
        return new Date(valor);
    },

    escapeHTML(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    ADMIN_STORAGE_KEY: 'administracionMedicamentos',

    cargarAdministracion() {
        try {
            const guardado = JSON.parse(localStorage.getItem(this.ADMIN_STORAGE_KEY) || 'null');
            this.state.administracion = {
                dosis: guardado?.dosis || {},
                suspensiones: guardado?.suspensiones || {}
            };
        } catch (error) {
            this.state.administracion = { dosis: {}, suspensiones: {} };
        }
        return this.state.administracion;
    },

    guardarAdministracion() {
        localStorage.setItem(this.ADMIN_STORAGE_KEY, JSON.stringify(this.state.administracion));
    },

    claveDosis(med) {
        return `${med.prescripcionId}|${med.medicineId}|${med.fecha}|${med.aplicacion}`;
    },

    getSuspension(prescripcionId, medicineId) {
        return this.state.administracion.suspensiones[`${prescripcionId}|${medicineId}`] || null;
    },

    // pendiente | dado | suspendido
    estadoDosis(med) {
        const susp = this.getSuspension(med.prescripcionId, med.medicineId);
        if (susp && (med.fecha > susp.desde || (med.fecha === susp.desde && med.aplicacion >= susp.desdeAplicacion))) {
            // Una dosis ya dada antes de suspender se conserva como dada
            if (this.state.administracion.dosis[this.claveDosis(med)]?.estado !== 'dado') return 'suspendido';
        }
        return this.state.administracion.dosis[this.claveDosis(med)]?.estado === 'dado' ? 'dado' : 'pendiente';
    },

    renderDosisItem(med) {
        const estado = this.estadoDosis(med);
        const susp = this.getSuspension(med.prescripcionId, med.medicineId);
        const registro = this.state.administracion.dosis[this.claveDosis(med)];
        const e = valor => this.escapeHTML(valor);
        const datos = `data-presc="${e(med.prescripcionId)}" data-med="${e(med.medicineId)}" data-fecha="${e(med.fecha)}" data-aplicacion="${med.aplicacion}"`;

        const titulos = {
            pendiente: 'No se ha dado. Clic para marcar como dada.',
            dado: `Dada${registro?.registrado ? ` el ${formatFechaHora(registro.registrado)}` : ''}. Clic para desmarcar.`,
            suspendido: `Suspendido desde ${susp ? formatFecha(susp.desde) : ''}: ${susp?.motivo || ''}. Clic para reanudar.`
        };
        const iconos = { pendiente: '', dado: '<i class="fas fa-check" aria-hidden="true"></i>', suspendido: '<i class="fas fa-xmark" aria-hidden="true"></i>' };

        const item = document.createElement('div');
        item.className = `mar-item mar-${estado}`;
        item.innerHTML = `
            <button type="button" class="mar-check" data-accion="${estado === 'suspendido' ? 'reanudar' : 'marcar'}" ${datos}
                    title="${e(titulos[estado])}" aria-label="${e(titulos[estado])}">${iconos[estado]}</button>
            <div class="mar-info">
                <strong title="${e(med.medicinaNombre)}">${e(med.medicinaNombre)}</strong>
                <span>${e(med.pacienteNombre)}</span>
                <span class="mar-dosis">${e(med.dosis || 'Sin dosis')}${med.aplicacionesDia > 1 ? ` · ${med.aplicacion}/${med.aplicacionesDia}` : ''}</span>
                ${estado === 'suspendido' && susp ? `<span class="mar-motivo" title="${e(susp.motivo)}">${e(susp.motivo)}</span>` : ''}
            </div>
            ${estado !== 'suspendido' ? `
                <button type="button" class="mar-suspender" data-accion="suspender" ${datos}
                        title="Suspender este medicamento a partir de esta dosis" aria-label="Suspender medicamento">
                    <i class="fas fa-ban" aria-hidden="true"></i>
                </button>` : ''}
        `;
        return item;
    },

    // Un solo listener para todas las casillas de la semana
    setupAgendaAdministracion(contenedor) {
        if (!contenedor || contenedor._marListener) return;
        contenedor._marListener = true;
        contenedor.addEventListener('click', event => {
            const boton = event.target.closest('[data-accion]');
            if (!boton) return;
            const med = {
                prescripcionId: boton.dataset.presc,
                medicineId: boton.dataset.med,
                fecha: boton.dataset.fecha,
                aplicacion: Number(boton.dataset.aplicacion)
            };
            if (boton.dataset.accion === 'marcar') this.toggleDosis(med);
            if (boton.dataset.accion === 'suspender') this.abrirSuspension(med);
            if (boton.dataset.accion === 'reanudar') this.reanudarMedicamento(med);
        });
    },

    toggleDosis(med) {
        const clave = this.claveDosis(med);
        if (this.state.administracion.dosis[clave]?.estado === 'dado') {
            delete this.state.administracion.dosis[clave];
        } else {
            this.state.administracion.dosis[clave] = {
                estado: 'dado',
                registrado: new Date().toISOString(),
                usuario: (typeof authManager !== 'undefined' && authManager.getUser?.()?.nombre) || ''
            };
        }
        this.guardarAdministracion();
        this.renderAgendaSemanalGeneral();
    },

    abrirSuspension(med) {
        const presc = this.state.prescripciones.find(p => String(p.id) === String(med.prescripcionId));
        const medicina = presc?.medicinas?.find(m => String(m.medicineId) === String(med.medicineId));
        const paciente = this.state.pacientes.find(p => String(p.id) === String(presc?.pacienteId));
        if (!presc || !medicina) return;
        const e = valor => this.escapeHTML(valor);

        document.getElementById('hcSuspenderModal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'hcSuspenderModal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 460px;">
                <div class="modal-header">
                    <h2><i class="fas fa-ban" aria-hidden="true"></i> Suspender medicamento</h2>
                    <button type="button" class="modal-close" aria-label="Cerrar" onclick="document.getElementById('hcSuspenderModal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 4px;"><strong>${e(medicina.medicinaNombre)}</strong> · ${e(medicina.dosis || '')}</p>
                    <p class="form-hint" style="margin-bottom: 14px;">${e(paciente ? `${paciente.nombre} ${paciente.apellidoPaterno || ''}` : '')} · Se suspende desde el ${formatFecha(med.fecha)}${med.aplicacion > 1 ? `, aplicación ${med.aplicacion}` : ''} en adelante.</p>
                    <div class="form-group">
                        <label for="hcSuspenderMotivo">Motivo de la suspensión <span class="required">*</span></label>
                        <textarea id="hcSuspenderMotivo" class="form-input" rows="3" placeholder="Ej: Reacción adversa, indicación médica, alta del paciente..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('hcSuspenderModal').remove()">Cancelar</button>
                    <button type="button" class="btn btn-danger" id="hcSuspenderConfirmar"><i class="fas fa-ban" aria-hidden="true"></i> Suspender medicamento</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        const motivoInput = modal.querySelector('#hcSuspenderMotivo');
        motivoInput.focus();
        modal.querySelector('#hcSuspenderConfirmar').addEventListener('click', () => {
            const motivo = motivoInput.value.trim();
            if (!motivo) {
                motivoInput.focus();
                this.showNotification('Escribe el motivo de la suspensión', 'warning');
                return;
            }
            this.suspenderMedicamento(med, motivo);
            modal.remove();
        });
    },

    suspenderMedicamento(med, motivo) {
        this.state.administracion.suspensiones[`${med.prescripcionId}|${med.medicineId}`] = {
            desde: med.fecha,
            desdeAplicacion: med.aplicacion,
            motivo,
            registrado: new Date().toISOString()
        };
        this.guardarAdministracion();

        // El medicamento sale del tratamiento activo del paciente
        this.state.medicamentosAsignados
            .filter(a => a.prescripcionId === med.prescripcionId && String(a.medicineId) === String(med.medicineId))
            .forEach(a => Object.assign(a, { estado: 'suspendido', fechaSuspension: med.fecha, motivoSuspension: motivo }));
        this.guardarMedicamentosAsignados();

        this.renderAgendaSemanalGeneral();
        if (this.state.pacienteSeleccionado) this.renderHistoriaClinica();
        this.showNotification('Medicamento suspendido', 'success');
    },

    reanudarMedicamento(med) {
        const susp = this.getSuspension(med.prescripcionId, med.medicineId);
        if (!susp) return;
        if (!confirm(`¿Reanudar este medicamento?\n\nSe quitará la suspensión del ${formatFecha(susp.desde)} (motivo: ${susp.motivo}).`)) return;

        delete this.state.administracion.suspensiones[`${med.prescripcionId}|${med.medicineId}`];
        this.guardarAdministracion();
        this.state.medicamentosAsignados
            .filter(a => a.prescripcionId === med.prescripcionId && String(a.medicineId) === String(med.medicineId))
            .forEach(a => {
                a.estado = 'activo';
                delete a.fechaSuspension;
                delete a.motivoSuspension;
            });
        this.guardarMedicamentosAsignados();

        this.renderAgendaSemanalGeneral();
        if (this.state.pacienteSeleccionado) this.renderHistoriaClinica();
        this.showNotification('Medicamento reanudado', 'success');
    },

    // ============================================
    // IMPRIMIR HISTORIA CLÍNICA
    // ============================================

    imprimirHistoriaClinica() {
        const paciente = this.state.pacienteSeleccionado;
        if (!paciente) {
            this.showNotification('Selecciona un paciente primero', 'warning');
            return;
        }
        this.cargarAdministracion();
        const e = valor => this.escapeHTML(valor);
        const historia = this.getHistoria(paciente.id) || {};
        const prescripciones = [...(historia.prescripciones || [])].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
        const notas = [...(historia.notas || [])].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
        const asignaciones = this.state.medicamentosAsignados.filter(a => String(a.pacienteId) === String(paciente.id));
        const clinica = (typeof CONFIG !== 'undefined' && CONFIG.CLINICA) || { nombre: 'Zentra MED' };
        const nombreMedico = id => {
            const m = (this.state.medicos || []).find(item => String(item.id) === String(id));
            return m ? [m.nombre, m.apellidoPaterno, m.apellidoMaterno].filter(Boolean).join(' ') : '';
        };
        const fecha = valor => valor ? formatFecha(valor) : '—';
        const seccion = (titulo, contenido) => `<section><h2>${titulo}</h2>${contenido}</section>`;
        const vacio = texto => `<p class="vacio">${texto}</p>`;

        // Registro de administración por medicina de cada prescripción
        const dosis = this.state.administracion.dosis;
        const registroAdmin = prescripciones.flatMap(presc => (presc.medicinas || []).map(med => {
            const prefijo = `${presc.id}|${med.medicineId}|`;
            const dadas = Object.entries(dosis)
                .filter(([clave, d]) => clave.startsWith(prefijo) && d.estado === 'dado')
                .map(([clave, d]) => ({ fecha: clave.split('|')[2], registrado: d.registrado }))
                .sort((a, b) => a.fecha.localeCompare(b.fecha));
            const porDia = dadas.reduce((acc, d) => { acc[d.fecha] = (acc[d.fecha] || 0) + 1; return acc; }, {});
            return { presc, med, dadas, porDia, susp: this.getSuspension(presc.id, med.medicineId) };
        }));

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Historia clínica - ${e(paciente.nombre)} ${e(paciente.apellidoPaterno || '')}</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2933; font-size: 12px; line-height: 1.45; padding: 28px; }
    .doc { max-width: 900px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f766e; padding-bottom: 12px; margin-bottom: 16px; }
    header .clinica { font-size: 16px; font-weight: 700; color: #0f766e; }
    header .clinica small { display: block; font-size: 11px; font-weight: 400; color: #52606d; }
    header h1 { font-size: 20px; text-align: right; letter-spacing: .04em; }
    header .fecha { text-align: right; font-size: 11px; color: #52606d; }
    section { margin-bottom: 16px; page-break-inside: avoid; }
    h2 { font-size: 12.5px; text-transform: uppercase; letter-spacing: .06em; color: #0f766e; border-bottom: 1px solid #d9e2e6; padding-bottom: 4px; margin-bottom: 8px; }
    .datos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 16px; }
    .datos div span { display: block; font-size: 10px; text-transform: uppercase; color: #7b8794; }
    .alerta { border: 1px solid #f3b4b4; background: #fdecec; color: #991b1b; padding: 8px 10px; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #d9e2e6; padding: 5px 7px; text-align: left; vertical-align: top; }
    th { background: #f1f5f7; font-size: 10.5px; text-transform: uppercase; }
    .presc { margin-bottom: 10px; }
    .presc-cab { display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 4px; }
    .suspendido { color: #b91c1c; font-weight: 600; }
    .nota { border-left: 3px solid #0f766e; padding: 4px 0 4px 10px; margin-bottom: 8px; }
    .nota-cab { font-weight: 600; }
    .nota-cab span { font-weight: 400; color: #52606d; }
    .vacio { color: #7b8794; font-style: italic; }
    .firmas { display: flex; gap: 40px; margin-top: 50px; }
    .firmas div { flex: 1; border-top: 1px solid #1f2933; padding-top: 4px; text-align: center; font-size: 11px; }
    footer { margin-top: 20px; font-size: 10px; color: #7b8794; text-align: center; }
    @media print { body { padding: 0; } @page { size: letter; margin: 14mm; } }
</style>
</head>
<body><div class="doc">
<header>
    <div class="clinica">${e(clinica.nombre || 'Zentra MED')}
        <small>${e([clinica.nit && `NIT ${clinica.nit}`, clinica.direccion, clinica.municipio, clinica.telefono].filter(x => x && String(x).trim() && String(x).trim() !== '+502').join(' · '))}</small>
    </div>
    <div><h1>HISTORIA CLÍNICA</h1><div class="fecha">Impresa el ${e(formatFechaHora())}</div></div>
</header>

${seccion('Datos del paciente', `<div class="datos">
    <div><span>Nombre</span>${e([paciente.nombre, paciente.apellidoPaterno, paciente.apellidoMaterno].filter(Boolean).join(' '))}</div>
    <div><span>DPI</span>${e(paciente.dpi || paciente.pasaporte || '—')}</div>
    <div><span>Edad</span>${e(this.calculateAge(paciente.fechaNacimiento))} años</div>
    <div><span>Fecha de nacimiento</span>${fecha(paciente.fechaNacimiento)}</div>
    <div><span>Género</span>${e(paciente.genero || '—')}</div>
    <div><span>Tipo de servicio</span>${e({ agudo: 'Agudo', cronico: 'Crónico', coex: 'COEX' }[paciente.tipoServicio] || paciente.tipoServicio || '—')}</div>
    <div><span>Teléfono</span>${e(paciente.telefono || '—')}</div>
    <div><span>Email</span>${e(paciente.email || '—')}</div>
    <div><span>Municipio</span>${e(paciente.municipio || '—')}</div>
</div>`)}

${historia.alergias ? seccion('Alergias', `<p class="alerta">${e(historia.alergias)}</p>`) : ''}
${seccion('Antecedentes médicos', historia.antecedentesMedicos ? `<p>${e(historia.antecedentesMedicos)}</p>` : vacio('Sin antecedentes registrados'))}
${historia.antecedentesfamiliares ? seccion('Antecedentes familiares', `<p>${e(historia.antecedentesfamiliares)}</p>`) : ''}
${(historia.diagnosticosActivos || []).length ? seccion('Diagnósticos activos', `<table><thead><tr><th>Diagnóstico</th><th>Fecha</th><th>Descripción</th></tr></thead><tbody>${
    historia.diagnosticosActivos.map(d => `<tr><td>${e(d.nombre)}</td><td>${e(d.fecha)}</td><td>${e(d.descripcion)}</td></tr>`).join('')
}</tbody></table>`) : ''}

${seccion('Tratamiento farmacológico', asignaciones.length ? `<table><thead><tr><th>Medicamento</th><th>Dosis</th><th>Frecuencia</th><th>Duración</th><th>Desde</th><th>Estado</th></tr></thead><tbody>${
    asignaciones.map(a => {
        const susp = this.getSuspension(a.prescripcionId, a.medicineId);
        const suspendido = a.estado === 'suspendido' || susp;
        return `<tr><td>${e(a.medicineName || '')}</td><td>${e(a.dosis || '—')}</td><td>${e(a.frecuencia || '—')}</td><td>${e(a.duracion || '—')}</td><td>${fecha(a.fechaAsignacion || a.fechaInicio)}</td>
            <td>${suspendido ? `<span class="suspendido">Suspendido ${fecha(susp?.desde || a.fechaSuspension)}</span><br>${e(susp?.motivo || a.motivoSuspension || '')}` : 'Activo'}</td></tr>`;
    }).join('')
}</tbody></table>` : vacio('Sin medicamentos en tratamiento'))}

${seccion('Prescripciones', prescripciones.length ? prescripciones.map(p => `<div class="presc">
    <div class="presc-cab"><span>${e(p.id)} · ${fecha(p.fecha)}</span><span>${e(nombreMedico(p.medicoId) || '')}</span></div>
    <p><strong>Diagnóstico:</strong> ${e(p.diagnostico || '—')}</p>
    <table><thead><tr><th>Medicina</th><th>Cantidad</th><th>Dosis</th><th>Frecuencia</th><th>Duración</th></tr></thead><tbody>${
        (p.medicinas || []).map(m => `<tr><td>${e(m.medicinaNombre)}</td><td>${e(m.cantidad)}</td><td>${e(m.dosis || '—')}</td><td>${e(m.frecuencia || '—')}</td><td>${e(m.duracion || '—')}</td></tr>`).join('')
    }</tbody></table></div>`).join('') : vacio('Sin prescripciones'))}

${seccion('Registro de administración de medicamentos', registroAdmin.length ? `<table><thead><tr><th>Medicamento</th><th>Prescripción</th><th>Dosis dadas</th><th>Detalle por día</th><th>Suspensión</th></tr></thead><tbody>${
    registroAdmin.map(r => `<tr><td>${e(r.med.medicinaNombre)}<br><small>${e(r.med.dosis || '')} · ${e(r.med.frecuencia || '')}</small></td>
        <td>${e(r.presc.id)}</td><td>${r.dadas.length}</td>
        <td>${Object.keys(r.porDia).length ? Object.entries(r.porDia).map(([f, n]) => `${fecha(f)}: ${n}/${this.parseFrequencia(r.med.frecuencia)}`).join('<br>') : '<span class="vacio">Sin registros</span>'}</td>
        <td>${r.susp ? `<span class="suspendido">Desde ${fecha(r.susp.desde)}</span><br>${e(r.susp.motivo)}` : '—'}</td></tr>`).join('')
}</tbody></table>` : vacio('Sin medicamentos prescritos'))}

${seccion('Evolución y notas médicas', notas.length ? notas.map(n => `<div class="nota">
    <div class="nota-cab">${e(n.tipo)} <span>· ${fecha(n.fecha)}${n.medico ? ` · ${e(n.medico)}` : ''}</span></div>
    <p>${e(n.contenido)}</p></div>`).join('') : vacio('Sin notas registradas'))}

<div class="firmas"><div>Médico tratante</div><div>Firma y sello</div></div>
<footer>Documento generado por ${e(clinica.nombre || 'Zentra MED')} · ${e(formatFechaHora())}</footer>
</div></body></html>`;

        const ventana = window.open('', '_blank', 'width=900,height=900');
        if (!ventana) {
            this.showNotification('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.', 'warning');
            return;
        }
        ventana.document.write(html);
        ventana.document.close();
        setTimeout(() => ventana.print(), 300);
    },

    // Navegar a semana anterior en vista general
    previousWeekGeneral() {
        const newDate = new Date(this.state.agendaWeekStartGeneral);
        newDate.setDate(newDate.getDate() - 7);
        this.state.agendaWeekStartGeneral = newDate;
        this.renderAgendaSemanalGeneral();
    },

    // Navegar a semana siguiente en vista general
    nextWeekGeneral() {
        const newDate = new Date(this.state.agendaWeekStartGeneral);
        newDate.setDate(newDate.getDate() + 7);
        this.state.agendaWeekStartGeneral = newDate;
        this.renderAgendaSemanalGeneral();
    }
};

