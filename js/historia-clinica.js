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
        searchTerm: '',
        filtroEstado: 'activos', // activos, todos
        agendaWeekStart: new Date(), // Se inicializa correctamente en init()
        agendaWeekStartGeneral: new Date() // Para la vista general
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
                this.searchTerm = e.target.value.toLowerCase();
                this.renderPacientes();
            });
        }

        const filterState = document.getElementById('filterEstadoHistoria');
        if (filterState) {
            filterState.addEventListener('change', (e) => {
                this.filtroEstado = e.target.value;
                this.renderPacientes();
            });
        }

        const addNoteBtn = document.getElementById('addNoteBtn');
        if (addNoteBtn) {
            addNoteBtn.addEventListener('click', () => this.openNoteModal());
        }

        const saveNoteBtn = document.getElementById('saveNoteBtn');
        if (saveNoteBtn) {
            saveNoteBtn.addEventListener('click', () => this.saveNote());
        }

        const closeNoteModal = document.querySelector('#noteModal .close-btn');
        if (closeNoteModal) {
            closeNoteModal.addEventListener('click', () => this.closeNoteModal());
        }
    },

    // Cargar datos
    loadData() {
        const demoData = window.DemoData || {};
        this.state.pacientes = JSON.parse(JSON.stringify(demoData.pacientes || []));
        this.state.medicinas = JSON.parse(JSON.stringify(demoData.medicinas || []));
        this.state.medicamentosAsignados = JSON.parse(JSON.stringify(demoData.medicamentosAsignados || []));
        
        // Cargar historial clínico desde localStorage si existe, sino desde DemoData
        const historiasFromStorage = localStorage.getItem('historiasClinicas');
        if (historiasFromStorage) {
            this.state.historiasClinicas = JSON.parse(historiasFromStorage);
        } else {
            this.state.historiasClinicas = JSON.parse(JSON.stringify(demoData.historiasClinicas || []));
        }
        
        this.state.medicos = JSON.parse(JSON.stringify(demoData.medicos || []));
        this.state.prescripciones = JSON.parse(JSON.stringify(demoData.prescripciones || []));
        this.renderPacientes();
    },

    // Renderizar lista de pacientes
    renderPacientes() {
        const container = document.getElementById('pacientesHistoriaList');
        if (!container) return;

        let filtered = [...this.state.pacientes];

        // Filtro por estado
        if (this.filtroEstado === 'activos') {
            filtered = filtered.filter(p => p.estado === 'activo');
        }

        // Búsqueda
        if (this.searchTerm) {
            filtered = filtered.filter(p =>
                p.nombre.toLowerCase().includes(this.searchTerm) ||
                p.apellido.toLowerCase().includes(this.searchTerm) ||
                p.cedula.includes(this.searchTerm)
            );
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
        const historiasCount = this.state.historiasClinicas.filter(h => h.pacienteId === pacient.id).length;
        const notasCount = this.state.historiasClinicas
            .filter(h => h.pacienteId === pacient.id)
            .reduce((sum, h) => sum + (h.notas ? h.notas.length : 0), 0);
        
        const medicamentosCount = this.state.medicamentosAsignados
            .filter(m => m.pacienteId === pacient.id && m.estado === 'activo').length;

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
                    <span class="stat">📝 ${notasCount} nota(s)</span>
                    <span class="stat">💊 ${medicamentosCount} medicamento(s)</span>
                </div>
            </div>
        `;
    },

    // Seleccionar paciente
    selectPacient(pacienteId) {
        this.state.pacienteSeleccionado = this.state.pacientes.find(p => p.id === pacienteId);
        if (this.state.pacienteSeleccionado) {
            this.renderHistoriaClinica();
        }
    },

    // Renderizar historia clínica completa
    renderHistoriaClinica() {
        const container = document.getElementById('historiaClinicaContent');
        const buttonBar = document.getElementById('historiaButtonBar');
        if (!container || !this.state.pacienteSeleccionado) return;

        const pacient = this.state.pacienteSeleccionado;
        const historia = this.state.historiasClinicas.find(h => h.pacienteId === pacient.id);
        const medicamentosActivos = this.state.medicamentosAsignados
            .filter(m => m.pacienteId === pacient.id && m.estado === 'activo');

        // Mostrar botón de agregar nota
        if (buttonBar) {
            buttonBar.style.display = 'flex';
        }

        container.innerHTML = `
            <div class="historia-container">
                <!-- Header con datos del paciente -->
                <div class="historia-header">
                    <div class="pacient-info">
                        <h1>${pacient.nombre} ${pacient.apellidoPaterno} ${pacient.apellidoMaterno || ''}</h1>
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
                                            <strong>${med?.nombre}</strong>
                                            <span class="badge badge-success">Activo</span>
                                        </div>
                                        <div class="med-details">
                                            <p><strong>Dosis:</strong> ${m.dosis}</p>
                                            <p><strong>Frecuencia:</strong> ${m.frecuencia}</p>
                                            <p><strong>Desde:</strong> ${m.fechaInicio}</p>
                                            ${m.notas ? `<p><strong>Notas:</strong> ${m.notas}</p>` : ''}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Notas Médicas / Observaciones -->
                ${historia && historia.notas && historia.notas.length > 0 ? `
                    <div class="section-card">
                        <h2><i class="fas fa-pen"></i> Notas Médicas y Observaciones</h2>
                        <div class="notas-timeline">
                            ${[...historia.notas].reverse().map((nota, idx) => `
                                <div class="nota-item">
                                    <div class="nota-header">
                                        <strong>${nota.tipo}</strong>
                                        <span class="nota-fecha">${nota.fecha}</span>
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
    openNoteModal() {
        if (!this.state.pacienteSeleccionado) {
            this.showNotification('⚠️ Selecciona un paciente primero', 'warning');
            return;
        }

        const modal = document.getElementById('noteModal');
        const noteForm = document.getElementById('editNoteForm');
        const prescForm = document.getElementById('prescripcionForm');
        if (!modal) return;

        // Limpiar formulario de notas
        noteForm.reset();
        document.getElementById('noteTipo').value = 'Observación';
        document.getElementById('noteFecha').valueAsDate = new Date();

        // Limpiar formulario de prescripción
        prescForm.reset();
        document.getElementById('prescFecha').valueAsDate = new Date();
        document.getElementById('prescMedicinesTable').innerHTML = '';

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    // Cerrar modal
    closeNoteModal() {
        const modal = document.getElementById('noteModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
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
        let historia = this.state.historiasClinicas.find(h => h.pacienteId === this.state.pacienteSeleccionado.id);
        
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

        // Agregar nota
        historia.notas.push({
            id: this.generateId('NOTE'),
            tipo: tipo,
            contenido: contenido,
            fecha: fecha,
            medico: medico
        });

        this.showNotification('✅ Nota registrada correctamente', 'success');
        this.saveToDB();
        this.closeNoteModal();
        this.renderHistoriaClinica();
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
            this.loadMedicos();
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

    // Cargar lista de médicos en select
    loadMedicos() {
        const demoData = window.DemoData || {};
        const medicos = demoData.medicos || [];
        const select = document.getElementById('prescMedico');
        
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Seleccionar médico --</option>';
        medicos.forEach(med => {
            const option = document.createElement('option');
            option.value = med.id;
            option.textContent = med.nombre || med.nombreCompleto;
            select.appendChild(option);
        });
    },

    // Agregar fila de medicina
    addMedicineRow() {
        const tbody = document.getElementById('prescMedicinesTable');
        if (!tbody) return;
        
        const rowId = 'med-' + Date.now();
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
    },

    // Mostrar todas las medicinas disponibles (al hacer clic en la lupa)
    showAllMedicines(rowId) {
        const row = document.getElementById(rowId);
        if (!row) return;
        
        const demoData = window.DemoData || {};
        const medicinas = demoData.medicinas || [];
        
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
                    <br><small style="color: #666;">Código: ${med.codigo} | Stock: ${med.stock}</small>
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
        
        const demoData = window.DemoData || {};
        const medicinas = demoData.medicinas || [];
        
        const filtered = medicinas.filter(med => 
            med.nombre.toLowerCase().includes(searchTerm)
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
    savePrescripcion() {
        if (!this.state.pacienteSeleccionado) return;
        
        const medicoId = document.getElementById('prescMedico').value;
        const diagnostico = document.getElementById('prescDiagnostico').value.trim();
        const fecha = document.getElementById('prescFecha').value;
        
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
        medicineRows.forEach(row => {
            const medicineId = row.querySelector('.med-id').value;
            const medicinaNombre = row.querySelector('.med-search').value;
            const cantidad = parseFloat(row.querySelector('.med-cantidad').value);
            const dosis = row.querySelector('.med-dosis').value;
            const frecuencia = row.querySelector('.med-frecuencia').value;
            const duracion = row.querySelector('.med-duracion').value;
            
            if (!medicineId || !medicinaNombre) {
                this.showNotification('⚠️ Por favor selecciona medicinas válidas', 'warning');
                return;
            }
            
            medicinas.push({
                medicineId,
                medicinaNombre,
                cantidad,
                dosis,
                frecuencia,
                duracion
            });
        });
        
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
        
        // Guardar en state
        if (!this.state.prescripciones) {
            this.state.prescripciones = [];
        }
        this.state.prescripciones.push(prescripcion);
        
        // GUARDAR EN HISTORIAL CLÍNICO
        this.guardarPrescripcionEnHistorial(prescripcion);
        
        this.showNotification(`✅ Prescripción ${prescripcionId} registrada correctamente`, 'success');
        this.closeNoteModal();
        this.renderHistoriaClinica();
    },

    // Guardar prescripción en historial clínico
    guardarPrescripcionEnHistorial(prescripcion) {
        // Obtener o crear historia clínica
        let historia = this.state.historiasClinicas.find(h => h.pacienteId === prescripcion.pacienteId);
        
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

        // Actualizar en Demo Data
        if (window.DemoData && window.DemoData.historiasClinicas) {
            const demoHistoria = window.DemoData.historiasClinicas.find(h => h.pacienteId === prescripcion.pacienteId);
            if (demoHistoria) {
                if (!demoHistoria.prescripciones) {
                    demoHistoria.prescripciones = [];
                }
                demoHistoria.prescripciones.push({
                    id: prescripcion.id,
                    diagnostico: prescripcion.diagnostico,
                    medicinas: prescripcion.medicinas,
                    fecha: prescripcion.fecha,
                    medicoId: prescripcion.medicoId,
                    estado: prescripcion.estado
                });
            }
        }

        this.saveToDB();
    },

    // Registrar movimientos de stock
    registrarMovimientosStock(medicinas, prescripcionId) {
        const demoData = window.DemoData || {};
        
        if (!demoData.movimientosStock) {
            demoData.movimientosStock = [];
        }

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

            demoData.movimientosStock.push(movimiento);

            // Descontar del stock disponible (si la medicina existe en medicinas)
            if (demoData.medicinas) {
                const med = demoData.medicinas.find(m => m.id === medicina.medicineId);
                if (med && med.cantidad) {
                    med.cantidad -= medicina.cantidad;
                }
            }
        });

        // Actualizar Demo Data
        if (window.DemoData) {
            window.DemoData.movimientosStock = demoData.movimientosStock;
            if (demoData.medicinas) {
                window.DemoData.medicinas = demoData.medicinas;
            }
        }
    },

    // Cargar monto a paciente (Sincronización con Saldo)
    cargarMontoAPaciente(pacienteId, monto, prescripcionId, descripcion) {
        const demoData = window.DemoData || {};
        
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
        
        if (!demoData.movimientosPaciente) {
            demoData.movimientosPaciente = [];
        }
        demoData.movimientosPaciente.push(nuevoMovimiento);
        
        // Actualizar/crear saldo
        if (!demoData.saldosPacientes) {
            demoData.saldosPacientes = [];
        }
        
        let saldo = demoData.saldosPacientes.find(s => s.pacienteId === pacienteId);
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
            demoData.saldosPacientes.push(saldo);
        }
        
        // Actualizar Demo Data globalmente
        if (window.DemoData) {
            window.DemoData.movimientosPaciente = demoData.movimientosPaciente;
            window.DemoData.saldosPacientes = demoData.saldosPacientes;
        }
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
        if (freq.includes('cada 4 horas')) return 6;
        if (freq.includes('cada 6 horas')) return 4;
        if (freq.includes('cada 8 horas')) return 3;
        if (freq.includes('cada 12 horas')) return 2;
        if (freq.includes('dos veces')) return 2;
        if (freq.includes('tres veces')) return 3;
        if (freq.includes('diario') || freq.includes('una vez')) return 1;
        if (freq.includes('cada día')) return 1;
        
        return 1; // Default
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
        
        // Inicializar los 7 días
        weekDays.forEach(day => {
            const dateKey = day.toISOString().split('T')[0];
            medicinesByDay[dateKey] = [];
        });

        // Procesar todas las prescripciones activas
        if (!this.state.prescripciones || this.state.prescripciones.length === 0) {
            return medicinesByDay;
        }

        this.state.prescripciones.forEach(presc => {
            if (!presc.medicinas || presc.medicinas.length === 0) return;
            
            const paciente = this.state.pacientes.find(p => p.id === presc.pacienteId);
            if (!paciente) return;

            const prescDate = new Date(presc.fecha);

            // Procesar cada medicina en la prescripción
            presc.medicinas.forEach(med => {
                const appsByDay = this.parseFrequencia(med.frecuencia);
                const duration = this.parseDuracion(med.duracion);
                
                // Para cada día de la prescripción
                let currentDate = new Date(prescDate);
                for (let d = 0; d < duration; d++) {
                    const dateKey = currentDate.toISOString().split('T')[0];
                    
                    // Verificar que la fecha esté en la semana actual
                    if (medicinesByDay[dateKey]) {
                        for (let app = 0; app < appsByDay; app++) {
                            medicinesByDay[dateKey].push({
                                pacienteNombre: `${paciente.nombre} ${paciente.apellido}`,
                                pacienteId: paciente.id,
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
        const startStr = startDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        const endStr = endDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        const monthYear = startDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
        
        document.getElementById('weekDisplay').textContent = `Semana del ${startStr} al ${endStr} de ${monthYear}`;

        // Renderizar los 7 días
        const agendaWeekly = document.getElementById('agendaWeekly');
        agendaWeekly.innerHTML = '';

        weekDays.forEach(day => {
            const dateKey = day.toISOString().split('T')[0];
            const dayName = day.toLocaleDateString('es-ES', { weekday: 'short' });
            const dayNum = day.toLocaleDateString('es-ES', { day: '2-digit' });
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

            const isToday = dateKey === new Date().toISOString().split('T')[0];
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
        
        // Actualizar display de semana
        const startDate = weekDays[0];
        const endDate = weekDays[6];
        const startStr = startDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        const endStr = endDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        const monthYear = startDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
        
        document.getElementById('weekDisplayGeneral').textContent = `Semana del ${startStr} al ${endStr} de ${monthYear}`;

        // Renderizar los 7 días
        const agendaWeekly = document.getElementById('agendaWeeklyGeneral');
        agendaWeekly.innerHTML = '';

        weekDays.forEach(day => {
            const dateKey = day.toISOString().split('T')[0];
            const dayName = day.toLocaleDateString('es-ES', { weekday: 'short' });
            const dayNum = day.toLocaleDateString('es-ES', { day: '2-digit' });
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

            const isToday = dateKey === new Date().toISOString().split('T')[0];
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
        this.renderAgendaSummaryGeneral(medicinesByDay);
    },

    // Renderizar resumen de medicinas general
    renderAgendaSummaryGeneral(medicinesByDay) {
        const summary = document.getElementById('agendaSummaryGeneral');
        const medicamentosPorPaciente = {};

        // Agrupar medicamentos por paciente desde prescripciones
        this.state.prescripciones.forEach(presc => {
            const paciente = this.state.pacientes.find(p => p.id === presc.pacienteId);
            if (paciente && presc.medicinas && presc.medicinas.length > 0) {
                const pacKey = `${paciente.nombre} ${paciente.apellido}`;
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
                        html += `
                            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #f0f0f0;">
                                <strong style="color: #333;">${med.medicinaNombre}</strong><br>
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

