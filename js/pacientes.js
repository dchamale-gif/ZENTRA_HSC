// ============================================
// MÓDULO DE PACIENTES
// ============================================
// Un paciente puede ser cliente o no (independiente)
// Un cliente puede estar vinculado a uno o múltiples pacientes

const PacientesModule = {
    state: {
        pacientes: [],
        clientes: [],
        filtroTipo: 'todos',        // todos, cliente, no-cliente
        filtroOrden: 'default',     // default, alfabetico-asc, alfabetico-desc
        filtroPago: 'todos',        // todos, deudor, pagado
        filtroTipoServicio: '',     // todos, agudo, cronico, coex
        filtroFecha: '',            // hoy, semana, mes, trimestre, ano
        searchTerm: '',
        stats: {
            total: 0,
            clientes: 0,
            noClientes: 0,
            deudores: 0,
            pagados: 0
        }
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

        const filterTipo = document.getElementById('filterPacient');
        if (filterTipo) {
            filterTipo.addEventListener('change', (e) => {
                this.state.filtroTipo = e.target.value;
                this.renderPacientes();
            });
        }

        const filterOrden = document.getElementById('filterOrden');
        if (filterOrden) {
            filterOrden.addEventListener('change', (e) => {
                this.state.filtroOrden = e.target.value;
                this.renderPacientes();
            });
        }

        const filtroPago = document.getElementById('filterPago');
        if (filtroPago) {
            filtroPago.addEventListener('change', (e) => {
                this.state.filtroPago = e.target.value;
                this.renderPacientes();
            });
        }

        const filtroTipoServicio = document.getElementById('filterTipoServicio');
        if (filtroTipoServicio) {
            filtroTipoServicio.addEventListener('change', (e) => {
                this.state.filtroTipoServicio = e.target.value;
                this.renderPacientes();
            });
        }

        const filtroFecha = document.getElementById('filterFecha');
        if (filtroFecha) {
            filtroFecha.addEventListener('change', (e) => {
                this.state.filtroFecha = e.target.value;
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

        // Event delegation para botones de acción (editar, eliminar, ver)
        const self = this;
        document.addEventListener('click', function(e) {
            // Primero encuentra el botón más cercano
            const button = e.target.closest('button.btn-icon');
            if (!button) return;

            // Luego encuentra la fila más cercana
            const row = button.closest('tr[data-pacient-id]');
            if (!row) return;

            const pacientId = row.getAttribute('data-pacient-id');
            if (!pacientId) {
                console.warn('No pacient ID found');
                return;
            }

            // Log para debug
            console.log('Button clicked, pacientId:', pacientId, 'classes:', button.className);

            // Verificar qué tipo de botón se clickeó
            if (button.classList.contains('btn-edit')) {
                console.log('Edit button clicked for pacient:', pacientId);
                self.editPacient(pacientId);
            } else if (button.classList.contains('btn-delete')) {
                console.log('Delete button clicked for pacient:', pacientId);
                self.deletePacient(pacientId);
            } else if (button.classList.contains('btn-view')) {
                console.log('View button clicked for pacient:', pacientId);
                self.viewPacientDetails(pacientId);
            }
        });
    },

    // Cargar datos desde API
    async loadData() {
        try {
            // Verificar si authManager está disponible
            if (typeof authManager === 'undefined') {
                throw new Error('authManager no disponible');
            }

            const token = authManager.getToken();
            if (!token) {
                console.error('❌ ERROR: No hay token de autenticación');
                this.showNotification('❌ Error: No hay token de autenticación. Por favor inicia sesión.', 'error');
                this.state.pacientes = [];
                this.renderPacientes();
                return;
            }

            const response = await fetch(`${authManager.apiBaseUrl}/api/pacientes`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            // Normalizar datos del backend (snake_case → camelCase)
            this.state.pacientes = DataNormalizer.normalizePacientes(data.pacientes || []);
            this.renderPacientes();
            
            console.log(`✅ ${this.state.pacientes.length} pacientes cargados desde BD`);
        } catch (error) {
            console.error('❌ Error cargando pacientes desde API:', error.message);
            this.showNotification(`❌ Error: No se puede acceder a la base de datos de pacientes. ${error.message}`, 'error');
            this.state.pacientes = [];
            this.renderPacientes();
        }
    },

    // Cargar datos demo locales
    loadDemoData() {
        console.error('❌ ERROR: No hay datos de pacientes disponibles en localStorage');
        this.showNotification('❌ Error: No se puede acceder a la base de datos de pacientes', 'error');
        this.state.pacientes = [];
        this.renderPacientes();
    },

    // Abrir modal de nuevo paciente
    openPacientModal(isNew = true) {
        const modal = document.getElementById('pacientModal');
        const form = document.getElementById('editPacientForm');
        if (!modal || !form) return;

        // Solo limpiar si es un paciente NUEVO
        if (isNew) {
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
    async savePacient() {
        const form = document.getElementById('editPacientForm');
        if (!form) {
            console.error('❌ Formulario no encontrado');
            return;
        }

        // Validar en cliente
        if (!this.validatePacientForm()) {
            this.showNotification('⚠️ Por favor completa todos los campos requeridos (Nombre, Apellido, Teléfono, Dirección)', 'warning');
            console.warn('❌ Validación de formulario fallida');
            return;
        }

        const id = document.getElementById('pacientId').value.trim();
        
        try {
            console.log('📝 Guardando paciente...');
            
            // Construir objeto con datos del formulario (SOLO campos que existen en HTML)
            const pacientData = {
                nombre: document.getElementById('pacientNombre').value.trim(),
                apellidoPaterno: document.getElementById('pacientApellidoPaterno').value.trim(),
                apellidoMaterno: document.getElementById('pacientApellidoMaterno').value.trim() || null,
                edad: document.getElementById('pacientEdad').value ? parseInt(document.getElementById('pacientEdad').value) : null,
                genero: document.getElementById('pacientGenero').value || null,
                fechaNacimiento: document.getElementById('pacientFechaNacimiento').value || null,
                telefono: document.getElementById('pacientTelefono').value.trim() || null,
                email: document.getElementById('pacientEmail').value.trim() || null,
                direccion: document.getElementById('pacientDireccion').value.trim() || null,
                tipoServicio: document.getElementById('pacientTipoServicio').value || null,
                clasificacion: document.getElementById('pacientClasificacion').value || null,
                segmentoCOEX: document.getElementById('pacientCOEXSegmento').value || null,
                foto: document.getElementById('pacientFoto').value || null,
                isCliente: document.getElementById('pacientIsCliente').checked || false,
                notas: document.getElementById('pacientNotas').value.trim() || null
            };

            console.log('📦 Datos a guardar (camelCase):', JSON.stringify(pacientData, null, 2));

            // Convertir a snake_case para el backend
            const apiData = DataNormalizer.denormalizePaciente(pacientData);
            console.log('📦 Datos a guardar (snake_case):', JSON.stringify(apiData, null, 2));

            // Obtener token
            const token = authManager.getToken();
            if (!token) {
                this.showNotification('❌ No estás autenticado', 'error');
                console.error('❌ Sin token de autenticación');
                return;
            }

            // Determinar URL y método
            const url = id 
                ? `${authManager.apiBaseUrl}/api/pacientes/${id}`
                : `${authManager.apiBaseUrl}/api/pacientes`;

            const method = id ? 'PUT' : 'POST';
            
            console.log(`🔗 ${method} ${url}`);

            // Hacer la petición
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(apiData)
            });

            console.log(`📊 Response status: ${response.status}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ Respuesta del servidor:', JSON.stringify(result, null, 2));
            
            // Actualizar estado local
            if (id) {
                // Actualizar paciente existente
                const index = this.state.pacientes.findIndex(p => String(p.id) === String(id));
                if (index !== -1) {
                    this.state.pacientes[index] = { ...this.state.pacientes[index], ...result };
                    console.log('✅ Paciente actualizado en estado local');
                }
                this.showNotification('✅ Paciente actualizado correctamente', 'success');
            } else {
                // Crear nuevo paciente
                this.state.pacientes.push(result);
                console.log('✅ Paciente creado en estado local');
                this.showNotification('✅ Paciente creado correctamente', 'success');
            }

            // Guardar en localStorage
            localStorage.setItem('pacientes', JSON.stringify(this.state.pacientes));
            console.log('💾 Datos guardados en localStorage');

            // Cerrar modal y recargar datos
            this.closePacientModal();
            await this.loadData(); // Recargar desde BD
            
            console.log('🎉 Proceso completado exitosamente');
        } catch (error) {
            console.error('❌ Error guardando paciente:', error);
            this.showNotification(`❌ Error: ${error.message}`, 'error');
        }
    },

    // Toggle campo de nombre cuando refiere otro paciente
    toggleNombrePacienteRefiere() {
        const referencia = document.getElementById('referencia');
        const pacienteRefiereName = document.getElementById('pacienteRefiereName');
        if (referencia && pacienteRefiereName) {
            if (referencia.value === 'otro-paciente') {
                pacienteRefiereName.style.display = 'block';
                document.getElementById('pacienteRefierenombre').focus();
            } else {
                pacienteRefiereName.style.display = 'none';
            }
        }
    },

    // Editar paciente
    editPacient(id) {
        console.log('editPacient called with id:', id);
        
        // Convertir id a string
        const pacientId = String(id);
        const pacient = this.state.pacientes.find(p => String(p.id) === pacientId);
        
        if (!pacient) {
            console.error('❌ Paciente no encontrado con id:', id);
            this.showNotification('❌ Error: Paciente no encontrado', 'error');
            return;
        }
        
        console.log('✅ Paciente encontrado:', pacient.nombre);
        console.log('Datos del paciente:', JSON.stringify(pacient, null, 2));

        // Helper function para llenar campos de forma segura
        const fillField = (id, value) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = value || '';
                console.log(`✓ Campo llenado [${id}]:`, value);
            } else {
                console.warn(`Campo no encontrado: ${id}`);
            }
        };

        try {
            // Llenar ID oculto
            document.getElementById('pacientId').value = pacient.id;
            
            // Datos personales básicos
            fillField('pacientNombre', pacient.nombre);
            fillField('pacientApellidoPaterno', pacient.apellidoPaterno);
            fillField('pacientApellidoMaterno', pacient.apellidoMaterno);
            fillField('pacientEdad', pacient.edad);
            fillField('pacientFechaNacimiento', pacient.fechaNacimiento);
            
            // Género
            const generoSelect = document.getElementById('pacientGenero');
            if (generoSelect) {
                generoSelect.value = pacient.genero || '';
                console.log('✓ Género establecido:', pacient.genero);
            }
            
            // Dirección
            fillField('pacientDireccion', pacient.direccion);
            
            // Contacto
            fillField('pacientTelefono', pacient.telefono);
            fillField('pacientEmail', pacient.email);
            
            // Tipo de servicio
            const tipoServicioSelect = document.getElementById('pacientTipoServicio');
            if (tipoServicioSelect) {
                tipoServicioSelect.value = pacient.tipoServicio || '';
                console.log('✓ Tipo de servicio establecido:', pacient.tipoServicio);
            }
            
            // Clasificación
            const clasificacionSelect = document.getElementById('pacientClasificacion');
            if (clasificacionSelect) {
                clasificacionSelect.value = pacient.clasificacion || '';
                console.log('✓ Clasificación establecida:', pacient.clasificacion);
            }
            
            // COEX Segmento
            const coexSelect = document.getElementById('pacientCOEXSegmento');
            if (coexSelect) {
                coexSelect.value = pacient.segmentoCOEX || '';
                console.log('✓ COEX Segmento establecido:', pacient.segmentoCOEX);
            }
            
            // Foto del paciente
            if (pacient.foto) {
                document.getElementById('pacientFoto').value = pacient.foto;
                this.displayPhotoPreview(pacient.foto);
                const removeBtn = document.getElementById('pacientFotoRemoveBtn');
                if (removeBtn) removeBtn.style.display = 'inline-block';
                console.log('✓ Foto establecida');
            } else {
                document.getElementById('pacientFoto').value = '';
                const preview = document.getElementById('pacientFotoPreview');
                if (preview) preview.innerHTML = '<i class="fas fa-user" style="font-size: 60px; color: #999;"></i>';
                const removeBtn = document.getElementById('pacientFotoRemoveBtn');
                if (removeBtn) removeBtn.style.display = 'none';
            }
            
            // Cliente
            const clienteCheckbox = document.getElementById('pacientIsCliente');
            if (clienteCheckbox) {
                clienteCheckbox.checked = pacient.isCliente || false;
                console.log('✓ Cliente checkbox:', clienteCheckbox.checked);
            }
            
            // Notas
            fillField('pacientNotas', pacient.notas);
            
            console.log('✅ TODOS LOS CAMPOS LLENADOS CORRECTAMENTE');
        } catch(error) {
            console.error('❌ Error al llenar formulario:', error);
            this.showNotification('❌ Error al cargar datos del paciente', 'error');
        }
        
        console.log('✅ Formulario llenado, abriendo modal...');
        this.openPacientModal(false); // false = es edición, no es nuevo
    },

    // Eliminar paciente
    deletePacient(id) {
        if (!confirm('¿Estás seguro de que quieres eliminar este paciente? Esta acción no se puede deshacer.')) return;

        try {
            const token = authManager.getToken();
            if (!token) {
                this.showNotification('❌ Error: No hay token de autenticación', 'error');
                return;
            }

            // Mostrar loading
            const btn = event?.target?.closest('.btn-delete');
            if (btn) btn.disabled = true;

            fetch(`${authManager.apiBaseUrl}/api/pacientes/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }).then(response => {
                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }
                return response.json();
            }).then(() => {
                // Eliminar del estado local - Comparar IDs como strings
                const pacientId = String(id);
                this.state.pacientes = this.state.pacientes.filter(p => String(p.id) !== pacientId);
                this.showNotification('✅ Paciente eliminado exitosamente', 'success');
                this.renderPacientes();
                console.log(`✅ Paciente ${id} eliminado de la BD`);
            }).catch(error => {
                console.error('❌ Error eliminando paciente:', error);
                this.showNotification(`❌ Error: No se pudo eliminar el paciente. ${error.message}`, 'error');
            }).finally(() => {
                if (btn) btn.disabled = false;
            });
        } catch (error) {
            console.error('❌ Error:', error);
            this.showNotification(`❌ Error: ${error.message}`, 'error');
        }
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
        const nombre = document.getElementById('pacientNombre').value.trim();
        const apellidoPaterno = document.getElementById('pacientApellidoPaterno').value.trim();
        const telefono = document.getElementById('pacientTelefono').value.trim();
        const email = document.getElementById('pacientEmail').value.trim();
        const direccion = document.getElementById('pacientDireccion').value.trim();

        // Campos requeridos (email es OPCIONAL)
        if (!nombre || !apellidoPaterno || !telefono || !direccion) {
            console.warn('⚠️ Campos requeridos faltando:', {
                nombre: !nombre,
                apellidoPaterno: !apellidoPaterno,
                telefono: !telefono,
                direccion: !direccion
            });
            return false;
        }

        // Validar formato email si se proporciona
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailRegex.test(email)) {
            console.warn('⚠️ Formato de email inválido:', email);
            return false;
        }

        return true;
    },

    // Renderizar tabla de pacientes
    renderPacientes() {
        const container = document.getElementById('pacientesTableContainer');
        if (!container) return;

        let filtered = [...this.state.pacientes];

        // Calcular estadísticas
        this.calculateStats();
        this.renderStats();

        // FILTRO POR TIPO (Cliente / No-Cliente)
        if (this.state.filtroTipo === 'cliente') {
            filtered = filtered.filter(p => p.isCliente);
        } else if (this.state.filtroTipo === 'no-cliente') {
            filtered = filtered.filter(p => !p.isCliente);
        }

        // FILTRO POR ESTADO DE PAGO (Deudor / Pagado)
        if (this.state.filtroPago === 'deudor') {
            // Filtrar por pacientes con saldo pendiente
            filtered = filtered.filter(p => {
                const saldo = SaldoPacienteModule?.state?.saldosPacientes?.find(s => s.pacienteId == p.id);
                return saldo && saldo.saldoPendiente > 0;
            });
        } else if (this.state.filtroPago === 'pagado') {
            // Filtrar por pacientes sin saldo pendiente
            filtered = filtered.filter(p => {
                const saldo = SaldoPacienteModule?.state?.saldosPacientes?.find(s => s.pacienteId == p.id);
                return !saldo || saldo.saldoPendiente === 0;
            });
        }

        // FILTRO POR TIPO DE SERVICIO
        if (this.state.filtroTipoServicio) {
            filtered = filtered.filter(p => p.tipoServicio === this.state.filtroTipoServicio);
        }

        // FILTRO POR FECHA
        if (this.state.filtroFecha) {
            const ahora = new Date();
            filtered = filtered.filter(p => {
                const fechaRegistro = new Date(p.createdAt || p.fechaRegistro);
                if (!fechaRegistro || isNaN(fechaRegistro)) return true; // Si no hay fecha, incluir
                
                const difDias = Math.floor((ahora - fechaRegistro) / (1000 * 60 * 60 * 24));
                
                switch(this.state.filtroFecha) {
                    case 'hoy':
                        return difDias === 0;
                    case 'semana':
                        return difDias <= 7;
                    case 'mes':
                        return difDias <= 30;
                    case 'trimestre':
                        return difDias <= 90;
                    case 'ano':
                        return difDias <= 365;
                    default:
                        return true;
                }
            });
        }

        // BÚSQUEDA - usar campos normalizados (camelCase)
        if (this.searchTerm) {
            filtered = filtered.filter(p =>
                (p.nombre && p.nombre.toLowerCase().includes(this.searchTerm)) ||
                (p.apellidoPaterno && p.apellidoPaterno.toLowerCase().includes(this.searchTerm)) ||
                (p.apellidoMaterno && p.apellidoMaterno.toLowerCase().includes(this.searchTerm)) ||
                (p.dpi && p.dpi.includes(this.searchTerm)) ||
                (p.email && p.email.toLowerCase().includes(this.searchTerm)) ||
                (p.telefono && p.telefono.includes(this.searchTerm))
            );
        }

        // ORDENAMIENTO
        if (this.state.filtroOrden === 'alfabetico-asc') {
            filtered.sort((a, b) => {
                const nameA = `${a.nombre} ${a.apellidoPaterno}`.toLowerCase().trim();
                const nameB = `${b.nombre} ${b.apellidoPaterno}`.toLowerCase().trim();
                return nameA.localeCompare(nameB, 'es');
            });
        } else if (this.state.filtroOrden === 'alfabetico-desc') {
            filtered.sort((a, b) => {
                const nameA = `${a.nombre} ${a.apellidoPaterno}`.toLowerCase().trim();
                const nameB = `${b.nombre} ${b.apellidoPaterno}`.toLowerCase().trim();
                return nameB.localeCompare(nameA, 'es');
            });
        } else {
            // Ordenamiento por defecto: apellido + nombre
            filtered.sort((a, b) => {
                const nameA = `${a.apellidoPaterno} ${a.nombre}`.toLowerCase().trim();
                const nameB = `${b.apellidoPaterno} ${b.nombre}`.toLowerCase().trim();
                return nameA.localeCompare(nameB, 'es');
            });
        }

        if (filtered.length === 0) {
            let mensaje = 'No hay pacientes registrados';
            let icon = '👥';
            
            if (this.searchTerm) {
                mensaje = `No se encontraron pacientes que coincidan con "${this.searchTerm}"`;
                icon = '🔍';
            } else if (this.state.filtroTipo === 'cliente') {
                mensaje = 'No hay clientes registrados';
                icon = '👤';
            } else if (this.state.filtroTipo === 'no-cliente') {
                mensaje = 'No hay pacientes sin vincular a cliente';
                icon = '❌';
            } else if (this.state.filtroPago === 'deudor') {
                mensaje = 'No hay pacientes con saldo pendiente';
                icon = '✓';
            } else if (this.state.filtroPago === 'pagado') {
                mensaje = 'No hay pacientes pagados';
                icon = '💰';
            }
            
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 40px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="font-size: 48px; margin-bottom: 15px;">${icon}</div>
                    <p style="font-size: 18px; color: #333; margin: 10px 0; font-weight: 600;">${mensaje}</p>
                    <small style="color: #999;">Intenta ajustar los filtros o crear un nuevo paciente</small>
                </div>
            `;
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
            <div style="padding: 15px; background: #f5f5f5; border-top: 1px solid #ddd; border-radius: 0 0 8px 8px; font-size: 14px; color: #666;">
                <strong>Total:</strong> ${filtered.length} de ${this.state.pacientes.length} pacientes
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
            <tr data-pacient-id="${pacient.id}">
                <td><strong>${pacient.dpi || pacient.pasaporte || 'N/A'}</strong></td>
                <td>${fullName}</td>
                <td>${pacient.telefono || 'N/A'}</td>
                <td>${pacient.email || 'N/A'}</td>
                <td>${tipoServicioBadge}</td>
                <td>${tipoTag}</td>
                <td>${pacient.fechaRegistro}</td>
                <td class="actions">
                    <button class="btn-icon btn-edit" title="Editar" type="button">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" title="Eliminar" type="button">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-icon btn-view" title="Ver Detalles" type="button">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    },

    // Calcular estadísticas de pacientes
    calculateStats() {
        const stats = {
            total: this.state.pacientes.length,
            clientes: this.state.pacientes.filter(p => p.isCliente).length,
            noClientes: this.state.pacientes.filter(p => !p.isCliente).length,
            deudores: 0,
            pagados: 0
        };

        if (typeof SaldoPacienteModule !== 'undefined' && SaldoPacienteModule?.state?.saldosPacientes) {
            stats.deudores = this.state.pacientes.filter(p => {
                const saldo = SaldoPacienteModule.state.saldosPacientes.find(s => s.pacienteId == p.id);
                return saldo && saldo.saldoPendiente > 0;
            }).length;
            
            stats.pagados = this.state.pacientes.filter(p => {
                const saldo = SaldoPacienteModule.state.saldosPacientes.find(s => s.pacienteId == p.id);
                return !saldo || saldo.saldoPendiente === 0;
            }).length;
        }

        this.state.stats = stats;
    },

    // Renderizar estadísticas
    renderStats() {
        const container = document.getElementById('pacientesStats');
        if (!container) return;

        const stats = this.state.stats;
        
        container.innerHTML = `
            <div class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="font-size: 12px; font-weight: 600; opacity: 0.9; margin-bottom: 8px;">
                    <i class="fas fa-users"></i> TOTAL DE PACIENTES
                </div>
                <div style="font-size: 32px; font-weight: 700; margin: 0;">${stats.total}</div>
                <small style="opacity: 0.8;">Registrados en el sistema</small>
            </div>

            <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="font-size: 12px; font-weight: 600; opacity: 0.9; margin-bottom: 8px;">
                    <i class="fas fa-check-circle"></i> CLIENTES
                </div>
                <div style="font-size: 32px; font-weight: 700; margin: 0;">${stats.clientes}</div>
                <small style="opacity: 0.8;">${stats.clientes > 0 ? ((stats.clientes / stats.total * 100).toFixed(1) + '%') : '0%'}</small>
            </div>

            <div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="font-size: 12px; font-weight: 600; opacity: 0.9; margin-bottom: 8px;">
                    <i class="fas fa-credit-card"></i> CON SALDO PENDIENTE
                </div>
                <div style="font-size: 32px; font-weight: 700; margin: 0;">${stats.deudores}</div>
                <small style="opacity: 0.8;">${stats.deudores > 0 ? ((stats.deudores / stats.total * 100).toFixed(1) + '%') : '0%'}</small>
            </div>

            <div class="stat-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="font-size: 12px; font-weight: 600; opacity: 0.9; margin-bottom: 8px;">
                    <i class="fas fa-check"></i> PAGADOS
                </div>
                <div style="font-size: 32px; font-weight: 700; margin: 0;">${stats.pagados}</div>
                <small style="opacity: 0.8;">${stats.pagados > 0 ? ((stats.pagados / stats.total * 100).toFixed(1) + '%') : '0%'}</small>
            </div>
        `;
    },

    // Ver detalles del paciente
    viewPacientDetails(id) {
        console.log('viewPacientDetails called with id:', id);
        
        // Convertir id a string
        const pacientId = String(id);
        const pacient = this.state.pacientes.find(p => String(p.id) === pacientId);
        
        if (!pacient) {
            console.error('❌ Paciente no encontrado con id:', id);
            this.showNotification('❌ Error: Paciente no encontrado', 'error');
            return;
        }

        const detailsModal = document.getElementById('pacientDetailsModal');
        const detailsContent = document.getElementById('pacientDetailsContent');

        if (!detailsModal || !detailsContent) {
            console.error('❌ Modal elements not found');
            return;
        }

        console.log('✅ Abriendo detalles para paciente:', pacient.nombre);

        const fullName = `${pacient.nombre} ${pacient.apellidoPaterno} ${pacient.apellidoMaterno || ''}`.trim();

        let html = `
            <div class="details-card" style="max-height: 80vh; overflow-y: auto;">
                <div class="details-header" style="display: flex; gap: 20px; align-items: flex-start; margin-bottom: 20px;">
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
                        <h3 style="margin: 0 0 10px 0;">${fullName}</h3>
                        <p style="margin: 5px 0; color: #666;"><strong>DPI/Pasaporte:</strong> ${pacient.dpi || pacient.pasaporte || 'N/A'}</p>
                        <p style="margin: 5px 0; color: #666;"><strong>Teléfono:</strong> ${pacient.telefono || 'N/A'}</p>
                        <p style="margin: 5px 0; color: #666;"><strong>Email:</strong> ${pacient.email || 'N/A'}</p>
                        <p style="margin: 5px 0; color: #666;"><strong>Estado:</strong> 
                            ${pacient.isCliente ? '<span class="badge badge-success">Cliente</span>' : '<span class="badge badge-info">No-Cliente</span>'}
                        </p>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h4 style="border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 10px;">Información Personal</h4>
                        <p><strong>Edad:</strong> ${pacient.edad || 'N/A'}</p>
                        <p><strong>Fecha Nacimiento:</strong> ${pacient.fechaNacimiento || 'N/A'}</p>
                        <p><strong>Género:</strong> ${pacient.genero || 'N/A'}</p>
                        <p><strong>Nacionalidad:</strong> ${pacient.nacionalidad || 'N/A'}</p>
                        <p><strong>Estado Civil:</strong> ${pacient.estadoCivil || 'N/A'}</p>
                        <p><strong>Tiene Hijos:</strong> ${pacient.tieneHijos || 'N/A'}</p>
                    </div>

                    <div>
                        <h4 style="border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 10px;">Información Laboral</h4>
                        <p><strong>Profesión:</strong> ${pacient.profesion || 'N/A'}</p>
                        <p><strong>Ocupación:</strong> ${pacient.ocupacion || 'N/A'}</p>
                        <p><strong>Grado Académico:</strong> ${pacient.gradoAcademico || 'N/A'}</p>
                        <p><strong>Tipo de Servicio:</strong> ${pacient.tipoServicio || 'N/A'}</p>
                    </div>

                    <div>
                        <h4 style="border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 10px;">Dirección</h4>
                        <p><strong>Dirección:</strong> ${pacient.direccion || 'N/A'}</p>
                        <p><strong>Colonia:</strong> ${pacient.colonia || 'N/A'}</p>
                        <p><strong>Zona:</strong> ${pacient.zona || 'N/A'}</p>
                        <p><strong>Municipio:</strong> ${pacient.municipio || 'N/A'}</p>
                        <p><strong>Departamento:</strong> ${pacient.departamento || 'N/A'}</p>
                    </div>

                    <div>
                        <h4 style="border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 10px;">Información de Consulta</h4>
                        <p><strong>Fecha Primera Consulta:</strong> ${pacient.fechaPrimerConsulta || 'N/A'}</p>
                        <p><strong>Motivo de Consulta:</strong> ${pacient.motivoConsulta || 'N/A'}</p>
                        <p><strong>Referencia:</strong> ${pacient.referencia || 'N/A'}</p>
                        <p><strong>Registrado:</strong> ${pacient.fechaRegistro || 'N/A'}</p>
                    </div>
                </div>

                ${pacient.notas ? `
                    <div style="margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 5px;">
                        <h4 style="margin-top: 0;">Notas</h4>
                        <p>${pacient.notas}</p>
                    </div>
                ` : ''}
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

    // Agregar laboratorio/resultado
    addLaboratorio() {
        const id = document.getElementById('pacientId').value;
        if (!id) {
            this.showNotification('⚠️ Por favor selecciona un paciente primero', 'warning');
            return;
        }

        const tipo = document.getElementById('laboratorioTipo').value.trim();
        const fecha = document.getElementById('laboratorioFecha').value;
        const resultado = document.getElementById('laboratorioResultado').value.trim();

        if (!tipo || !fecha || !resultado) {
            this.showNotification('⚠️ Completa todos los campos del laboratorio', 'warning');
            return;
        }

        const pacient = this.state.pacientes.find(p => p.id === id);
        if (!pacient) return;

        if (!pacient.laboratorios) {
            pacient.laboratorios = [];
        }

        pacient.laboratorios.push({
            id: this.generateId('LAB'),
            tipo: tipo,
            fecha: fecha,
            resultado: resultado,
            fechaRegistro: new Date().toISOString().split('T')[0]
        });

        this.showNotification('✅ Laboratorio agregado', 'success');
        document.getElementById('laboratorioTipo').value = '';
        document.getElementById('laboratorioFecha').value = '';
        document.getElementById('laboratorioResultado').value = '';
        
        this.displayLaboratorios(id);
        this.saveToDB();
    },

    // Mostrar laboratorios
    displayLaboratorios(pacientId) {
        const pacient = this.state.pacientes.find(p => p.id === pacientId);
        const tbody = document.getElementById('laboratoriosTableBody');
        
        if (!tbody) return;

        if (!pacient || !pacient.laboratorios || pacient.laboratorios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="padding: 10px; text-align: center;">Sin resultados registrados</td></tr>';
            return;
        }

        tbody.innerHTML = pacient.laboratorios.map(lab => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px;">${lab.tipo}</td>
                <td style="padding: 10px;">${lab.fecha}</td>
                <td style="padding: 10px;">${lab.resultado}</td>
                <td style="padding: 10px; text-align: center;">
                    <button onclick="PacientesModule.deleteLaboratorio('${pacientId}', '${lab.id}')" style="color: #e74c3c; background: none; border: none; cursor: pointer;">🗑️ Eliminar</button>
                </td>
            </tr>
        `).join('');
    },

    // Eliminar laboratorio
    deleteLaboratorio(pacientId, labId) {
        const pacient = this.state.pacientes.find(p => p.id === pacientId);
        if (pacient && pacient.laboratorios) {
            pacient.laboratorios = pacient.laboratorios.filter(l => l.id !== labId);
            this.displayLaboratorios(pacientId);
            this.saveToDB();
            this.showNotification('✅ Laboratorio eliminado', 'success');
        }
    },

    // Agregar orden/actividad
    addOrden() {
        const id = document.getElementById('pacientId').value;
        if (!id) {
            this.showNotification('⚠️ Por favor selecciona un paciente primero', 'warning');
            return;
        }

        const tipo = document.getElementById('ordenTipo').value;
        const descripcion = document.getElementById('ordenDescripcion').value.trim();

        if (!tipo || !descripcion) {
            this.showNotification('⚠️ Completa todos los campos de la orden', 'warning');
            return;
        }

        const pacient = this.state.pacientes.find(p => p.id === id);
        if (!pacient) return;

        if (!pacient.ordenes) {
            pacient.ordenes = [];
        }

        pacient.ordenes.push({
            id: this.generateId('ORD'),
            tipo: tipo,
            descripcion: descripcion,
            estado: 'pendiente',
            fechaCreacion: new Date().toISOString().split('T')[0],
            fechaCompletada: null
        });

        this.showNotification('✅ Orden agregada', 'success');
        document.getElementById('ordenTipo').value = '';
        document.getElementById('ordenDescripcion').value = '';
        
        this.displayOrdenes(id);
        this.saveToDB();
    },

    // Mostrar órdenes
    displayOrdenes(pacientId) {
        const pacient = this.state.pacientes.find(p => p.id === pacientId);
        const tbody = document.getElementById('ordenesTableBody');
        
        if (!tbody) return;

        if (!pacient || !pacient.ordenes || pacient.ordenes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="padding: 10px; text-align: center;">Sin órdenes registradas</td></tr>';
            return;
        }

        const tiposIcons = {
            ejercicio: '🏃',
            alimentacion: '🍎',
            medicamento: '💊',
            descanso: '😴',
            higiene: '🧼',
            otro: '📝'
        };

        tbody.innerHTML = pacient.ordenes.map(ord => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px;">${tiposIcons[ord.tipo] || '📋'} ${ord.tipo}</td>
                <td style="padding: 10px;">${ord.descripcion}</td>
                <td style="padding: 10px;">
                    <span style="padding: 3px 8px; border-radius: 3px; background: ${ord.estado === 'completada' ? '#27ae60' : '#f39c12'}; color: white; font-size: 12px;">
                        ${ord.estado === 'completada' ? '✅ Completada' : '⏳ Pendiente'}
                    </span>
                </td>
                <td style="padding: 10px; text-align: center;">
                    ${ord.estado === 'pendiente' ? `<button onclick="PacientesModule.toggleOrdenEstado('${pacientId}', '${ord.id}')" style="background: #27ae60; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">✓ Completar</button>` : ''}
                    <button onclick="PacientesModule.deleteOrden('${pacientId}', '${ord.id}')" style="color: #e74c3c; background: none; border: none; cursor: pointer; margin-left: 5px;">🗑️</button>
                </td>
            </tr>
        `).join('');
    },

    // Cambiar estado de orden
    toggleOrdenEstado(pacientId, ordenId) {
        const pacient = this.state.pacientes.find(p => p.id === pacientId);
        if (pacient && pacient.ordenes) {
            const orden = pacient.ordenes.find(o => o.id === ordenId);
            if (orden) {
                orden.estado = orden.estado === 'pendiente' ? 'completada' : 'pendiente';
                if (orden.estado === 'completada') {
                    orden.fechaCompletada = new Date().toISOString().split('T')[0];
                }
                this.displayOrdenes(pacientId);
                this.saveToDB();
                this.showNotification('✅ Orden actualizada', 'success');
            }
        }
    },

    // Eliminar orden
    deleteOrden(pacientId, ordenId) {
        const pacient = this.state.pacientes.find(p => p.id === pacientId);
        if (pacient && pacient.ordenes) {
            pacient.ordenes = pacient.ordenes.filter(o => o.id !== ordenId);
            this.displayOrdenes(pacientId);
            this.saveToDB();
            this.showNotification('✅ Orden eliminada', 'success');
        }
    },

    // Agregar alerta
    addAlerta() {
        const id = document.getElementById('pacientId').value;
        if (!id) {
            this.showNotification('⚠️ Por favor selecciona un paciente primero', 'warning');
            return;
        }

        const tipo = document.getElementById('alertaTipo').value;
        const descripcion = document.getElementById('alertaDescripcion').value.trim();

        if (!tipo || !descripcion) {
            this.showNotification('⚠️ Completa todos los campos de la alerta', 'warning');
            return;
        }

        const pacient = this.state.pacientes.find(p => p.id === id);
        if (!pacient) return;

        if (!pacient.alertas) {
            pacient.alertas = [];
        }

        pacient.alertas.push({
            id: this.generateId('ALT'),
            tipo: tipo,
            descripcion: descripcion,
            activa: true,
            fechaCreacion: new Date().toISOString().split('T')[0]
        });

        this.showNotification('✅ Alerta agregada', 'success');
        document.getElementById('alertaTipo').value = '';
        document.getElementById('alertaDescripcion').value = '';
        
        this.displayAlertas(id);
        this.saveToDB();
    },

    // Mostrar alertas
    displayAlertas(pacientId) {
        const pacient = this.state.pacientes.find(p => p.id === pacientId);
        const container = document.getElementById('alertasList');
        
        if (!container) return;

        if (!pacient || !pacient.alertas || pacient.alertas.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999;">Sin alertas registradas</p>';
            return;
        }

        const tiposIcons = {
            alergia: '🔴',
            medicamento: '💊',
            riesgo: '⚠️',
            otro: '📌'
        };

        container.innerHTML = pacient.alertas.map(alt => `
            <div style="background: ${alt.activa ? '#fff3cd' : '#e8f5e9'}; border-left: 4px solid ${alt.activa ? '#ff9800' : '#4caf50'}; padding: 12px; margin-bottom: 10px; border-radius: 3px;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <strong>${tiposIcons[alt.tipo] || '📌'} ${alt.tipo.toUpperCase()}</strong>
                        <p style="margin: 5px 0 0 0; color: #333;">${alt.descripcion}</p>
                        <small style="color: #999;">Creada: ${alt.fechaCreacion}</small>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button onclick="PacientesModule.toggleAlerta('${pacientId}', '${alt.id}')" style="background: none; border: none; cursor: pointer; font-size: 16px;">
                            ${alt.activa ? '⏸️' : '▶️'}
                        </button>
                        <button onclick="PacientesModule.deleteAlerta('${pacientId}', '${alt.id}')" style="color: #e74c3c; background: none; border: none; cursor: pointer;">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    // Cambiar estado de alerta
    toggleAlerta(pacientId, alertaId) {
        const pacient = this.state.pacientes.find(p => p.id === pacientId);
        if (pacient && pacient.alertas) {
            const alerta = pacient.alertas.find(a => a.id === alertaId);
            if (alerta) {
                alerta.activa = !alerta.activa;
                this.displayAlertas(pacientId);
                this.saveToDB();
            }
        }
    },

    // Eliminar alerta
    deleteAlerta(pacientId, alertaId) {
        const pacient = this.state.pacientes.find(p => p.id === pacientId);
        if (pacient && pacient.alertas) {
            pacient.alertas = pacient.alertas.filter(a => a.id !== alertaId);
            this.displayAlertas(pacientId);
            this.saveToDB();
            this.showNotification('✅ Alerta eliminada', 'success');
        }
    },

    // Cargar y mostrar evoluciones desde historia clínica
    loadEvolucion(pacientId) {
        const historiasClinicas = JSON.parse(localStorage.getItem('historiasClinicas') || '[]');
        const historia = historiasClinicas.find(h => h.pacientId === pacientId);
        const container = document.getElementById('evolucionList');
        
        if (!container) return;

        if (!historia || !historia.notas || historia.notas.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999;">Sin notas de evolución</p>';
            return;
        }

        container.innerHTML = `
            <div style="max-height: 400px; overflow-y: auto;">
                ${[...historia.notas].reverse().map(nota => `
                    <div style="background: #f9f9f9; border-left: 3px solid #3498db; padding: 12px; margin-bottom: 10px; border-radius: 3px;">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <strong style="color: #2c3e50;">${nota.tipo.toUpperCase()}</strong>
                                <small style="color: #7f8c8d; margin-left: 10px;">📅 ${nota.fecha}</small>
                                ${nota.medico ? `<small style="color: #7f8c8d; margin-left: 10px;">👨‍⚕️ ${nota.medico}</small>` : ''}
                                <p style="margin: 8px 0 0 0; color: #2c3e50; line-height: 1.5;">${nota.contenido}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
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
