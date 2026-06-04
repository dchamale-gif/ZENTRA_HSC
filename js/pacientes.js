// ============================================
// MÓDULO DE PACIENTES
// ============================================
// Un paciente puede ser cliente o no (independiente)
// Un cliente puede estar vinculado a uno o múltiples pacientes

const PacientesModule = {
    state: {
        pacientes: [],
        clientes: [],
        filtroActivo: 'todos', // todos, cliente, no-cliente
        searchTerm: ''
    },
    documentosTemporales: {}, // Almacena documentos antes de guardar

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        this.loadData();
        console.log('Módulo de Pacientes inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        const newPacientBtn = document.getElementById('addPacientBtn');
        if (newPacientBtn) {
            newPacientBtn.addEventListener('click', () => this.openPacientModal());
        }

        const savePacientBtn = document.getElementById('savePacientBtn');
        if (savePacientBtn) {
            savePacientBtn.addEventListener('click', () => this.savePacient());
        }

        const searchInput = document.getElementById('searchPacient');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.renderPacientes();
            });
        }

        const filterSelect = document.getElementById('filterPacient');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filtroActivo = e.target.value;
                this.renderPacientes();
            });
        }

        const closeBtnModal = document.querySelector('#pacientModal .close-btn');
        if (closeBtnModal) {
            closeBtnModal.addEventListener('click', () => this.closePacientModal());
        }

        const editForm = document.getElementById('editPacientForm');
        if (editForm) {
            editForm.addEventListener('change', () => this.validatePacientForm());
        }

        // Listeners para fotos
        const fotoFileInput = document.getElementById('pacientFotoInput');
        if (fotoFileInput) {
            fotoFileInput.addEventListener('change', (e) => this.handlePhotoUpload(e));
        }

        const camerInput = document.getElementById('pacientCameraInput');
        if (camerInput) {
            camerInput.addEventListener('change', (e) => this.handlePhotoUpload(e));
        }

        const docFileInput = document.getElementById('pacientDocFileInput');
        if (docFileInput) {
            docFileInput.addEventListener('change', (e) => this.handleDocumentUpload(e));
        }

        // Drag & Drop para foto del paciente
        const fotoDragZone = document.getElementById('pacientFotoDragZone');
        if (fotoDragZone) {
            fotoDragZone.addEventListener('dragover', (e) => this.handleDragOver(e));
            fotoDragZone.addEventListener('dragenter', (e) => this.handleDragEnter(e, fotoDragZone));
            fotoDragZone.addEventListener('dragleave', (e) => this.handleDragLeave(e, fotoDragZone));
            fotoDragZone.addEventListener('drop', (e) => this.handleFotoDrop(e));
        }

        // Drag & Drop para documentos
        const docDragZone = document.getElementById('pacientDocDragZone');
        if (docDragZone) {
            docDragZone.addEventListener('dragover', (e) => this.handleDragOver(e));
            docDragZone.addEventListener('dragenter', (e) => this.handleDragEnter(e, docDragZone));
            docDragZone.addEventListener('dragleave', (e) => this.handleDragLeave(e, docDragZone));
            docDragZone.addEventListener('drop', (e) => this.handleDocumentDrop(e));
        }
    },

    // Cargar datos
    loadData() {
        const demoData = window.DemoData || {};
        this.state.pacientes = JSON.parse(JSON.stringify(demoData.pacientes || []));
        this.state.clientes = JSON.parse(JSON.stringify(demoData.clientes || []));
        this.renderPacientes();
    },

    // Abrir modal de nuevo paciente
    openPacientModal() {
        const modal = document.getElementById('pacientModal');
        const form = document.getElementById('editPacientForm');
        if (!modal || !form) return;

        // Limpiar formulario
        form.reset();
        document.getElementById('pacientId').value = '';
        document.getElementById('pacientIsCliente').checked = false;
        document.getElementById('clienteSelectionDiv').style.display = 'none';
        
        // Limpiar foto
        this.removePacientPhoto();
        
        // Limpiar documentos
        document.getElementById('pacientDocCategory').value = '';
        const gallery = document.getElementById('pacientDocumentsGallery');
        if (gallery) {
            gallery.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">No hay documentos cargados</p>';
        }
        
        // Limpiar contenedor de archivos
        const filesContainer = document.getElementById('pacientFilesContainer');
        if (filesContainer) {
            filesContainer.innerHTML = '<p style="text-align: center; color: #999;">Guarda el paciente para cargar archivos</p>';
        }
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    // Cerrar modal
    closePacientModal() {
        const modal = document.getElementById('pacientModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    },

    // Manejo de fotos
    triggerFileUpload() {
        document.getElementById('pacientFotoInput').click();
    },

    triggerCameraCapture() {
        document.getElementById('pacientCameraInput').click();
    },

    handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.convertFileToBase64(file);
        }
        // Limpiar el input para permitir cargar el mismo archivo nuevamente
        event.target.value = '';
    },

    convertFileToBase64(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            document.getElementById('pacientFoto').value = base64;
            this.displayPhotoPreview(base64);
            document.getElementById('pacientFotoRemoveBtn').style.display = 'inline-block';
        };
        reader.readAsDataURL(file);
    },

    displayPhotoPreview(base64) {
        const preview = document.getElementById('pacientFotoPreview');
        preview.innerHTML = '';
        
        const img = document.createElement('img');
        img.src = base64;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        
        preview.appendChild(img);
    },

    removePacientPhoto() {
        document.getElementById('pacientFoto').value = '';
        document.getElementById('pacientFotoInput').value = '';
        document.getElementById('pacientCameraInput').value = '';
        
        const preview = document.getElementById('pacientFotoPreview');
        preview.innerHTML = '<i class="fas fa-user" style="font-size: 60px; color: #999;"></i>';
        
        document.getElementById('pacientFotoRemoveBtn').style.display = 'none';
    },

    // Manejo de Drag & Drop
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
    },

    handleDragEnter(event, zone) {
        event.preventDefault();
        event.stopPropagation();
        if (zone) {
            zone.style.backgroundColor = '#e3f2fd';
            zone.style.borderColor = '#1976d2';
            zone.style.boxShadow = '0 0 10px rgba(25, 118, 210, 0.3)';
        }
    },

    handleDragLeave(event, zone) {
        event.preventDefault();
        event.stopPropagation();
        if (zone && event.target === zone) {
            zone.style.backgroundColor = '';
            zone.style.borderColor = '';
            zone.style.boxShadow = '';
        }
    },

    handleFotoDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const zone = document.getElementById('pacientFotoDragZone');
        if (zone) {
            zone.style.backgroundColor = '';
            zone.style.borderColor = '';
            zone.style.boxShadow = '';
        }

        const files = Array.from(event.dataTransfer.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            this.showNotification('⚠️ Por favor arrastra solo imágenes', 'warning');
            return;
        }

        // Procesar solo la primera imagen para la foto del paciente
        if (imageFiles[0]) {
            this.convertFileToBase64(imageFiles[0]);
        }
    },

    handleDocumentDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const zone = document.getElementById('pacientDocDragZone');
        if (zone) {
            zone.style.backgroundColor = '';
            zone.style.borderColor = '';
            zone.style.boxShadow = '';
        }

        const category = document.getElementById('pacientDocCategory').value;
        if (!category) {
            this.showNotification('⚠️ Por favor selecciona una categoría de documento primero', 'warning');
            return;
        }

        const files = Array.from(event.dataTransfer.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            this.showNotification('⚠️ Por favor arrastra solo imágenes', 'warning');
            return;
        }

        const currentId = document.getElementById('pacientId').value;
        if (!currentId) {
            this.showNotification('⚠️ Primero debes crear el paciente', 'warning');
            return;
        }

        // Procesar múltiples imágenes
        imageFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result;
                this.addDocumentToGallery(currentId, category, base64, file.name);
            };
            reader.readAsDataURL(file);
        });

        this.showNotification(`✅ ${imageFiles.length} imagen(es) agregada(s)`, 'success');
    },

    // Manejo de documentos (fotografías)
    triggerDocumentUpload() {
        const category = document.getElementById('pacientDocCategory').value;
        if (!category) {
            this.showNotification('⚠️ Por favor selecciona una categoría de documento', 'warning');
            return;
        }
        document.getElementById('pacientDocFileInput').click();
    },

    handleDocumentUpload(event) {
        const files = Array.from(event.target.files);
        const category = document.getElementById('pacientDocCategory').value;
        
        if (!files.length || !category) return;

        const currentId = document.getElementById('pacientId').value;
        if (!currentId) {
            this.showNotification('⚠️ Primero debes crear el paciente', 'warning');
            event.target.value = '';
            return;
        }

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result;
                this.addDocumentToGallery(currentId, category, base64, file.name);
            };
            reader.readAsDataURL(file);
        });

        event.target.value = '';
    },

    addDocumentToGallery(pacientId, category, base64, fileName) {
        if (!this.documentosTemporales) {
            this.documentosTemporales = {};
        }
        
        if (!this.documentosTemporales[pacientId]) {
            this.documentosTemporales[pacientId] = [];
        }

        const documentId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.documentosTemporales[pacientId].push({
            id: documentId,
            category: category,
            base64: base64,
            fileName: fileName,
            timestamp: new Date().toLocaleString('es-GT')
        });

        this.displayDocumentGallery(pacientId);
    },

    displayDocumentGallery(pacientId) {
        const gallery = document.getElementById('pacientDocumentsGallery');
        if (!gallery) return;

        const documentos = this.documentosTemporales?.[pacientId] || [];

        if (documentos.length === 0) {
            gallery.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">No hay documentos cargados</p>';
            return;
        }

        const categoryLabels = {
            'DPI_Paciente': '📄 DPI Paciente',
            'DocumentoId_Paciente': '📄 Documento de Identificación',
            'DPI_Responsable': '📄 DPI Responsable',
            'DocumentoId_Responsable': '📄 Documento de Identificación Resp.',
            'Foto_Perfil_Responsable': '📸 Foto Responsable',
            'Documentos_Medicos': '🏥 Médicos',
            'Otros': '📎 Otros'
        };

        gallery.innerHTML = documentos.map(doc => `
            <div style="background: white; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; position: relative; transition: transform 0.2s;">
                <img src="${doc.base64}" style="width: 100%; height: 150px; object-fit: cover;">
                <div style="padding: 10px; background: #f9f9f9; font-size: 12px;">
                    <p style="margin: 3px 0; font-weight: bold; color: #333;">${categoryLabels[doc.category] || doc.category}</p>
                    <p style="margin: 3px 0; color: #666;">${doc.timestamp}</p>
                </div>
                <button type="button" style="position: absolute; top: 5px; right: 5px; background: #e74c3c; color: white; border: none; border-radius: 50%; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center;" onclick="PacientesModule.removeDocument('${pacientId}', '${doc.id}')">
                    <i class="fas fa-trash" style="font-size: 12px;"></i>
                </button>
            </div>
        `).join('');
    },

    removeDocument(pacientId, documentId) {
        if (!this.documentosTemporales?.[pacientId]) return;

        const index = this.documentosTemporales[pacientId].findIndex(d => d.id === documentId);
        if (index > -1) {
            this.documentosTemporales[pacientId].splice(index, 1);
            this.displayDocumentGallery(pacientId);
        }
    },

    // Guardar paciente
    savePacient() {
        const form = document.getElementById('editPacientForm');
        if (!form) return;

        // Validar en cliente
        if (!this.validatePacientForm()) {
            this.showNotification('⚠️ Por favor completa todos los campos requeridos', 'warning');
            return;
        }

        const id = document.getElementById('pacientId').value;
        const cedula = document.getElementById('pacientCedula').value.trim();
        
        // Validar cédula única
        const existeCedula = this.state.pacientes.some(p => 
            p.cedula === cedula && p.id !== id
        );
        if (existeCedula) {
            this.showNotification('❌ Esta cédula ya existe en el sistema', 'error');
            return;
        }

        const pacientData = {
            id: id || this.generateId('PAC'),
            // Datos de consulta
            fechaPrimerConsulta: document.getElementById('fechaPrimerConsulta').value,
            motivoConsulta: document.getElementById('motivoConsulta').value.trim(),
            referencia: document.getElementById('referencia').value.trim(),
            // Identificación personal
            nombre: document.getElementById('pacientNombre').value.trim(),
            apellidoPaterno: document.getElementById('pacientApellidoPaterno').value.trim(),
            apellidoMaterno: document.getElementById('pacientApellidoMaterno').value.trim(),
            edad: document.getElementById('pacientEdad').value,
            fechaNacimiento: document.getElementById('pacientFechaNacimiento').value,
            nacionalidad: document.getElementById('nacionalidad').value.trim(),
            genero: document.getElementById('pacientGenero').value,
            dpi: document.getElementById('dpi').value.trim(),
            documentoIdentificacion: document.getElementById('documentoIdentificacion').value.trim(),
            // Dirección
            direccion: document.getElementById('pacientDireccion').value.trim(),
            colonia: document.getElementById('colonia').value.trim(),
            zona: document.getElementById('zona').value.trim(),
            municipio: document.getElementById('municipio').value.trim(),
            departamento: document.getElementById('departamento').value.trim(),
            originarioDe: document.getElementById('originarioDe').value.trim(),
            // Contacto
            telefono: document.getElementById('pacientTelefono').value.trim(),
            email: document.getElementById('pacientEmail').value.trim(),
            vivecon: document.getElementById('vivecon').value.trim(),
            tieneHijos: document.getElementById('tieneHijos').value,
            // Información laboral/educativa
            estadoCivil: document.getElementById('estadoCivil').value,
            profesion: document.getElementById('profesion').value.trim(),
            gradoAcademico: document.getElementById('gradoAcademico').value,
            ocupacion: document.getElementById('ocupacion').value.trim(),
            // Tipo de servicio
            tipoServicio: document.getElementById('pacientTipoServicio').value,
            clasificacion: (['agudo', 'cronico'].includes(document.getElementById('pacientTipoServicio').value)) 
                ? document.getElementById('pacientClasificacion').value 
                : null,
            segmentoCOEX: document.getElementById('pacientTipoServicio').value === 'coex' 
                ? document.getElementById('pacientCOEXSegmento').value 
                : null,
            // Lugar de trabajo
            empresa: {
                nombre: document.getElementById('empresaNombre').value.trim(),
                telefono: document.getElementById('empresaTelefono').value.trim(),
                direccion: document.getElementById('empresaDireccion').value.trim()
            },
            // Contacto de emergencia
            emergencia: {
                nombre: document.getElementById('emergenciaNombre').value.trim(),
                telefono: document.getElementById('emergenciaTelefono').value.trim(),
                parentesco: document.getElementById('emergenciaParentesco').value.trim()
            },
            // Historial médico
            historialMedico: {
                padeceCronica: document.getElementById('padeceCronica').checked,
                especificacionCronica: document.getElementById('especificacionCronica').value.trim(),
                tomaMedicamento: document.getElementById('tomaMedicamento').checked,
                especificacionMedicamento: document.getElementById('especificacionMedicamento').value.trim(),
                padaceAlergia: document.getElementById('padaceAlergia').checked,
                especificacionAlergia: document.getElementById('especificacionAlergia').value.trim(),
                utilizaProtesis: document.getElementById('utilizaProtesis').checked,
                especificacionProtesis: document.getElementById('especificacionProtesis').value.trim(),
                haConvulsionado: document.getElementById('haConvulsionado').checked,
                especificacionConvulsion: document.getElementById('especificacionConvulsion').value.trim(),
                ultimoProcedimiento: document.getElementById('ultimoProcedimiento').value.trim(),
                fechaProcedimiento: document.getElementById('fechaProcedimiento').value,
                examenesLab: document.getElementById('examenesLab').value.trim(),
                fechaExamenes: document.getElementById('fechaExamenes').value,
                ultimoPeriodo: document.getElementById('ultimoPeriodo').value,
                edadPrimeraMenstruacion: document.getElementById('edadPrimeraMenstruacion').value,
                cantidadGestas: document.getElementById('cantidadGestas').value,
                cantidadPartos: document.getElementById('cantidadPartos').value,
                tratamientoPsiquiatrico: document.getElementById('tratamientoPsiquiatrico').checked,
                // Información específica para COEX
                coex: {
                    tipoSustancia: document.getElementById('tipoSustancia')?.value.trim() || '',
                    tiempoConsumo: document.getElementById('tiempoConsumo')?.value.trim() || '',
                    frecuenciaConsumo: document.getElementById('frecuenciaConsumo')?.value || '',
                    viaAdministracion: document.getElementById('viaAdministracion')?.value.trim() || '',
                    intentosRehabilitacion: document.getElementById('intentosRehabilitacion')?.value || 0,
                    ultimoTratamiento: document.getElementById('ultimoTratamiento')?.value || '',
                    motivacionTratamiento: document.getElementById('motivacionTratamiento')?.value.trim() || '',
                    comorbilidad: document.getElementById('comorbilidad')?.checked || false,
                    especificacionComorbilidad: document.getElementById('especificacionComorbilidad')?.value.trim() || '',
                    antecedentesLegales: document.getElementById('antecedentesLegales')?.checked || false,
                    especificacionLegales: document.getElementById('especificacionLegales')?.value.trim() || ''
                }
            },
            // Datos familiares
            familia: {
                padre: {
                    nombre: document.getElementById('padreNombre').value.trim(),
                    telefono: document.getElementById('padreTelefono').value.trim(),
                    ocupacion: document.getElementById('padreOcupacion').value.trim()
                },
                madre: {
                    nombre: document.getElementById('madreNombre').value.trim(),
                    telefono: document.getElementById('madreTelefono').value.trim(),
                    ocupacion: document.getElementById('madreOcupacion').value.trim()
                },
                pareja: {
                    nombre: document.getElementById('parejaNombre').value.trim(),
                    telefono: document.getElementById('parejaTelefono').value.trim(),
                    ocupacion: document.getElementById('parejaOcupacion').value.trim()
                },
                hermanos: {
                    numero: document.getElementById('hermanosNumero').value,
                    observaciones: document.getElementById('hermanosObservaciones').value.trim()
                },
                hijos: {
                    numero: document.getElementById('hijosNumero').value,
                    observaciones: document.getElementById('hijosObservaciones').value.trim()
                }
            },
            // Responsable (opcional)
            responsable: {
                nombre: document.getElementById('responsableNombre').value.trim(),
                relacion: document.getElementById('responsableRelacion').value,
                telefono: document.getElementById('responsableTelefono').value.trim(),
                email: document.getElementById('responsableEmail').value.trim()
            },
            // Información adicional
            isCliente: document.getElementById('pacientIsCliente').checked,
            clienteId: document.getElementById('pacientIsCliente').checked 
                ? document.getElementById('clienteSelect').value 
                : null,
            fechaRegistro: id ? this.state.pacientes.find(p => p.id === id)?.fechaRegistro : new Date().toISOString().split('T')[0],
            notas: document.getElementById('pacientNotas').value.trim(),
            foto: document.getElementById('pacientFoto').value || null,
            documentos: this.documentosTemporales?.[id] || []
        };

        if (id) {
            // Actualizar
            const index = this.state.pacientes.findIndex(p => p.id === id);
            if (index > -1) {
                this.state.pacientes[index] = pacientData;
                this.showNotification('✅ Paciente actualizado correctamente', 'success');
            }
        } else {
            // Crear
            this.state.pacientes.push(pacientData);
            this.showNotification('✅ Paciente creado correctamente', 'success');
        }

        this.saveToDB();
        this.renderPacientes();
        
        // Mantener el modal abierto para permitir carga de archivos
        const newPacienteId = id || pacientData.id;
        document.getElementById('pacientId').value = newPacienteId;
        
        // Cargar archivos después de guardar
        setTimeout(() => {
            PacientesFileManager.renderPacientFiles(newPacienteId);
        }, 100);
    },

    // Editar paciente
    editPacient(id) {
        const pacient = this.state.pacientes.find(p => p.id === id);
        if (!pacient) return;

        document.getElementById('pacientId').value = pacient.id;
        
        // Datos de consulta
        document.getElementById('fechaPrimerConsulta').value = pacient.fechaPrimerConsulta || '';
        document.getElementById('motivoConsulta').value = pacient.motivoConsulta || '';
        document.getElementById('referencia').value = pacient.referencia || '';
        
        // Identificación personal
        document.getElementById('pacientNombre').value = pacient.nombre || '';
        document.getElementById('pacientApellidoPaterno').value = pacient.apellidoPaterno || '';
        document.getElementById('pacientApellidoMaterno').value = pacient.apellidoMaterno || '';
        document.getElementById('pacientEdad').value = pacient.edad || '';
        document.getElementById('pacientFechaNacimiento').value = pacient.fechaNacimiento || '';
        document.getElementById('nacionalidad').value = pacient.nacionalidad || '';
        document.getElementById('pacientGenero').value = pacient.genero || '';
        document.getElementById('dpi').value = pacient.dpi || '';
        document.getElementById('documentoIdentificacion').value = pacient.documentoIdentificacion || '';
        
        // Dirección
        document.getElementById('pacientDireccion').value = pacient.direccion || '';
        document.getElementById('colonia').value = pacient.colonia || '';
        document.getElementById('zona').value = pacient.zona || '';
        document.getElementById('municipio').value = pacient.municipio || '';
        document.getElementById('departamento').value = pacient.departamento || '';
        document.getElementById('originarioDe').value = pacient.originarioDe || '';
        
        // Contacto
        document.getElementById('pacientTelefono').value = pacient.telefono || '';
        document.getElementById('pacientEmail').value = pacient.email || '';
        document.getElementById('vivecon').value = pacient.vivecon || '';
        document.getElementById('tieneHijos').value = pacient.tieneHijos || '';
        
        // Información laboral/educativa
        document.getElementById('estadoCivil').value = pacient.estadoCivil || '';
        document.getElementById('profesion').value = pacient.profesion || '';
        document.getElementById('gradoAcademico').value = pacient.gradoAcademico || '';
        document.getElementById('ocupacion').value = pacient.ocupacion || '';
        
        // Tipo de servicio
        document.getElementById('pacientTipoServicio').value = pacient.tipoServicio || '';
        document.getElementById('pacientClasificacion').value = pacient.clasificacion || '';
        document.getElementById('pacientCOEXSegmento').value = pacient.segmentoCOEX || '';
        
        // Lugar de trabajo
        if (pacient.empresa) {
            document.getElementById('empresaNombre').value = pacient.empresa.nombre || '';
            document.getElementById('empresaTelefono').value = pacient.empresa.telefono || '';
            document.getElementById('empresaDireccion').value = pacient.empresa.direccion || '';
        }
        
        // Contacto de emergencia
        if (pacient.emergencia) {
            document.getElementById('emergenciaNombre').value = pacient.emergencia.nombre || '';
            document.getElementById('emergenciaTelefono').value = pacient.emergencia.telefono || '';
            document.getElementById('emergenciaParentesco').value = pacient.emergencia.parentesco || '';
        }
        
        // Historial médico
        if (pacient.historialMedico) {
            document.getElementById('padeceCronica').checked = pacient.historialMedico.padeceCronica || false;
            document.getElementById('especificacionCronica').value = pacient.historialMedico.especificacionCronica || '';
            document.getElementById('tomaMedicamento').checked = pacient.historialMedico.tomaMedicamento || false;
            document.getElementById('especificacionMedicamento').value = pacient.historialMedico.especificacionMedicamento || '';
            document.getElementById('padaceAlergia').checked = pacient.historialMedico.padaceAlergia || false;
            document.getElementById('especificacionAlergia').value = pacient.historialMedico.especificacionAlergia || '';
            document.getElementById('utilizaProtesis').checked = pacient.historialMedico.utilizaProtesis || false;
            document.getElementById('especificacionProtesis').value = pacient.historialMedico.especificacionProtesis || '';
            document.getElementById('haConvulsionado').checked = pacient.historialMedico.haConvulsionado || false;
            document.getElementById('especificacionConvulsion').value = pacient.historialMedico.especificacionConvulsion || '';
            document.getElementById('ultimoProcedimiento').value = pacient.historialMedico.ultimoProcedimiento || '';
            document.getElementById('fechaProcedimiento').value = pacient.historialMedico.fechaProcedimiento || '';
            document.getElementById('examenesLab').value = pacient.historialMedico.examenesLab || '';
            document.getElementById('fechaExamenes').value = pacient.historialMedico.fechaExamenes || '';
            document.getElementById('ultimoPeriodo').value = pacient.historialMedico.ultimoPeriodo || '';
            document.getElementById('edadPrimeraMenstruacion').value = pacient.historialMedico.edadPrimeraMenstruacion || '';
            document.getElementById('cantidadGestas').value = pacient.historialMedico.cantidadGestas || '';
            document.getElementById('cantidadPartos').value = pacient.historialMedico.cantidadPartos || '';
            document.getElementById('tratamientoPsiquiatrico').checked = pacient.historialMedico.tratamientoPsiquiatrico || false;
            
            // Cargar campos COEX si existen
            if (pacient.historialMedico.coex) {
                const coex = pacient.historialMedico.coex;
                document.getElementById('tipoSustancia').value = coex.tipoSustancia || '';
                document.getElementById('tiempoConsumo').value = coex.tiempoConsumo || '';
                document.getElementById('frecuenciaConsumo').value = coex.frecuenciaConsumo || '';
                document.getElementById('viaAdministracion').value = coex.viaAdministracion || '';
                document.getElementById('intentosRehabilitacion').value = coex.intentosRehabilitacion || 0;
                document.getElementById('ultimoTratamiento').value = coex.ultimoTratamiento || '';
                document.getElementById('motivacionTratamiento').value = coex.motivacionTratamiento || '';
                document.getElementById('comorbilidad').checked = coex.comorbilidad || false;
                document.getElementById('especificacionComorbilidad').value = coex.especificacionComorbilidad || '';
                document.getElementById('antecedentesLegales').checked = coex.antecedentesLegales || false;
                document.getElementById('especificacionLegales').value = coex.especificacionLegales || '';
            }
        }
        
        // Datos familiares
        if (pacient.familia) {
            if (pacient.familia.padre) {
                document.getElementById('padreNombre').value = pacient.familia.padre.nombre || '';
                document.getElementById('padreTelefono').value = pacient.familia.padre.telefono || '';
                document.getElementById('padreOcupacion').value = pacient.familia.padre.ocupacion || '';
            }
            if (pacient.familia.madre) {
                document.getElementById('madreNombre').value = pacient.familia.madre.nombre || '';
                document.getElementById('madreTelefono').value = pacient.familia.madre.telefono || '';
                document.getElementById('madreOcupacion').value = pacient.familia.madre.ocupacion || '';
            }
            if (pacient.familia.pareja) {
                document.getElementById('parejaNombre').value = pacient.familia.pareja.nombre || '';
                document.getElementById('parejaTelefono').value = pacient.familia.pareja.telefono || '';
                document.getElementById('parejaOcupacion').value = pacient.familia.pareja.ocupacion || '';
            }
            if (pacient.familia.hermanos) {
                document.getElementById('hermanosNumero').value = pacient.familia.hermanos.numero || '';
                document.getElementById('hermanosObservaciones').value = pacient.familia.hermanos.observaciones || '';
            }
            if (pacient.familia.hijos) {
                document.getElementById('hijosNumero').value = pacient.familia.hijos.numero || '';
                document.getElementById('hijosObservaciones').value = pacient.familia.hijos.observaciones || '';
            }
        }
        
        // Responsable
        if (pacient.responsable) {
            document.getElementById('responsableNombre').value = pacient.responsable.nombre || '';
            document.getElementById('responsableRelacion').value = pacient.responsable.relacion || '';
            document.getElementById('responsableTelefono').value = pacient.responsable.telefono || '';
            document.getElementById('responsableEmail').value = pacient.responsable.email || '';
        }
        
        document.getElementById('pacientIsCliente').checked = pacient.isCliente;
        document.getElementById('pacientNotas').value = pacient.notas;
        toggleClasificacionPaciente();

        if (pacient.isCliente) {
            document.getElementById('clienteSelectionDiv').style.display = 'block';
            document.getElementById('clienteSelect').value = pacient.clienteId;
            this.updateClienteSelect();
        } else {
            document.getElementById('clienteSelectionDiv').style.display = 'none';
        }

        // Cargar archivos del paciente
        if (pacient.archivos && pacient.archivos.length > 0) {
            PacientesFileManager.renderPacientFiles(id);
        } else {
            const filesContainer = document.getElementById('pacientFilesContainer');
            if (filesContainer) {
                filesContainer.innerHTML = '<p style="text-align: center; color: #999;">No hay archivos cargados</p>';
            }
        }

        // Cargar foto del paciente
        if (pacient.foto) {
            document.getElementById('pacientFoto').value = pacient.foto;
            this.displayPhotoPreview(pacient.foto);
            document.getElementById('pacientFotoRemoveBtn').style.display = 'inline-block';
        } else {
            document.getElementById('pacientFoto').value = '';
            const preview = document.getElementById('pacientFotoPreview');
            preview.innerHTML = '<i class="fas fa-user" style="font-size: 60px; color: #999;"></i>';
            document.getElementById('pacientFotoRemoveBtn').style.display = 'none';
        }

        // Cargar documentos del paciente
        if (!this.documentosTemporales) {
            this.documentosTemporales = {};
        }
        this.documentosTemporales[id] = pacient.documentos || [];
        this.displayDocumentGallery(id);

        this.openPacientModal();
    },

    // Eliminar paciente
    deletePacient(id) {
        if (!confirm('¿Estás seguro de que quieres eliminar este paciente?')) return;

        this.state.pacientes = this.state.pacientes.filter(p => p.id !== id);
        this.showNotification('✅ Paciente eliminado', 'success');
        this.saveToDB();
        this.renderPacientes();
    },

    // Vincular/desvincular cliente
    toggleCheckIsCliente() {
        const isChecked = document.getElementById('pacientIsCliente').checked;
        document.getElementById('clienteSelectionDiv').style.display = isChecked ? 'block' : 'none';
        if (isChecked) {
            this.updateClienteSelect();
        }
    },

    // Actualizar select de clientes
    updateClienteSelect() {
        const select = document.getElementById('clienteSelect');
        if (!select) return;

        select.innerHTML = '<option value="">-- Selecciona un cliente --</option>' +
            this.state.clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    },

    // Validar formulario
    validatePacientForm() {
        const cedula = document.getElementById('pacientCedula').value.trim();
        const nombre = document.getElementById('pacientNombre').value.trim();
        const apellido = document.getElementById('pacientApellido').value.trim();
        const telefono = document.getElementById('pacientTelefono').value.trim();
        const email = document.getElementById('pacientEmail').value.trim();

        if (!cedula || !nombre || !apellido || !telefono || !email) {
            return false;
        }

        // Validar formato email básico
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailRegex.test(email)) {
            return false;
        }

        return true;
    },

    // Renderizar tabla de pacientes
    renderPacientes() {
        const container = document.getElementById('pacientesTableContainer');
        if (!container) return;

        let filtered = [...this.state.pacientes];

        // Filtro por tipo
        if (this.filtroActivo === 'cliente') {
            filtered = filtered.filter(p => p.isCliente);
        } else if (this.filtroActivo === 'no-cliente') {
            filtered = filtered.filter(p => !p.isCliente);
        }

        // Búsqueda
        if (this.searchTerm) {
            filtered = filtered.filter(p =>
                p.nombre.toLowerCase().includes(this.searchTerm) ||
                p.apellido.toLowerCase().includes(this.searchTerm) ||
                p.cedula.includes(this.searchTerm) ||
                p.email.toLowerCase().includes(this.searchTerm)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No hay pacientes registrados</p></div>';
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Cédula</th>
                            <th>Nombre Completo</th>
                            <th>Teléfono</th>
                            <th>Email</th>
                            <th>Tipo de Servicio</th>
                            <th>Tipo</th>
                            <th>Fecha Registro</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(pacient => this.renderPacientRow(pacient)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // Renderizar fila de paciente
    renderPacientRow(pacient) {
        const fullName = `${pacient.nombre} ${pacient.apellidoPaterno} ${pacient.apellidoMaterno || ''}`.trim();
        const tipoTag = pacient.isCliente 
            ? '<span class="badge badge-success">Cliente</span>'
            : '<span class="badge badge-info">No-Cliente</span>';
        const tipoServicioBadge = this.getTipoServicioBadge(pacient.tipoServicio, pacient.clasificacion, pacient.segmentoCOEX);

        return `
            <tr>
                <td><strong>${pacient.dpi || pacient.pasaporte || 'N/A'}</strong></td>
                <td>${fullName}</td>
                <td>${pacient.telefono || 'N/A'}</td>
                <td>${pacient.email || 'N/A'}</td>
                <td>${tipoServicioBadge}</td>
                <td>${tipoTag}</td>
                <td>${pacient.fechaRegistro}</td>
                <td class="actions">
                    <button class="btn-icon btn-edit" title="Editar" onclick="PacientesModule.editPacient('${pacient.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" title="Eliminar" onclick="PacientesModule.deletePacient('${pacient.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-icon btn-view" title="Ver Detalles" onclick="PacientesModule.viewPacientDetails('${pacient.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    },

    // Ver detalles del paciente
    viewPacientDetails(id) {
        const pacient = this.state.pacientes.find(p => p.id === id);
        if (!pacient) return;

        const detailsModal = document.getElementById('pacientDetailsModal');
        const detailsContent = document.getElementById('pacientDetailsContent');

        if (!detailsModal || !detailsContent) return;

        const tipoServicioBadge = this.getTipoServicioBadge(pacient.tipoServicio, pacient.clasificacion, pacient.segmentoCOEX);
        const fullName = `${pacient.nombre} ${pacient.apellidoPaterno} ${pacient.apellidoMaterno || ''}`.trim();

        let html = `
            <div class="details-card">
                <div class="details-header" style="display: flex; gap: 20px; align-items: flex-start;">
                    <div>
                        ${pacient.foto ? `
                            <img src="${pacient.foto}" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid #3498db;">
                        ` : `
                            <div style="width: 120px; height: 120px; background: #e8e8e8; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #ddd;">
                                <i class="fas fa-user" style="font-size: 60px; color: #999;"></i>
                            </div>
                        `}
                    </div>
                    <div>
                        <h3>${fullName}</h3>
                        ${tipoServicioBadge}
                    </div>
                </div>

                <!-- DATOS DE CONSULTA -->
                <div class="detail-section">
                    <h4><i class="fas fa-clipboard"></i> Datos de Consulta</h4>
                    <div class="detail-group">
                        <label>Fecha Primera Consulta</label>
                        <p>${pacient.fechaPrimerConsulta || 'No especificada'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Motivo Consulta</label>
                        <p>${pacient.motivoConsulta || 'No especificado'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Referencia</label>
                        <p>${pacient.referencia || 'No especificada'}</p>
                    </div>
                </div>

                <!-- DATOS PERSONALES -->
                <div class="detail-section">
                    <h4><i class="fas fa-user"></i> Datos Personales</h4>
                    <div class="detail-group">
                        <label>DPI</label>
                        <p>${pacient.dpi || 'No especificado'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Documento de Identificación</label>
                        <p>${pacient.documentoIdentificacion || 'No especificado'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Edad</label>
                        <p>${pacient.edad || 'No especificada'} años</p>
                    </div>
                    <div class="detail-group">
                        <label>Fecha Nacimiento</label>
                        <p>${pacient.fechaNacimiento || 'No especificada'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Nacionalidad</label>
                        <p>${pacient.nacionalidad || 'No especificada'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Género</label>
                        <p>${pacient.genero || 'No especificado'}</p>
                    </div>
                </div>

                <!-- DIRECCIÓN -->
                <div class="detail-section">
                    <h4><i class="fas fa-map-marker-alt"></i> Dirección</h4>
                    <div class="detail-group">
                        <label>Dirección</label>
                        <p>${pacient.direccion || 'No especificada'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Colonia</label>
                        <p>${pacient.colonia || 'No especificada'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Zona</label>
                        <p>${pacient.zona || 'No especificada'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Municipio</label>
                        <p>${pacient.municipio || 'No especificado'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Departamento</label>
                        <p>${pacient.departamento || 'No especificado'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Originario de</label>
                        <p>${pacient.originarioDe || 'No especificado'}</p>
                    </div>
                </div>

                <!-- CONTACTO -->
                <div class="detail-section">
                    <h4><i class="fas fa-phone"></i> Contacto</h4>
                    <div class="detail-group">
                        <label>Teléfono</label>
                        <p>${pacient.telefono || 'No especificado'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Email</label>
                        <p>${pacient.email || 'No especificado'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Vive con</label>
                        <p>${pacient.vivecon || 'No especificado'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Tiene Hijos</label>
                        <p>${pacient.tieneHijos || 'No especificado'}</p>
                    </div>
                </div>

                <!-- INFORMACIÓN LABORAL/EDUCATIVA -->
                <div class="detail-section">
                    <h4><i class="fas fa-briefcase"></i> Información Laboral/Educativa</h4>
                    <div class="detail-group">
                        <label>Estado Civil</label>
                        <p>${pacient.estadoCivil || 'No especificado'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Profesión</label>
                        <p>${pacient.profesion || 'No especificada'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Grado Académico</label>
                        <p>${pacient.gradoAcademico || 'No especificado'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Ocupación</label>
                        <p>${pacient.ocupacion || 'No especificada'}</p>
                    </div>
                </div>

                <!-- LUGAR DE TRABAJO -->
                ${pacient.empresa && (pacient.empresa.nombre || pacient.empresa.telefono || pacient.empresa.direccion) ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-building"></i> Lugar de Trabajo</h4>
                        <div class="detail-group">
                            <label>Empresa</label>
                            <p>${pacient.empresa.nombre || 'No especificada'}</p>
                        </div>
                        <div class="detail-group">
                            <label>Teléfono</label>
                            <p>${pacient.empresa.telefono || 'No especificado'}</p>
                        </div>
                        <div class="detail-group">
                            <label>Dirección</label>
                            <p>${pacient.empresa.direccion || 'No especificada'}</p>
                        </div>
                    </div>
                ` : ''}

                <!-- CONTACTO DE EMERGENCIA -->
                ${pacient.emergencia && (pacient.emergencia.nombre || pacient.emergencia.telefono) ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-exclamation-circle"></i> Contacto de Emergencia</h4>
                        <div class="detail-group">
                            <label>Nombre</label>
                            <p>${pacient.emergencia.nombre || 'No especificado'}</p>
                        </div>
                        <div class="detail-group">
                            <label>Teléfono</label>
                            <p>${pacient.emergencia.telefono || 'No especificado'}</p>
                        </div>
                        <div class="detail-group">
                            <label>Parentesco</label>
                            <p>${pacient.emergencia.parentesco || 'No especificado'}</p>
                        </div>
                    </div>
                ` : ''}

                <!-- HISTORIAL MÉDICO -->
                ${pacient.historialMedico ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-stethoscope"></i> Historial Médico</h4>
                        <div class="detail-group">
                            <label>Padece enfermedad crónica</label>
                            <p>${pacient.historialMedico.padeceCronica ? 'Sí' : 'No'} ${pacient.historialMedico.especificacionCronica ? ' - ' + pacient.historialMedico.especificacionCronica : ''}</p>
                        </div>
                        <div class="detail-group">
                            <label>Toma medicamentos</label>
                            <p>${pacient.historialMedico.tomaMedicamento ? 'Sí' : 'No'} ${pacient.historialMedico.especificacionMedicamento ? ' - ' + pacient.historialMedico.especificacionMedicamento : ''}</p>
                        </div>
                        <div class="detail-group">
                            <label>Padece alergia</label>
                            <p>${pacient.historialMedico.padaceAlergia ? 'Sí' : 'No'} ${pacient.historialMedico.especificacionAlergia ? ' - ' + pacient.historialMedico.especificacionAlergia : ''}</p>
                        </div>
                        <div class="detail-group">
                            <label>Utiliza prótesis</label>
                            <p>${pacient.historialMedico.utilizaProtesis ? 'Sí' : 'No'} ${pacient.historialMedico.especificacionProtesis ? ' - ' + pacient.historialMedico.especificacionProtesis : ''}</p>
                        </div>
                        <div class="detail-group">
                            <label>Ha convulsionado</label>
                            <p>${pacient.historialMedico.haConvulsionado ? 'Sí' : 'No'} ${pacient.historialMedico.especificacionConvulsion ? ' - ' + pacient.historialMedico.especificacionConvulsion : ''}</p>
                        </div>
                        <div class="detail-group">
                            <label>Último procedimiento</label>
                            <p>${pacient.historialMedico.ultimoProcedimiento || 'No especificado'}</p>
                        </div>
                        <div class="detail-group">
                            <label>Fecha procedimiento</label>
                            <p>${pacient.historialMedico.fechaProcedimiento || 'No especificada'}</p>
                        </div>
                        <div class="detail-group">
                            <label>Exámenes de laboratorio</label>
                            <p>${pacient.historialMedico.examenesLab || 'No especificados'}</p>
                        </div>
                        <div class="detail-group">
                            <label>Fecha exámenes</label>
                            <p>${pacient.historialMedico.fechaExamenes || 'No especificada'}</p>
                        </div>
                        ${pacient.genero === 'femenino' ? `
                            <div class="detail-group">
                                <label>Último período menstrual</label>
                                <p>${pacient.historialMedico.ultimoPeriodo || 'No especificado'}</p>
                            </div>
                            <div class="detail-group">
                                <label>Edad primera menstruación</label>
                                <p>${pacient.historialMedico.edadPrimeraMenstruacion || 'No especificada'}</p>
                            </div>
                            <div class="detail-group">
                                <label>Cantidad de gestas</label>
                                <p>${pacient.historialMedico.cantidadGestas || 'No especificada'}</p>
                            </div>
                            <div class="detail-group">
                                <label>Cantidad de partos</label>
                                <p>${pacient.historialMedico.cantidadPartos || 'No especificada'}</p>
                            </div>
                        ` : ''}
                        <div class="detail-group">
                            <label>Tratamiento psiquiátrico</label>
                            <p>${pacient.historialMedico.tratamientoPsiquiatrico ? 'Sí' : 'No'}</p>
                        </div>
                    </div>
                ` : ''}

                <!-- DATOS FAMILIARES -->
                ${pacient.familia ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-users"></i> Datos Familiares</h4>
                        ${pacient.familia.padre && (pacient.familia.padre.nombre || pacient.familia.padre.telefono) ? `
                            <div class="detail-family-item">
                                <label>Padre</label>
                                <p>${pacient.familia.padre.nombre || 'No especificado'}</p>
                                <p class="text-muted">${pacient.familia.padre.telefono ? 'Tel: ' + pacient.familia.padre.telefono : ''} ${pacient.familia.padre.ocupacion ? ' - ' + pacient.familia.padre.ocupacion : ''}</p>
                            </div>
                        ` : ''}
                        ${pacient.familia.madre && (pacient.familia.madre.nombre || pacient.familia.madre.telefono) ? `
                            <div class="detail-family-item">
                                <label>Madre</label>
                                <p>${pacient.familia.madre.nombre || 'No especificado'}</p>
                                <p class="text-muted">${pacient.familia.madre.telefono ? 'Tel: ' + pacient.familia.madre.telefono : ''} ${pacient.familia.madre.ocupacion ? ' - ' + pacient.familia.madre.ocupacion : ''}</p>
                            </div>
                        ` : ''}
                        ${pacient.familia.pareja && (pacient.familia.pareja.nombre || pacient.familia.pareja.telefono) ? `
                            <div class="detail-family-item">
                                <label>Pareja</label>
                                <p>${pacient.familia.pareja.nombre || 'No especificado'}</p>
                                <p class="text-muted">${pacient.familia.pareja.telefono ? 'Tel: ' + pacient.familia.pareja.telefono : ''} ${pacient.familia.pareja.ocupacion ? ' - ' + pacient.familia.pareja.ocupacion : ''}</p>
                            </div>
                        ` : ''}
                        ${pacient.familia.hermanos && (pacient.familia.hermanos.numero || pacient.familia.hermanos.observaciones) ? `
                            <div class="detail-family-item">
                                <label>Hermanos</label>
                                <p>${pacient.familia.hermanos.numero || 'No especificado'} hermanos</p>
                                <p class="text-muted">${pacient.familia.hermanos.observaciones || ''}</p>
                            </div>
                        ` : ''}
                        ${pacient.familia.hijos && (pacient.familia.hijos.numero || pacient.familia.hijos.observaciones) ? `
                            <div class="detail-family-item">
                                <label>Hijos</label>
                                <p>${pacient.familia.hijos.numero || 'No especificado'} hijos</p>
                                <p class="text-muted">${pacient.familia.hijos.observaciones || ''}</p>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <!-- RESPONSABLE -->
                ${pacient.responsable && (pacient.responsable.nombre || pacient.responsable.telefono || pacient.responsable.email) ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-user-shield"></i> Responsable (Información Adicional)</h4>
                        <div class="detail-group">
                            <label>Nombre</label>
                            <p>${pacient.responsable.nombre || 'No especificado'}</p>
                        </div>
                        <div class="detail-group">
                            <label>Relación</label>
                            <p>${pacient.responsable.relacion || 'No especificada'}</p>
                        </div>
                        <div class="detail-group">
                            <label>Teléfono</label>
                            <p>${pacient.responsable.telefono || 'No especificado'}</p>
                        </div>
                        <div class="detail-group">
                            <label>Email</label>
                            <p>${pacient.responsable.email || 'No especificado'}</p>
                        </div>
                    </div>
                ` : ''}

                <!-- FOTOGRAFÍAS Y DOCUMENTOS -->
                ${pacient.documentos && pacient.documentos.length > 0 ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-images"></i> Fotografías y Documentos</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 15px; margin-top: 15px;">
                            ${pacient.documentos.map((doc, idx) => {
                                const categoryLabels = {
                                    'DPI_Paciente': '📄 DPI Paciente',
                                    'DocumentoId_Paciente': '📄 Documento de Identificación',
                                    'DPI_Responsable': '📄 DPI Responsable',
                                    'DocumentoId_Responsable': '📄 Documento de Identificación Resp.',
                                    'Foto_Perfil_Responsable': '📸 Foto Responsable',
                                    'Documentos_Medicos': '🏥 Médicos',
                                    'Otros': '📎 Otros'
                                };
                                return `
                                    <div style="background: white; border: 1px solid #ddd; border-radius: 5px; overflow: hidden;">
                                        <img src="${doc.base64}" style="width: 100%; height: 100px; object-fit: cover;">
                                        <div style="padding: 8px; background: #f9f9f9; font-size: 11px; text-align: center;">
                                            <p style="margin: 2px 0; font-weight: bold; color: #333;">${categoryLabels[doc.category] || doc.category}</p>
                                            <p style="margin: 2px 0; color: #666;">${doc.timestamp}</p>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="details-footer">
                    <p class="text-muted">Tipo de Servicio: ${pacient.tipoServicio || 'No especificado'}</p>
                    <p class="text-muted">Registrado el: ${pacient.fechaRegistro}</p>
                    ${pacient.notas ? `<p><strong>Notas:</strong> ${pacient.notas}</p>` : ''}
                </div>
            </div>
        `;

        detailsContent.innerHTML = html;
        detailsModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    // Cerrar modal de detalles
    closeDetailsModal() {
        const modal = document.getElementById('pacientDetailsModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
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
        const count = this.state.pacientes.length + 1;
        return `${prefix}-${String(count).padStart(4, '0')}`;
    },

    // Guardar en DB (localStorage)
    saveToDB() {
        localStorage.setItem('pacientes', JSON.stringify(this.state.pacientes));
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

    // Obtener badge de tipo de servicio
    getTipoServicioBadge(tipoServicio, clasificacion, segmentoCOEX) {
        let badgeClass = 'badge';
        let badgeText = '';

        switch(tipoServicio) {
            case 'agudo':
                badgeClass += ' badge-warning';
                if (clasificacion === 'adicto') {
                    badgeText = '🚨 Agudo - Adicto';
                } else if (clasificacion === 'psiquiatrico') {
                    badgeText = '🚨 Agudo - Psiquiátrico';
                } else {
                    badgeText = '🚨 Agudo';
                }
                break;
            case 'cronico':
                badgeClass += ' badge-info';
                if (clasificacion === 'adicto') {
                    badgeText = '📋 Crónico - Adicto';
                } else if (clasificacion === 'psiquiatrico') {
                    badgeText = '📋 Crónico - Psiquiátrico';
                } else {
                    badgeText = '📋 Crónico';
                }
                break;
            case 'coex':
                badgeClass += ' badge-danger';
                if (segmentoCOEX === 'psiquiatrico') {
                    badgeText = '🧠 COEX - Psiquiátrico';
                } else if (segmentoCOEX === 'psicologico') {
                    badgeText = '💭 COEX - Psicológico';
                } else {
                    badgeText = '⚠️ COEX - Sin segmento';
                }
                break;
            default:
                badgeClass += ' badge-secondary';
                badgeText = 'No definido';
        }

        return `<span class="${badgeClass}">${badgeText}</span>`;
    }
};
