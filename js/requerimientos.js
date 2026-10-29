// ============================================
// REQUERIMIENTOS DE COMPRA
// Una bodega (farmacia, cocina…) pide artículos o medicinas con su costo.
// Cada bodega lleva su correlativo por año (FAR-0001-2026); compras administra las bodegas.
// Compras los confirma o rechaza desde el listado y, confirmados, genera la compra.
// El formulario es el mismo de compras en modo requerimiento (ComprasModule.abrirRequerimiento).
// ============================================

const RequerimientosModule = {
    state: {
        requerimientos: [],
        bodegas: [],
        puedeRevisar: false,
        disponible: true,
        estado: '',
        bodega: '',
        busqueda: ''
    },

    ESTADOS: { pendiente: 'Pendiente', confirmada: 'Confirmado', rechazada: 'Rechazado' },
    CATEGORIAS: { medicinas: 'Medicinas', descartables: 'Descartables' },

    init() {
        if (this._iniciado) return;
        this._iniciado = true;
        document.getElementById('reqNuevoBtn')?.addEventListener('click', () => this.nuevo());
        document.getElementById('reqBodegasBtn')?.addEventListener('click', () => this.administrarBodegas());
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
            this.state.bodega = e.target.value;
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
                facturas: () => this.verFacturas(requerimiento),
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
            if (this.state.bodega) params.set('bodega_id', this.state.bodega);
            if (this.state.busqueda.trim()) params.set('q', this.state.busqueda.trim());
            const [data, bodegas] = await Promise.all([
                this.api(`?${params}`),
                authManager.fetchWithAuth('/api/bodegas').then(r => r.json()).catch(() => ({ bodegas: [] }))
            ]);
            Object.assign(this.state, {
                requerimientos: data.requerimientos || [],
                bodegas: bodegas.bodegas || [],
                puedeRevisar: Boolean(data.puedeRevisar),
                disponible: data.disponible !== false
            });
            this.renderBodegas();
            document.getElementById('reqBodegasBtn').hidden = !Permisos.puede('compras', 'edit');
            this.render();
        } catch (error) {
            contenedor.innerHTML = `<div class="cot-vacio"><p>No se pudieron cargar los requerimientos.</p><small>${this.e(error.message)}</small></div>`;
        }
    },

    renderBodegas() {
        const select = document.getElementById('reqFiltroAlmacen');
        if (!select) return;
        select.innerHTML = '<option value="">Todas</option>' + this.state.bodegas
            .map(b => `<option value="${b.id}" ${String(b.id) === String(this.state.bodega) ? 'selected' : ''}>${this.e(b.nombre)}</option>`).join('');
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
        if (!this.state.puedeRevisar || this.comprasActivas(r).length) {
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
            const filtrado = this.state.estado || this.state.bodega || this.state.busqueda.trim();
            contenedor.innerHTML = `<div class="cot-vacio"><p>${filtrado ? 'Ningún requerimiento coincide con los filtros.' : 'Aún no hay requerimientos de compra.'}</p>
                ${filtrado ? '' : '<button type="button" class="btn btn-primary" onclick="RequerimientosModule.nuevo()"><i class="fas fa-plus" aria-hidden="true"></i> Nuevo requerimiento</button>'}</div>`;
            return;
        }
        const puedeComprar = Permisos.puede('compras', 'edit');
        // Un requerimiento es el pedido: los costos y la forma de pago se ponen en la compra
        contenedor.innerHTML = `
            <table class="data-table req-tabla">
                <thead><tr>
                    <th>Número</th><th>Fecha</th><th>Bodega</th><th>Solicitado por</th>
                    <th class="text-right">Artículos</th><th>Estado</th><th>Compra</th><th class="text-center">Acciones</th>
                </tr></thead>
                <tbody>${lista.map(r => `
                    <tr>
                        <td><strong>${this.e(r.numero)}</strong></td>
                        <td>${formatFecha(r.fecha)}</td>
                        <td>${this.e(r.almacen)}${r.categoria ? `<small class="cot-sub">${this.CATEGORIAS[r.categoria] || this.e(r.categoria)}</small>` : ''}</td>
                        <td>${this.e(r.solicitado_por_nombre || '—')}</td>
                        <td class="text-right">${r.items.length}</td>
                        <td>${this.selectorEstado(r)}
                            ${r.estado === 'rechazada' && r.motivo_rechazo ? `<small class="cot-sub" title="${this.e(r.motivo_rechazo)}">${this.e(r.motivo_rechazo)}</small>` : ''}
                            ${r.revisado_por_nombre && r.estado !== 'pendiente' ? `<small class="cot-sub">Por ${this.e(r.revisado_por_nombre)}</small>` : ''}</td>
                        <td class="req-compras">${this.celdaCompras(r, puedeComprar)}</td>
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

    // Cada compra lleva los conceptos elegidos; los demás quedan para otra compra (otro proveedor)
    async generarCompra(requerimiento) {
        await this.asegurarCatalogo();
        const renglones = await ComprasModule.elegirConceptos(requerimiento);
        if (renglones) ComprasModule.openPurchaseModal(null, { desdeRequerimiento: requerimiento, renglones });
    },

    // Abre Gestión de Compras filtrada por las facturas que salen de este requerimiento
    async verFacturas(requerimiento) {
        ComprasModule.state.filtroRequerimiento = ComprasModule.clave(requerimiento.numero);
        navigateToPage('compras');
        if (!ComprasModule.state.compras.length) await ComprasModule.loadData();
    },

    // Compras que siguen en pie (las canceladas liberan sus conceptos)
    comprasActivas(r) {
        return (r.compras || []).filter(c => c.estado !== 'cancelada');
    },

    pendientes(r) {
        return r.items.filter(item => !item.compra).length;
    },

    celdaCompras(r, puedeComprar) {
        // Con acceso a compras, cada número lleva a las facturas de este requerimiento
        const verCompras = Permisos.puede('compras', 'view');
        const etiquetas = (r.compras || []).map(c => {
            const titulo = this.e(`${c.proveedor}${c.numero_factura ? ` · factura ${c.numero_factura}` : ''}${c.estado === 'cancelada' ? ' · cancelada' : ''}`);
            const clase = `cot-tag${c.estado === 'cancelada' ? ' req-compra-cancelada' : ''}`;
            const texto = this.e(c.numero_factura || c.numero_compra);
            return verCompras
                ? `<button type="button" class="${clase} req-compra-enlace" data-req-accion="facturas" data-id="${r.id}" title="${titulo} · ver en Gestión de Compras">${texto}</button>`
                : `<span class="${clase}" title="${titulo}">${texto}</span>`;
        }).join(' ');
        const pendientes = this.pendientes(r);
        const parcial = this.comprasActivas(r).length && pendientes
            ? `<small class="cot-sub" title="${pendientes} de ${r.items.length} conceptos aún no están en una compra">Faltan ${pendientes} de ${r.items.length}</small>` : '';
        const boton = r.estado === 'confirmada' && puedeComprar && pendientes
            ? `<button type="button" class="btn-accion btn-accion-primaria" data-req-accion="comprar" data-id="${r.id}"><i class="fas fa-cart-plus" aria-hidden="true"></i> ${this.comprasActivas(r).length ? 'Otra compra' : 'Generar compra'}</button>` : '';
        return etiquetas || parcial || boton ? `${etiquetas}${parcial}${boton}` : '<small class="cot-sub">—</small>';
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

    // ---------- Bodegas (solo compras) ----------
    async administrarBodegas() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-dialog req-bodegas" role="dialog" aria-modal="true" aria-labelledby="reqBodegasTitulo">
                <div class="modal-header">
                    <h2 id="reqBodegasTitulo">Bodegas</h2>
                    <button type="button" class="close-btn" aria-label="Cerrar">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="form-hint">Cada bodega lleva su propio correlativo por año en requerimientos y compras, encabezado por su código (FAR-0001-2026). El código no se cambia después de crearla.</p>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead><tr><th>Nombre</th><th>Código</th><th>Activa</th><th></th></tr></thead>
                            <tbody data-bodegas></tbody>
                        </table>
                    </div>
                    <form class="req-bodega-nueva" novalidate>
                        <div class="form-group">
                            <label for="reqBodegaNombre">Nueva bodega</label>
                            <input id="reqBodegaNombre" class="form-input" maxlength="60" placeholder="Ej.: Lavandería" required>
                        </div>
                        <div class="form-group">
                            <label for="reqBodegaCodigo">Código</label>
                            <input id="reqBodegaCodigo" class="form-input" maxlength="6" placeholder="LAV" autocomplete="off" required>
                        </div>
                        <button type="submit" class="btn btn-primary"><i class="fas fa-plus" aria-hidden="true"></i> Agregar</button>
                    </form>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const cuerpo = overlay.querySelector('[data-bodegas]');
        const render = () => {
            cuerpo.innerHTML = this.state.bodegas.map(b => `<tr>
                <td><input class="form-input" value="${this.e(b.nombre)}" maxlength="60" data-bodega-nombre="${b.id}" aria-label="Nombre de la bodega ${this.e(b.codigo)}"></td>
                <td><strong>${this.e(b.codigo)}</strong></td>
                <td><input type="checkbox" ${b.activo ? 'checked' : ''} data-bodega-activa="${b.id}" aria-label="Bodega ${this.e(b.nombre)} activa"></td>
                <td><button type="button" class="btn btn-secondary btn-small" data-bodega-guardar="${b.id}">Guardar</button></td>
            </tr>`).join('');
        };
        render();
        const recargar = async () => {
            const data = await authManager.fetchWithAuth('/api/bodegas').then(r => r.json());
            this.state.bodegas = data.bodegas || [];
            if (typeof ComprasModule !== 'undefined') ComprasModule.state.bodegas = this.state.bodegas;
            render();
            this.renderBodegas();
        };
        const pedir = async (url, method, body) => {
            const response = await authManager.fetchWithAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
            return data;
        };
        overlay.addEventListener('click', async (e) => {
            const boton = e.target.closest('[data-bodega-guardar]');
            if (!boton) return;
            const id = boton.dataset.bodegaGuardar;
            try {
                const data = await pedir(`/api/bodegas/${id}`, 'PUT', {
                    nombre: overlay.querySelector(`[data-bodega-nombre="${id}"]`).value,
                    activo: overlay.querySelector(`[data-bodega-activa="${id}"]`).checked
                });
                this.notificar(data.message, 'success');
                await recargar();
            } catch (error) {
                this.notificar(error.message, 'error');
            }
        });
        overlay.querySelector('.req-bodega-nueva').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const data = await pedir('/api/bodegas', 'POST', {
                    nombre: overlay.querySelector('#reqBodegaNombre').value,
                    codigo: overlay.querySelector('#reqBodegaCodigo').value
                });
                this.notificar(data.message, 'success');
                e.target.reset();
                await recargar();
            } catch (error) {
                this.notificar(error.message, 'error');
            }
        });
        const cerrar = () => {
            overlay.remove();
            document.removeEventListener('keydown', alTeclear);
        };
        const alTeclear = (e) => { if (e.key === 'Escape') cerrar(); };
        document.addEventListener('keydown', alTeclear);
        overlay.querySelector('.close-btn').addEventListener('click', cerrar);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
        overlay.querySelector('#reqBodegaNombre').focus();
    },

    // Detalle de solo lectura: conceptos, cantidades y en qué compra va cada uno
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
                        <div><dt>Bodega</dt><dd>${this.e(r.almacen)}${r.categoria ? ` · ${this.CATEGORIAS[r.categoria]}` : ''}</dd></div>
                        <div><dt>Solicitado por</dt><dd>${this.e(r.solicitado_por_nombre || '—')}</dd></div>
                        <div><dt>Estado</dt><dd>${this.ESTADOS[r.estado]}${r.revisado_por_nombre && r.estado !== 'pendiente' ? ` · ${this.e(r.revisado_por_nombre)}` : ''}</dd></div>
                        ${r.motivo_rechazo ? `<div><dt>Motivo del rechazo</dt><dd>${this.e(r.motivo_rechazo)}</dd></div>` : ''}
                        ${(r.compras || []).length ? `<div><dt>Compras</dt><dd>${r.compras.map(c => this.e(`${c.numero_compra} · ${c.proveedor}${c.numero_factura ? ` · factura ${c.numero_factura}` : ''}${c.estado === 'cancelada' ? ' (cancelada)' : ''}`)).join('<br>')}</dd></div>` : ''}
                    </dl>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead><tr><th>Artículo / medicina</th><th class="text-right">Cantidad</th><th>Compra</th></tr></thead>
                            <tbody>${r.items.map(i => `<tr>
                                <td>${this.e(i.concepto_nombre || '—')}${i.presentacion_nombre ? `<small class="cot-sub">${this.e(i.presentacion_nombre)}</small>` : ''}</td>
                                <td class="text-right">${Number(i.cantidad)}</td>
                                <td>${i.compra ? this.e(i.compra) : `<small class="cot-sub">${r.estado === 'confirmada' ? 'Pendiente' : '—'}</small>`}</td></tr>`).join('')}</tbody>
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
