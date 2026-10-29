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
        // Pago de la compra (con la migración del pago de compras)
        pagos: false,
        vouchers: [],
        vouchersNuevos: [],
        // El mismo formulario sirve para compras y para requerimientos de compra
        modo: 'compra',
        requerimientoId: null,
        requerimientosDisponible: false,
        requerimientosConfirmados: [], // confirmados sin compra, para "No. de requerimiento"
        bodegas: [],                   // farmacia, cocina…: cada una lleva su correlativo por año
        // Filtros del listado: texto y requerimiento de origen ('' todos, '-' sin requerimiento)
        busqueda: '',
        filtroRequerimiento: '',
        initialized: false
    },

    FORMAS_PAGO: {
        efectivo: { texto: 'Efectivo', referencia: 'No. de recibo' },
        tarjeta: { texto: 'Tarjeta', referencia: 'No. de autorización' },
        cheque: { texto: 'Cheque', referencia: 'No. de cheque' },
        transferencia: { texto: 'Transferencia', referencia: 'No. de transferencia o boleta' }
    },

    ESTADOS: { pendiente: 'Pendiente', ordenada: 'Ordenada', recibida: 'Recibida', cancelada: 'Cancelada' },

    init() {
        if (this.state.initialized) return;
        this.setupEventListeners();
        this.state.initialized = true;
        this.loadData();
    },

    setupEventListeners() {
        document.getElementById('addPurchaseBtn')?.addEventListener('click', () => this.openPurchaseModal());
        document.getElementById('savePurchaseBtn')?.addEventListener('click', () => this.savePurchase());

        // Pago
        document.querySelectorAll('input[name="purchasePaymentTerms"]').forEach(radio =>
            radio.addEventListener('change', () => this.actualizarPago()));
        ['purchaseCreditDays', 'purchaseDate'].forEach(id =>
            document.getElementById(id)?.addEventListener('input', () => this.actualizarPago()));
        document.getElementById('purchasePaymentMethod')?.addEventListener('change', () => this.actualizarPago());
        document.getElementById('purchaseProvider')?.addEventListener('change', (e) => this.llenarCuentaProveedor(e.target.value));
        document.getElementById('purchaseVoucherInput')?.addEventListener('change', (e) => {
            this.agregarVouchers([...e.target.files]);
            e.target.value = '';
        });
        document.getElementById('purchaseVoucherList')?.addEventListener('click', (e) => this.alClicVoucher(e));

        document.getElementById('purchaseReqNumber')?.addEventListener('change', (e) => this.usarRequerimiento(e.target.value));

        document.getElementById('comprasBusqueda')?.addEventListener('input', (e) => {
            this.state.busqueda = e.target.value;
            this.render();
        });
        document.getElementById('comprasFiltroReq')?.addEventListener('change', (e) => {
            this.state.filtroRequerimiento = e.target.value;
            this.render();
        });
        // El número de requerimiento de una fila filtra por él
        document.querySelector('#comprasTable tbody')?.addEventListener('click', (e) => {
            const boton = e.target.closest('[data-filtrar-req]');
            if (boton) this.filtrarPorRequerimiento(boton.dataset.filtrarReq);
            const pagos = e.target.closest('[data-pagos-compra]');
            if (pagos) this.pagosCompra(this.state.compras.find(c => String(c.id) === pagos.dataset.pagosCompra));
        });

        // Estado y pago se cambian desde el listado
        document.querySelector('#comprasTable tbody')?.addEventListener('change', (e) => {
            const select = e.target.closest('select[data-compra]');
            if (!select) return;
            if (select.dataset.campo === 'estado') this.cambiarEstado(select);
            if (select.dataset.campo === 'pago') this.cambiarPago(select);
        });
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

    // Quien solo hace requerimientos (farmacia, cocina) no ve compras ni proveedores
    puedeComprar(accion = 'view') {
        return typeof Permisos === 'undefined' || Permisos.puede('compras', accion);
    },

    async loadData() {
        try {
            const vacio = (clave) => Promise.resolve({ [clave]: [] });
            const [comprasData, proveedoresData, medicinasData, articulosData, requerimientosData, bodegasData] = await Promise.all([
                this.puedeComprar() ? this.apiRequest('/api/compras') : vacio('compras'),
                this.puedeComprar() ? this.apiRequest('/api/proveedores') : vacio('proveedores'),
                this.apiRequest('/api/medicinas'),
                this.apiRequest('/api/codigos-articulos'),
                this.puedeComprar()
                    ? this.apiRequest('/api/requerimientos-compra?confirmados_sin_compra=1').catch(() => ({ requerimientos: [] }))
                    : vacio('requerimientos'),
                this.apiRequest('/api/bodegas').catch(() => ({ bodegas: [] }))
            ]);
            this.state.bodegas = bodegasData.bodegas || [];
            this.state.requerimientosDisponible = Boolean(requerimientosData.disponible);
            this.state.requerimientosConfirmados = requerimientosData.requerimientos || [];
            this.state.compras = comprasData.compras || [];
            this.state.pagos = Boolean(comprasData.pagos);
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
        const columnaPago = document.querySelector('#comprasTable th.compras-col-pago');
        if (columnaPago) columnaPago.hidden = !this.state.pagos;

        this.renderFiltroRequerimientos();
        const columnas = this.state.pagos ? 9 : 8;
        if (this.state.compras.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${columnas}" class="text-center">No hay compras registradas</td></tr>`;
            return;
        }
        const lista = this.comprasFiltradas();
        this.renderResumenFiltro(lista);
        if (lista.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${columnas}" class="text-center">Ninguna compra coincide con los filtros</td></tr>`;
            return;
        }

        tbody.innerHTML = lista.map(compra => `
            <tr>
                <td>${compra.numero_factura ? `<strong>${this.escapeHtml(compra.numero_factura)}</strong>` : '<span class="compras-sin-factura">Sin factura</span>'}
                    <small class="compras-req">Compra ${this.escapeHtml(compra.numero_compra)}${compra.bodega_nombre ? ` · ${this.escapeHtml(compra.bodega_nombre)}` : ''}</small>
                    ${compra.numero_requerimiento ? `<button type="button" class="btn-link compras-req compras-req-filtro" data-filtrar-req="${this.escapeHtml(compra.numero_requerimiento)}"
                        title="Ver todas las facturas de este requerimiento">Req. ${this.escapeHtml(compra.numero_requerimiento)}${compra.fecha_requerimiento ? ` · ${formatFecha(compra.fecha_requerimiento)}` : ''}</button>` : ''}</td>
                <td>${this.formatDate(compra.fecha)}</td>
                <td>${this.escapeHtml(compra.proveedor_nombre)}</td>
                ${this.responsablesHTML(compra)}
                <td>${formatQ(compra.total || 0)}</td>
                <td>${this.selectorEstado(compra)}</td>
                ${this.state.pagos ? `<td class="compras-col-pago">${this.estadoPagoHTML(compra)}</td>` : ''}
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

    // ---------- Filtros del listado ----------
    clave(texto) {
        return String(texto || '').trim().toUpperCase();
    },

    comprasFiltradas() {
        const req = this.state.filtroRequerimiento;
        const texto = this.state.busqueda.trim().toLowerCase();
        return this.state.compras.filter(compra => {
            if (req === '-' && compra.numero_requerimiento) return false;
            if (req && req !== '-' && this.clave(compra.numero_requerimiento) !== req) return false;
            if (!texto) return true;
            return [compra.numero_factura, compra.numero_compra, compra.proveedor_nombre, compra.numero_requerimiento, compra.requisicion_numero]
                .some(valor => String(valor || '').toLowerCase().includes(texto));
        });
    },

    // Un requerimiento por opción, con cuántas facturas (compras) salen de él
    renderFiltroRequerimientos() {
        const select = document.getElementById('comprasFiltroReq');
        if (!select) return;
        const conteo = new Map();
        this.state.compras.forEach(compra => {
            const clave = this.clave(compra.numero_requerimiento);
            if (clave) {
                const previo = conteo.get(clave);
                conteo.set(clave, { numero: previo?.numero || compra.numero_requerimiento.trim(), n: (previo?.n || 0) + 1 });
            }
        });
        const sinReq = this.state.compras.filter(c => !c.numero_requerimiento).length;
        // Si el requerimiento elegido ya no tiene compras, el filtro vuelve a "Todos"
        if (this.state.filtroRequerimiento && this.state.filtroRequerimiento !== '-' && !conteo.has(this.state.filtroRequerimiento)) {
            this.state.filtroRequerimiento = '';
        }
        const plural = (n) => `${n} factura${n === 1 ? '' : 's'}`;
        select.innerHTML = '<option value="">Todos</option>'
            + `<option value="-">Sin requerimiento (${plural(sinReq)})</option>`
            + [...conteo.entries()].sort((a, b) => b[0].localeCompare(a[0]))
                .map(([clave, r]) => `<option value="${this.escapeHtml(clave)}">${this.escapeHtml(r.numero)} (${plural(r.n)})</option>`).join('');
        select.value = this.state.filtroRequerimiento;
    },

    // Con un requerimiento elegido: cuántas facturas, su total y lo que aún falta comprar de él
    renderResumenFiltro(lista) {
        const resumen = document.getElementById('comprasFiltroResumen');
        if (!resumen) return;
        const req = this.state.filtroRequerimiento;
        if (!req || req === '-') {
            resumen.hidden = true;
            return;
        }
        const activas = lista.filter(c => c.estado !== 'cancelada');
        const total = activas.reduce((s, c) => s + Number(c.total || 0), 0);
        const numero = lista[0]?.numero_requerimiento || req;
        resumen.innerHTML = `Requerimiento <strong>${this.escapeHtml(numero)}</strong>: ${lista.length} factura${lista.length === 1 ? '' : 's'}
            · total ${formatQ(total)}${activas.length < lista.length ? ' (sin las canceladas)' : ''}
            <button type="button" class="btn-link" onclick="ComprasModule.filtrarPorRequerimiento('')">Quitar filtro</button>`;
        resumen.hidden = false;
    },

    filtrarPorRequerimiento(numero) {
        this.state.filtroRequerimiento = this.clave(numero);
        this.render();
        document.getElementById('comprasFiltroReq')?.focus();
    },

    // Solicitó: quien hizo el requerimiento del sistema o, sin él, quien registró la compra.
    // Confirmó: quien confirmó ese requerimiento.
    responsablesHTML(compra) {
        const solicito = compra.solicitado_por_nombre || compra.registrado_por_nombre;
        const nota = compra.solicitado_por_nombre ? '' : '<small class="compras-req">Registró la compra</small>';
        return `<td>${solicito ? `${this.escapeHtml(solicito)}${nota}` : '—'}</td>
                <td>${compra.confirmado_por_nombre ? this.escapeHtml(compra.confirmado_por_nombre)
                    : '<span title="Solo las compras que salen de un requerimiento del sistema tienen quién lo confirmó">—</span>'}</td>`;
    },

    // ---------- Pago ----------
    hoy() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.REGION.timeZone }).format(new Date());
    },

    selectorEstado(compra) {
        return `<select class="cuenta-select compras-select compras-estado-${this.escapeHtml(compra.estado)}" data-compra="${this.escapeHtml(compra.id)}" data-campo="estado"
                    data-anterior="${this.escapeHtml(compra.estado)}" aria-label="Estado de la compra ${this.escapeHtml(compra.numero_compra)}">
                ${Object.entries(this.ESTADOS).map(([valor, texto]) => `<option value="${valor}" ${valor === compra.estado ? 'selected' : ''}>${texto}</option>`).join('')}
            </select>`;
    },

    // Pago en el listado: un selector Pendiente / Pagada con el detalle debajo
    // (crédito por vencer o vencido, o la fecha y forma en que se pagó)
    estadoPagoHTML(compra) {
        const forma = this.FORMAS_PAGO[compra.forma_pago]?.texto;
        const vouchers = compra.vouchers?.length
            ? ` <i class="fas fa-paperclip" title="${compra.vouchers.length} voucher(s)" aria-label="${compra.vouchers.length} voucher(s)"></i>` : '';
        if (compra.estado === 'cancelada' && !compra.fecha_pago) return '<small>—</small>';
        // En una requisición (no anulada) el pago lo registra la requisición
        if (compra.requisicion_numero && compra.requisicion_estado !== 'anulada') {
            const pagada = Boolean(compra.fecha_pago);
            return `<span class="compras-pago-requisicion ${pagada ? 'pagada' : 'pendiente'}"
                    title="El pago se registra en la requisición ${this.escapeHtml(compra.requisicion_numero)}">${pagada ? 'Pagada' : 'Pendiente'}</span>
                <small>${pagada ? `${formatFecha(compra.fecha_pago)}${forma ? ` · ${this.escapeHtml(forma)}` : ''} · ` : ''}Requisición ${this.escapeHtml(compra.requisicion_numero)}${vouchers}</small>`;
        }
        let clase = 'pendiente';
        let pendiente = 'Pendiente';
        let detalle = vouchers;
        if (compra.fecha_pago) {
            clase = 'pagada';
            detalle = `${formatFecha(compra.fecha_pago)}${forma ? ` · ${this.escapeHtml(forma)}` : ''}${vouchers}`;
        } else if (compra.condicion_pago === 'credito') {
            const vencida = compra.fecha_vencimiento_pago && compra.fecha_vencimiento_pago < this.hoy();
            clase = vencida ? 'vencida' : 'credito';
            pendiente = vencida ? 'Crédito vencido' : `Crédito ${compra.dias_credito} días`;
            detalle = `Vence ${formatFecha(compra.fecha_vencimiento_pago)}${vouchers}`;
        }
        // Con abonos: un botón que abre los pagos (pago parcial con su saldo)
        if (Array.isArray(compra.abonos)) {
            const parcial = !compra.fecha_pago && compra.abonos.length > 0;
            if (parcial) {
                clase = 'parcial';
                pendiente = 'Pago parcial';
                detalle = `${Abonos.resumenTexto(compra.total, compra.abonos)}${vouchers}`;
            }
            if (compra.fecha_pago && compra.abonos.length > 1) detalle += ` · ${compra.abonos.length} abonos`;
            return `<button type="button" class="compras-pago-boton compras-pago-${clase}" data-pagos-compra="${this.escapeHtml(compra.id)}"
                        title="Ver o registrar los pagos" aria-label="Pagos de la compra ${this.escapeHtml(compra.numero_compra)}">
                    ${compra.fecha_pago ? 'Pagada' : pendiente} <i class="fas fa-chevron-right" aria-hidden="true"></i></button>${detalle ? `<small>${detalle}</small>` : ''}`;
        }
        return `<select class="cuenta-select compras-select compras-pago-${clase}" data-compra="${this.escapeHtml(compra.id)}" data-campo="pago"
                    aria-label="Pago de la compra ${this.escapeHtml(compra.numero_compra)}">
                <option value="pendiente" ${compra.fecha_pago ? '' : 'selected'}>${pendiente}</option>
                <option value="pagada" ${compra.fecha_pago ? 'selected' : ''}>Pagada</option>
            </select>${detalle ? `<small>${detalle}</small>` : ''}`;
    },

    // Abonos del pago de una compra suelta (la referencia va en vez de los números del banco)
    pagosCompra(compra) {
        if (!compra) return;
        const nombre = compra.numero_factura ? `factura ${compra.numero_factura}` : `compra ${compra.numero_compra}`;
        Abonos.dialogo({
            titulo: `Pagos de la ${this.escapeHtml(nombre)}`,
            subtitulo: `${this.escapeHtml(compra.proveedor_nombre)} · compra ${this.escapeHtml(compra.numero_compra)}`,
            total: compra.total,
            abonos: compra.abonos || [],
            puedeEditar: this.puedeComprar('edit') && compra.estado !== 'cancelada',
            exigirBanco: false,
            registrar: (datos) => this.apiRequest(`/api/compras/${encodeURIComponent(compra.id)}/abonos`, { method: 'POST', body: JSON.stringify(datos) }),
            eliminar: (abono) => this.apiRequest(`/api/compras/abonos/${abono.id}`, { method: 'DELETE' }),
            subirVoucher: (abonoId, archivo) => Abonos.subirVoucher(`/api/compras/${encodeURIComponent(compra.id)}/vouchers`, abonoId, archivo),
            verVoucher: (id, nombre) => this.verVoucher({ id, nombre }),
            alTerminar: () => this.loadData()
        });
    },

    async cambiarEstado(select) {
        const compra = this.state.compras.find(c => String(c.id) === select.dataset.compra);
        const estado = select.value;
        if (!compra) return;
        if (compra.estado === 'recibida' && !confirm(`La compra ${compra.numero_compra} dejará de estar recibida: lo que sumó al inventario se restará. ¿Continuar?`)) {
            select.value = compra.estado;
            return;
        }
        select.disabled = true;
        try {
            const data = await this.apiRequest(`/api/compras/${encodeURIComponent(compra.id)}/estado`, {
                method: 'PUT',
                body: JSON.stringify({ estado })
            });
            compra.estado = estado;
            this.notify(estado === 'recibida' ? `${compra.numero_compra} recibida: sus conceptos se sumaron al inventario` : data.message, 'success');
        } catch (error) {
            this.notify(`No se pudo cambiar el estado: ${error.message}`, 'error');
        }
        this.render();
    },

    cambiarPago(select) {
        const compra = this.state.compras.find(c => String(c.id) === select.dataset.compra);
        if (!compra) return;
        if (select.value === 'pagada') {
            this.dialogoPago(compra);
            return;
        }
        if (!confirm(`¿Marcar el pago de ${compra.numero_compra} como pendiente? Se borra la fecha de pago.`)) {
            select.value = 'pagada';
            return;
        }
        this.guardarPagoListado(compra, { pagada: false });
    },

    async guardarPagoListado(compra, datos) {
        try {
            const data = await this.apiRequest(`/api/compras/${encodeURIComponent(compra.id)}/pago`, {
                method: 'PUT',
                body: JSON.stringify(datos)
            });
            if (datos.pagada) {
                Object.assign(compra, { fecha_pago: datos.fecha_pago, forma_pago: datos.forma_pago });
                if (datos.referencia_pago) compra.referencia_pago = datos.referencia_pago;
            } else {
                compra.fecha_pago = null;
            }
            this.notify(data.message, 'success');
            return true;
        } catch (error) {
            this.notify(`No se pudo guardar el pago: ${error.message}`, 'error');
            throw error;
        } finally {
            this.render();
        }
    },

    // Fecha, forma y referencia del pago al marcar una compra como pagada desde el listado
    dialogoPago(compra) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        const forma = compra.forma_pago || 'efectivo';
        overlay.innerHTML = `
            <div class="modal-dialog inv-dialogo" role="dialog" aria-modal="true" aria-labelledby="compraPagoTitulo">
                <div class="modal-header">
                    <h2 id="compraPagoTitulo">Pago de ${this.escapeHtml(compra.numero_compra)} · ${formatQ(compra.total || 0)}</h2>
                    <button type="button" class="close-btn" aria-label="Cerrar">&times;</button>
                </div>
                <form class="modal-body" novalidate>
                    <div class="form-group">
                        <label for="compraPagoFecha">Fecha de pago <span class="required">*</span></label>
                        <input type="date" id="compraPagoFecha" class="form-input" required max="${this.hoy()}" value="${this.hoy()}">
                    </div>
                    <div class="form-group">
                        <label for="compraPagoForma">Forma de pago <span class="required">*</span></label>
                        <select id="compraPagoForma" class="form-input">
                            ${Object.entries(this.FORMAS_PAGO).map(([valor, f]) => `<option value="${valor}" ${valor === forma ? 'selected' : ''}>${f.texto}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="compraPagoReferencia" id="compraPagoReferenciaEtiqueta">${this.FORMAS_PAGO[forma].referencia}</label>
                        <input type="text" id="compraPagoReferencia" class="form-input" maxlength="60" value="${this.escapeHtml(compra.referencia_pago || '')}" autocomplete="off">
                    </div>
                    <div class="form-group">
                        <div class="compra-pago-subtitulo">Voucher de pago (opcional)</div>
                        <ul class="compra-vouchers" data-vouchers></ul>
                        <label class="btn btn-secondary btn-small" for="compraPagoVoucher">
                            <i class="fas fa-paperclip" aria-hidden="true"></i> Adjuntar voucher
                        </label>
                        <input type="file" id="compraPagoVoucher" accept="application/pdf,image/jpeg,image/png,image/webp" multiple hidden>
                        <small class="form-hint">PDF, JPG, PNG o WEBP de hasta 10 MB.</small>
                    </div>
                    <div class="inv-dialogo-acciones">
                        <button type="button" class="btn btn-secondary" data-cerrar>Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="fas fa-check" aria-hidden="true"></i> Marcar como pagada</button>
                    </div>
                </form>
            </div>`;
        document.body.appendChild(overlay);
        const cerrar = () => {
            overlay.remove();
            document.removeEventListener('keydown', alTeclear);
            this.render(); // el selector vuelve a su valor si no se guardó
        };
        const alTeclear = (e) => { if (e.key === 'Escape') cerrar(); };
        document.addEventListener('keydown', alTeclear);
        overlay.querySelector('.close-btn').addEventListener('click', cerrar);
        overlay.querySelector('[data-cerrar]').addEventListener('click', cerrar);
        overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });
        overlay.querySelector('#compraPagoForma').addEventListener('change', e => {
            overlay.querySelector('#compraPagoReferenciaEtiqueta').textContent = this.FORMAS_PAGO[e.target.value].referencia;
        });
        const archivos = [];
        const listaVouchers = overlay.querySelector('[data-vouchers]');
        const renderArchivos = () => {
            listaVouchers.innerHTML = archivos.map((archivo, i) => `
                <li>
                    <span>${this.escapeHtml(archivo.name)}</span>
                    <small>${this.tamano(archivo.size)}</small>
                    <button type="button" class="btn-icon btn-delete" data-quitar="${i}" title="Quitar" aria-label="Quitar ${this.escapeHtml(archivo.name)}"><i class="fas fa-times"></i></button>
                </li>`).join('');
        };
        overlay.querySelector('#compraPagoVoucher').addEventListener('change', e => {
            archivos.push(...this.vouchersValidos([...e.target.files]));
            e.target.value = '';
            renderArchivos();
        });
        listaVouchers.addEventListener('click', e => {
            const quitar = e.target.closest('[data-quitar]');
            if (!quitar) return;
            archivos.splice(Number(quitar.dataset.quitar), 1);
            renderArchivos();
        });
        const form = overlay.querySelector('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fecha = form.querySelector('#compraPagoFecha').value;
            if (!fecha) {
                this.notify('Indique la fecha de pago', 'warning');
                return;
            }
            const boton = form.querySelector('button[type="submit"]');
            boton.disabled = true;
            try {
                await this.guardarPagoListado(compra, {
                    pagada: true,
                    fecha_pago: fecha,
                    forma_pago: form.querySelector('#compraPagoForma').value,
                    referencia_pago: form.querySelector('#compraPagoReferencia').value.trim()
                });
                // El pago ya quedó guardado: si un voucher falla solo se avisa
                const fallidos = archivos.length ? await this.subirVouchers(compra.id, archivos) : [];
                if (fallidos.length) this.notify(`No se subieron estos vouchers: ${fallidos.join(', ')}`, 'warning');
                cerrar();
            } catch (error) {
                boton.disabled = false;
            }
        });
        setTimeout(() => overlay.querySelector('#compraPagoFecha').focus(), 0);
    },

    condicionPago() {
        return document.querySelector('input[name="purchasePaymentTerms"]:checked')?.value || 'contado';
    },

    // Muestra los días de crédito y su vencimiento, y la referencia según la forma de pago
    actualizarPago() {
        const credito = this.condicionPago() === 'credito';
        document.getElementById('purchaseCreditDaysGroup').hidden = !credito;
        const dias = Number(document.getElementById('purchaseCreditDays').value);
        const fecha = document.getElementById('purchaseDate').value;
        const hint = document.getElementById('purchaseDueHint');
        if (credito && fecha && Number.isInteger(dias) && dias > 0) {
            const vence = new Date(`${fecha}T00:00:00`);
            vence.setDate(vence.getDate() + dias);
            hint.textContent = `Vence el ${formatFecha(vence)}`;
        } else {
            hint.textContent = '';
        }
        const forma = this.FORMAS_PAGO[document.getElementById('purchasePaymentMethod').value];
        document.getElementById('purchasePaymentRefGroup').hidden = !forma;
        if (forma) document.getElementById('purchasePaymentRefLabel').textContent = forma.referencia;
    },

    cuentaProveedor() {
        return {
            banco: document.getElementById('purchaseProviderBank').value.trim(),
            numero_cuenta: document.getElementById('purchaseProviderAccount').value.trim(),
            tipo_cuenta: document.getElementById('purchaseProviderAccountType').value
        };
    },

    llenarCuentaProveedor(proveedorId) {
        const proveedor = this.state.proveedores.find(p => String(p.id) === String(proveedorId));
        document.getElementById('purchaseProviderBank').value = proveedor?.banco || '';
        document.getElementById('purchaseProviderAccount').value = proveedor?.numero_cuenta || '';
        document.getElementById('purchaseProviderAccountType').value = proveedor?.tipo_cuenta || '';
    },

    prepararPago(compra) {
        const seccion = document.getElementById('purchasePaymentSection');
        seccion.hidden = !this.state.pagos;
        this.state.vouchers = [...(compra?.vouchers || [])];
        this.state.vouchersNuevos = [];
        if (!this.state.pagos) return;
        const condicion = compra?.condicion_pago || 'contado';
        document.querySelector(`input[name="purchasePaymentTerms"][value="${condicion}"]`).checked = true;
        document.getElementById('purchaseCreditDays').value = compra?.dias_credito || '';
        document.getElementById('purchasePaymentMethod').value = compra?.forma_pago || '';
        document.getElementById('purchasePaymentRef').value = compra?.referencia_pago || '';
        document.getElementById('purchasePaymentDate').value = compra?.fecha_pago || '';
        // Con abonos, los pagos se registran desde el listado (botón Pago)
        const conAbonos = (compra?.abonos || []).length > 0;
        document.getElementById('purchasePaymentDate').disabled = conAbonos;
        document.getElementById('purchasePaymentDateHint').textContent = conAbonos
            ? `Tiene ${compra.abonos.length} abono${compra.abonos.length === 1 ? '' : 's'}: los pagos se registran desde el listado, en la columna Pago.`
            : 'Déjela vacía mientras no se haya pagado. Para pagar en partes, use la columna Pago del listado.';
        this.llenarCuentaProveedor(compra?.proveedor_id || '');
        this.renderVouchers();
        this.actualizarPago();
    },

    leerPago() {
        if (!this.state.pagos) return {};
        const condicion = this.condicionPago();
        return {
            condicion_pago: condicion,
            dias_credito: condicion === 'credito' ? Number(document.getElementById('purchaseCreditDays').value) : null,
            forma_pago: document.getElementById('purchasePaymentMethod').value || null,
            referencia_pago: document.getElementById('purchasePaymentRef').value.trim() || null,
            fecha_pago: document.getElementById('purchasePaymentDate').value || null
        };
    },

    // Devuelve un mensaje si el pago está incompleto
    validarPago(pago) {
        if (!this.state.pagos) return '';
        if (pago.condicion_pago === 'credito' && !(Number.isInteger(pago.dias_credito) && pago.dias_credito >= 1 && pago.dias_credito <= 365)) {
            return 'Indica los días de crédito (de 1 a 365).';
        }
        if (pago.fecha_pago && !pago.forma_pago) return 'Indica la forma de pago.';
        if (this.state.vouchersNuevos.length && !pago.fecha_pago) return 'Indica la fecha del pago del voucher adjunto.';
        return '';
    },

    renderVouchers() {
        const lista = document.getElementById('purchaseVoucherList');
        const icono = tipo => tipo === 'application/pdf' ? 'fa-file-pdf' : 'fa-file-image';
        const existentes = this.state.vouchers.map(v => `
            <li>
                <i class="fas ${icono(v.tipo_contenido)}" aria-hidden="true"></i>
                <button type="button" class="btn-link" data-ver-voucher="${v.id}">${this.escapeHtml(v.nombre)}</button>
                <small>${this.tamano(v.tamano)}${v.subido_por ? ` · ${this.escapeHtml(v.subido_por)}` : ''}</small>
                <button type="button" class="btn-icon btn-delete" data-quitar-voucher="${v.id}" title="Eliminar voucher" aria-label="Eliminar ${this.escapeHtml(v.nombre)}"><i class="fas fa-trash"></i></button>
            </li>`);
        const nuevos = this.state.vouchersNuevos.map((archivo, i) => `
            <li class="nuevo">
                <i class="fas ${icono(archivo.type)}" aria-hidden="true"></i>
                <span>${this.escapeHtml(archivo.name)}</span>
                <small>${this.tamano(archivo.size)} · se sube al guardar</small>
                <button type="button" class="btn-icon btn-delete" data-quitar-nuevo="${i}" title="Quitar" aria-label="Quitar ${this.escapeHtml(archivo.name)}"><i class="fas fa-times"></i></button>
            </li>`);
        lista.innerHTML = [...existentes, ...nuevos].join('') || '<li class="vacio">Sin voucher adjunto.</li>';
    },

    tamano(bytes) {
        return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
    },

    // Deja solo los PDF o imágenes de hasta 10 MB y avisa de los demás
    vouchersValidos(archivos) {
        return archivos.filter(archivo => {
            if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(archivo.type)) {
                this.notify(`"${archivo.name}" no es PDF, JPG, PNG o WEBP.`, 'warning');
                return false;
            }
            if (archivo.size > 10 * 1024 * 1024) {
                this.notify(`"${archivo.name}" pesa más de 10 MB.`, 'warning');
                return false;
            }
            return true;
        });
    },

    agregarVouchers(archivos) {
        this.state.vouchersNuevos.push(...this.vouchersValidos(archivos));
        // Con voucher, la fecha del pago parte de hoy
        const fechaPago = document.getElementById('purchasePaymentDate');
        if (this.state.vouchersNuevos.length && !fechaPago.value) fechaPago.value = this.hoy();
        this.renderVouchers();
    },

    async alClicVoucher(e) {
        const ver = e.target.closest('[data-ver-voucher]');
        const quitar = e.target.closest('[data-quitar-voucher]');
        const quitarNuevo = e.target.closest('[data-quitar-nuevo]');
        if (ver) {
            this.verVoucher(this.state.vouchers.find(v => String(v.id) === ver.dataset.verVoucher));
        } else if (quitarNuevo) {
            this.state.vouchersNuevos.splice(Number(quitarNuevo.dataset.quitarNuevo), 1);
            this.renderVouchers();
        } else if (quitar) {
            const voucher = this.state.vouchers.find(v => String(v.id) === quitar.dataset.quitarVoucher);
            if (!voucher || !confirm(`¿Eliminar el voucher "${voucher.nombre}"? No se puede deshacer.`)) return;
            try {
                await this.apiRequest(`/api/compras/vouchers/${voucher.id}`, { method: 'DELETE' });
                this.state.vouchers = this.state.vouchers.filter(v => v !== voucher);
                const compra = this.state.compras.find(c => c.vouchers?.includes(voucher));
                if (compra) compra.vouchers = compra.vouchers.filter(v => v !== voucher);
                this.renderVouchers();
                this.render();
                this.notify('Voucher eliminado.', 'success');
            } catch (error) {
                this.notify(error.message, 'error');
            }
        }
    },

    // Abre el voucher en una pestaña nueva (se pide con el token, por eso no es un enlace directo)
    async verVoucher(voucher) {
        if (!voucher) return;
        const ventana = window.open('', '_blank');
        try {
            const response = await fetch(`${authManager.apiBaseUrl}/api/compras/vouchers/${voucher.id}`, {
                headers: { Authorization: `Bearer ${authManager.getToken()}` }
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || `Error ${response.status}`);
            }
            const url = URL.createObjectURL(await response.blob());
            if (ventana) {
                ventana.location.href = url;
            } else {
                // Si el navegador bloqueó la pestaña, se descarga
                const enlace = document.createElement('a');
                enlace.href = url;
                enlace.download = voucher.nombre || 'voucher';
                enlace.click();
            }
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {
            ventana?.close();
            this.notify(`No se pudo abrir el voucher: ${error.message}`, 'error');
        }
    },

    // Sube los vouchers pendientes; devuelve los nombres de los que no se pudieron subir
    async subirVouchers(compraId, archivos = this.state.vouchersNuevos) {
        const fallidos = [];
        const compra = this.state.compras.find(c => String(c.id) === String(compraId));
        for (const archivo of archivos) {
            try {
                const response = await fetch(`${authManager.apiBaseUrl}/api/compras/${encodeURIComponent(compraId)}/vouchers?nombre=${encodeURIComponent(archivo.name)}`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${authManager.getToken()}`, 'Content-Type': archivo.type },
                    body: archivo
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
                if (compra && data.voucher) compra.vouchers = [...(compra.vouchers || []), data.voucher];
            } catch (error) {
                fallidos.push(`${archivo.name} (${error.message})`);
            }
        }
        if (archivos === this.state.vouchersNuevos) this.state.vouchersNuevos = [];
        return fallidos;
    },

    // Si cambió la cuenta del proveedor, se guarda en el proveedor
    async guardarCuentaProveedor(proveedorId) {
        if (!this.state.pagos) return;
        const proveedor = this.state.proveedores.find(p => String(p.id) === String(proveedorId));
        if (!proveedor) return;
        const cuenta = this.cuentaProveedor();
        const cambio = ['banco', 'numero_cuenta', 'tipo_cuenta'].some(campo => (proveedor[campo] || '') !== cuenta[campo]);
        if (!cambio) return;
        const data = await this.apiRequest(`/api/proveedores/${encodeURIComponent(proveedorId)}`, {
            method: 'PUT',
            body: JSON.stringify({ banco: cuenta.banco || null, numero_cuenta: cuenta.numero_cuenta || null, tipo_cuenta: cuenta.tipo_cuenta || null })
        });
        Object.assign(proveedor, data.proveedor);
    },

    // Pone el formulario en modo compra o requerimiento (cada modo oculta los campos del otro)
    prepararModo(modo, titulo, boton) {
        this.state.modo = modo;
        document.getElementById('purchaseModal').dataset.modo = modo;
        // Quien solo pide (bodegas) elige conceptos y cantidades: los costos y la forma de pago son de compras
        document.getElementById('purchaseModal').toggleAttribute('data-sin-precios', modo === 'requerimiento' && !this.puedeComprar('edit'));
        document.getElementById('purchaseModalTitle').textContent = titulo;
        document.getElementById('savePurchaseBtnText').textContent = boton;
        // Requisición y factura llegan con la migración de requerimientos: sin ella se ven, pero bloqueadas y con el aviso
        const listo = this.state.requerimientosDisponible;
        const aviso = 'Falta preparar la base de datos: en el servidor, cd backend && npm run migrate:requerimientos';
        ['purchaseReqNumber', 'purchaseReqDate', 'purchaseInvoiceNumber'].forEach(id => {
            document.getElementById(id).disabled = !listo;
        });
        document.getElementById('purchaseReqHint').textContent = listo ? 'Un requerimiento confirmado del sistema carga los conceptos que elija.' : aviso;
        document.getElementById('purchaseInvoiceHint').textContent = listo ? '' : aviso;
    },

    // desdeRequerimiento: compra nueva con la forma de pago de un requerimiento confirmado y los
    // conceptos elegidos de él (renglones); el resto queda pendiente para otra compra
    openPurchaseModal(compra = null, { desdeRequerimiento = null, renglones = null } = {}) {
        const form = document.getElementById('purchaseForm');
        form.reset();
        document.getElementById('purchaseId').value = compra?.id || '';
        this.prepararModo('compra', compra ? 'Editar Compra' : 'Nueva Compra', 'Guardar Compra');
        this.renderRequerimientosConfirmados(compra?.numero_requerimiento);
        document.getElementById('purchaseReqNumber').value = compra?.numero_requerimiento || '';
        document.getElementById('purchaseReqDate').value = compra?.fecha_requerimiento || '';
        document.getElementById('purchaseInvoiceNumber').value = compra?.numero_factura || '';
        // La bodega va en el número de la compra: se elige al crearla y ya no cambia
        this.renderBodegas(compra?.bodega_id, Boolean(compra?.bodega_id),
            compra?.bodega_id ? 'El número de la compra lleva el código de su bodega; no se cambia.' : 'Cada bodega lleva su propio correlativo por año.');
        this.renderProviderOptions(compra?.proveedor_id || '');
        document.getElementById('purchaseDate').value = compra ? this.dateValue(compra.fecha) : this.hoy();
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
                requerimiento_item_id: item.requerimiento_item_id || null,
                filtros: { seccion: '', familia: '', subfamilia: '' }
            }))
            : [{ tipo: 'articulo', concepto_id: '', presentacion_id: '', cantidad: 1, precio_unitario: 0, filtros: { seccion: '', familia: '', subfamilia: '' } }];
        this.renderItems();
        this.prepararPago(compra);
        if (desdeRequerimiento) this.cargarRequerimiento(desdeRequerimiento, renglones);
        document.getElementById('purchaseModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        this.toggleProviderForm(this.state.proveedores.length === 0);
    },

    // Formulario en modo requerimiento: almacén, forma de pago y conceptos con su costo
    abrirRequerimiento(requerimiento = null) {
        const form = document.getElementById('purchaseForm');
        form.reset();
        this.state.requerimientoId = requerimiento?.id || null;
        this.prepararModo('requerimiento',
            requerimiento ? `Requerimiento ${requerimiento.numero}` : 'Nuevo requerimiento de compra',
            requerimiento ? 'Guardar requerimiento' : 'Enviar requerimiento');
        document.getElementById('purchaseDate').value = requerimiento?.fecha || this.hoy();
        this.renderBodegas(requerimiento?.bodega_id, Boolean(requerimiento),
            requerimiento ? 'El número lleva el código de su bodega; para otra bodega haga un requerimiento nuevo.' : '');
        document.getElementById('reqFormaPago').value = requerimiento?.forma_pago || '';
        document.getElementById('purchaseObservations').value = requerimiento?.observaciones || '';
        this.state.items = this.itemsDeRequerimiento(requerimiento);
        this.renderItems();
        document.getElementById('purchaseModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById(requerimiento ? 'purchaseConceptSearch-0' : 'purchaseBodega')?.focus(), 50);
    },

    bodega(id) {
        return this.state.bodegas.find(b => String(b.id) === String(id)) || null;
    },

    // Bodegas activas (y la del documento aunque ya esté desactivada); bloqueada al editar
    renderBodegas(seleccionada = '', bloqueada = false, ayuda = '') {
        const select = document.getElementById('purchaseBodega');
        if (!select) return;
        const grupo = select.closest('.form-group');
        grupo.hidden = this.state.bodegas.length === 0;
        const opciones = this.state.bodegas.filter(b => b.activo || String(b.id) === String(seleccionada));
        select.innerHTML = '<option value="">Selecciona una bodega</option>' + opciones
            .map(b => `<option value="${b.id}">${this.escapeHtml(b.nombre)} (${this.escapeHtml(b.codigo)})</option>`).join('');
        select.value = seleccionada ? String(seleccionada) : '';
        select.disabled = bloqueada;
        document.getElementById('purchaseBodegaHint').textContent = ayuda;
    },

    itemsDeRequerimiento(requerimiento) {
        const items = (requerimiento?.items || []).map(item => ({
            tipo: item.tipo,
            concepto_id: String(item.concepto_id),
            presentacion_id: item.presentacion_id != null ? String(item.presentacion_id) : '',
            cantidad: Number(item.cantidad),
            precio_unitario: Number(item.precio_unitario),
            requerimiento_item_id: item.id || null,
            filtros: { seccion: '', familia: '', subfamilia: '' }
        }));
        return items.length ? items : [{ tipo: 'articulo', concepto_id: '', presentacion_id: '', cantidad: 1, precio_unitario: 0, filtros: { seccion: '', familia: '', subfamilia: '' } }];
    },

    renderRequerimientosConfirmados(actual = '') {
        const lista = document.getElementById('purchaseReqList');
        if (!lista) return;
        lista.innerHTML = this.state.requerimientosConfirmados
            .filter(r => r.numero !== actual)
            .map(r => `<option value="${this.escapeHtml(r.numero)}">${this.escapeHtml(`${r.almacen} · ${formatFecha(r.fecha)} · ${formatQ(r.total)}`)}</option>`)
            .join('');
    },

    // Un requerimiento se reparte entre proveedores: se eligen los conceptos que van en esta compra.
    // Devuelve los renglones elegidos, o null si se cancela o ya no queda nada por comprar.
    elegirConceptos(requerimiento) {
        const pendientes = requerimiento.items.filter(item => !item.compra);
        if (!pendientes.length) {
            this.notify(`Todos los conceptos del requerimiento ${requerimiento.numero} ya están en una compra.`, 'warning');
            return Promise.resolve(null);
        }
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal-dialog req-detalle" role="dialog" aria-modal="true" aria-labelledby="reqElegirTitulo">
                    <div class="modal-header">
                        <h2 id="reqElegirTitulo">Compra del requerimiento ${this.escapeHtml(requerimiento.numero)}</h2>
                        <button type="button" class="close-btn" aria-label="Cerrar">&times;</button>
                    </div>
                    <form class="modal-body" novalidate>
                        <p class="form-hint">Marque los conceptos que van a este proveedor. Los demás quedan pendientes en el requerimiento para otra compra.</p>
                        <div class="table-responsive">
                            <table class="data-table req-elegir">
                                <thead><tr>
                                    <th><input type="checkbox" data-todos checked aria-label="Marcar todos los pendientes"></th>
                                    <th>Artículo / medicina</th><th class="text-right">Cantidad</th><th class="text-right">Costo</th><th class="text-right">Total</th>
                                </tr></thead>
                                <tbody>${requerimiento.items.map((item, i) => `
                                    <tr class="${item.compra ? 'req-comprado' : ''}">
                                        <td>${item.compra ? '' : `<input type="checkbox" data-renglon="${i}" checked aria-label="Incluir ${this.escapeHtml(item.concepto_nombre || '')}">`}</td>
                                        <td>${this.escapeHtml(item.concepto_nombre || '—')}${item.presentacion_nombre ? `<small class="cot-sub">${this.escapeHtml(item.presentacion_nombre)}</small>` : ''}
                                            ${item.compra ? `<small class="cot-sub">Ya va en la compra ${this.escapeHtml(item.compra)}</small>` : ''}</td>
                                        <td class="text-right">${Number(item.cantidad)}</td>
                                        <td class="text-right">${formatQ(item.precio_unitario)}</td>
                                        <td class="text-right">${formatQ(item.subtotal)}</td>
                                    </tr>`).join('')}</tbody>
                                <tfoot><tr><th colspan="4" class="text-right">Total de esta compra</th><th class="text-right" data-total></th></tr></tfoot>
                            </table>
                        </div>
                        <div class="inv-dialogo-acciones">
                            <button type="button" class="btn btn-secondary" data-cerrar>Cancelar</button>
                            <button type="submit" class="btn btn-primary"><i class="fas fa-cart-plus" aria-hidden="true"></i> <span data-boton></span></button>
                        </div>
                    </form>
                </div>`;
            document.body.appendChild(overlay);
            const casillas = [...overlay.querySelectorAll('[data-renglon]')];
            const elegidos = () => casillas.filter(c => c.checked).map(c => requerimiento.items[Number(c.dataset.renglon)]);
            const actualizar = () => {
                const lista = elegidos();
                overlay.querySelector('[data-total]').textContent = formatQ(lista.reduce((s, item) => s + Number(item.subtotal), 0));
                overlay.querySelector('[data-boton]').textContent = `Continuar con ${lista.length} concepto${lista.length === 1 ? '' : 's'}`;
                overlay.querySelector('button[type="submit"]').disabled = !lista.length;
                const todos = overlay.querySelector('[data-todos]');
                todos.checked = lista.length === casillas.length;
                todos.indeterminate = lista.length > 0 && lista.length < casillas.length;
            };
            const cerrar = (resultado) => {
                overlay.remove();
                document.removeEventListener('keydown', alTeclear);
                resolve(resultado);
            };
            const alTeclear = (e) => { if (e.key === 'Escape') cerrar(null); };
            document.addEventListener('keydown', alTeclear);
            overlay.querySelector('.close-btn').addEventListener('click', () => cerrar(null));
            overlay.querySelector('[data-cerrar]').addEventListener('click', () => cerrar(null));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(null); });
            overlay.querySelector('[data-todos]').addEventListener('change', (e) => {
                casillas.forEach(c => { c.checked = e.target.checked; });
                actualizar();
            });
            casillas.forEach(c => c.addEventListener('change', actualizar));
            overlay.querySelector('form').addEventListener('submit', (e) => {
                e.preventDefault();
                if (elegidos().length) cerrar(elegidos());
            });
            actualizar();
            setTimeout(() => overlay.querySelector('button[type="submit"]').focus(), 0);
        });
    },

    // Llena la compra con un requerimiento confirmado: número, fecha, los conceptos elegidos y forma de pago
    cargarRequerimiento(requerimiento, renglones = null) {
        document.getElementById('purchaseReqNumber').value = requerimiento.numero;
        document.getElementById('purchaseReqDate').value = requerimiento.fecha;
        // La compra sale de la misma bodega del requerimiento
        if (requerimiento.bodega_id && !document.getElementById('purchaseId').value) {
            this.renderBodegas(requerimiento.bodega_id, true, `Bodega del requerimiento ${requerimiento.numero}.`);
        }
        this.state.items = this.itemsDeRequerimiento({ items: renglones || requerimiento.items.filter(item => !item.compra) });
        this.renderItems();
        if (requerimiento.forma_pago) {
            document.getElementById('purchasePaymentMethod').value = requerimiento.forma_pago;
            this.actualizarPago();
        }
        const obs = document.getElementById('purchaseObservations');
        if (!obs.value.trim()) {
            obs.value = [`Requerimiento ${requerimiento.numero} · ${requerimiento.almacen}`, requerimiento.categoria, requerimiento.observaciones]
                .filter(Boolean).join(' · ');
        }
    },

    // Número escrito en la compra: si es un requerimiento confirmado del sistema, trae sus datos
    async usarRequerimiento(numero) {
        const requerimiento = this.state.requerimientosConfirmados.find(r => r.numero.toUpperCase() === String(numero).trim().toUpperCase());
        if (!requerimiento) return;
        document.getElementById('purchaseReqDate').value = requerimiento.fecha;
        const hayConceptos = this.state.items.some(item => item.concepto_id);
        if (hayConceptos && !confirm(`¿Reemplazar los conceptos de la compra por los del requerimiento ${requerimiento.numero}?`)) return;
        const renglones = await this.elegirConceptos(requerimiento);
        if (renglones) this.cargarRequerimiento(requerimiento, renglones);
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
            direccion: document.getElementById('quickProviderAddress').value.trim() || null,
            banco: document.getElementById('quickProviderBank').value.trim() || null,
            numero_cuenta: document.getElementById('quickProviderAccount').value.trim() || null,
            tipo_cuenta: document.getElementById('quickProviderAccountType').value || null
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
            this.llenarCuentaProveedor(data.proveedor.id);
            document.querySelectorAll('#quickProviderForm input, #quickProviderForm select').forEach(input => { input.value = ''; });
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
        this.state.vouchersNuevos = [];
        this.state.requerimientoId = null;
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
                    <td data-precio><input id="purchaseItemPrice-${index}" class="form-input" type="number" min="0" step="0.01" value="${item.precio_unitario}" onchange="ComprasModule.updateItem(${index}, 'precio_unitario', this.value)"></td>
                    <td data-precio><strong id="purchaseItemSubtotal-${index}">${formatQ(subtotal)}</strong></td>
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

    leerConceptos() {
        return this.state.items.map(item => ({
            tipo: item.tipo,
            concepto_id: item.concepto_id,
            presentacion_id: item.tipo === 'medicina' && item.presentacion_id ? Number(item.presentacion_id) : null,
            cantidad: Number(item.cantidad),
            precio_unitario: Number(item.precio_unitario),
            requerimiento_item_id: item.requerimiento_item_id || null
        }));
    },

    conceptosIncompletos(items) {
        return items.some(item => !item.concepto_id || !Number.isInteger(item.cantidad) || item.cantidad <= 0 || item.precio_unitario < 0);
    },

    async guardarRequerimiento() {
        const payload = {
            fecha: document.getElementById('purchaseDate').value,
            bodega_id: Number(document.getElementById('purchaseBodega').value) || null,
            forma_pago: document.getElementById('reqFormaPago').value || null,
            observaciones: document.getElementById('purchaseObservations').value.trim() || null,
            items: this.leerConceptos()
        };
        if (!payload.bodega_id || !payload.fecha || this.conceptosIncompletos(payload.items)) {
            this.notify(this.puedeComprar('edit')
                ? 'Completa la bodega, la fecha y todos los artículos con su cantidad y costo.'
                : 'Completa la bodega, la fecha y todos los artículos con su cantidad.', 'warning');
            return;
        }
        const boton = document.getElementById('savePurchaseBtn');
        boton.disabled = true;
        try {
            const id = this.state.requerimientoId;
            const data = await this.apiRequest(id ? `/api/requerimientos-compra/${id}` : '/api/requerimientos-compra', {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(payload)
            });
            this.closePurchaseModal();
            this.notify(data.message, 'success');
            if (typeof RequerimientosModule !== 'undefined') RequerimientosModule.cargar();
        } catch (error) {
            this.notify(error.message, 'error');
        } finally {
            boton.disabled = false;
        }
    },

    async savePurchase() {
        if (this.state.modo === 'requerimiento') return this.guardarRequerimiento();
        const id = document.getElementById('purchaseId').value;
        const payload = {
            proveedor_id: document.getElementById('purchaseProvider').value,
            fecha: document.getElementById('purchaseDate').value,
            fecha_entrega: document.getElementById('purchaseDeliveryDate').value || null,
            estado: document.getElementById('purchaseStatus').value,
            observaciones: document.getElementById('purchaseObservations').value.trim() || null,
            ...this.leerPago(),
            bodega_id: Number(document.getElementById('purchaseBodega').value) || null,
            numero_requerimiento: document.getElementById('purchaseReqNumber').value.trim() || null,
            fecha_requerimiento: document.getElementById('purchaseReqDate').value || null,
            numero_factura: document.getElementById('purchaseInvoiceNumber').value.trim() || null,
            items: this.leerConceptos()
        };

        if (this.state.bodegas.length && !id && !payload.bodega_id) {
            this.notify('Elige la bodega de la compra: cada bodega lleva su propio correlativo.', 'warning');
            return;
        }
        if (!payload.proveedor_id || !payload.fecha || this.conceptosIncompletos(payload.items)) {
            this.notify('Completa el proveedor, la fecha y todos los conceptos de la compra.', 'warning');
            return;
        }
        const errorPago = this.validarPago(payload);
        if (errorPago) {
            this.notify(errorPago, 'warning');
            return;
        }

        const boton = document.getElementById('savePurchaseBtn');
        boton.disabled = true;
        try {
            const data = await this.apiRequest(id ? `/api/compras/${id}` : '/api/compras', {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(payload)
            });
            const compraId = id || data.compra?.id;
            // La compra ya quedó guardada: la cuenta del proveedor y los vouchers se avisan aparte si fallan
            const avisos = [];
            try {
                await this.guardarCuentaProveedor(payload.proveedor_id);
            } catch (error) {
                avisos.push(`No se guardó la cuenta del proveedor: ${error.message}`);
            }
            const fallidos = compraId ? await this.subirVouchers(compraId) : [];
            if (fallidos.length) avisos.push(`No se subieron estos vouchers: ${fallidos.join(', ')}`);
            this.closePurchaseModal();
            await this.loadData();
            if (payload.numero_requerimiento && typeof RequerimientosModule !== 'undefined') RequerimientosModule.cargar();
            this.notify(id ? 'Compra actualizada correctamente.' : 'Compra registrada correctamente.', 'success');
            avisos.forEach(aviso => this.notify(aviso, 'warning'));
        } catch (error) {
            console.error('Error guardando compra:', error);
            this.notify(error.message, 'error');
        } finally {
            boton.disabled = false;
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
        } else if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            alert(message);
        }
    }
};
