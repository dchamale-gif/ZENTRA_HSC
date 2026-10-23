// ============================================
// MÓDULO DE COMPRAS
// ============================================

const ComprasModule = {
    state: {
        compras: [],
        proveedores: [],
        medicinas: [],
        articulos: [],
        items: [],
        initialized: false
    },

    init() {
        if (this.state.initialized) return;
        this.setupEventListeners();
        this.state.initialized = true;
        this.loadData();
    },

    setupEventListeners() {
        document.getElementById('addPurchaseBtn')?.addEventListener('click', () => this.openPurchaseModal());
        document.getElementById('savePurchaseBtn')?.addEventListener('click', () => this.savePurchase());
    },

    async apiRequest(path, options = {}) {
        const token = authManager.getToken();
        const response = await fetch(`${authManager.apiBaseUrl}${path}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Error ${response.status}`);
        }
        return response.json();
    },

    async loadData() {
        try {
            const [comprasData, proveedoresData, medicinasData, articulosData] = await Promise.all([
                this.apiRequest('/api/compras'),
                this.apiRequest('/api/proveedores'),
                this.apiRequest('/api/medicinas'),
                this.apiRequest('/api/codigos-articulos')
            ]);
            this.state.compras = comprasData.compras || [];
            this.state.proveedores = proveedoresData.proveedores || [];
            this.state.medicinas = (medicinasData.medicinas || []).map(medicina => ({
                ...medicina,
                id: String(medicina.id),
                nombre: medicina.nombre,
                codigo: medicina.codigo_interno || medicina.codigo_externo || medicina.codigo_barra || '',
                precio: Number(medicina.precio_costo ?? medicina.precio ?? 0),
                seccion: medicina.seccion || medicina.categoria || '',
                familia: medicina.familia || '',
                subfamilia: medicina.subfamilia || ''
            }));
            this.state.articulos = (articulosData.articulos || []).map(articulo => ({
                id: String(articulo.id),
                nombre: articulo.nombre_articulo,
                codigo: articulo.codigo || articulo.codigo_barras || articulo.codigo_alternativo || '',
                codigosExactos: [articulo.codigo, articulo.codigo_barras, articulo.codigo_alternativo].filter(Boolean).map(String),
                precio: Number(articulo.precio_costo ?? 0),
                seccion: articulo.categoria || articulo.seccion || '',
                familia: articulo.familia || '',
                subfamilia: articulo.subfamilia || ''
            }));
            this.render();
        } catch (error) {
            console.error('Error cargando compras:', error);
            this.state.compras = [];
            this.render();
            this.notify(`No se pudieron cargar las compras: ${error.message}`, 'error');
        }
    },

    // La llama app.js al entrar a la página
    refreshTable() {
        this.render();
    },

    render() {
        const tbody = document.querySelector('#comprasTable tbody');
        if (!tbody) return;

        if (this.state.compras.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay compras registradas</td></tr>';
            return;
        }

        tbody.innerHTML = this.state.compras.map(compra => `
            <tr>
                <td><strong>${this.escapeHtml(compra.numero_compra)}</strong></td>
                <td>${this.formatDate(compra.fecha)}</td>
                <td>${this.escapeHtml(compra.proveedor_nombre)}</td>
                <td>${formatQ(compra.total || 0)}</td>
                <td><span class="badge badge-${this.escapeHtml(compra.estado)}">${this.capitalize(compra.estado)}</span></td>
                <td class="actions">
                    <button class="btn-icon btn-edit" title="Editar compra" onclick="ComprasModule.editPurchase('${compra.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" title="Eliminar compra" onclick="ComprasModule.deletePurchase('${compra.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    openPurchaseModal(compra = null) {
        const form = document.getElementById('purchaseForm');
        form.reset();
        document.getElementById('purchaseId').value = compra?.id || '';
        document.getElementById('purchaseModalTitle').textContent = compra ? 'Editar Compra' : 'Nueva Compra';
        this.renderProviderOptions(compra?.proveedor_id || '');
        document.getElementById('purchaseDate').value = compra ? this.dateValue(compra.fecha) : this.dateValue(new Date());
        document.getElementById('purchaseDeliveryDate').value = compra?.fecha_entrega ? this.dateValue(compra.fecha_entrega) : '';
        document.getElementById('purchaseStatus').value = compra?.estado || 'pendiente';
        document.getElementById('purchaseObservations').value = compra?.observaciones || '';
        this.state.items = compra?.items?.length
            ? compra.items.map(item => ({
                tipo: item.tipo,
                concepto_id: String(item.concepto_id),
                presentacion_id: item.presentacion_id != null ? String(item.presentacion_id) : '',
                cantidad: Number(item.cantidad),
                precio_unitario: Number(item.precio_unitario),
                filtros: { seccion: '', familia: '', subfamilia: '' }
            }))
            : [{ tipo: 'articulo', concepto_id: '', presentacion_id: '', cantidad: 1, precio_unitario: 0, filtros: { seccion: '', familia: '', subfamilia: '' } }];
        this.renderItems();
        document.getElementById('purchaseModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        this.toggleProviderForm(this.state.proveedores.length === 0);
    },

    renderProviderOptions(selectedId = '') {
        const select = document.getElementById('purchaseProvider');
        select.innerHTML = '<option value="">Selecciona un proveedor</option>' +
            this.state.proveedores.map(proveedor =>
                `<option value="${this.escapeHtml(proveedor.id)}">${this.escapeHtml(proveedor.nombre)}</option>`
            ).join('');
        select.value = String(selectedId);
    },

    toggleProviderForm(forceOpen) {
        const panel = document.getElementById('quickProviderForm');
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : panel.hidden;
        panel.hidden = !shouldOpen;
        if (shouldOpen) document.getElementById('quickProviderName').focus();
    },

    async saveQuickProvider() {
        const nameInput = document.getElementById('quickProviderName');
        const nombre = nameInput.value.trim();
        if (!nombre) {
            this.notify('El nombre del proveedor es requerido.', 'warning');
            nameInput.focus();
            return;
        }

        const button = document.getElementById('saveQuickProviderBtn');
        const payload = {
            nombre,
            razon_social: document.getElementById('quickProviderBusinessName').value.trim() || null,
            nit: document.getElementById('quickProviderNit').value.trim() || null,
            contacto: document.getElementById('quickProviderContact').value.trim() || null,
            email: document.getElementById('quickProviderEmail').value.trim() || null,
            telefono: document.getElementById('quickProviderPhone').value.trim() || null,
            ciudad: document.getElementById('quickProviderCity').value.trim() || null,
            direccion: document.getElementById('quickProviderAddress').value.trim() || null
        };

        button.disabled = true;
        try {
            const data = await this.apiRequest('/api/proveedores', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            this.state.proveedores.push(data.proveedor);
            this.state.proveedores.sort((a, b) => a.nombre.localeCompare(b.nombre));
            this.renderProviderOptions(data.proveedor.id);
            document.querySelectorAll('#quickProviderForm input').forEach(input => { input.value = ''; });
            this.toggleProviderForm(false);
            this.notify('Proveedor creado y seleccionado.', 'success');
        } catch (error) {
            this.notify(error.message, 'error');
        } finally {
            button.disabled = false;
        }
    },

    closePurchaseModal() {
        document.getElementById('purchaseModal').style.display = 'none';
        document.body.style.overflow = 'auto';
        this.state.items = [];
    },

    addItem() {
        this.state.items.push({ tipo: 'articulo', concepto_id: '', presentacion_id: '', cantidad: 1, precio_unitario: 0, filtros: { seccion: '', familia: '', subfamilia: '' } });
        this.renderItems();
    },

    removeItem(index) {
        if (this.state.items.length === 1) return;
        this.state.items.splice(index, 1);
        this.renderItems();
    },

    updateItem(index, field, value) {
        const item = this.state.items[index];
        if (!item) return;

        if (field === 'tipo') {
            item.tipo = value;
            item.concepto_id = '';
            item.presentacion_id = '';
            item.precio_unitario = 0;
            item.filtros = { seccion: '', familia: '', subfamilia: '' };
        } else if (field === 'concepto_id') {
            item.concepto_id = value;
            item.presentacion_id = '';
            const concepto = this.getCatalog(item.tipo).find(entry => entry.id === String(value));
            item.precio_unitario = concepto?.precio || 0;
        } else if (field === 'presentacion_id') {
            item.presentacion_id = String(value || '');
            item.precio_unitario = this.costoPresentacion(item);
        } else {
            item[field] = Number(value);
        }
        this.renderItems();
    },

    // Costo sugerido de una presentación: el último costo por unidad base × su factor
    costoPresentacion(item) {
        const medicina = this.state.medicinas.find(entry => entry.id === String(item.concepto_id));
        const presentacion = InventarioMedicinas.presentacion(medicina, item.presentacion_id);
        return Number(((Number(medicina?.precio_costo) || 0) * presentacion.factor).toFixed(2));
    },

    // Código de barras escaneado (o escrito completo): elige el producto y, en medicinas, la presentación
    aplicarCodigo(index, codigo) {
        const item = this.state.items[index];
        const encontrado = InventarioMedicinas.buscarPorCodigo(this.state.medicinas, codigo);
        if (encontrado) {
            Object.assign(item, { tipo: 'medicina', concepto_id: encontrado.medicina.id, presentacion_id: String(encontrado.presentacion.id) });
            item.precio_unitario = this.costoPresentacion(item);
        } else {
            const limpio = String(codigo || '').trim();
            const articulo = limpio && this.state.articulos.find(a => a.codigosExactos.includes(limpio));
            if (!articulo) return false;
            Object.assign(item, { tipo: 'articulo', concepto_id: articulo.id, presentacion_id: '', precio_unitario: articulo.precio });
        }
        this.renderItems();
        document.querySelector(`#purchaseItemsBody tr:nth-child(${index + 1}) [data-compra-cantidad]`)?.select();
        return true;
    },

    alTeclearConcepto(event, index) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (this.aplicarCodigo(index, event.target.value)) return;
        const resultados = document.querySelectorAll(`#conceptSearchResults-${index} .concept-search-result`);
        if (resultados.length === 1) resultados[0].click();
    },

    // Medicina elegida: presentación comprada y cuántas unidades base suma al recibirse
    htmlPresentacion(item, index) {
        if (item.tipo !== 'medicina' || !item.concepto_id) return '';
        const medicina = this.state.medicinas.find(entry => entry.id === String(item.concepto_id));
        if (!medicina) return '';
        const presentaciones = InventarioMedicinas.presentaciones(medicina);
        const elegida = InventarioMedicinas.presentacion(medicina, item.presentacion_id);
        const total = (Number(item.cantidad) || 0) * elegida.factor;
        return `<div class="inv-presentacion">
            ${presentaciones.length > 1 ? `<label class="sr-only" for="purchasePresentation-${index}">Presentación</label>
            <select id="purchasePresentation-${index}" class="form-input" onchange="ComprasModule.updateItem(${index}, 'presentacion_id', this.value)">
                ${presentaciones.map(p => `<option value="${this.escapeHtml(p.id)}" ${String(p.id) === String(elegida.id) ? 'selected' : ''}>${this.escapeHtml(InventarioMedicinas.nombrePresentacion(medicina, p))}</option>`).join('')}
            </select>` : ''}
            <small>Al recibirse suma ${this.escapeHtml(InventarioMedicinas.texto(total, InventarioMedicinas.unidadBase(medicina)))}</small>
        </div>`;
    },

    getCatalog(tipo) {
        return tipo === 'medicina' ? this.state.medicinas : this.state.articulos;
    },

    getFilterOptions(item, field) {
        const filters = item.filtros || {};
        const catalog = this.getCatalog(item.tipo).filter(concepto =>
            (field === 'seccion' || !filters.seccion || concepto.seccion === filters.seccion) &&
            (field !== 'subfamilia' || !filters.familia || concepto.familia === filters.familia)
        );
        return [...new Set(catalog.map(concepto => concepto[field]).filter(Boolean))]
            .sort((left, right) => left.localeCompare(right));
    },

    toggleConceptFilters(index) {
        const panel = document.getElementById(`purchaseConceptFilters-${index}`);
        if (panel) panel.hidden = !panel.hidden;
    },

    setConceptFilter(index, field, value) {
        const item = this.state.items[index];
        if (!item) return;
        item.filtros ||= { seccion: '', familia: '', subfamilia: '' };
        item.filtros[field] = value;
        if (field === 'seccion') {
            item.filtros.familia = '';
            item.filtros.subfamilia = '';
        } else if (field === 'familia') {
            item.filtros.subfamilia = '';
        }
        this.renderItems();
        document.getElementById(`purchaseConceptFilters-${index}`).hidden = false;
        this.searchConcept(index, document.getElementById(`purchaseConceptSearch-${index}`).value);
    },

    searchConcept(index, term) {
        const item = this.state.items[index];
        const results = document.getElementById(`conceptSearchResults-${index}`);
        if (!item || !results) return;

        const selected = this.getCatalog(item.tipo).find(entry => entry.id === String(item.concepto_id));
        if (!selected || selected.nombre !== term) {
            item.concepto_id = '';
            item.presentacion_id = '';
            item.precio_unitario = 0;
            document.getElementById(`purchaseItemPrice-${index}`).value = 0;
            document.getElementById(`purchaseItemSubtotal-${index}`).textContent = 'Q0.00';
            this.updateCalculatedTotal();
        }
        if (InventarioMedicinas.buscarPorCodigo(this.state.medicinas, term) && this.aplicarCodigo(index, term)) return;

        const normalizedTerm = this.normalizeSearch(term);
        const filters = item.filtros || {};
        const hasFilters = filters.seccion || filters.familia || filters.subfamilia;
        if (normalizedTerm.length < 2 && !hasFilters) {
            results.hidden = true;
            results.innerHTML = '';
            return;
        }

        const matches = this.getCatalog(item.tipo).filter(concepto =>
            (!normalizedTerm || this.normalizeSearch(`${concepto.nombre} ${concepto.codigo}`).includes(normalizedTerm)) &&
            (!filters.seccion || concepto.seccion === filters.seccion) &&
            (!filters.familia || concepto.familia === filters.familia) &&
            (!filters.subfamilia || concepto.subfamilia === filters.subfamilia)
        ).slice(0, 8);

        results.innerHTML = matches.length > 0
            ? matches.map(concepto => `
                <button class="concept-search-result" type="button" data-concept-id="${this.escapeHtml(concepto.id)}"
                    onclick="ComprasModule.selectConcept(${index}, this.dataset.conceptId)">
                    <strong>${this.escapeHtml(concepto.nombre)}</strong>
                    ${concepto.codigo ? `<small>${this.escapeHtml(concepto.codigo)}</small>` : ''}
                </button>
            `).join('')
            : '<div class="concept-search-empty">Sin coincidencias</div>';
        results.hidden = false;
    },

    selectConcept(index, conceptId) {
        const item = this.state.items[index];
        const concepto = this.getCatalog(item.tipo).find(entry => entry.id === String(conceptId));
        if (!concepto) return;
        item.concepto_id = concepto.id;
        item.presentacion_id = '';
        item.precio_unitario = concepto.precio || 0;
        this.renderItems();
    },

    normalizeSearch(value = '') {
        return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    },

    renderItems() {
        const tbody = document.getElementById('purchaseItemsBody');
        tbody.innerHTML = this.state.items.map((item, index) => {
            item.filtros ||= { seccion: '', familia: '', subfamilia: '' };
            const selectedConcept = this.getCatalog(item.tipo).find(concepto =>
                concepto.id === String(item.concepto_id)
            );
            const sections = this.getFilterOptions(item, 'seccion');
            const families = this.getFilterOptions(item, 'familia');
            const subfamilies = this.getFilterOptions(item, 'subfamilia');
            const subtotal = (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0);
            return `
                <tr>
                    <td>
                        <select class="form-input" onchange="ComprasModule.updateItem(${index}, 'tipo', this.value)">
                            <option value="articulo" ${item.tipo === 'articulo' ? 'selected' : ''}>Artículo</option>
                            <option value="medicina" ${item.tipo === 'medicina' ? 'selected' : ''}>Medicina</option>
                        </select>
                    </td>
                    <td>
                        <div class="concept-search">
                            <div class="concept-search-input">
                                <i class="fas fa-search"></i>
                                <input id="purchaseConceptSearch-${index}" class="form-input" type="search" autocomplete="off"
                                    placeholder="Buscar por nombre o código..."
                                    value="${this.escapeHtml(selectedConcept?.nombre || '')}"
                                    oninput="ComprasModule.searchConcept(${index}, this.value)" onkeydown="ComprasModule.alTeclearConcepto(event, ${index})">
                                <button class="concept-filter-toggle" type="button" title="Filtrar conceptos" onclick="ComprasModule.toggleConceptFilters(${index})">
                                    <i class="fas fa-filter"></i>
                                </button>
                            </div>
                            <div id="purchaseConceptFilters-${index}" class="concept-filter-panel" hidden>
                                <select class="form-input" aria-label="Sección" onchange="ComprasModule.setConceptFilter(${index}, 'seccion', this.value)">
                                    <option value="">Todas las secciones</option>
                                    ${sections.map(value => `<option value="${this.escapeHtml(value)}" ${item.filtros.seccion === value ? 'selected' : ''}>${this.escapeHtml(value)}</option>`).join('')}
                                </select>
                                <select class="form-input" aria-label="Familia" onchange="ComprasModule.setConceptFilter(${index}, 'familia', this.value)">
                                    <option value="">Todas las familias</option>
                                    ${families.map(value => `<option value="${this.escapeHtml(value)}" ${item.filtros.familia === value ? 'selected' : ''}>${this.escapeHtml(value)}</option>`).join('')}
                                </select>
                                <select class="form-input" aria-label="Subfamilia" onchange="ComprasModule.setConceptFilter(${index}, 'subfamilia', this.value)">
                                    <option value="">Todas las subfamilias</option>
                                    ${subfamilies.map(value => `<option value="${this.escapeHtml(value)}" ${item.filtros.subfamilia === value ? 'selected' : ''}>${this.escapeHtml(value)}</option>`).join('')}
                                </select>
                            </div>
                            <div id="conceptSearchResults-${index}" class="concept-search-results" hidden></div>
                        </div>
                        ${this.htmlPresentacion(item, index)}
                    </td>
                    <td><input class="form-input" type="number" min="1" step="1" value="${item.cantidad}" data-compra-cantidad onchange="ComprasModule.updateItem(${index}, 'cantidad', this.value)"></td>
                    <td><input id="purchaseItemPrice-${index}" class="form-input" type="number" min="0" step="0.01" value="${item.precio_unitario}" onchange="ComprasModule.updateItem(${index}, 'precio_unitario', this.value)"></td>
                    <td><strong id="purchaseItemSubtotal-${index}">${formatQ(subtotal)}</strong></td>
                    <td>
                        <button class="btn-icon btn-delete" type="button" title="Quitar concepto" onclick="ComprasModule.removeItem(${index})" ${this.state.items.length === 1 ? 'disabled' : ''}>
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('');
        this.updateCalculatedTotal();
    },

    updateCalculatedTotal() {
        document.getElementById('purchaseCalculatedTotal').textContent = `${formatQ(this.calculateTotal())}`;
    },

    calculateTotal() {
        return this.state.items.reduce((total, item) =>
            total + (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0), 0);
    },

    async savePurchase() {
        const id = document.getElementById('purchaseId').value;
        const payload = {
            proveedor_id: document.getElementById('purchaseProvider').value,
            fecha: document.getElementById('purchaseDate').value,
            fecha_entrega: document.getElementById('purchaseDeliveryDate').value || null,
            estado: document.getElementById('purchaseStatus').value,
            observaciones: document.getElementById('purchaseObservations').value.trim() || null,
            items: this.state.items.map(item => ({
                tipo: item.tipo,
                concepto_id: item.concepto_id,
                presentacion_id: item.tipo === 'medicina' && item.presentacion_id ? Number(item.presentacion_id) : null,
                cantidad: Number(item.cantidad),
                precio_unitario: Number(item.precio_unitario)
            }))
        };

        if (!payload.proveedor_id || !payload.fecha || payload.items.some(item =>
            !item.concepto_id || !Number.isInteger(item.cantidad) || item.cantidad <= 0 || item.precio_unitario < 0)) {
            this.notify('Completa el proveedor, la fecha y todos los conceptos de la compra.', 'warning');
            return;
        }

        try {
            await this.apiRequest(id ? `/api/compras/${id}` : '/api/compras', {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(payload)
            });
            this.closePurchaseModal();
            await this.loadData();
            this.notify(id ? 'Compra actualizada correctamente.' : 'Compra registrada correctamente.', 'success');
        } catch (error) {
            console.error('Error guardando compra:', error);
            this.notify(error.message, 'error');
        }
    },

    editPurchase(id) {
        const compra = this.state.compras.find(entry => String(entry.id) === String(id));
        if (compra) this.openPurchaseModal(compra);
    },

    async deletePurchase(id) {
        if (!confirm('¿Eliminar esta compra y todos sus conceptos?')) return;
        try {
            await this.apiRequest(`/api/compras/${id}`, { method: 'DELETE' });
            await this.loadData();
            this.notify('Compra eliminada correctamente.', 'success');
        } catch (error) {
            this.notify(error.message, 'error');
        }
    },

    dateValue(value) {
        const date = value instanceof Date ? value : new Date(value);
        return date.toISOString().slice(0, 10);
    },

    formatDate(value) {
        if (!value) return '-';
        return new Date(value).toLocaleDateString('es-GT', { timeZone: 'UTC' });
    },

    capitalize(value = '') {
        return value.charAt(0).toUpperCase() + value.slice(1);
    },

    escapeHtml(value = '') {
        const element = document.createElement('div');
        element.textContent = String(value ?? '');
        return element.innerHTML;
    },

    notify(message, type) {
        if (window.NotificationsModule?.show) {
            window.NotificationsModule.show(message, type);
        } else {
            alert(message);
        }
    }
};
