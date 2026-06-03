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
        presentaciones: ['Tabletas', 'Cápsulas', 'Solución Oral', 'Inyectable', 'Crema', 'Polvo', 'Jarabe', 'Grageas']
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
    },

    // Cargar datos
    loadData() {
        const demoData = window.DemoData || {};
        this.state.medicinas = JSON.parse(JSON.stringify(demoData.medicinas || []));
        this.state.pacientes = JSON.parse(JSON.stringify(demoData.pacientes || []));
        this.state.medicamentosAsignados = JSON.parse(JSON.stringify(demoData.medicamentosAsignados || []));
        this.extractFamilias();
        this.renderMedicines();
    },

    // Extraer familias únicas
    extractFamilias() {
        this.state.familiasDisponibles = [...new Set(this.state.medicinas.map(m => m.familia))].filter(Boolean);
    },

    // Abrir modal de nueva medicina
    openMedicineModal() {
        const modal = document.getElementById('medicineModal');
        const form = document.getElementById('editMedicineForm');
        if (!modal || !form) return;

        form.reset();
        document.getElementById('medicineId').value = '';
        
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
    saveMedicine() {
        const form = document.getElementById('editMedicineForm');
        if (!form) return;

        if (!this.validateMedicineForm()) {
            this.showNotification('⚠️ Por favor completa todos los campos requeridos', 'warning');
            return;
        }

        const id = document.getElementById('medicineId').value;
        const codigoBarra = document.getElementById('medicineCodigoBarra').value.trim();
        
        // Validar código barra único
        const existeCodigoBarra = this.state.medicinas.some(m => 
            m.codigoBarra === codigoBarra && m.id !== id
        );
        if (existeCodigoBarra) {
            this.showNotification('❌ Este código de barra ya existe', 'error');
            return;
        }

        const medicineData = {
            id: id || this.generateId('MED'),
            codigoBarra: codigoBarra,
            nombre: document.getElementById('medicineName').value.trim(),
            familia: document.getElementById('medicineFamily').value.trim(),
            subfamilia: document.getElementById('medicineSubfamily').value.trim(),
            presentacion: document.getElementById('medicinePresentacion').value,
            principioActivo: document.getElementById('medicinePrincipioActivo').value.trim(),
            dosis: document.getElementById('medicineDosis').value.trim(),
            unidadDosis: document.getElementById('medicineUnidadDosis').value,
            lote: document.getElementById('medicineLote').value.trim(),
            fechaVencimiento: document.getElementById('medicineFechaVencimiento').value,
            proveedor: document.getElementById('medicineProveedor').value.trim(),
            cantidad: parseInt(document.getElementById('medicineCantidad').value) || 0,
            cantidadMinima: parseInt(document.getElementById('medicineCantidadMinima').value) || 0,
            precioUnitario: parseFloat(document.getElementById('medicinePrecioUnitario').value) || 0,
            contraindicaciones: document.getElementById('medicineContraindicaciones').value.trim(),
            efectosSecundarios: document.getElementById('medicineEfectosSecundarios').value.trim(),
            fechaRegistro: id ? this.state.medicinas.find(m => m.id === id)?.fechaRegistro : new Date().toISOString().split('T')[0],
            activa: document.getElementById('medicineActiva').checked
        };

        if (id) {
            // Actualizar
            const index = this.state.medicinas.findIndex(m => m.id === id);
            if (index > -1) {
                this.state.medicinas[index] = medicineData;
                this.showNotification('✅ Medicina actualizada correctamente', 'success');
            }
        } else {
            // Crear
            this.state.medicinas.push(medicineData);
            this.showNotification('✅ Medicina creada correctamente', 'success');
        }

        this.extractFamilias();
        this.saveToDB();
        this.closeMedicineModal();
        this.renderMedicines();
    },

    // Editar medicina
    editMedicine(id) {
        const medicine = this.state.medicinas.find(m => m.id === id);
        if (!medicine) return;

        document.getElementById('medicineId').value = medicine.id;
        document.getElementById('medicineCodigoBarra').value = medicine.codigoBarra;
        document.getElementById('medicineName').value = medicine.nombre;
        document.getElementById('medicineFamily').value = medicine.familia;
        document.getElementById('medicineSubfamily').value = medicine.subfamilia;
        document.getElementById('medicinePresentacion').value = medicine.presentacion;
        document.getElementById('medicinePrincipioActivo').value = medicine.principioActivo;
        document.getElementById('medicineDosis').value = medicine.dosis;
        document.getElementById('medicineUnidadDosis').value = medicine.unidadDosis;
        document.getElementById('medicineLote').value = medicine.lote;
        document.getElementById('medicineFechaVencimiento').value = medicine.fechaVencimiento;
        document.getElementById('medicineProveedor').value = medicine.proveedor;
        document.getElementById('medicineCantidad').value = medicine.cantidad;
        document.getElementById('medicineCantidadMinima').value = medicine.cantidadMinima;
        document.getElementById('medicinePrecioUnitario').value = medicine.precioUnitario;
        document.getElementById('medicineContraindicaciones').value = medicine.contraindicaciones;
        document.getElementById('medicineEfectosSecundarios').value = medicine.efectosSecundarios;
        document.getElementById('medicineActiva').checked = medicine.activa;

        this.openMedicineModal();
    },

    // Eliminar medicina
    deleteMedicine(id) {
        if (!confirm('¿Estás seguro de que quieres eliminar esta medicina?')) return;

        this.state.medicinas = this.state.medicinas.filter(m => m.id !== id);
        this.showNotification('✅ Medicina eliminada', 'success');
        this.saveToDB();
        this.renderMedicines();
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
                m.nombre.toLowerCase().includes(this.searchTerm) ||
                m.codigoBarra.includes(this.searchTerm) ||
                m.familia.toLowerCase().includes(this.searchTerm) ||
                m.principioActivo.toLowerCase().includes(this.searchTerm)
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
                            <th>Dosis</th>
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
        const activaBadge = medicine.activa 
            ? '<span class="badge badge-success">Activa</span>'
            : '<span class="badge badge-inactive">Inactiva</span>';
        
        const vencida = this.isExpired(medicine.fechaVencimiento);
        const vencimientoBadge = vencida
            ? '<span class="badge badge-danger">Vencida</span>'
            : `<span class="badge badge-info">${medicine.fechaVencimiento}</span>`;

        return `
            <tr>
                <td><strong>${medicine.codigoBarra}</strong></td>
                <td>${medicine.nombre}</td>
                <td>${medicine.familia}</td>
                <td>${medicine.presentacion}</td>
                <td>${medicine.dosis} ${medicine.unidadDosis}</td>
                <td>${stockBadge}</td>
                <td>${vencimientoBadge}</td>
                <td>${activaBadge}</td>
                <td class="actions">
                    <button class="btn-icon btn-edit" title="Editar" onclick="MedicinasModule.editMedicine('${medicine.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" title="Eliminar" onclick="MedicinasModule.deleteMedicine('${medicine.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-icon btn-view" title="Detalles" onclick="MedicinasModule.viewMedicineDetails('${medicine.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    },

    // Get stock badge
    getStockBadge(medicine) {
        if (medicine.cantidad === 0) {
            return '<span class="badge badge-danger">Agotado (0)</span>';
        } else if (medicine.cantidad <= medicine.cantidadMinima) {
            return `<span class="badge badge-warning">Bajo ${medicine.cantidad}</span>`;
        }
        return `<span class="badge badge-success">${medicine.cantidad} unid.</span>`;
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
        this.updatePacienteSelect();
        this.updateMedicineSelectForAssign();

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
    },

    // Actualizar select de pacientes
    updatePacienteSelect() {
        const select = document.getElementById('assignPacienteSelect');
        if (!select) return;

        select.innerHTML = '<option value="">-- Selecciona un paciente --</option>' +
            this.state.pacientes.filter(p => p.estado === 'activo')
                .map(p => `<option value="${p.id}">${p.nombre} ${p.apellido} (${p.cedula})</option>`)
                .join('');
    },

    // Actualizar select de medicinas para asignación
    updateMedicineSelectForAssign() {
        const select = document.getElementById('assignMedicineSelect');
        if (!select) return;

        select.innerHTML = '<option value="">-- Selecciona una medicina --</option>' +
            this.state.medicinas.filter(m => m.activa && m.cantidad > 0)
                .map(m => `<option value="${m.id}">${m.nombre} (${m.cantidad} disp.)</option>`)
                .join('');
    },

    // Guardar asignación de medicina
    saveMedicineAssignment() {
        const pacienteId = document.getElementById('assignPacienteSelect').value;
        const medicineId = document.getElementById('assignMedicineSelect').value;
        const cantidad = parseInt(document.getElementById('assignCantidad').value) || 0;
        const dosis = document.getElementById('assignDosis').value.trim();
        const frecuencia = document.getElementById('assignFrecuencia').value;
        const fechaInicio = document.getElementById('assignFechaInicio').value;
        const fechaFin = document.getElementById('assignFechaFin').value;

        if (!pacienteId || !medicineId || !cantidad || !dosis || !frecuencia || !fechaInicio) {
            this.showNotification('⚠️ Por favor completa todos los campos requeridos', 'warning');
            return;
        }

        const medicine = this.state.medicinas.find(m => m.id === medicineId);
        if (!medicine || medicine.cantidad < cantidad) {
            this.showNotification('❌ No hay suficiente stock disponible', 'error');
            return;
        }

        const assignmentData = {
            id: this.generateId('ASG'),
            pacienteId: pacienteId,
            medicineId: medicineId,
            cantidad: cantidad,
            dosis: dosis,
            frecuencia: frecuencia,
            fechaInicio: fechaInicio,
            fechaFin: fechaFin || null,
            estado: 'activo', // activo, pausado, finalizado
            notas: document.getElementById('assignNotas').value.trim(),
            fechaAsignacion: new Date().toISOString().split('T')[0]
        };

        // Reducir stock
        medicine.cantidad -= cantidad;

        // Agregar asignación
        this.state.medicamentosAsignados.push(assignmentData);

        this.showNotification('✅ Medicina asignada al paciente correctamente', 'success');
        this.saveToDB();
        this.closeAssignModal();
        this.renderMedicines();
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
