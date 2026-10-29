// ============================================
// REQUISICIONES A PROVEEDORES
// Junta las facturas (compras) de un proveedor de un mes en un solo documento que se
// paga de una vez: al pagarla, todas sus facturas quedan pagadas. Se guarda en la
// base de datos (/api/requisiciones). No confundir con los requerimientos de compra.
// ============================================

const RequisicionesModule = {
    state: {
        requisiciones: [],
        proveedores: [],
        disponible: true,
        estado: '',
        proveedor: '',
        busqueda: ''
    },

    ESTADOS: { pendiente: 'Por pagar', parcial: 'Pago parcial', pagada: 'Pagada', anulada: 'Anulada' },
    FORMAS_PAGO: { efectivo: 'Efectivo', tarjeta: 'Tarjeta de crédito', transferencia: 'Transferencia', cheque: 'Cheque' },

    init() {
        if (this._iniciado) return;
        this._iniciado = true;
        document.getElementById('rqsNuevaBtn')?.addEventListener('click', () => this.formulario());
        document.getElementById('rqsBusqueda')?.addEventListener('input', (e) => {
            this.state.busqueda = e.target.value;
            clearTimeout(this._timer);
            this._timer = setTimeout(() => this.cargar(), 250);
        });
        document.getElementById('rqsFiltroEstado')?.addEventListener('change', (e) => {
            this.state.estado = e.target.value;
            this.cargar();
        });
        document.getElementById('rqsFiltroProveedor')?.addEventListener('change', (e) => {
            this.state.proveedor = e.target.value;
            this.cargar();
        });
        document.getElementById('rqsLista')?.addEventListener('click', (e) => {
            const voucher = e.target.closest('[data-rqs-voucher]');
            if (voucher) {
                this.verVoucher(voucher.dataset.rqsVoucher, voucher.dataset.nombre);
                return;
            }
            const boton = e.target.closest('[data-rqs-accion]');
            const requisicion = boton && this.state.requisiciones.find(r => String(r.id) === boton.dataset.id);
            if (!requisicion) return;
            const acciones = {
                ver: () => this.ver(requisicion),
                editar: () => this.formulario(requisicion),
                pagar: () => this.pagos(requisicion),
                quitarPago: () => this.quitarPago(requisicion),
                anular: () => this.anular(requisicion),
                eliminar: () => this.eliminar(requisicion)
            };
            acciones[boton.dataset.rqsAccion]?.();
        });
    },

    e(valor) {
        return escapeHtml(valor ?? '');
    },

    notificar(mensaje, tipo = 'info') {
        if (typeof showNotification === 'function') showNotification(mensaje, tipo);
        else alert(mensaje);
    },

    puedeEditar() {
        return typeof Permisos === 'undefined' || Permisos.puede('compras', 'edit');
    },

    hoy() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.REGION.timeZone }).format(new Date());
    },

    // "2026-10" -> "octubre de 2026"
    textoMes(periodo) {
        if (!periodo) return '—';
        const texto = new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric' }).format(new Date(`${periodo}-01T12:00:00`));
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    },

    nombreFactura(f) {
        return f.numero_factura || `Compra ${f.numero_compra}`;
    },

    async api(path = '', options = {}) {
        const response = await authManager.fetchWithAuth(`/api/requisiciones${path}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || data.message || `Error ${response.status}`);
        return data;
    },

    async cargarProveedores() {
        if (this.state.proveedores.length) return;
        const response = await authManager.fetchWithAuth('/api/proveedores');
        const data = await response.json().catch(() => ({}));
        this.state.proveedores = (data.proveedores || []).sort((a, b) => a.nombre.localeCompare(b.nombre));
        const select = document.getElementById('rqsFiltroProveedor');
        if (select) {
            select.innerHTML = '<option value="">Todos</option>' + this.state.proveedores
                .map(p => `<option value="${this.e(p.id)}">${this.e(p.nombre)}</option>`).join('');
            select.value = this.state.proveedor;
        }
    },

    async cargar() {
        this.init();
        const contenedor = document.getElementById('rqsLista');
        if (!contenedor) return;
        document.getElementById('rqsNuevaBtn').hidden = !this.puedeEditar();
        try {
            await this.cargarProveedores().catch(() => {});
            const params = new URLSearchParams();
            if (this.state.estado) params.set('estado', this.state.estado);
            if (this.state.proveedor) params.set('proveedor_id', this.state.proveedor);
            if (this.state.busqueda.trim()) params.set('q', this.state.busqueda.trim());
            const data = await this.api(`?${params}`);
            this.state.requisiciones = data.requisiciones || [];
            this.state.disponible = data.disponible !== false;
            this.render();
        } catch (error) {
            contenedor.innerHTML = `<div class="cot-vacio"><p>No se pudieron cargar las requisiciones.</p><small>${this.e(error.message)}</small></div>`;
        }
    },

    renderResumen() {
        const caja = document.getElementById('rqsResumen');
        if (!caja) return;
        const porPagar = this.state.requisiciones.filter(r => ['pendiente', 'parcial'].includes(r.estado));
        const total = porPagar.reduce((s, r) => s + Abonos.saldo(r.total, r.abonos), 0);
        caja.innerHTML = porPagar.length
            ? `<strong>${porPagar.length} requisición${porPagar.length === 1 ? '' : 'es'} por pagar · ${formatQ(total)}</strong>`
            : '<span>No hay requisiciones por pagar.</span>';
        caja.hidden = !this.state.disponible;
    },

    detallePago(r) {
        const partes = [formatFecha(r.fecha_pago), this.FORMAS_PAGO[r.forma_pago] || ''];
        if (r.numero_pago_banco) partes.push(`Banco ${this.e(r.numero_pago_banco)}`);
        if (r.numero_autorizacion) partes.push(`Aut. ${this.e(r.numero_autorizacion)}`);
        const vouchers = (r.vouchers || []).map(v => `
            <button type="button" class="btn-link gasto-voucher" data-rqs-voucher="${v.id}" data-nombre="${this.e(v.nombre)}"
                    title="Ver ${this.e(v.nombre)}"><i class="fas fa-paperclip" aria-hidden="true"></i> ${this.e(v.nombre)}</button>`).join('');
        const varios = (r.abonos || []).length > 1 ? `<small class="cot-sub">En ${r.abonos.length} abonos</small>` : '';
        return `<small class="cot-sub">${partes.filter(Boolean).join(' · ')}</small>${varios}
            ${r.pagado_por_nombre ? `<small class="cot-sub">Por ${this.e(r.pagado_por_nombre)}</small>` : ''}${vouchers}`;
    },

    render() {
        this.renderResumen();
        const contenedor = document.getElementById('rqsLista');
        if (!this.state.disponible) {
            contenedor.innerHTML = '<div class="cot-vacio"><p>Falta preparar la base de datos para las requisiciones.</p><small>En el servidor: cd backend && npm run migrate:requisiciones</small></div>';
            return;
        }
        const lista = this.state.requisiciones;
        if (!lista.length) {
            const filtrado = this.state.estado || this.state.proveedor || this.state.busqueda.trim();
            contenedor.innerHTML = `<div class="cot-vacio"><p>${filtrado ? 'Ninguna requisición coincide con los filtros.' : 'Aún no hay requisiciones.'}</p>
                ${filtrado || !this.puedeEditar() ? '' : '<button type="button" class="btn btn-primary" onclick="RequisicionesModule.formulario()"><i class="fas fa-plus" aria-hidden="true"></i> Nueva requisición</button>'}</div>`;
            return;
        }
        const editar = this.puedeEditar();
        const boton = (accion, r, icono, titulo, clase = '') => `<button type="button" class="btn-accion btn-accion-icono ${clase}"
            data-rqs-accion="${accion}" data-id="${r.id}" title="${titulo}" aria-label="${titulo} ${this.e(r.numero)}"><i class="fas ${icono}" aria-hidden="true"></i></button>`;
        contenedor.innerHTML = `
            <table class="data-table rqs-tabla">
                <thead><tr>
                    <th>Número</th><th>Mes</th><th>Proveedor</th><th>Facturas</th><th class="text-right">Total</th>
                    <th>Estado</th><th class="text-center">Acciones</th>
                </tr></thead>
                <tbody>${lista.map(r => `
                    <tr>
                        <td><strong>${this.e(r.numero)}</strong><small class="cot-sub">${formatFecha(r.fecha)} · ${this.e(r.creado_por_nombre || '')}</small></td>
                        <td class="rqs-mes">${this.e(this.textoMes(r.periodo))}</td>
                        <td>${this.e(r.proveedor_nombre)}</td>
                        <td class="rqs-facturas">${r.facturas.length
                            ? r.facturas.map(f => `<span class="cot-tag${f.estado === 'cancelada' ? ' req-compra-cancelada' : ''}" title="${this.e(`${f.numero_compra} · ${formatFecha(f.fecha)} · ${formatQ(f.total)}`)}">${this.e(this.nombreFactura(f))}</span>`).join(' ')
                            : '<small class="cot-sub">—</small>'}</td>
                        <td class="text-right">${r.estado === 'anulada' ? '<small class="cot-sub">—</small>' : `<strong>${formatQ(r.total)}</strong>`}${r.facturas.length ? `<small class="cot-sub">${r.facturas.length} factura${r.facturas.length === 1 ? '' : 's'}</small>` : ''}</td>
                        <td><span class="rqs-estado rqs-estado-${this.e(r.estado)}">${this.ESTADOS[r.estado] || this.e(r.estado)}</span>
                            ${r.estado === 'pagada' ? this.detallePago(r) : ''}
                            ${r.estado === 'parcial' ? `<small class="cot-sub">${Abonos.resumenTexto(r.total, r.abonos)}</small>` : ''}
                            ${r.estado === 'anulada' && r.motivo_anulacion ? `<small class="cot-sub" title="${this.e(r.motivo_anulacion)}">${this.e(r.motivo_anulacion)}</small>` : ''}</td>
                        <td><div class="acciones-saldo">
                            ${boton('ver', r, 'fa-eye', 'Ver')}
                            ${editar && ['pendiente', 'parcial'].includes(r.estado) ? `
                                <button type="button" class="btn-accion btn-accion-primaria" data-rqs-accion="pagar" data-id="${r.id}"><i class="fas fa-money-check-dollar" aria-hidden="true"></i> ${r.estado === 'parcial' ? 'Abonar' : 'Pagar'}</button>` : ''}
                            ${r.estado === 'pagada' ? boton('pagar', r, 'fa-receipt', 'Ver los pagos') : ''}
                            ${editar && r.estado === 'pendiente' ? `
                                ${boton('editar', r, 'fa-pen', 'Editar')}
                                ${boton('anular', r, 'fa-ban', 'Anular')}
                                ${boton('eliminar', r, 'fa-trash', 'Eliminar', 'btn-accion-peligro')}` : ''}
                            ${editar && ['parcial', 'pagada'].includes(r.estado) ? boton('quitarPago', r, 'fa-rotate-left', 'Quitar todos los pagos') : ''}
                        </div></td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
    },

    // Diálogo con formulario; `enviar` devuelve una promesa o lanza el error a mostrar
    dialogo(titulo, cuerpo, textoBoton, enviar, { ancho = false } = {}) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-dialog ${ancho ? 'req-detalle' : 'inv-dialogo'}" role="dialog" aria-modal="true" aria-labelledby="rqsDialogoTitulo">
                <div class="modal-header">
                    <h2 id="rqsDialogoTitulo">${titulo}</h2>
                    <button type="button" class="close-btn" aria-label="Cerrar">&times;</button>
                </div>
                <form class="modal-body" novalidate>
                    ${cuerpo}
                    <p class="inv-error" role="alert" hidden></p>
                    ${textoBoton ? `<div class="inv-dialogo-acciones">
                        <button type="button" class="btn btn-secondary" data-cerrar>Cancelar</button>
                        <button type="submit" class="btn btn-primary">${textoBoton}</button>
                    </div>` : ''}
                </form>
            </div>`;
        document.body.appendChild(overlay);
        const error = overlay.querySelector('.inv-error');
        const cerrar = () => {
            overlay.remove();
            document.removeEventListener('keydown', alTeclear);
        };
        const alTeclear = (e) => { if (e.key === 'Escape') cerrar(); };
        document.addEventListener('keydown', alTeclear);
        overlay.querySelector('.close-btn').addEventListener('click', cerrar);
        overlay.querySelector('[data-cerrar]')?.addEventListener('click', cerrar);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
        const form = overlay.querySelector('form');
        form.addEventListener('input', () => { error.hidden = true; });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!enviar) return;
            const botonEnviar = form.querySelector('button[type="submit"]');
            botonEnviar.disabled = true;
            try {
                await enviar(form);
                cerrar();
            } catch (err) {
                error.textContent = err.message;
                error.hidden = false;
            } finally {
                botonEnviar.disabled = false;
            }
        });
        setTimeout(() => form.querySelector('input, select, textarea, .close-btn')?.focus(), 0);
        return form;
    },

    // Nueva o editar (pendiente): proveedor, mes y las facturas de ese proveedor que entran
    async formulario(requisicion = null) {
        await this.cargarProveedores().catch(() => {});
        const mesActual = this.hoy().slice(0, 7);
        const form = this.dialogo(
            requisicion ? `Editar requisición ${this.e(requisicion.numero)}` : 'Nueva requisición',
            `<div class="inv-campos">
                <div class="form-group">
                    <label for="rqsProveedor">Proveedor <span class="required">*</span></label>
                    <select id="rqsProveedor" class="form-input" required>
                        <option value="">Selecciona un proveedor</option>
                        ${this.state.proveedores.map(p => `<option value="${this.e(p.id)}">${this.e(p.nombre)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="rqsPeriodo">Mes <span class="required">*</span></label>
                    <input id="rqsPeriodo" type="month" class="form-input" required value="${this.e(requisicion?.periodo || mesActual)}">
                </div>
                <div class="form-group">
                    <label for="rqsFecha">Fecha de la requisición</label>
                    <input id="rqsFecha" type="date" class="form-input" value="${this.e(requisicion?.fecha || this.hoy())}">
                </div>
                <div class="form-group inv-ancho">
                    <label for="rqsObservaciones">Observaciones</label>
                    <textarea id="rqsObservaciones" class="form-input" rows="2" maxlength="2000">${this.e(requisicion?.observaciones || '')}</textarea>
                </div>
            </div>
            <div class="compra-pago-subtitulo">Facturas del proveedor</div>
            <p class="form-hint">Se marcan las del mes elegido. Solo aparecen las que no están pagadas ni en otra requisición.</p>
            <div class="table-responsive" id="rqsFacturas"><p class="cot-sub">Elija el proveedor.</p></div>`,
            `<i class="fas fa-save" aria-hidden="true"></i> ${requisicion ? 'Guardar' : 'Registrar requisición'}`,
            async (f) => {
                const facturas = [...f.querySelectorAll('[data-factura]:checked')].map(c => c.dataset.factura);
                const datos = {
                    proveedor_id: f.querySelector('#rqsProveedor').value,
                    periodo: f.querySelector('#rqsPeriodo').value,
                    fecha: f.querySelector('#rqsFecha').value || null,
                    observaciones: f.querySelector('#rqsObservaciones').value.trim() || null,
                    facturas
                };
                if (!datos.proveedor_id) throw new Error('Elija el proveedor.');
                if (!datos.periodo) throw new Error('Elija el mes.');
                if (!facturas.length) throw new Error('Marque al menos una factura.');
                const data = await this.api(requisicion ? `/${requisicion.id}` : '', {
                    method: requisicion ? 'PUT' : 'POST',
                    body: JSON.stringify(datos)
                });
                this.notificar(data.message, 'success');
                await this.cargar();
            },
            { ancho: true }
        );
        const proveedor = form.querySelector('#rqsProveedor');
        const periodo = form.querySelector('#rqsPeriodo');
        const caja = form.querySelector('#rqsFacturas');
        let facturas = [];
        // Las de la requisición al editar; si no, las del mes elegido
        const marcar = (soloMes) => {
            caja.querySelectorAll('[data-factura]').forEach(c => {
                const f = facturas.find(x => String(x.id) === c.dataset.factura);
                c.checked = soloMes ? f.fecha.slice(0, 7) === periodo.value : Boolean(requisicion && f.requisicion_id === requisicion.id);
            });
            actualizarTotal();
        };
        const actualizarTotal = () => {
            const marcadas = [...caja.querySelectorAll('[data-factura]:checked')]
                .map(c => facturas.find(x => String(x.id) === c.dataset.factura));
            const total = caja.querySelector('[data-total]');
            if (total) total.textContent = `${marcadas.length} factura${marcadas.length === 1 ? '' : 's'} · ${formatQ(marcadas.reduce((s, f) => s + Number(f.total), 0))}`;
        };
        const cargarFacturas = async (soloMes) => {
            if (!proveedor.value) {
                caja.innerHTML = '<p class="cot-sub">Elija el proveedor.</p>';
                return;
            }
            caja.innerHTML = '<p class="cot-sub">Buscando facturas…</p>';
            try {
                const params = new URLSearchParams({ proveedor_id: proveedor.value });
                if (requisicion) params.set('requisicion_id', requisicion.id);
                facturas = (await this.api(`/facturas?${params}`)).facturas || [];
            } catch (error) {
                caja.innerHTML = `<p class="inv-error">${this.e(error.message)}</p>`;
                return;
            }
            caja.innerHTML = facturas.length ? `
                <table class="data-table req-elegir">
                    <thead><tr><th></th><th>No. de factura</th><th>Compra</th><th>Fecha</th><th class="text-right">Total</th></tr></thead>
                    <tbody>${facturas.map(f => `<tr>
                        <td><input type="checkbox" data-factura="${this.e(f.id)}" aria-label="Incluir ${this.e(this.nombreFactura(f))}"></td>
                        <td>${f.numero_factura ? `<strong>${this.e(f.numero_factura)}</strong>` : '<span class="compras-sin-factura">Sin factura</span>'}</td>
                        <td>${this.e(f.numero_compra)}</td>
                        <td>${formatFecha(f.fecha)}</td>
                        <td class="text-right">${formatQ(f.total)}</td></tr>`).join('')}</tbody>
                    <tfoot><tr><th colspan="4" class="text-right">Marcadas</th><th class="text-right" data-total></th></tr></tfoot>
                </table>`
                : '<p class="cot-sub">Este proveedor no tiene facturas pendientes de pago fuera de otra requisición.</p>';
            marcar(soloMes);
        };
        caja.addEventListener('change', actualizarTotal);
        proveedor.addEventListener('change', () => cargarFacturas(true));
        periodo.addEventListener('change', () => marcar(true));
        if (requisicion) {
            proveedor.value = String(requisicion.proveedor_id);
            cargarFacturas(false);
        }
    },

    // Abonos del pago: ver lo pagado y registrar uno más (o el pago completo)
    pagos(r) {
        Abonos.dialogo({
            titulo: `Pagos de ${this.e(r.numero)}`,
            subtitulo: `${this.e(r.proveedor_nombre)} · ${this.e(this.textoMes(r.periodo))} · al completar el pago, sus ${r.facturas.length} factura${r.facturas.length === 1 ? '' : 's'} quedan pagadas.`,
            total: r.total,
            abonos: r.abonos || [],
            puedeEditar: this.puedeEditar() && r.estado !== 'anulada',
            exigirBanco: true,
            registrar: (datos) => this.api(`/${r.id}/abonos`, { method: 'POST', body: JSON.stringify(datos) }),
            eliminar: (abono) => this.api(`/abonos/${abono.id}`, { method: 'DELETE' }),
            subirVoucher: (abonoId, archivo) => Abonos.subirVoucher(`/api/requisiciones/${r.id}/vouchers`, abonoId, archivo),
            verVoucher: (id, nombre) => this.verVoucher(id, nombre),
            alTerminar: () => this.cargar()
        });
    },

    // Abre el voucher en una pestaña nueva (se pide con el token, por eso no es un enlace directo)
    async verVoucher(id, nombre) {
        const ventana = window.open('', '_blank');
        try {
            const response = await authManager.fetchWithAuth(`/api/requisiciones/vouchers/${encodeURIComponent(id)}`);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || `Error ${response.status}`);
            }
            const url = URL.createObjectURL(await response.blob());
            if (ventana) {
                ventana.location.href = url;
            } else {
                const enlace = document.createElement('a');
                enlace.href = url;
                enlace.download = nombre || 'voucher';
                enlace.click();
            }
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {
            ventana?.close();
            this.notificar(`No se pudo abrir el voucher: ${error.message}`, 'error');
        }
    },

    async quitarPago(r) {
        if (!confirm(`¿Quitar todos los pagos de ${r.numero}? Sus facturas vuelven a quedar pendientes de pago.`)) return;
        try {
            const data = await this.api(`/${r.id}/estado`, { method: 'PUT', body: JSON.stringify({ estado: 'pendiente' }) });
            this.notificar(data.message, 'success');
            await this.cargar();
        } catch (error) {
            this.notificar(error.message, 'error');
        }
    },

    anular(r) {
        this.dialogo(`Anular ${this.e(r.numero)}`,
            `<p class="form-hint">Sus facturas quedan libres para ponerlas en otra requisición.</p>
            <div class="form-group">
                <label for="rqsMotivo">Motivo de la anulación <span class="required">*</span></label>
                <textarea id="rqsMotivo" class="form-input" rows="2" maxlength="500" required></textarea>
            </div>`,
            'Anular requisición',
            async (f) => {
                const data = await this.api(`/${r.id}/estado`, { method: 'PUT', body: JSON.stringify({ estado: 'anulada', motivo: f.querySelector('#rqsMotivo').value }) });
                this.notificar(data.message, 'success');
                await this.cargar();
            });
    },

    async eliminar(r) {
        if (!confirm(`¿Eliminar la requisición ${r.numero}? Sus facturas quedan libres. No se puede deshacer.`)) return;
        try {
            const data = await this.api(`/${r.id}`, { method: 'DELETE' });
            this.notificar(data.message, 'success');
            await this.cargar();
        } catch (error) {
            this.notificar(error.message, 'error');
        }
    },

    // Detalle de solo lectura: facturas, total y pago
    ver(r) {
        this.dialogo(`Requisición ${this.e(r.numero)}`,
            `<dl class="req-datos">
                <div><dt>Proveedor</dt><dd>${this.e(r.proveedor_nombre)}</dd></div>
                <div><dt>Mes</dt><dd>${this.e(this.textoMes(r.periodo))}</dd></div>
                <div><dt>Fecha</dt><dd>${formatFecha(r.fecha)} · ${this.e(r.creado_por_nombre || '')}</dd></div>
                <div><dt>Estado</dt><dd>${this.ESTADOS[r.estado] || this.e(r.estado)}</dd></div>
                ${r.estado === 'pagada' ? `<div><dt>Pago</dt><dd>${this.detallePago(r)}</dd></div>` : ''}
                ${r.motivo_anulacion ? `<div><dt>Motivo de la anulación</dt><dd>${this.e(r.motivo_anulacion)}</dd></div>` : ''}
            </dl>
            <div class="table-responsive">
                <table class="data-table">
                    <thead><tr><th>No. de factura</th><th>Compra</th><th>Fecha</th><th class="text-right">Total</th></tr></thead>
                    <tbody>${r.facturas.map(f => `<tr class="${f.estado === 'cancelada' ? 'req-compra-cancelada' : ''}">
                        <td>${f.numero_factura ? this.e(f.numero_factura) : '<span class="compras-sin-factura">Sin factura</span>'}</td>
                        <td>${this.e(f.numero_compra)}${f.estado === 'cancelada' ? ' <small class="cot-sub">cancelada</small>' : ''}</td>
                        <td>${formatFecha(f.fecha)}</td>
                        <td class="text-right">${formatQ(f.total)}</td></tr>`).join('') || '<tr><td colspan="4" class="text-center">Sin facturas</td></tr>'}</tbody>
                    <tfoot><tr><th colspan="3" class="text-right">Total</th><th class="text-right">${formatQ(r.total)}</th></tr></tfoot>
                </table>
            </div>
            ${r.observaciones ? `<p class="req-observaciones"><strong>Observaciones:</strong> ${this.e(r.observaciones)}</p>` : ''}`,
            null, null, { ancho: true });
        // Los vouchers del detalle se abren igual que en el listado
        document.querySelector('#rqsDialogoTitulo')?.closest('.modal-dialog').addEventListener('click', (e) => {
            const voucher = e.target.closest('[data-rqs-voucher]');
            if (voucher) this.verVoucher(voucher.dataset.rqsVoucher, voucher.dataset.nombre);
        });
    }
};

window.RequisicionesModule = RequisicionesModule;
