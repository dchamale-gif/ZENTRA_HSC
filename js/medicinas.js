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
        seccionFiltro: '',
        familiaFiltro: '', // Familia seleccionada para filtro
        subfamiliaFiltro: '', // Subfamilia seleccionada para filtro
        ordenActivo: 'default', // Orden de medicinas
        seccionesDisponibles: [],
        familiasDisponibles: [],
        subfamiliasDisponibles: [],
        presentaciones: ['Tabletas', 'Cápsulas', 'Solución Oral', 'Inyectable', 'Crema', 'Polvo', 'Jarabe', 'Grageas'],
        medicinasSeleccionadas: [], // Medicinas temporales para asignación múltiple
        presentacionesForm: [], // Presentaciones (caja, blíster…) en edición en el formulario
        kardex: null // { medicina, movimientos } del kárdex abierto
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

        // El botón Guardar ya llama a saveMedicine() desde su onclick en el HTML;
        // agregar otro listener guardaba la medicina dos veces.

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

        const filterFamilySelect = document.getElementById('filterMedicineFamily');
        if (filterFamilySelect) {
            filterFamilySelect.addEventListener('change', (e) => {
                this.familiaFiltro = e.target.value;
                // Resetear subfamilia cuando cambia familia
                this.subfamiliaFiltro = '';
                const subfamilySelect = document.getElementById('filterMedicineSubfamily');
                if (subfamilySelect) {
                    subfamilySelect.value = '';
                    this.updateSubfamilyFilter();
                }
                this.renderMedicines();
            });
        }

        const filterSectionSelect = document.getElementById('filterMedicineSection');
        if (filterSectionSelect) {
            filterSectionSelect.addEventListener('change', (e) => {
                this.seccionFiltro = e.target.value;
                this.familiaFiltro = '';
                this.subfamiliaFiltro = '';
                this.updateFamilyFilters();
                this.renderMedicines();
            });
        }

        const filterSubfamilySelect = document.getElementById('filterMedicineSubfamily');
        if (filterSubfamilySelect) {
            filterSubfamilySelect.addEventListener('change', (e) => {
                this.subfamiliaFiltro = e.target.value;
                this.renderMedicines();
            });
        }

        const filterOrdenSelect = document.getElementById('filterMedicineOrden');
        if (filterOrdenSelect) {
            filterOrdenSelect.addEventListener('change', (e) => {
                this.ordenActivo = e.target.value;
                this.renderMedicines();
            });
        }

        const closeBtnModal = document.querySelector('#medicineModal .close-btn');
        if (closeBtnModal) {
            closeBtnModal.addEventListener('click', () => this.closeMedicineModal());
        }

        const medicineSection = document.getElementById('medicineSection');
        if (medicineSection) {
            medicineSection.addEventListener('change', () => this.updateMedicineFamilySelector());
        }

        const medicineFamily = document.getElementById('medicineFamily');
        if (medicineFamily) {
            medicineFamily.addEventListener('change', () => this.updateMedicineSubfamilySelector());
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
                } else if (action === 'kardex') {
                    this.abrirKardex(medicineId);
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

            const requestOptions = {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };
            const [response, articulosResponse] = await Promise.all([
                fetch(`${authManager.apiBaseUrl}/api/medicinas?activo=todos`, requestOptions),
                fetch(`${authManager.apiBaseUrl}/api/codigos-articulos`, requestOptions).catch(() => null)
            ]);

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}. Verifica tu conexión a la BD.`);
            }

            const data = await response.json();
            const articulosData = articulosResponse?.ok ? await articulosResponse.json() : { articulos: [] };
            const articulos = articulosData.articulos || [];
            this.state.medicinas = this.mergeMedicineClassifications(data.medicinas || [], articulos)
                .map(medicina => this.normalizarMedicina(medicina));
            this.extractFamilias(articulos);
            this.renderMedicines();
            
            console.log(`✅ ${this.state.medicinas.length} medicinas cargadas desde BD`);
        } catch (error) {
            console.error('❌ Error cargando medicinas desde API:', error);
            this.showNotification(`❌ Error de conexión: ${error.message}`, 'error');
            this.state.medicinas = [];
            this.renderMedicines();
        }
    },

    // Agrega a cada medicina de la API los nombres de campo que usa este módulo
    normalizarMedicina(m) {
        const cantidad = Number(m.cantidad ?? m.stock) || 0;
        const cantidadMinima = Number(m.cantidad_minima ?? m.stock_minimo) || 0;
        const precio = Number(m.precio_venta ?? m.precio) || 0;
        const vencimiento = m.fecha_vencimiento ? String(m.fecha_vencimiento).slice(0, 10) : '';
        const activo = m.activo !== false;
        return {
            ...m,
            codigoBarra: m.codigo_barra || m.codigo_externo || '',
            principioActivo: m.principio_activo || '',
            unidadDosis: m.unidad_dosis || '',
            contraindicaciones: m.contraindicaciones || '',
            efectosSecundarios: m.efectos_secundarios || '',
            cantidad,
            stock: cantidad,
            cantidadMinima,
            stock_minimo: cantidadMinima,
            precio,
            precioUnitario: precio,
            fecha_vencimiento: vencimiento,
            fechaVencimiento: vencimiento,
            precioCosto: Number(m.precio_costo) || 0,
            fechaRegistro: m.created_at ? formatFecha(m.created_at) : 'N/A',
            fechaActualizacion: m.updated_at ? formatFechaHora(m.updated_at) : 'N/A',
            activo,
            activa: activo
        };
    },

    mergeMedicineClassifications(medicinas, articulos) {
        const normalize = value => String(value || '').trim().toLocaleLowerCase('es');
        const articlesByCode = new Map();
        const articlesByName = new Map();

        articulos.forEach(articulo => {
            [articulo.codigo, articulo.codigo_barras, articulo.codigo_alternativo]
                .map(normalize)
                .filter(Boolean)
                .forEach(code => articlesByCode.set(code, articulo));
            const name = normalize(articulo.nombre_articulo);
            if (name) articlesByName.set(name, articulo);
        });

        return medicinas.map(medicina => {
            const matchingArticle = [medicina.codigo_externo, medicina.codigo_barra, medicina.codigo_interno]
                .map(normalize)
                .filter(Boolean)
                .map(code => articlesByCode.get(code))
                .find(Boolean) || articlesByName.get(normalize(medicina.nombre));

            if (!matchingArticle) return medicina;

            return {
                ...medicina,
                seccion: medicina.seccion || medicina.categoria || matchingArticle.categoria || '',
                familia: medicina.familia || matchingArticle.familia || '',
                subfamilia: medicina.subfamilia || matchingArticle.subfamilia || ''
            };
        });
    },

    // Extraer familias únicas
    extractFamilias(articulos = []) {
        const secciones = new Map();
        const familias = new Map();
        const subfamilias = new Map();
        const catalogo = typeof CodigosArticulosModule !== 'undefined' ? CodigosArticulosModule : null;
        const defaultSecciones = catalogo?.getDefaultSecciones?.() || [];
        const defaultFamilias = catalogo?.getDefaultFamilias?.() || [];
        const defaultSubfamilias = catalogo?.getDefaultSubfamilias?.() || [];

        defaultSecciones.forEach(item => secciones.set(item.id, item));
        defaultFamilias.forEach(item => familias.set(item.id, item));
        defaultSubfamilias.forEach(item => subfamilias.set(item.id, item));

        [...articulos, ...this.state.medicinas].forEach(item => {
            const seccionId = item.categoria || item.seccion || '';
            const familiaId = item.familia || '';
            const subfamiliaId = item.subfamilia || '';
            if (seccionId && !secciones.has(seccionId)) {
                secciones.set(seccionId, { id: seccionId, nombre: seccionId });
            }
            if (familiaId && !familias.has(familiaId)) {
                familias.set(familiaId, { id: familiaId, seccionId, nombre: familiaId });
            }
            if (subfamiliaId && !subfamilias.has(subfamiliaId)) {
                subfamilias.set(subfamiliaId, { id: subfamiliaId, familiaId, nombre: subfamiliaId });
            }
        });

        this.state.seccionesDisponibles = [...secciones.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.state.familiasDisponibles = [...familias.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.state.subfamiliasDisponibles = [...subfamilias.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.updateFamilyFilters();
    },

    // Actualizar los selectores de familia y subfamilia
    updateFamilyFilters() {
        const sectionSelect = document.getElementById('filterMedicineSection');
        if (sectionSelect) {
            sectionSelect.innerHTML = '<option value="">Todas las Secciones</option>' +
                this.state.seccionesDisponibles.map(item => `<option value="${item.id}">${item.nombre}</option>`).join('');
            sectionSelect.value = this.seccionFiltro || '';
        }

        const familySelect = document.getElementById('filterMedicineFamily');
        if (familySelect) {
            // Guardar valor actual
            const currentFamily = familySelect.value;
            
            // Limpiar opciones excepto la primera
            familySelect.innerHTML = '<option value="">Todas las Familias</option>';
            
            const familias = this.seccionFiltro
                ? this.state.familiasDisponibles.filter(item => item.seccionId === this.seccionFiltro)
                : this.state.familiasDisponibles;
            familias.forEach(familia => {
                const option = document.createElement('option');
                option.value = familia.id;
                option.textContent = familia.nombre;
                familySelect.appendChild(option);
            });
            
            familySelect.value = familias.some(item => item.id === currentFamily) ? currentFamily : '';
            this.familiaFiltro = familySelect.value;
        }
        
        this.updateSubfamilyFilter();
    },

    // Actualizar subfamilias según familia seleccionada
    updateSubfamilyFilter() {
        const subfamilySelect = document.getElementById('filterMedicineSubfamily');
        if (!subfamilySelect) return;

        // Guardar valor actual
        const currentSubfamily = subfamilySelect.value;
        
        // Obtener subfamilias para la familia seleccionada
        let subfamiliasDisponibles = [];
        
        if (this.familiaFiltro) {
            subfamiliasDisponibles = this.state.subfamiliasDisponibles
                .filter(item => item.familiaId === this.familiaFiltro);
        } else {
            // Si no hay familia seleccionada, mostrar todas las subfamilias
            subfamiliasDisponibles = this.state.subfamiliasDisponibles;
        }
        
        // Limpiar opciones excepto la primera
        subfamilySelect.innerHTML = '<option value="">Todas las Subfamilias</option>';
        
        // Agregar subfamilias
        subfamiliasDisponibles.forEach(subfamilia => {
            const option = document.createElement('option');
            option.value = subfamilia.id;
            option.textContent = subfamilia.nombre;
            subfamilySelect.appendChild(option);
        });
        
        // Restaurar valor solo si sigue siendo válido
        if (subfamiliasDisponibles.some(item => item.id === currentSubfamily)) {
            subfamilySelect.value = currentSubfamily;
        } else {
            subfamilySelect.value = '';
        }
    },

    // Abrir modal de nueva medicina
    openMedicineModal(isNew = true) {
        const modal = document.getElementById('medicineModal');
        const form = document.getElementById('editMedicineForm');
        if (!modal || !form) return;

        // Llenar selectores de familia y subfamilia
        this.populateFamilySelectors();

        // Solo limpiar si es nueva medicina
        if (isNew) {
            form.reset();
            document.getElementById('medicineId').value = '';
            document.getElementById('medicineActiva').checked = true;
            this.state.presentacionesForm = [];
            this.prepararInventarioForm(null);
            document.getElementById('medicineSection').value = '';
            document.getElementById('medicineFamily').value = '';
            document.getElementById('medicineSubfamily').value = '';
            this.updateMedicineSubfamilySelector(); // Resetear subfamilias
        }
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    // Llenar selectores de familia y subfamilia
    populateFamilySelectors() {
        const sectionSelect = document.getElementById('medicineSection');
        const familySelect = document.getElementById('medicineFamily');
        if (!sectionSelect || !familySelect) return;

        const currentSection = sectionSelect.value;
        const currentFamily = familySelect.value;
        const currentSubfamily = document.getElementById('medicineSubfamily')?.value || '';

        sectionSelect.innerHTML = '<option value="">Seleccionar Sección...</option>' +
            this.state.seccionesDisponibles.map(item => `<option value="${item.id}">${item.nombre}</option>`).join('');
        sectionSelect.value = currentSection;

        this.updateMedicineFamilySelector(currentFamily, currentSubfamily);
    },

    updateMedicineFamilySelector(preferredFamily = '', preferredSubfamily = '') {
        const sectionId = document.getElementById('medicineSection')?.value || '';
        const familySelect = document.getElementById('medicineFamily');
        if (!familySelect) return;
        const currentFamily = preferredFamily || familySelect.value;
        const familias = sectionId
            ? this.state.familiasDisponibles.filter(item => item.seccionId === sectionId)
            : this.state.familiasDisponibles;

        familySelect.innerHTML = '<option value="">Seleccionar Familia...</option>';
        familias.forEach(familia => {
            const option = document.createElement('option');
            option.value = familia.id;
            option.textContent = familia.nombre;
            familySelect.appendChild(option);
        });
        familySelect.value = familias.some(item => item.id === currentFamily) ? currentFamily : '';
        this.updateMedicineSubfamilySelector(preferredSubfamily);
    },

    // Actualizar selector de subfamilia según familia seleccionada en modal
    updateMedicineSubfamilySelector(preferredSubfamily = '') {
        const familySelect = document.getElementById('medicineFamily');
        const subfamilySelect = document.getElementById('medicineSubfamily');
        if (!familySelect || !subfamilySelect) return;

        const selectedFamily = familySelect.value;
        const currentSubfamily = preferredSubfamily || subfamilySelect.value;

        // Obtener subfamilias para la familia seleccionada
        let subfamiliasDisponibles = [];
        
        if (selectedFamily) {
            subfamiliasDisponibles = this.state.subfamiliasDisponibles
                .filter(item => item.familiaId === selectedFamily);
        } else {
            subfamiliasDisponibles = this.state.subfamiliasDisponibles;
        }

        // Llenar subfamilia
        subfamilySelect.innerHTML = '<option value="">Seleccionar Subfamilia...</option>';
        subfamiliasDisponibles.forEach(subfamilia => {
            const option = document.createElement('option');
            option.value = subfamilia.id;
            option.textContent = subfamilia.nombre;
            subfamilySelect.appendChild(option);
        });

        // Restaurar valor si sigue siendo válido
        if (subfamiliasDisponibles.some(item => item.id === currentSubfamily)) {
            subfamilySelect.value = currentSubfamily;
        } else {
            subfamilySelect.value = '';
        }
    },

    // Cerrar modal
    // ---------- Unidades de medida y presentaciones (formulario) ----------
    // Con kárdex, la existencia de una medicina ya registrada solo cambia con movimientos
    prepararInventarioForm(medicine) {
        const lista = document.getElementById('medicineUnidadesLista');
        if (lista && !lista.children.length) lista.innerHTML = InventarioMedicinas.UNIDADES.map(u => `<option value="${u}">`).join('');
        const unidad = document.getElementById('medicineUnidadBase');
        if (unidad) {
            unidad.value = medicine ? InventarioMedicinas.unidadBase(medicine) : 'Unidad';
            if (!unidad.dataset.enlazado) {
                unidad.dataset.enlazado = '1';
                unidad.addEventListener('input', () => this.actualizarEtiquetasUnidad());
            }
        }
        const cantidad = document.getElementById('medicineCantidad');
        const ayuda = document.getElementById('medicineCantidadAyuda');
        if (cantidad) cantidad.readOnly = Boolean(medicine);
        if (ayuda) {
            ayuda.textContent = medicine
                ? 'Cambia con compras recibidas, ventas, consumo interno y ajustes. Para corregirla use el kárdex de la medicina.'
                : 'Existencia inicial al registrar la medicina.';
        }
        this.renderPresentacionesForm();
        this.actualizarEtiquetasUnidad();
    },

    unidadFormulario() {
        return document.getElementById('medicineUnidadBase')?.value.trim() || 'Unidad';
    },

    actualizarEtiquetasUnidad() {
        const unidad = this.unidadFormulario().toLowerCase();
        document.querySelectorAll('#editMedicineForm [data-unidad-base]').forEach(el => { el.textContent = unidad; });
        document.querySelectorAll('#medicinePresentaciones [data-unidad-fila]').forEach(el => {
            const fila = this.state.presentacionesForm[Number(el.dataset.unidadFila)];
            el.textContent = InventarioMedicinas.texto(parseInt(fila?.factor, 10) || 0, this.unidadFormulario()).replace(/^\d+\s/, '');
        });
    },

    agregarPresentacion() {
        const tieneCaja = this.state.presentacionesForm.some(p => String(p.nombre).toLowerCase() === 'caja');
        this.state.presentacionesForm.push({ nombre: tieneCaja ? '' : 'Caja', factor: '', precio_venta: '', codigo_barra: '' });
        this.renderPresentacionesForm();
        const filas = document.querySelectorAll('#medicinePresentaciones .inv-presentacion-fila');
        filas[filas.length - 1]?.querySelector(tieneCaja ? '[data-campo="nombre"]' : '[data-campo="factor"]')?.focus();
    },

    quitarPresentacion(indice) {
        this.state.presentacionesForm.splice(indice, 1);
        this.renderPresentacionesForm();
    },

    renderPresentacionesForm() {
        const contenedor = document.getElementById('medicinePresentaciones');
        if (!contenedor) return;
        const e = valor => this.escapeHTML(valor ?? '');
        const filas = this.state.presentacionesForm;
        contenedor.innerHTML = filas.length ? filas.map((p, i) => `
            <div class="inv-presentacion-fila" data-indice="${i}">
                <label class="inv-campo"><span>Presentación</span>
                    <input type="text" class="form-input" data-campo="nombre" list="medicinePresentacionNombres" maxlength="40" value="${e(p.nombre)}" placeholder="Caja">
                </label>
                <label class="inv-campo"><span>Contiene</span>
                    <span class="inv-con-unidad">
                        <input type="number" class="form-input" data-campo="factor" min="2" step="1" value="${e(p.factor)}" placeholder="100">
                        <small data-unidad-fila="${i}"></small>
                    </span>
                </label>
                <label class="inv-campo"><span>Precio de venta (Q)</span>
                    <input type="number" class="form-input" data-campo="precio_venta" min="0" step="0.01" value="${e(p.precio_venta)}" placeholder="0.00">
                </label>
                <label class="inv-campo"><span>Código de barras</span>
                    <input type="text" class="form-input" data-campo="codigo_barra" maxlength="60" value="${e(p.codigo_barra)}" placeholder="Opcional">
                </label>
                <button type="button" class="btn-accion btn-accion-icono btn-accion-peligro" onclick="MedicinasModule.quitarPresentacion(${i})" title="Quitar presentación" aria-label="Quitar presentación ${i + 1}">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            </div>`).join('') + '<datalist id="medicinePresentacionNombres"><option value="Caja"><option value="Blíster"><option value="Frasco"><option value="Paquete"><option value="Display"></datalist>'
            : '<p class="inv-vacio">Sin presentaciones: se compra y vende solo por unidad base.</p>';
        if (!contenedor.dataset.enlazado) {
            contenedor.dataset.enlazado = '1';
            contenedor.addEventListener('input', ev => {
                const fila = ev.target.closest('[data-indice]');
                const campo = ev.target.dataset.campo;
                if (!fila || !campo) return;
                this.state.presentacionesForm[Number(fila.dataset.indice)][campo] = ev.target.value;
                if (campo === 'factor') this.actualizarEtiquetasUnidad();
            });
        }
        this.actualizarEtiquetasUnidad();
    },

    // ---------- Kárdex: movimientos, consumo interno y ajustes ----------
    async apiMedicinas(path, options = {}) {
        const response = await fetch(`${authManager.apiBaseUrl}/api/medicinas${path}`, {
            ...options,
            headers: { Authorization: `Bearer ${authManager.getToken()}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || data.message || `Error ${response.status}`);
        return data;
    },

    async abrirKardex(id) {
        const medicina = this.state.medicinas.find(m => String(m.id) === String(id));
        if (!medicina) return;
        document.getElementById('kardexMedicina')?.remove();
        const capa = document.createElement('div');
        capa.id = 'kardexMedicina';
        capa.className = 'modal-overlay inv-kardex';
        capa.innerHTML = `
            <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="kardexTitulo">
                <div class="modal-header">
                    <h2 id="kardexTitulo">Kárdex · ${this.escapeHTML(medicina.nombre)}</h2>
                    <button type="button" class="close-btn" data-kardex="cerrar" aria-label="Cerrar">&times;</button>
                </div>
                <div class="modal-body" id="kardexContenido"><p class="inv-vacio">Cargando movimientos…</p></div>
            </div>`;
        const cerrar = () => {
            capa.remove();
            document.removeEventListener('keydown', alTeclear);
            this.state.kardex = null;
        };
        const alTeclear = ev => { if (ev.key === 'Escape') cerrar(); };
        capa.addEventListener('click', ev => {
            if (ev.target === capa || ev.target.closest('[data-kardex="cerrar"]')) cerrar();
            if (ev.target.closest('[data-kardex="registrar"]')) this.registrarMovimiento();
        });
        capa.addEventListener('change', ev => {
            if (ev.target.matches('[data-mov="tipo"]')) this.actualizarFormMovimiento();
        });
        capa.addEventListener('input', ev => {
            if (ev.target.matches('[data-mov="cantidad"], [data-mov="presentacion"]')) this.actualizarFormMovimiento();
        });
        document.addEventListener('keydown', alTeclear);
        document.body.appendChild(capa);
        capa.querySelector('[data-kardex="cerrar"]').focus();
        await this.cargarKardex(medicina.id);
    },

    async cargarKardex(id) {
        const contenido = document.getElementById('kardexContenido');
        try {
            const [{ medicina }, { movimientos }] = await Promise.all([
                this.apiMedicinas(`/${encodeURIComponent(id)}`),
                this.apiMedicinas(`/${encodeURIComponent(id)}/movimientos`)
            ]);
            if (Permisos.puede('medicinas', 'edit') && !this.state.pacientesKardex) {
                this.state.pacientesKardex = await fetch(`${authManager.apiBaseUrl}/api/pacientes`, { headers: { Authorization: `Bearer ${authManager.getToken()}` } })
                    .then(r => (r.ok ? r.json() : {})).then(d => d.pacientes || d.data || []).catch(() => []);
            }
            this.state.kardex = { medicina, movimientos };
            if (contenido) contenido.innerHTML = this.htmlKardex();
            this.actualizarFormMovimiento();
        } catch (error) {
            if (contenido) contenido.innerHTML = `<p class="inv-vacio">No se pudo cargar el kárdex: ${this.escapeHTML(error.message)}</p>`;
        }
    },

    htmlKardex() {
        const { medicina, movimientos } = this.state.kardex;
        const e = valor => this.escapeHTML(valor ?? '');
        const unidad = InventarioMedicinas.unidadBase(medicina);
        const presentaciones = InventarioMedicinas.presentaciones(medicina);
        const cantidad = Number(medicina.cantidad) || 0;
        const desglose = InventarioMedicinas.desglose(cantidad, medicina);
        const pacientes = this.state.pacientesKardex || [];

        const formulario = Permisos.puede('medicinas', 'edit') ? `
            <fieldset class="inv-mov-form">
                <legend>Registrar consumo interno o ajuste</legend>
                <p class="inv-ayuda">Consumo interno: lo usado para atender a pacientes del centro (no es venta). Ajuste: correcciones por conteo físico, merma o vencimiento.</p>
                <div class="inv-mov-campos">
                    <label class="inv-campo"><span>Movimiento</span>
                        <select class="form-input" data-mov="tipo">
                            <option value="consumo_interno">Consumo interno</option>
                            <option value="ajuste_salida">Ajuste de salida</option>
                            <option value="ajuste_entrada">Ajuste de entrada</option>
                        </select>
                    </label>
                    <label class="inv-campo"><span>Presentación</span>
                        <select class="form-input" data-mov="presentacion">
                            ${presentaciones.map(p => `<option value="${e(p.id)}">${e(InventarioMedicinas.nombrePresentacion(medicina, p))}</option>`).join('')}
                        </select>
                    </label>
                    <label class="inv-campo"><span>Cantidad</span>
                        <input type="number" class="form-input" data-mov="cantidad" min="1" step="1" value="1">
                    </label>
                    <label class="inv-campo" data-mov-paciente><span>Paciente (opcional)</span>
                        <select class="form-input" data-mov="paciente">
                            <option value="">Sin paciente</option>
                            ${pacientes.map(p => `<option value="${e(p.id)}">${e([p.nombre, p.apellido_paterno || p.apellidoPaterno, p.apellido_materno || p.apellidoMaterno].filter(Boolean).join(' '))}</option>`).join('')}
                        </select>
                    </label>
                    <label class="inv-campo inv-campo-ancho"><span data-mov-motivo-etiqueta>Detalle (opcional)</span>
                        <input type="text" class="form-input" data-mov="motivo" maxlength="500" placeholder="Ej.: dosis de la noche, blíster dañado, conteo físico…">
                    </label>
                </div>
                <div class="inv-mov-pie">
                    <small data-mov-equivale></small>
                    <button type="button" class="btn btn-primary btn-small" data-kardex="registrar"><i class="fas fa-check" aria-hidden="true"></i> Registrar</button>
                </div>
            </fieldset>` : '';

        const filas = movimientos.length ? movimientos.map(m => {
            const entra = m.cantidad > 0;
            const detalle = [m.paciente_nombre ? `Paciente: ${m.paciente_nombre}` : '', m.motivo].filter(Boolean).join(' · ');
            return `<tr>
                <td>${e(formatFechaHora(m.fecha))}</td>
                <td>${e(InventarioMedicinas.MOVIMIENTOS[m.tipo] || m.tipo)}${m.referencia ? `<br><small>${e(m.referencia)}</small>` : ''}</td>
                <td>${m.factor > 1 ? `${e(m.cantidad_presentacion)} × ${e(m.presentacion)}` : e(InventarioMedicinas.texto(Math.abs(m.cantidad), m.presentacion || unidad))}</td>
                <td class="inv-num ${entra ? 'inv-entrada' : 'inv-salida'}">${entra ? '+' : '−'}${Math.abs(m.cantidad)}</td>
                <td class="inv-num">${e(m.existencia_resultante)}</td>
                <td>${e(m.usuario_nombre || '—')}</td>
                <td class="inv-detalle">${e(detalle)}</td>
            </tr>`;
        }).join('') : `<tr><td colspan="7" class="inv-vacio">Sin movimientos.</td></tr>`;

        return `
            <div class="inv-existencia">
                <span>Existencia</span>
                <strong>${e(InventarioMedicinas.texto(cantidad, unidad))}</strong>
                ${desglose ? `<small>${e(desglose)}</small>` : ''}
            </div>
            ${formulario}
            <div class="inv-tabla-envoltura">
                <table class="inv-tabla">
                    <thead><tr><th scope="col">Fecha</th><th scope="col">Movimiento</th><th scope="col">Presentación</th>
                        <th scope="col" class="inv-num">Entrada / salida <small>(${e(unidad.toLowerCase())})</small></th><th scope="col" class="inv-num">Existencia</th>
                        <th scope="col">Usuario</th><th scope="col">Detalle</th></tr></thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>`;
    },

    // El paciente solo aplica al consumo interno; el ajuste exige motivo. Muestra el equivalente en unidades base.
    actualizarFormMovimiento() {
        const capa = document.getElementById('kardexMedicina');
        if (!capa || !this.state.kardex) return;
        const campo = nombre => capa.querySelector(`[data-mov="${nombre}"]`);
        if (!campo('tipo')) return;
        const consumo = campo('tipo').value === 'consumo_interno';
        capa.querySelector('[data-mov-paciente]').hidden = !consumo;
        capa.querySelector('[data-mov-motivo-etiqueta]').textContent = consumo ? 'Detalle (opcional)' : 'Motivo del ajuste *';
        const { medicina } = this.state.kardex;
        const p = InventarioMedicinas.presentacion(medicina, campo('presentacion').value);
        const cantidad = parseInt(campo('cantidad').value, 10) || 0;
        capa.querySelector('[data-mov-equivale]').textContent = p.factor > 1 && cantidad > 0
            ? `Equivale a ${InventarioMedicinas.texto(cantidad * p.factor, InventarioMedicinas.unidadBase(medicina))}`
            : '';
    },

    async registrarMovimiento() {
        const capa = document.getElementById('kardexMedicina');
        const { medicina } = this.state.kardex || {};
        if (!capa || !medicina) return;
        const campo = nombre => capa.querySelector(`[data-mov="${nombre}"]`);
        const tipo = campo('tipo').value;
        const cantidad = parseInt(campo('cantidad').value, 10);
        const motivo = campo('motivo').value.trim();
        if (!(cantidad > 0)) {
            this.showNotification('Escriba una cantidad mayor a cero', 'warning');
            campo('cantidad').focus();
            return;
        }
        if (tipo !== 'consumo_interno' && motivo.length < 3) {
            this.showNotification('Escriba el motivo del ajuste', 'warning');
            campo('motivo').focus();
            return;
        }
        const boton = capa.querySelector('[data-kardex="registrar"]');
        boton.disabled = true;
        try {
            const { medicina: actualizada } = await this.apiMedicinas(`/${encodeURIComponent(medicina.id)}/movimientos`, {
                method: 'POST',
                body: JSON.stringify({
                    tipo,
                    cantidad,
                    presentacion_id: campo('presentacion').value || null,
                    paciente_id: tipo === 'consumo_interno' ? campo('paciente').value || null : null,
                    motivo
                })
            });
            this.showNotification(`Movimiento registrado. Existencia: ${InventarioMedicinas.existencia(actualizada)}`, 'success');
            await this.cargarKardex(medicina.id);
            this.loadData();
        } catch (error) {
            this.showNotification(error.message, 'error');
            boton.disabled = false;
        }
    },

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
        const presentacionMala = this.state.presentacionesForm.findIndex(p => !String(p.nombre || '').trim() || !(parseInt(p.factor, 10) >= 2));
        if (presentacionMala >= 0) {
            this.showNotification(`Complete la presentación ${presentacionMala + 1}: nombre y cuántas unidades contiene (2 o más)`, 'warning');
            document.querySelector(`#medicinePresentaciones [data-indice="${presentacionMala}"] input`)?.focus();
            return;
        }

        const id = document.getElementById('medicineId').value.trim();
        const codigoBarra = document.getElementById('medicineCodigoBarra').value.trim();
        if (this.guardandoMedicina) return;
        this.guardandoMedicina = true;
        const saveBtn = document.getElementById('saveMedicineBtn');
        if (saveBtn) saveBtn.disabled = true;
        
        try {
            console.log('📝 Guardando medicina...');
            
            // Construir objeto con datos del formulario
            const valor = id => document.getElementById(id)?.value?.trim() || null;
            const dosis = valor('medicineDosis');
            const unidadDosis = valor('medicineUnidadDosis');
            // Todos los campos del formulario, con el nombre de su columna en la BD
            const medicineData = {
                codigo_barra: codigoBarra,
                codigo_externo: codigoBarra,
                nombre: valor('medicineName'),
                seccion: valor('medicineSection'),
                familia: valor('medicineFamily'),
                subfamilia: valor('medicineSubfamily'),
                presentacion: valor('medicinePresentacion'),
                principio_activo: valor('medicinePrincipioActivo'),
                dosis,
                unidad_dosis: unidadDosis,
                concentracion: [dosis, unidadDosis].filter(Boolean).join(' ') || null,
                lote: valor('medicineLote'),
                fecha_vencimiento: valor('medicineFechaVencimiento'),
                cantidad: parseInt(document.getElementById('medicineCantidad').value, 10) || 0,
                cantidad_minima: parseInt(document.getElementById('medicineCantidadMinima').value, 10) || 0,
                precio_venta: parseFloat(document.getElementById('medicinePrecioUnitario').value) || 0,
                precio_costo: parseFloat(document.getElementById('medicinePrecioCosto').value) || 0,
                unidad_base: valor('medicineUnidadBase') || 'Unidad',
                presentaciones: this.state.presentacionesForm.map(p => ({
                    nombre: String(p.nombre || '').trim(),
                    factor: parseInt(p.factor, 10),
                    precio_venta: parseFloat(p.precio_venta) || 0,
                    codigo_barra: String(p.codigo_barra || '').trim() || null
                })),
                contraindicaciones: valor('medicineContraindicaciones'),
                efectos_secundarios: valor('medicineEfectosSecundarios'),
                proveedor: valor('medicineProveedor'),
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
        } finally {
            this.guardandoMedicina = false;
            if (saveBtn) saveBtn.disabled = false;
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
            this.populateFamilySelectors();
            document.getElementById('medicineId').value = medicine.id;
            fillField('medicineCodigoBarra', medicine.codigo_barra || medicine.codigo_externo);
            fillField('medicineName', medicine.nombre);
            fillField('medicineSection', medicine.seccion || medicine.categoria || 'SEC-001');
            this.updateMedicineFamilySelector();
            fillField('medicineFamily', medicine.familia);
            this.updateMedicineSubfamilySelector();
            fillField('medicineSubfamily', medicine.subfamilia);
            fillField('medicinePresentacion', medicine.presentacion || medicine.forma_farmaceutica);
            fillField('medicinePrincipioActivo', medicine.principio_activo || medicine.concentracion);
            fillField('medicineDosis', medicine.dosis);
            fillField('medicineUnidadDosis', medicine.unidad_dosis);
            fillField('medicineLote', medicine.lote);
            fillField('medicineFechaVencimiento', medicine.fechaVencimiento);
            fillField('medicineProveedor', medicine.proveedor);
            fillField('medicineCantidad', String(medicine.cantidad));
            fillField('medicineCantidadMinima', String(medicine.cantidadMinima));
            fillField('medicinePrecioUnitario', medicine.precioUnitario ? medicine.precioUnitario.toFixed(2) : '');
            fillField('medicinePrecioCosto', medicine.precioCosto ? String(medicine.precioCosto) : '');
            this.state.presentacionesForm = (medicine.presentaciones || []).map(p => ({ ...p }));
            this.prepararInventarioForm(medicine);
            fillField('medicineContraindicaciones', medicine.contraindicaciones);
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
        const seccion = document.getElementById('medicineSection').value;
        const familia = document.getElementById('medicineFamily').value;

        return codigoBarra && nombre && presentacion && dosis && seccion && familia;
    },

    // Renderizar tabla de medicinas
    renderMedicines() {
        const container = document.getElementById('medicinesTableContainer');
        if (!container) return;

        let filtered = [...this.state.medicinas];

        // Filtro por disponibilidad
        if (this.filtroActivo === 'disponibles') {
            filtered = filtered.filter(m => {
                const stock = m.stock || m.cantidad || 0;
                const stockMinimo = m.stock_minimo || m.cantidadMinima || 0;
                const activo = m.activo !== false && m.activa !== false;
                return stock > stockMinimo && activo;
            });
        } else if (this.filtroActivo === 'agotadas') {
            filtered = filtered.filter(m => {
                const stock = m.stock || m.cantidad || 0;
                const stockMinimo = m.stock_minimo || m.cantidadMinima || 0;
                const activo = m.activo !== false && m.activa !== false;
                return stock <= stockMinimo || !activo;
            });
        } else if (this.filtroActivo === 'activas') {
            filtered = filtered.filter(m => m.activo);
        } else if (this.filtroActivo === 'inactivas') {
            filtered = filtered.filter(m => !m.activo);
        } else if (this.filtroActivo === 'por-vencer') {
            filtered = filtered.filter(m => {
                const dias = this.diasParaVencer(m.fechaVencimiento);
                return dias !== null && dias >= 0 && dias <= 90;
            });
        } else if (this.filtroActivo === 'vencidas') {
            filtered = filtered.filter(m => this.isExpired(m.fechaVencimiento));
        }

        // Filtro por sección
        if (this.seccionFiltro) {
            filtered = filtered.filter(m => (m.seccion || m.categoria) === this.seccionFiltro);
        }

        // Filtro por familia
        if (this.familiaFiltro) {
            filtered = filtered.filter(m => m.familia === this.familiaFiltro);
        }

        // Filtro por subfamilia
        if (this.subfamiliaFiltro) {
            filtered = filtered.filter(m => m.subfamilia === this.subfamiliaFiltro);
        }

        // Búsqueda
        if (this.searchTerm) {
            const termino = this.normalizarTexto(this.searchTerm);
            filtered = filtered.filter(m => this.textoBusqueda(m).includes(termino));
        }

        // Aplicar orden
        switch(this.ordenActivo) {
            case 'alfabetico-asc':
                filtered.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
                break;
            case 'alfabetico-desc':
                filtered.sort((a, b) => (b.nombre || '').localeCompare(a.nombre || ''));
                break;
            case 'vencimiento-asc':
                filtered.sort((a, b) => (a.fechaVencimiento || '9999').localeCompare(b.fechaVencimiento || '9999'));
                break;
            case 'precio-desc':
                filtered.sort((a, b) => b.precioUnitario - a.precioUnitario);
                break;
            case 'stock-asc':
                filtered.sort((a, b) => (a.stock || a.cantidad || 0) - (b.stock || b.cantidad || 0));
                break;
            case 'stock-desc':
                filtered.sort((a, b) => (b.stock || b.cantidad || 0) - (a.stock || a.cantidad || 0));
                break;
            case 'default':
            default:
                // Mantener orden original
                break;
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
                            <th>Medicina</th>
                            <th>Principio activo / dosis</th>
                            <th>Clasificación</th>
                            <th>Stock</th>
                            <th class="text-right">Precio</th>
                            <th>Lote / vencimiento</th>
                            <th>Proveedor</th>
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
        const e = valor => this.escapeHTML(valor);
        const estadoBadge = medicine.activo
            ? '<span class="badge badge-success">Activa</span>'
            : '<span class="badge badge-inactive">Inactiva</span>';
        const clasificacion = [
            this.getClassificationName('seccion', medicine.seccion || medicine.categoria || 'SEC-001'),
            medicine.familia && this.getClassificationName('familia', medicine.familia),
            medicine.subfamilia && this.getClassificationName('subfamilia', medicine.subfamilia)
        ].filter(Boolean).map(e).join(' › ');

        return `
            <tr data-medicine-id="${e(medicine.id)}" class="${medicine.activo ? '' : 'medicina-inactiva'}">
                <td><strong>${e(medicine.codigoBarra || 'N/A')}</strong></td>
                <td>
                    <div class="medicina-nombre">${e(medicine.nombre || 'N/A')}</div>
                    <small class="medicina-sub">${e(medicine.presentacion || medicine.forma_farmaceutica || 'Sin presentación')}</small>
                </td>
                <td>
                    ${e(medicine.principioActivo || 'N/A')}
                    ${medicine.dosis ? `<br><small class="medicina-sub">${e(medicine.dosis)} ${e(medicine.unidadDosis)}</small>` : ''}
                </td>
                <td><small>${clasificacion}</small></td>
                <td>${this.getStockBadge(medicine)}<br><small class="medicina-sub">Mín. ${medicine.cantidadMinima}</small></td>
                <td class="text-right">${formatQ(medicine.precioUnitario)}</td>
                <td>
                    ${medicine.lote ? `<small class="medicina-sub">Lote ${e(medicine.lote)}</small><br>` : ''}
                    ${this.getVencimientoBadge(medicine.fechaVencimiento)}
                </td>
                <td><small>${e(medicine.proveedor || '—')}</small></td>
                <td>${estadoBadge}</td>
                <td class="actions">
                    <button class="btn-icon btn-view" title="Ver detalles" data-action="view">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" title="Kárdex: movimientos, consumo interno y ajustes" aria-label="Kárdex de ${e(medicine.nombre)}" data-action="kardex">
                        <i class="fas fa-clipboard-list"></i>
                    </button>
                    <button class="btn-icon btn-edit" title="Editar" data-action="edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" title="Desactivar" data-action="delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    },

    escapeHTML(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    normalizarTexto(valor) {
        return String(valor ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    },

    // Todo el texto de una medicina sobre el que busca el listado
    textoBusqueda(m) {
        return this.normalizarTexto([
            m.nombre, m.codigoBarra, m.codigo_externo, m.codigo_interno,
            m.principioActivo, m.concentracion, m.dosis, m.unidadDosis,
            m.presentacion, m.forma_farmaceutica, m.lote, m.proveedor,
            m.seccion, m.familia, m.subfamilia,
            this.getClassificationName('seccion', m.seccion),
            this.getClassificationName('familia', m.familia),
            this.getClassificationName('subfamilia', m.subfamilia),
            m.contraindicaciones, m.efectosSecundarios, m.descripcion
        ].filter(Boolean).join(' '));
    },

    diasParaVencer(fecha) {
        if (!fecha) return null;
        const [y, mes, d] = String(fecha).slice(0, 10).split('-').map(Number);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        return Math.round((new Date(y, mes - 1, d) - hoy) / 86400000);
    },

    getVencimientoBadge(fecha) {
        const dias = this.diasParaVencer(fecha);
        if (dias === null) return '<span class="medicina-sub">Sin vencimiento</span>';
        const texto = formatFecha(fecha);
        if (dias < 0) return `<span class="badge badge-danger">Vencida ${texto}</span>`;
        if (dias <= 90) return `<span class="badge badge-warning">Vence ${texto}</span>`;
        return `<span class="badge badge-info">${texto}</span>`;
    },

    getClassificationName(type, id) {
        if (!id) return 'Sin clasificar';
        const collection = type === 'seccion'
            ? this.state.seccionesDisponibles
            : type === 'familia'
                ? this.state.familiasDisponibles
                : this.state.subfamiliasDisponibles;
        return collection.find(item => item.id === id)?.nombre || id;
    },

    // Get stock badge
    getStockBadge(medicine) {
        const stock = medicine.stock || medicine.cantidad || 0;
        const stockMinimo = medicine.stock_minimo || medicine.cantidadMinima || 0;
        const texto = this.escapeHTML(InventarioMedicinas.texto(stock, InventarioMedicinas.unidadBase(medicine)));
        const desglose = InventarioMedicinas.desglose(stock, medicine);
        const detalle = desglose ? `<br><small class="medicina-sub">${this.escapeHTML(desglose)}</small>` : '';

        if (stock === 0) {
            return '<span class="badge badge-danger">Agotado (0)</span>';
        } else if (stock <= stockMinimo) {
            return `<span class="badge badge-warning">Bajo: ${texto}</span>${detalle}`;
        }
        return `<span class="badge badge-success">${texto}</span>${detalle}`;
    },

    // Verificar si está vencida
    isExpired(fechaVencimiento) {
        const dias = this.diasParaVencer(fechaVencimiento);
        return dias !== null && dias < 0;
    },

    // Ver detalles de medicina: trae la versión más reciente desde la API
    async viewMedicineDetails(id) {
        let medicine = this.state.medicinas.find(m => String(m.id) === String(id));
        const detailsModal = document.getElementById('medicineDetailsModal');
        const detailsContent = document.getElementById('medicineDetailsContent');
        if (!detailsModal || !detailsContent) return;

        if (medicine) this.renderMedicineDetails(medicine);
        else detailsContent.innerHTML = '<p class="form-hint">Cargando información…</p>';
        detailsModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        try {
            const token = authManager.getToken();
            const response = await fetch(`${authManager.apiBaseUrl}/api/medicinas/${encodeURIComponent(id)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error(`Error ${response.status}`);
            const data = await response.json();
            if (!data.medicina) throw new Error('Respuesta sin medicina');

            const [conClasificacion] = this.mergeMedicineClassifications([data.medicina], []);
            medicine = this.normalizarMedicina(conClasificacion);
            // Mantener el listado sincronizado con lo que hay en la base de datos
            this.state.medicinas = this.state.medicinas.map(m => String(m.id) === String(id) ? medicine : m);
            if (detailsModal.style.display !== 'none') this.renderMedicineDetails(medicine);
        } catch (error) {
            console.warn('No se pudo actualizar el detalle desde la API:', error);
            if (!medicine) detailsContent.innerHTML = '<p class="form-hint">No se pudo cargar la medicina.</p>';
        }
    },

    renderMedicineDetails(medicine) {
        const detailsContent = document.getElementById('medicineDetailsContent');
        if (!detailsContent) return;
        const e = valor => this.escapeHTML(valor);
        const dato = (label, valor) => `
            <div class="detail-group">
                <label>${label}</label>
                <p>${valor === undefined || valor === null || valor === '' ? '<span class="medicina-sub">N/A</span>' : valor}</p>
            </div>`;
        const asignaciones = this.state.medicamentosAsignados.filter(a => String(a.medicineId) === String(medicine.id));
        const dias = this.diasParaVencer(medicine.fechaVencimiento);
        const vencimientoTexto = dias === null ? '' : dias < 0
            ? `${formatFecha(medicine.fechaVencimiento)} (vencida hace ${Math.abs(dias)} días)`
            : `${formatFecha(medicine.fechaVencimiento)} (${dias} días)`;

        detailsContent.innerHTML = `
            <div class="details-card">
                <div class="details-header">
                    <div>
                        <h3>${e(medicine.nombre)}</h3>
                        <p class="medicina-sub">${e([medicine.principioActivo, medicine.dosis && `${medicine.dosis} ${medicine.unidadDosis}`, medicine.presentacion].filter(Boolean).join(' · '))}</p>
                    </div>
                    <span class="badge ${medicine.activo ? 'badge-success' : 'badge-inactive'}">
                        ${medicine.activo ? 'ACTIVA' : 'INACTIVA'}
                    </span>
                </div>

                <div class="detail-section">
                    <h4>Identificación</h4>
                    <div class="details-grid">
                        ${dato('Código de barra', e(medicine.codigoBarra))}
                        ${dato('Código externo', e(medicine.codigo_externo))}
                        ${dato('ID en sistema', e(medicine.id))}
                        ${dato('Nombre', e(medicine.nombre))}
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Clasificación</h4>
                    <div class="details-grid">
                        ${dato('Sección', e(this.getClassificationName('seccion', medicine.seccion || 'SEC-001')))}
                        ${dato('Familia', medicine.familia && e(this.getClassificationName('familia', medicine.familia)))}
                        ${dato('Subfamilia', medicine.subfamilia && e(this.getClassificationName('subfamilia', medicine.subfamilia)))}
                        ${dato('Presentación', e(medicine.presentacion || medicine.forma_farmaceutica))}
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Información farmacológica</h4>
                    <div class="details-grid">
                        ${dato('Principio activo', e(medicine.principioActivo))}
                        ${dato('Dosis', e(medicine.dosis))}
                        ${dato('Unidad de dosis', e(medicine.unidadDosis))}
                        ${dato('Concentración', e(medicine.concentracion))}
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Inventario y precio</h4>
                    <div class="details-grid">
                        ${dato('Stock actual', `${this.getStockBadge(medicine)}`)}
                        ${dato('Stock mínimo (alerta)', `${medicine.cantidadMinima} unidades`)}
                        ${dato('Precio unitario', formatQ(medicine.precioUnitario))}
                        ${dato('Valor del inventario', formatQ(medicine.cantidad * medicine.precioUnitario))}
                        ${medicine.precioCosto ? dato('Precio de costo', formatQ(medicine.precioCosto)) : ''}
                        ${dato('Lote', e(medicine.lote))}
                        ${dato('Fecha de vencimiento', vencimientoTexto && `${this.getVencimientoBadge(medicine.fechaVencimiento)}<br><small class="medicina-sub">${vencimientoTexto}</small>`)}
                        ${dato('Proveedor', e(medicine.proveedor))}
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Contraindicaciones</h4>
                    <p>${e(medicine.contraindicaciones) || '<span class="medicina-sub">Sin información</span>'}</p>
                </div>

                <div class="detail-section">
                    <h4>Efectos secundarios</h4>
                    <p>${e(medicine.efectosSecundarios) || '<span class="medicina-sub">Sin información</span>'}</p>
                </div>

                ${medicine.descripcion && medicine.descripcion !== medicine.contraindicaciones ? `
                <div class="detail-section">
                    <h4>Descripción</h4>
                    <p>${e(medicine.descripcion)}</p>
                </div>` : ''}

                <div class="detail-section">
                    <h4>Asignaciones</h4>
                    <p>Asignada a <strong>${asignaciones.length}</strong> paciente(s) en tratamiento</p>
                </div>

                <div class="details-footer">
                    <p class="text-muted">Registrada: ${e(medicine.fechaRegistro)} · Última actualización: ${e(medicine.fechaActualizacion)}</p>
                    <button type="button" class="btn btn-primary btn-small" onclick="MedicinasModule.closeMedicineDetailsModal(); MedicinasModule.editMedicine('${e(medicine.id)}')">
                        <i class="fas fa-edit" aria-hidden="true"></i> Editar medicina
                    </button>
                </div>
            </div>
        `;
    },

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
