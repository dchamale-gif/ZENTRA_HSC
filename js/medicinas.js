// ============================================
// MÓDULO DE MEDICINAS
// ============================================
// Gestión de medicinas durante la estancia del paciente
// Un paciente puede tener múltiples medicinas
// Vinculado al paciente, no al cliente

const MedicinasModule = {
    state: {
        medicinas: [],
        pacientes: [],
        medicamentosAsignados: [], // Medicinas asignadas a pacientes
        filtroActivo: 'todas', // todas, disponibles, agotadas
        searchTerm: '',
        familiasDisponibles: [],
        presentaciones: ['Tabletas', 'Cápsulas', 'Solución Oral', 'Inyectable', 'Crema', 'Polvo', 'Jarabe', 'Grageas'],
        medicinasSeleccionadas: [] // Medicinas temporales para asignación múltiple
    },

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        this.loadData();
        console.log('Módulo de Medicinas inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        const newMedicineBtn = document.getElementById('addMedicineBtn');
        if (newMedicineBtn) {
            newMedicineBtn.addEventListener('click', () => this.openMedicineModal());
        }

        const saveMedicineBtn = document.getElementById('saveMedicineBtn');
        if (saveMedicineBtn) {
            saveMedicineBtn.addEventListener('click', () => this.saveMedicine());
        }

        const searchInput = document.getElementById('searchMedicine');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.renderMedicines();
            });
        }

        const filterSelect = document.getElementById('filterMedicine');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filtroActivo = e.target.value;
                this.renderMedicines();
            });
        }

        const closeBtnModal = document.querySelector('#medicineModal .close-btn');
        if (closeBtnModal) {
            closeBtnModal.addEventListener('click', () => this.closeMedicineModal());
        }

        // Event listeners para asignación de medicinas
        const assignMedicineBtn = document.getElementById('assignMedicineBtn');
        if (assignMedicineBtn) {
            assignMedicineBtn.addEventListener('click', () => this.openAssignModal());
        }

        const saveMedicineAssignBtn = document.getElementById('saveMedicineAssignBtn');
        if (saveMedicineAssignBtn) {
            saveMedicineAssignBtn.addEventListener('click', () => this.saveMedicineAssignment());
        }

        const closeAssignModal = document.querySelector('#assignMedicineModal .close-btn');
        if (closeAssignModal) {
            closeAssignModal.addEventListener('click', () => this.closeAssignModal());
        }

        // Event delegation para botones de la tabla de medicinas
        const medicinesContainer = document.getElementById('medicinesTableContainer');
        if (medicinesContainer) {
            medicinesContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;

                const row = btn.closest('tr');
                if (!row) return;

                const medicineId = row.getAttribute('data-medicine-id');
                const action = btn.getAttribute('data-action');

                if (action === 'edit') {
                    this.editMedicine(medicineId);
                } else if (action === 'delete') {
                    this.deleteMedicine(medicineId);
                } else if (action === 'view') {
                    this.viewMedicineDetails(medicineId);
                }
            });
        }
    },

    // Cargar datos
    // Cargar datos desde API
    async loadData() {
        try {
            const token = authManager.getToken();
            if (!token) {
                console.error('❌ ERROR: No hay token de autenticación');
                this.showNotification('❌ Error: No autenticado. Por favor inicia sesión.', 'error');
                return;
            }

            const response = await fetch(`${authManager.apiBaseUrl}/api/medicinas`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}. Verifica tu conexión a la BD.`);
            }

            const data = await response.json();
            this.state.medicinas = data.medicinas || [];
            this.extractFamilias();
            this.renderMedicines();
            
            console.log(`✅ ${this.state.medicinas.length} medicinas cargadas desde BD`);
        } catch (error) {
            console.error('❌ Error cargando medicinas desde API:', error);
            this.showNotification(`❌ Error de conexión: ${error.message}`, 'error');
            this.state.medicinas = [];
            this.renderMedicines();
        }
    },

    // Extraer familias únicas
    extractFamilias() {
        this.state.familiasDisponibles = [...new Set(this.state.medicinas.map(m => m.familia))].filter(Boolean);
    },

    // Abrir modal de nueva medicina
    openMedicineModal(isNew = true) {
        const modal = document.getElementById('medicineModal');
        const form = document.getElementById('editMedicineForm');
        if (!modal || !form) return;

        // Solo limpiar si es nueva medicina
        if (isNew) {
            form.reset();
            document.getElementById('medicineId').value = '';
            document.getElementById('medicineActiva').checked = true;
        }
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    // Cerrar modal
    closeMedicineModal() {
        const modal = document.getElementById('medicineModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    },

    // Guardar medicina
    async saveMedicine() {
        const form = document.getElementById('editMedicineForm');
        if (!form) {
            console.error('❌ Formulario no encontrado');
            return;
        }

        if (!this.validateMedicineForm()) {
            this.showNotification('⚠️ Por favor completa todos los campos requeridos', 'warning');
            return;
        }

        const id = document.getElementById('medicineId').value.trim();
        const codigoBarra = document.getElementById('medicineCodigoBarra').value.trim();
        
        try {
            console.log('📝 Guardando medicina...');
            
            // Construir objeto con datos del formulario
            const medicineData = {
                nombre: document.getElementById('medicineName').value.trim(),
                codigo_externo: codigoBarra,
                presentacion: document.getElementById('medicinePresentacion').value,
                concentracion: document.getElementById('medicinePrincipioActivo').value.trim(),
                precio: parseFloat(document.getElementById('medicinePrecioUnitario').value) || 0,
                stock: parseInt(document.getElementById('medicineCantidad').value) || 0,
                stock_minimo: parseInt(document.getElementById('medicineCantidadMinima').value) || 0,
                vencimiento: document.getElementById('medicineFechaVencimiento').value || null,
                familia: document.getElementById('medicineFamily').value.trim() || null,
                subfamilia: document.getElementById('medicineSubfamily').value.trim() || null,
                lote: document.getElementById('medicineLote').value.trim() || null,
                proveedor: document.getElementById('medicineProveedor').value.trim() || null,
                descripcion: document.getElementById('medicineContraindicaciones').value.trim() || null,
                activo: document.getElementById('medicineActiva').checked
            };

            console.log('📦 Datos a guardar:', JSON.stringify(medicineData, null, 2));

            const token = authManager.getToken();
            if (!token) {
                this.showNotification('❌ No estás autenticado', 'error');
                return;
            }

            const url = id 
                ? `${authManager.apiBaseUrl}/api/medicinas/${id}`
                : `${authManager.apiBaseUrl}/api/medicinas`;

            const method = id ? 'PUT' : 'POST';
            
            console.log(`🔗 ${method} ${url}`);

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(medicineData)
            });

            console.log(`📊 Response status: ${response.status}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Error ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ Respuesta del servidor:', JSON.stringify(result, null, 2));
            
            if (id) {
                this.showNotification('✅ Medicina actualizada correctamente', 'success');
            } else {
                this.showNotification('✅ Medicina creada correctamente', 'success');
            }

            this.closeMedicineModal();
            this.loadData(); // Recargar desde BD
        } catch (error) {
            console.error('Error guardando medicina:', error);
            this.showNotification(`❌ Error: ${error.message}`, 'error');
        }
    },

    // Editar medicina
    editMedicine(id) {
        console.log('editMedicine called with id:', id);
        
        const medicine = this.state.medicinas.find(m => m.id === id || String(m.id) === String(id));
        if (!medicine) {
            console.error('❌ Medicina no encontrada:', id);
            this.showNotification('❌ Error: Medicina no encontrada', 'error');
            return;
        }

        console.log('✅ Medicina encontrada:', medicine.nombre);
        console.log('Datos:', JSON.stringify(medicine, null, 2));

        // Helper para llenar campos de forma segura
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
            document.getElementById('medicineId').value = medicine.id;
            fillField('medicineCodigoBarra', medicine.codigo_externo || medicine.codigoBarra);
            fillField('medicineName', medicine.nombre);
            fillField('medicineFamily', medicine.familia);
            fillField('medicineSubfamily', medicine.subfamilia);
            fillField('medicinePresentacion', medicine.presentacion);
            fillField('medicinePrincipioActivo', medicine.concentracion || medicine.principioActivo);
            fillField('medicineDosis', medicine.dosis);
            fillField('medicineUnidadDosis', medicine.unidadDosis);
            fillField('medicineLote', medicine.lote);
            fillField('medicineFechaVencimiento', medicine.vencimiento || medicine.fechaVencimiento);
            fillField('medicineProveedor', medicine.proveedor);
            fillField('medicineCantidad', medicine.stock || medicine.cantidad);
            fillField('medicineCantidadMinima', medicine.stock_minimo || medicine.cantidadMinima);
            fillField('medicinePrecioUnitario', medicine.precio || medicine.precioUnitario);
            fillField('medicineContraindicaciones', medicine.descripcion || medicine.contraindicaciones);
            fillField('medicineEfectosSecundarios', medicine.efectosSecundarios);
            
            const activaCheckbox = document.getElementById('medicineActiva');
            if (activaCheckbox) {
                activaCheckbox.checked = medicine.activo !== false && medicine.activa !== false;
                console.log('✓ Activa checkbox:', activaCheckbox.checked);
            }

            console.log('✅ TODOS LOS CAMPOS LLENADOS');
            this.openMedicineModal(false); // false = es edición
        } catch(error) {
            console.error('❌ Error al llenar formulario:', error);
            this.showNotification('❌ Error al cargar datos', 'error');
        }
    },

    // Eliminar medicina
    async deleteMedicine(id) {
        if (!confirm('¿Estás seguro de que quieres eliminar esta medicina?')) return;

        try {
            const token = authManager.getToken();
            if (!token) {
                this.showNotification('❌ No estás autenticado', 'error');
                return;
            }

            const response = await fetch(
                `${authManager.apiBaseUrl}/api/medicinas/${id}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Error ${response.status}`);
            }

            this.showNotification('✅ Medicina eliminada', 'success');
            this.loadData(); // Recargar desde BD
        } catch (error) {
            console.error('Error eliminando medicina:', error);
            this.showNotification(`❌ Error: ${error.message}`, 'error');
        }
    },

    // Validar formulario
    validateMedicineForm() {
        const codigoBarra = document.getElementById('medicineCodigoBarra').value.trim();
        const nombre = document.getElementById('medicineName').value.trim();
        const presentacion = document.getElementById('medicinePresentacion').value;
        const dosis = document.getElementById('medicineDosis').value.trim();

        return codigoBarra && nombre && presentacion && dosis;
    },

    // Renderizar tabla de medicinas
    renderMedicines() {
        const container = document.getElementById('medicinesTableContainer');
        if (!container) return;

        let filtered = [...this.state.medicinas];

        // Filtro por disponibilidad
        if (this.filtroActivo === 'disponibles') {
            filtered = filtered.filter(m => m.cantidad > m.cantidadMinima && m.activa);
        } else if (this.filtroActivo === 'agotadas') {
            filtered = filtered.filter(m => m.cantidad <= m.cantidadMinima || !m.activa);
        }

        // Búsqueda
        if (this.searchTerm) {
            filtered = filtered.filter(m =>
                (m.nombre && m.nombre.toLowerCase().includes(this.searchTerm)) ||
                (m.codigo_externo && m.codigo_externo.includes(this.searchTerm)) ||
                (m.codigoBarra && m.codigoBarra.includes(this.searchTerm)) ||
                (m.familia && m.familia.toLowerCase().includes(this.searchTerm)) ||
                (m.concentracion && m.concentracion.toLowerCase().includes(this.searchTerm)) ||
                (m.principioActivo && m.principioActivo.toLowerCase().includes(this.searchTerm))
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No hay medicinas registradas</p></div>';
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Nombre</th>
                            <th>Familia</th>
                            <th>Presentación</th>
                            <th>Concentración</th>
                            <th>Stock</th>
                            <th>Vencimiento</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(medicine => this.renderMedicineRow(medicine)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // Renderizar fila de medicina
    renderMedicineRow(medicine) {
        const stockBadge = this.getStockBadge(medicine);
        const activaBadge = medicine.activo || medicine.activa
            ? '<span class="badge badge-success">Activa</span>'
            : '<span class="badge badge-inactive">Inactiva</span>';
        
        const fechaVencimiento = medicine.vencimiento || medicine.fechaVencimiento || 'N/A';
        const vencida = this.isExpired(fechaVencimiento);
        const vencimientoBadge = vencida
            ? '<span class="badge badge-danger">Vencida</span>'
            : `<span class="badge badge-info">${fechaVencimiento}</span>`;

        return `
            <tr data-medicine-id="${medicine.id}">
                <td><strong>${medicine.codigo_externo || medicine.codigoBarra || 'N/A'}</strong></td>
                <td>${medicine.nombre || 'N/A'}</td>
                <td>${medicine.familia || 'N/A'}</td>
                <td>${medicine.presentacion || 'N/A'}</td>
                <td>${medicine.concentracion || 'N/A'}</td>
                <td>${stockBadge}</td>
                <td>${vencimientoBadge}</td>
                <td>${activaBadge}</td>
                <td class="actions">
                    <button class="btn-icon btn-edit" title="Editar" data-action="edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" title="Eliminar" data-action="delete">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-icon btn-view" title="Detalles" data-action="view">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    },

    // Get stock badge
    getStockBadge(medicine) {
        const stock = medicine.stock || medicine.cantidad || 0;
        const stockMinimo = medicine.stock_minimo || medicine.cantidadMinima || 0;
        
        if (stock === 0) {
            return '<span class="badge badge-danger">Agotado (0)</span>';
        } else if (stock <= stockMinimo) {
            return `<span class="badge badge-warning">Bajo ${stock}</span>`;
        }
        return `<span class="badge badge-success">${stock} unid.</span>`;
    },

    // Verificar si está vencida
    isExpired(fechaVencimiento) {
        if (!fechaVencimiento) return false;
        return new Date(fechaVencimiento) < new Date();
    },

    // Ver detalles de medicina
    viewMedicineDetails(id) {
        const medicine = this.state.medicinas.find(m => m.id === id);
        if (!medicine) return;

        const detailsModal = document.getElementById('medicineDetailsModal');
        const detailsContent = document.getElementById('medicineDetailsContent');
        if (!detailsModal || !detailsContent) return;

        // Contar asignaciones
        const asignaciones = this.state.medicamentosAsignados.filter(a => a.medicineId === id);

        detailsContent.innerHTML = `
            <div class="details-card">
                <div class="details-header">
                    <h3>${medicine.nombre}</h3>
                    <span class="badge ${medicine.activa ? 'badge-success' : 'badge-inactive'}">
                        ${medicine.activa ? 'ACTIVA' : 'INACTIVA'}
                    </span>
                </div>

                <div class="details-grid">
                    <div class="detail-group">
                        <label>Código de Barra</label>
                        <p>${medicine.codigoBarra}</p>
                    </div>
                    <div class="detail-group">
                        <label>Familia</label>
                        <p>${medicine.familia}</p>
                    </div>
                    <div class="detail-group">
                        <label>Subfamilia</label>
                        <p>${medicine.subfamilia || 'N/A'}</p>
                    </div>
                    <div class="detail-group">
                        <label>Presentación</label>
                        <p>${medicine.presentacion}</p>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Información Farmacológica</h4>
                    <div class="details-grid">
                        <div class="detail-group">
                            <label>Principio Activo</label>
                            <p>${medicine.principioActivo}</p>
                        </div>
                        <div class="detail-group">
                            <label>Dosis Recomendada</label>
                            <p>${medicine.dosis} ${medicine.unidadDosis}</p>
                        </div>
                        <div class="detail-group">
                            <label>Lote</label>
                            <p>${medicine.lote}</p>
                        </div>
                        <div class="detail-group">
                            <label>Fecha Vencimiento</label>
                            <p>${this.isExpired(medicine.fechaVencimiento) ? '🔴 VENCIDA: ' : '✅ '}${medicine.fechaVencimiento}</p>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Inventario</h4>
                    <div class="details-grid">
                        <div class="detail-group">
                            <label>Stock Actual</label>
                            <p><strong>${medicine.cantidad}</strong> unidades</p>
                        </div>
                        <div class="detail-group">
                            <label>Stock Mínimo</label>
                            <p>${medicine.cantidadMinima} unidades</p>
                        </div>
                        <div class="detail-group">
                            <label>Precio Unitario</label>
                            <p>$${medicine.precioUnitario.toFixed(2)}</p>
                        </div>
                        <div class="detail-group">
                            <label>Valor Total</label>
                            <p>$${(medicine.cantidad * medicine.precioUnitario).toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Contraindicaciones</h4>
                    <p>${medicine.contraindicaciones || 'Sin información'}</p>
                </div>

                <div class="detail-section">
                    <h4>Efectos Secundarios</h4>
                    <p>${medicine.efectosSecundarios || 'Sin información'}</p>
                </div>

                <div class="detail-section">
                    <h4>Asignaciones</h4>
                    <p>Asignada a <strong>${asignaciones.length}</strong> paciente(s) en tratamiento</p>
                </div>

                <div class="details-footer">
                    <p class="text-muted">Proveedor: ${medicine.proveedor} | Registrado: ${medicine.fechaRegistro}</p>
                </div>
            </div>
        `;

        detailsModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    // Cerrar modal de detalles
    closeMedicineDetailsModal() {
        const modal = document.getElementById('medicineDetailsModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    },

    // ========== ASIGNACIÓN DE MEDICINAS A PACIENTES ==========

    // Abrir modal de asignación
    openAssignModal() {
        const modal = document.getElementById('assignMedicineModal');
        const form = document.getElementById('assignMedicineForm');
        if (!modal || !form) return;

        form.reset();
        document.getElementById('assignMedicineId').value = '';
        this.state.medicinasSeleccionadas = []; // Reiniciar lista de medicinas
        
        // Cargar pacientes SOLO desde PacientesModule
        if (typeof PacientesModule !== 'undefined' && PacientesModule.state && PacientesModule.state.pacientes) {
            this.state.pacientes = PacientesModule.state.pacientes;
        } else {
            console.error('❌ ERROR: PacientesModule no disponible');
            this.showNotification('❌ Error: No hay pacientes disponibles', 'error');
            return;
        }
        
        if (this.state.medicinas.length === 0) {
            console.error('❌ ERROR: No hay medicinas cargadas');
            this.showNotification('❌ Error: No hay medicinas disponibles', 'error');
            return;
        }
        
        this.updatePacienteSelect();
        this.updateMedicineSelectForAssign();
        this.displaySelectedMedicines();

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    // Cerrar modal de asignación
    closeAssignModal() {
        const modal = document.getElementById('assignMedicineModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        this.state.medicinasSeleccionadas = [];
    },

    // Actualizar select de pacientes
    updatePacienteSelect() {
        const select = document.getElementById('assignPacienteSelect');
        if (!select) return;

        if (!this.state.pacientes || this.state.pacientes.length === 0) {
            select.innerHTML = '<option value="">-- No hay pacientes disponibles --</option>';
            return;
        }

        select.innerHTML = '<option value="">-- Selecciona un paciente --</option>' +
            this.state.pacientes
                .map(p => {
                    const fullName = `${p.nombre} ${p.apellidoPaterno} ${p.apellidoMaterno || ''}`.trim();
                    const cedula = p.dpi || p.pasaporte || 'S/N';
                    return `<option value="${p.id}">${fullName} (${cedula})</option>`;
                })
                .join('');
    },

    // Actualizar select de medicinas para asignación
    updateMedicineSelectForAssign() {
        const select = document.getElementById('assignMedicineSelect');
        if (!select) return;

        if (!this.state.medicinas || this.state.medicinas.length === 0) {
            select.innerHTML = '<option value="">-- No hay medicinas disponibles --</option>';
            return;
        }

        select.innerHTML = '<option value="">-- Selecciona una medicina --</option>' +
            this.state.medicinas
                .filter(m => (m.cantidad === undefined || m.cantidad > 0))
                .map(m => {
                    const cantidad = m.cantidad || 0;
                    return `<option value="${m.id}">${m.nombre} (${cantidad} unid.)</option>`;
                })
                .join('');
    },

    // Agregar medicina a la lista de asignación
    addMedicineToList() {
        const medicineId = document.getElementById('assignMedicineSelect').value;
        
        if (!medicineId) {
            this.showNotification('⚠️ Por favor selecciona una medicina', 'warning');
            return;
        }

        // Verificar si ya está en la lista
        if (this.state.medicinasSeleccionadas.some(m => m.medicineId === medicineId)) {
            this.showNotification('⚠️ Esta medicina ya ha sido agregada', 'warning');
            return;
        }

        const medicine = this.state.medicinas.find(m => m.id === medicineId);
        if (!medicine) return;

        // Agregar a la lista temporal con valores por defecto
        this.state.medicinasSeleccionadas.push({
            medicineId: medicineId,
            medicineName: medicine.nombre,
            cantidad: 1,
            dosis: '',
            frecuencia: ''
        });

        this.displaySelectedMedicines();
        document.getElementById('assignMedicineSelect').value = '';
        this.showNotification('✅ Medicina agregada a la lista', 'success');
    },

    // Quitar medicina de la lista de asignación
    removeMedicineFromList(medicineId) {
        this.state.medicinasSeleccionadas = this.state.medicinasSeleccionadas.filter(m => m.medicineId !== medicineId);
        this.displaySelectedMedicines();
        this.showNotification('✅ Medicina removida de la lista', 'success');
    },

    // Actualizar una medicina en la lista
    updateMedicineInList(medicineId, field, value) {
        const medicina = this.state.medicinasSeleccionadas.find(m => m.medicineId === medicineId);
        if (medicina) {
            medicina[field] = value;
        }
    },

    // Mostrar medicinas seleccionadas
    displaySelectedMedicines() {
        const container = document.getElementById('assignedMedicinesList');
        if (!container) return;

        if (this.state.medicinasSeleccionadas.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; margin: 0;">No hay medicinas seleccionadas aún</p>';
            return;
        }

        const frecuenciaOptions = [
            'Una vez al día',
            'Cada 8 horas',
            'Cada 12 horas',
            'Cada 6 horas',
            'Cada 4 horas',
            'Cada 24 horas',
            'Cada 3 días',
            'Semanalmente',
            'Según sea necesario'
        ];

        container.innerHTML = this.state.medicinasSeleccionadas.map((med, idx) => `
            <div style="background: white; border: 1px solid #ddd; border-radius: 4px; padding: 15px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h4 style="margin: 0; color: #333;">${med.medicineName}</h4>
                    <button type="button" class="btn-icon btn-delete" style="background: none; border: none; color: #e74c3c; cursor: pointer; font-size: 18px;" onclick="MedicinasModule.removeMedicineFromList('${med.medicineId}')" title="Eliminar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="font-size: 12px; color: #666;">Cantidad <span style="color: red;">*</span></label>
                        <input type="number" value="${med.cantidad}" min="1" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;" 
                            onchange="MedicinasModule.updateMedicineInList('${med.medicineId}', 'cantidad', this.value)">
                    </div>
                    <div>
                        <label style="font-size: 12px; color: #666;">Dosis <span style="color: red;">*</span></label>
                        <input type="text" value="${med.dosis}" placeholder="Ej: 1 tableta" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;" 
                            onchange="MedicinasModule.updateMedicineInList('${med.medicineId}', 'dosis', this.value)">
                    </div>
                    <div style="grid-column: 1 / -1;">
                        <label style="font-size: 12px; color: #666;">Frecuencia <span style="color: red;">*</span></label>
                        <select style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;" 
                            onchange="MedicinasModule.updateMedicineInList('${med.medicineId}', 'frecuencia', this.value)">
                            <option value="">Selecciona frecuencia</option>
                            ${frecuenciaOptions.map(f => `<option value="${f}" ${med.frecuencia === f ? 'selected' : ''}>${f}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
        `).join('');
    },

    // Guardar asignación múltiple de medicinas
    saveMedicineAssignment() {
        const pacienteId = document.getElementById('assignPacienteSelect').value;
        const notas = document.getElementById('assignNotas').value.trim();

        if (!pacienteId) {
            this.showNotification('⚠️ Por favor selecciona un paciente', 'warning');
            return;
        }

        if (this.state.medicinasSeleccionadas.length === 0) {
            this.showNotification('⚠️ Por favor agrega al menos una medicina', 'warning');
            return;
        }

        // Validar que todas las medicinas tengan dosis y frecuencia
        for (let med of this.state.medicinasSeleccionadas) {
            if (!med.dosis || !med.frecuencia) {
                this.showNotification(`⚠️ ${med.medicineName} requiere dosis y frecuencia`, 'warning');
                return;
            }
        }

        // Crear asignación para cada medicina
        let totalExitoso = 0;
        for (let med of this.state.medicinasSeleccionadas) {
            const medicine = this.state.medicinas.find(m => m.id === med.medicineId);
            const cantidad = parseInt(med.cantidad) || 1;
            
            if (!medicine) {
                this.showNotification(`❌ No se encontró la medicina ${med.medicineName}`, 'error');
                continue;
            }

            // Crear asignación
            const assignmentData = {
                id: this.generateId('ASG'),
                pacienteId: pacienteId,
                medicineId: med.medicineId,
                medicineName: med.medicineName,
                cantidad: cantidad,
                dosis: med.dosis,
                frecuencia: med.frecuencia,
                estado: 'activo',
                notas: notas,
                fechaAsignacion: new Date().toISOString().split('T')[0]
            };

            // Agregar asignación
            this.state.medicamentosAsignados.push(assignmentData);
            totalExitoso++;
        }

        if (totalExitoso > 0) {
            this.showNotification(`✅ ${totalExitoso} medicina(s) asignada(s) al paciente correctamente`, 'success');
            this.saveToDB();
            this.closeAssignModal();
            this.renderMedicines();
        } else {
            this.showNotification('❌ No se pudieron asignar las medicinas', 'error');
        }
    },

    // Generar ID único
    generateId(prefix) {
        const count = this.state.medicinas.length + 1;
        return `${prefix}-${String(count).padStart(5, '0')}`;
    },

    // Guardar en DB (localStorage)
    saveToDB() {
        localStorage.setItem('medicinas', JSON.stringify(this.state.medicinas));
        localStorage.setItem('medicamentosAsignados', JSON.stringify(this.state.medicamentosAsignados));
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
