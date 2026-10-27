// ============================================
// REQUERIMIENTOS DE COMPRA
// Un almacén (farmacia, cocina…) pide artículos o medicinas con su costo.
// Compras los confirma o rechaza desde el listado y, confirmados, genera la compra.
// El formulario es el mismo de compras en modo requerimiento (ComprasModule.abrirRequerimiento).
// ============================================

const RequerimientosModule = {
    state: {
        requerimientos: [],
        almacenes: [],
        puedeRevisar: false,
        disponible: true,
        estado: '',
        almacen: '',
        busqueda: ''
    },

    ESTADOS: { pendiente: 'Pendiente', confirmada: 'Confirmado', rechazada: 'Rechazado' },
    FORMAS_PAGO: { tarjeta: 'Tarjeta de crédito', efectivo: 'Efectivo', transferencia: 'Transferencia', cheque: 'Cheque' },
    CATEGORIAS: { medicinas: 'Medicinas', descartables: 'Descartables' },

    init() {
        if (this._iniciado) return;
        this._iniciado = true;
        document.getElementById('reqNuevoBtn')?.addEventListener('click', () => this.nuevo());
        document.getElementById('reqBusqueda')?.addEventListener('input', (e) => {
            this.state.busqueda = e.target.value;
            clearTimeout(this._busquedaTimer);
            this._busquedaTimer = setTimeout(() => this.cargar(), 250);
        });
        document.getElementById('reqFiltroEstado')?.addEventListener('change', (e) => {
            this.state.estado = e.target.value;
            this.cargar();
        });
        document.getElementById('reqFiltroAlmacen')?.addEventListener('change', (e) => {
            this.state.almacen = e.target.value;
            this.cargar();
        });
        const lista = document.getElementById('reqLista');
        lista?.addEventListener('change', (e) => {
            const select = e.target.closest('select[data-req-estado]');
            if (select) this.cambiarEstado(select);
        });
        lista?.addEventListener('click', (e) => {
            const boton = e.target.closest('[data-req-accion]');
            if (!boton) return;
            const requerimiento = this.state.requerimientos.find(r => String(r.id) === boton.dataset.id);
            if (!requerimiento) return;
            const acciones = {
                ver: () => this.ver(requerimiento),
                editar: () => this.editar(requerimiento),
                comprar: () => this.generarCompra(requerimiento),
                eliminar: () => this.eliminar(requerimiento)
            };
            acciones[boton.dataset.reqAccion]?.();
        });
    },

    e(valor) {
        return escapeHtml(valor ?? '');
    },

    notificar(mensaje, tipo = 'info') {
        if (typeof showNotification === 'function') showNotification(mensaje, tipo);
        else alert(mensaje);
    },

    async api(path, options = {}) {
        const response = await authManager.fetchWithAuth(`/api/requerimientos-compra${path}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || data.message || `Error ${response.status}`);
        return data;
    },

    async cargar() {
        this.init();
        const contenedor = document.getElementById('reqLista');
        if (!contenedor) return;
        try {
            const params = new URLSearchParams();
            if (this.state.estado) params.set('estado', this.state.estado);
            if (this.state.almacen) params.set('almacen', this.state.almacen);
            if (this.state.busqueda.trim()) params.set('q', this.state.busqueda.trim());
            const data = await this.api(`?${params}`);
            Object.assign(this.state, {
                requerimientos: data.requerimientos || [],
                almacenes: data.almacenes || [],
                puedeRevisar: Boolean(data.puedeRevisar),
                disponible: data.disponible !== false
            });
            this.renderAlmacenes();
            this.render();
        } catch (error) {
            contenedor.innerHTML = `<div class="cot-vacio"><p>No se pudieron cargar los requerimientos.</p><small>${this.e(error.message)}</small></div>`;
        }
    },

    renderAlmacenes() {
        const select = document.getElementById('reqFiltroAlmacen');
        if (!select) return;
        select.innerHTML = '<option value="">Todos</option>' + this.state.almacenes
            .map(a => `<option value="${this.e(a)}" ${a === this.state.almacen ? 'selected' : ''}>${this.e(a)}</option>`).join('');
    },

    esMio(requerimiento) {
        return Number(requerimiento.solicitado_por) === Number(authManager.getUser()?.id);
    },

    editable(requerimiento) {
        return requerimiento.estado === 'pendiente' && (this.state.puedeRevisar || this.esMio(requerimiento));
    },

    selectorEstado(r) {
        const opciones = Object.entries(this.ESTADOS)
            .map(([valor, texto]) => `<option value="${valor}" ${valor === r.estado ? 'selected' : ''}>${texto}</option>`).join('');
        // Con compra generada el estado queda fijo; solo compras confirma o rechaza
        if (!this.state.puedeRevisar || r.compra_id) {
            return `<span class="req-estado req-estado-${this.e(r.estado)}">${this.ESTADOS[r.estado] || this.e(r.estado)}</span>`;
        }
        return `<select class="cuenta-select compras-select req-select-${this.e(r.estado)}" data-req-estado data-id="${r.id}"
                    aria-label="Estado del requerimiento ${this.e(r.numero)}">${opciones}</select>`;
    },

    render() {
        const contenedor = document.getElementById('reqLista');
        if (!this.state.disponible) {
            contenedor.innerHTML = '<div class="cot-vacio"><p>Falta preparar la base de datos para los requerimientos.</p><small>En el servidor: cd backend && npm run migrate:requerimientos</small></div>';
            return;
        }
        const lista = this.state.requerimientos;
        if (!lista.length) {
            const filtrado = this.state.estado || this.state.almacen || this.state.busqueda.trim();
            contenedor.innerHTML = `<div class="cot-vacio"><p>${filtrado ? 'Ningún requerimiento coincide con los filtros.' : 'Aún no hay requerimientos de compra.'}</p>
                ${filtrado ? '' : '<button type="button" class="btn btn-primary" onclick="RequerimientosModule.nuevo()"><i class="fas fa-plus" aria-hidden="true"></i> Nuevo requerimiento</button>'}</div>`;
            return;
        }
        const puedeComprar = Permisos.puede('compras', 'edit');
        contenedor.innerHTML = `
            <table class="data-table req-tabla">
                <thead><tr>
                    <th>Número</th><th>Fecha</th><th>Almacén</th><th>Solicitado por</th>
                    <th class="text-right">Total</th><th>Forma de pago</th><th>Estado</th><th>Compra</th><th class="text-center">Acciones</th>
                </tr></thead>
                <tbody>${lista.map(r => `
                    <tr>
                        <td><strong>${this.e(r.numero)}</strong></td>
                        <td>${formatFecha(r.fecha)}</td>
                        <td>${this.e(r.almacen)}${r.categoria ? `<small class="cot-sub">${this.CATEGORIAS[r.categoria] || this.e(r.categoria)}</small>` : ''}</td>
                        <td>${this.e(r.solicitado_por_nombre || '—')}</td>
                        <td class="text-right"><strong>${formatQ(r.total)}</strong><small class="cot-sub">${r.items.length} artículo${r.items.length === 1 ? '' : 's'}</small></td>
                        <td>${this.FORMAS_PAGO[r.forma_pago] || '<small class="cot-sub">—</small>'}</td>
                        <td>${this.selectorEstado(r)}
                            ${r.estado === 'rechazada' && r.motivo_rechazo ? `<small class="cot-sub" title="${this.e(r.motivo_rechazo)}">${this.e(r.motivo_rechazo)}</small>` : ''}
                            ${r.revisado_por_nombre && r.estado !== 'pendiente' ? `<small class="cot-sub">Por ${this.e(r.revisado_por_nombre)}</small>` : ''}</td>
                        <td>${r.numero_compra
                            ? `<span class="cot-tag">${this.e(r.numero_compra)}</span>`
                            : r.estado === 'confirmada' && puedeComprar
                                ? `<button type="button" class="btn-accion btn-accion-primaria" data-req-accion="comprar" data-id="${r.id}"><i class="fas fa-cart-plus" aria-hidden="true"></i> Generar compra</button>`
                                : '<small class="cot-sub">—</small>'}</td>
                        <td><div class="acciones-saldo">
                            <button type="button" class="btn-accion btn-accion-icono" data-req-accion="ver" data-id="${r.id}" title="Ver" aria-label="Ver requerimiento ${this.e(r.numero)}"><i class="fas fa-eye" aria-hidden="true"></i></button>
                            ${this.editable(r) ? `
                            <button type="button" class="btn-accion btn-accion-icono" data-req-accion="editar" data-id="${r.id}" title="Editar" aria-label="Editar requerimiento ${this.e(r.numero)}"><i class="fas fa-pen" aria-hidden="true"></i></button>
                            <button type="button" class="btn-accion btn-accion-icono btn-accion-peligro" data-req-accion="eliminar" data-id="${r.id}" title="Eliminar" aria-label="Eliminar requerimiento ${this.e(r.numero)}"><i class="fas fa-trash" aria-hidden="true"></i></button>` : ''}
                        </div></td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
    },

    async asegurarCatalogo() {
        // El formulario busca en el catálogo de artículos y medicinas que carga ComprasModule
        ComprasModule.init();
        if (!ComprasModule.state.articulos.length && !ComprasModule.state.medicinas.length) await ComprasModule.loadData();
    },

    async nuevo() {
        await this.asegurarCatalogo();
        ComprasModule.abrirRequerimiento();
    },

    async editar(requerimiento) {
        await this.asegurarCatalogo();
        ComprasModule.abrirRequerimiento(requerimiento);
    },

    async generarCompra(requerimiento) {
        await this.asegurarCatalogo();
        ComprasModule.openPurchaseModal(null, { desdeRequerimiento: requerimiento });
    },

    async cambiarEstado(select) {
        const requerimiento = this.state.requerimientos.find(r => String(r.id) === select.dataset.id);
        if (!requerimiento) return;
        const estado = select.value;
        let motivo = null;
        if (estado === 'rechazada') {
            motivo = prompt(`Motivo del rechazo del requerimiento ${requerimiento.numero}:`);
            if (!motivo || !motivo.trim()) {
                select.value = requerimiento.estado;
                if (motivo !== null) this.notificar('Escribe el motivo del rechazo', 'warning');
                return;
            }
        }
        select.disabled = true;
        try {
            const data = await this.api(`/${requerimiento.id}/estado`, { method: 'PUT', body: JSON.stringify({ estado, motivo }) });
            this.notificar(data.message, 'success');
            if (typeof ComprasModule !== 'undefined' && ComprasModule.state.initialized) ComprasModule.loadData();
        } catch (error) {
            this.notificar(`No se pudo cambiar el estado: ${error.message}`, 'error');
        }
        this.cargar();
    },

    async eliminar(requerimiento) {
        if (!confirm(`¿Eliminar el requerimiento ${requerimiento.numero}? No se puede deshacer.`)) return;
        try {
            const data = await this.api(`/${requerimiento.id}`, { method: 'DELETE' });
            this.notificar(data.message, 'success');
            this.cargar();
        } catch (error) {
            this.notificar(`No se pudo eliminar: ${error.message}`, 'error');
        }
    },

    // Detalle de solo lectura: conceptos, costos y total
    ver(r) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-dialog req-detalle" role="dialog" aria-modal="true" aria-labelledby="reqDetalleTitulo">
                <div class="modal-header">
                    <h2 id="reqDetalleTitulo">Requerimiento ${this.e(r.numero)}</h2>
                    <button type="button" class="close-btn" aria-label="Cerrar">&times;</button>
                </div>
                <div class="modal-body">
                    <dl class="req-datos">
                        <div><dt>Fecha</dt><dd>${formatFecha(r.fecha)}</dd></div>
                        <div><dt>Almacén</dt><dd>${this.e(r.almacen)}${r.categoria ? ` · ${this.CATEGORIAS[r.categoria]}` : ''}</dd></div>
                        <div><dt>Solicitado por</dt><dd>${this.e(r.solicitado_por_nombre || '—')}</dd></div>
                        <div><dt>Forma de pago</dt><dd>${this.FORMAS_PAGO[r.forma_pago] || '—'}</dd></div>
                        <div><dt>Estado</dt><dd>${this.ESTADOS[r.estado]}${r.revisado_por_nombre && r.estado !== 'pendiente' ? ` · ${this.e(r.revisado_por_nombre)}` : ''}${r.numero_compra ? ` · compra ${this.e(r.numero_compra)}` : ''}</dd></div>
                        ${r.motivo_rechazo ? `<div><dt>Motivo del rechazo</dt><dd>${this.e(r.motivo_rechazo)}</dd></div>` : ''}
                    </dl>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead><tr><th>Artículo / medicina</th><th class="text-right">Cantidad</th><th class="text-right">Costo unitario</th><th class="text-right">Total</th></tr></thead>
                            <tbody>${r.items.map(i => `<tr>
                                <td>${this.e(i.concepto_nombre || '—')}${i.presentacion_nombre ? `<small class="cot-sub">${this.e(i.presentacion_nombre)}</small>` : ''}</td>
                                <td class="text-right">${Number(i.cantidad)}</td>
                                <td class="text-right">${formatQ(i.precio_unitario)}</td>
                                <td class="text-right">${formatQ(i.subtotal)}</td></tr>`).join('')}</tbody>
                            <tfoot><tr><th colspan="3" class="text-right">Total</th><th class="text-right">${formatQ(r.total)}</th></tr></tfoot>
                        </table>
                    </div>
                    ${r.observaciones ? `<p class="req-observaciones"><strong>Observaciones:</strong> ${this.e(r.observaciones)}</p>` : ''}
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const cerrar = () => {
            overlay.remove();
            document.removeEventListener('keydown', alTeclear);
        };
        const alTeclear = (e) => { if (e.key === 'Escape') cerrar(); };
        document.addEventListener('keydown', alTeclear);
        overlay.querySelector('.close-btn').addEventListener('click', cerrar);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
        overlay.querySelector('.close-btn').focus();
    }
};

window.RequerimientosModule = RequerimientosModule;
