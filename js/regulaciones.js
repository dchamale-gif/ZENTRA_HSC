// ============================================
// REGULACIONES DE INVENTARIO (solo administrador)
// Lo que sale del inventario sin ser venta: consumo interno, merma o daño, vencimiento,
// donación, ajuste por conteo físico. Se aplica al guardar y queda en el kárdex de cada
// medicina o artículo con el número de la regulación. Al anularla se devuelve lo movido.
// Se guarda en la base de datos (/api/regulaciones).
// ============================================

const RegulacionesModule = {
    state: {
        regulaciones: [],
        resumen: null,
        disponible: true,
        mensaje: '',
        bodegas: [],
        medicinas: [],
        articulos: [],
        catalogoCargado: false,
        filtros: { desde: '', hasta: '', motivo: '', bodega: '', estado: '', buscar: '' }
    },

    MOTIVOS: {
        consumo_interno: 'Consumo interno',
        merma: 'Merma o daño',
        vencimiento: 'Vencimiento',
        donacion: 'Donación',
        ajuste_conteo: 'Ajuste por conteo físico',
        otro: 'Otro'
    },

    init() {
        if (this._iniciado) return;
        this._iniciado = true;
        // Por defecto, el mes en curso
        const hoy = this.hoy();
        this.state.filtros.desde = `${hoy.slice(0, 7)}-01`;
        this.state.filtros.hasta = hoy;
        const campos = { regDesde: 'desde', regHasta: 'hasta', regFiltroMotivo: 'motivo', regFiltroBodega: 'bodega', regFiltroEstado: 'estado' };
        Object.entries(campos).forEach(([id, filtro]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.value = this.state.filtros[filtro];
            el.addEventListener('change', () => { this.state.filtros[filtro] = el.value; this.cargar(); });
        });
        document.getElementById('regFiltroMotivo')?.insertAdjacentHTML('beforeend',
            Object.entries(this.MOTIVOS).map(([v, t]) => `<option value="${v}">${t}</option>`).join(''));
        document.getElementById('regBuscar')?.addEventListener('input', (e) => {
            this.state.filtros.buscar = e.target.value;
            clearTimeout(this._timer);
            this._timer = setTimeout(() => this.cargar(), 250);
        });
        document.getElementById('regNuevaBtn')?.addEventListener('click', () => this.formulario());
        document.getElementById('regLista')?.addEventListener('click', (e) => {
            const boton = e.target.closest('[data-reg-accion]');
            const regulacion = boton && this.state.regulaciones.find(r => String(r.id) === boton.dataset.id);
            if (!regulacion) return;
            if (boton.dataset.regAccion === 'ver') this.ver(regulacion);
            if (boton.dataset.regAccion === 'anular') this.anular(regulacion);
        });
    },

    e(valor) {
        return escapeHtml(valor ?? '');
    },

    notificar(mensaje, tipo = 'info') {
        if (typeof showNotification === 'function') showNotification(mensaje, tipo);
        else alert(mensaje);
    },

    hoy() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.REGION.timeZone }).format(new Date());
    },

    async api(path = '', options = {}) {
        const response = await authManager.fetchWithAuth(`/api/regulaciones${path}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || data.message || `Error ${response.status}`);
        return data;
    },

    async obtenerJSON(url) {
        const response = await authManager.fetchWithAuth(url);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
        return data;
    },

    async cargarBodegas() {
        if (this.state.bodegas.length) return;
        const data = await this.obtenerJSON('/api/bodegas');
        this.state.bodegas = (data.bodegas || []).filter(b => b.activo !== false);
        const select = document.getElementById('regFiltroBodega');
        if (select) {
            select.innerHTML = '<option value="">Todas</option>' + this.state.bodegas
                .map(b => `<option value="${b.id}">${this.e(b.nombre)}</option>`).join('');
            select.value = this.state.filtros.bodega;
        }
    },

    // Medicinas y artículos para el formulario (una vez por visita a la página)
    async cargarCatalogo() {
        if (this.state.catalogoCargado) return;
        const [med, art] = await Promise.all([
            this.obtenerJSON('/api/medicinas'),
            this.obtenerJSON('/api/codigos-articulos')
        ]);
        this.state.medicinas = (med.medicinas || []).map(m => ({ ...m, id: String(m.id) }));
        this.state.articulos = (art.articulos || [])
            .filter(a => a.activo !== false && a.tipo !== 'servicio')
            .map(a => ({ ...a, id: String(a.id), nombre: a.nombre_articulo }));
        this.state.catalogoCargado = true;
    },

    async cargar() {
        this.init();
        const contenedor = document.getElementById('regLista');
        if (!contenedor) return;
        this.state.catalogoCargado = false; // existencias frescas al abrir el formulario
        try {
            await this.cargarBodegas().catch(() => {});
            const f = this.state.filtros;
            const params = new URLSearchParams();
            if (f.desde) params.set('desde', f.desde);
            if (f.hasta) params.set('hasta', f.hasta);
            if (f.motivo) params.set('motivo', f.motivo);
            if (f.bodega) params.set('bodega_id', f.bodega);
            if (f.estado) params.set('estado', f.estado);
            if (f.buscar.trim()) params.set('buscar', f.buscar.trim());
            const data = await this.api(`?${params}`);
            this.state.regulaciones = data.regulaciones || [];
            this.state.resumen = data.resumen;
            this.state.disponible = data.disponible !== false;
            this.state.mensaje = data.mensaje || '';
            this.render();
        } catch (error) {
            contenedor.innerHTML = `<div class="cot-vacio"><p>No se pudieron cargar las regulaciones.</p><small>${this.e(error.message)}</small></div>`;
        }
    },

    // "−2 Cajas" / "+5 Tabletas"; con presentación, también en unidades base
    textoMovimiento(item) {
        const signo = item.sentido === 'salida' ? '−' : '+';
        const unidad = item.unidad_base || 'unidades';
        const base = InventarioMedicinas.texto(item.unidades, unidad);
        if (item.factor > 1) return `${signo}${InventarioMedicinas.texto(item.cantidad, item.presentacion_nombre)} (${base})`;
        return `${signo}${base}`;
    },

    renderResumen() {
        const caja = document.getElementById('regResumen');
        if (!caja) return;
        const r = this.state.resumen;
        caja.hidden = !this.state.disponible || !r;
        if (!r) return;
        const partes = Object.entries(r.por_motivo || {})
            .sort((a, b) => b[1] - a[1])
            .map(([m, v]) => `${this.MOTIVOS[m] || m}: ${formatQ(v)}`);
        caja.innerHTML = r.aplicadas
            ? `<strong>${r.aplicadas} ${r.aplicadas === 1 ? 'regulación aplicada' : 'regulaciones aplicadas'} · ${formatQ(r.total_costo)} al costo</strong>${partes.length > 1 ? `<small class="cot-sub">${partes.join(' · ')}</small>` : ''}`
            : '<span>No hay regulaciones aplicadas en este periodo.</span>';
    },

    render() {
        this.renderResumen();
        const contenedor = document.getElementById('regLista');
        if (!this.state.disponible) {
            contenedor.innerHTML = `<div class="cot-vacio"><p>Falta preparar la base de datos para las regulaciones.</p><small>En el servidor: cd backend && npm run migrate:regulaciones</small></div>`;
            return;
        }
        const lista = this.state.regulaciones;
        if (!lista.length) {
            const f = this.state.filtros;
            const filtrado = f.motivo || f.bodega || f.estado || f.buscar.trim();
            contenedor.innerHTML = `<div class="cot-vacio"><p>${filtrado ? 'Ninguna regulación coincide con los filtros.' : 'No hay regulaciones en estas fechas.'}</p>
                ${filtrado ? '' : '<button type="button" class="btn btn-primary" onclick="RegulacionesModule.formulario()"><i class="fas fa-plus" aria-hidden="true"></i> Nueva regulación</button>'}</div>`;
            return;
        }
        const boton = (accion, r, icono, titulo) => `<button type="button" class="btn-accion btn-accion-icono"
            data-reg-accion="${accion}" data-id="${r.id}" title="${titulo}" aria-label="${titulo} ${this.e(r.numero)}"><i class="fas ${icono}" aria-hidden="true"></i></button>`;
        contenedor.innerHTML = `
            <table class="data-table reg-tabla">
                <thead><tr>
                    <th>Número</th><th>Bodega</th><th>Motivo</th><th>Medicinas y artículos</th>
                    <th class="text-right">Valor al costo</th><th>Estado</th><th class="text-center">Acciones</th>
                </tr></thead>
                <tbody>${lista.map(r => `
                    <tr class="${r.estado === 'anulada' ? 'reg-anulada' : ''}">
                        <td><strong class="reg-numero">${this.e(r.numero)}</strong><small class="cot-sub">${formatFecha(r.fecha)} · ${this.e(r.creado_por_nombre)}</small></td>
                        <td>${this.e(r.bodega_nombre)}</td>
                        <td>${this.e(this.MOTIVOS[r.motivo] || r.motivo)}${r.observaciones ? `<small class="cot-sub reg-obs" title="${this.e(r.observaciones)}">${this.e(r.observaciones)}</small>` : ''}</td>
                        <td class="reg-items">${r.items.slice(0, 3).map(i => `
                            <span class="reg-item"><span>${this.e(i.concepto_nombre)}</span>
                                <small class="reg-mov reg-mov-${i.sentido}">${this.e(this.textoMovimiento(i))}</small></span>`).join('')}
                            ${r.items.length > 3 ? `<small class="cot-sub">y ${r.items.length - 3} más</small>` : ''}</td>
                        <td class="text-right">${r.estado === 'anulada' ? '<small class="cot-sub">—</small>' : `<strong>${formatQ(r.total_costo)}</strong>`}</td>
                        <td><span class="reg-estado reg-estado-${this.e(r.estado)}">${r.estado === 'anulada' ? 'Anulada' : 'Aplicada'}</span>
                            ${r.estado === 'anulada' && r.motivo_anulacion ? `<small class="cot-sub" title="${this.e(r.motivo_anulacion)}">${this.e(r.motivo_anulacion)}</small>` : ''}</td>
                        <td><div class="acciones-saldo">
                            ${boton('ver', r, 'fa-eye', 'Ver')}
                            ${r.estado === 'aplicada' ? boton('anular', r, 'fa-ban', 'Anular y devolver al inventario') : ''}
                        </div></td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
    },

    // Diálogo con formulario; `enviar` devuelve una promesa o lanza el error a mostrar
    dialogo(titulo, cuerpo, textoBoton, enviar, { ancho = false, peligro = false } = {}) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-dialog ${ancho ? 'req-detalle reg-dialogo' : 'inv-dialogo'}" role="dialog" aria-modal="true" aria-labelledby="regDialogoTitulo">
                <div class="modal-header">
                    <h2 id="regDialogoTitulo">${titulo}</h2>
                    <button type="button" class="close-btn" aria-label="Cerrar">&times;</button>
                </div>
                <form class="modal-body" novalidate>
                    ${cuerpo}
                    <p class="inv-error" role="alert" hidden></p>
                    ${textoBoton ? `<div class="inv-dialogo-acciones">
                        <button type="button" class="btn btn-secondary" data-cerrar>Cancelar</button>
                        <button type="submit" class="btn ${peligro ? 'btn-danger' : 'btn-primary'}">${textoBoton}</button>
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

    // ---------- Formulario ----------

    renglonVacio() {
        return { tipo: 'medicina', concepto_id: '', presentacion_id: '', cantidad: 1, sentido: 'salida', busqueda: '' };
    },

    concepto(r) {
        const lista = r.tipo === 'medicina' ? this.state.medicinas : this.state.articulos;
        return lista.find(c => c.id === String(r.concepto_id)) || null;
    },

    // Existencia y unidad del concepto, y cuántas unidades base mueve el renglón
    calculo(r) {
        const c = this.concepto(r);
        if (!c) return null;
        if (r.tipo === 'medicina') {
            const pres = InventarioMedicinas.presentacion(c, r.presentacion_id);
            const unidad = InventarioMedicinas.unidadBase(c);
            const unidades = (Number(r.cantidad) || 0) * pres.factor;
            return { existencia: Number(c.cantidad) || 0, unidad, unidades, costo: Number(c.precio_costo) || 0 };
        }
        return {
            existencia: Number(c.cantidad_disponible) || 0,
            unidad: c.unidad_medida || 'unidad',
            unidades: Number(r.cantidad) || 0,
            costo: Number(c.precio_costo) || 0
        };
    },

    async formulario() {
        try {
            await Promise.all([this.cargarBodegas(), this.cargarCatalogo()]);
        } catch (error) {
            this.notificar(`No se pudo cargar el catálogo: ${error.message}`, 'error');
            return;
        }
        this.renglones = [this.renglonVacio()];
        const form = this.dialogo('Nueva regulación de inventario', `
            <div class="inv-campos reg-campos">
                <div class="form-group">
                    <label for="regFecha">Fecha <span class="required">*</span></label>
                    <input id="regFecha" type="date" class="form-input" required max="${this.hoy()}" value="${this.hoy()}">
                </div>
                <div class="form-group">
                    <label for="regBodega">Bodega <span class="required">*</span></label>
                    <select id="regBodega" class="form-input" required>
                        <option value="">Selecciona</option>
                        ${this.state.bodegas.map(b => `<option value="${b.id}">${this.e(b.nombre)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="regMotivo">Motivo <span class="required">*</span></label>
                    <select id="regMotivo" class="form-input" required>
                        <option value="">Selecciona</option>
                        ${Object.entries(this.MOTIVOS).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group inv-ancho">
                    <label for="regObservaciones">Observaciones <span data-obs-requerida hidden class="required">*</span></label>
                    <textarea id="regObservaciones" class="form-input" rows="2" maxlength="1000" placeholder="Qué pasó, quién lo usó, lote vencido…"></textarea>
                </div>
            </div>
            <div class="compra-pago-subtitulo">Medicinas y artículos</div>
            <p class="form-hint" data-hint-sentido>Todo lo que se registre aquí se descuenta del inventario al guardar.</p>
            <div class="table-responsive">
                <table class="data-table reg-renglones">
                    <thead><tr>
                        <th>Tipo</th><th>Medicina o artículo</th><th data-col-sentido hidden>Movimiento</th>
                        <th>Cantidad</th><th>Existencia</th><th class="text-right">Costo</th><th></th>
                    </tr></thead>
                    <tbody data-renglones></tbody>
                </table>
            </div>
            <div class="reg-pie">
                <button type="button" class="btn btn-secondary btn-small" data-agregar><i class="fas fa-plus" aria-hidden="true"></i> Agregar renglón</button>
                <span data-total></span>
            </div>`,
            '<i class="fas fa-check" aria-hidden="true"></i> Aplicar al inventario',
            (f) => this.guardar(f),
            { ancho: true });

        this.formActual = form;
        form.querySelector('#regMotivo').addEventListener('change', () => {
            if (form.querySelector('#regMotivo').value !== 'ajuste_conteo') this.renglones.forEach(r => { r.sentido = 'salida'; });
            this.renderRenglones();
        });
        form.querySelector('[data-agregar]').addEventListener('click', () => {
            this.renglones.push(this.renglonVacio());
            this.renderRenglones();
            form.querySelector(`[data-buscar="${this.renglones.length - 1}"]`)?.focus();
        });
        const tbody = form.querySelector('[data-renglones]');
        tbody.addEventListener('input', (e) => this.alCambiar(e));
        tbody.addEventListener('change', (e) => this.alCambiar(e));
        tbody.addEventListener('click', (e) => {
            const elegir = e.target.closest('[data-elegir]');
            if (elegir) {
                const r = this.renglones[Number(elegir.dataset.renglon)];
                Object.assign(r, { concepto_id: elegir.dataset.elegir, presentacion_id: '', busqueda: '' });
                this.renderRenglones();
                form.querySelector(`[data-campo="cantidad"][data-renglon="${elegir.dataset.renglon}"]`)?.select();
                return;
            }
            const quitar = e.target.closest('[data-quitar]');
            if (quitar) {
                this.renglones.splice(Number(quitar.dataset.quitar), 1);
                if (!this.renglones.length) this.renglones.push(this.renglonVacio());
                this.renderRenglones();
                return;
            }
            const cambiar = e.target.closest('[data-cambiar]');
            if (cambiar) {
                Object.assign(this.renglones[Number(cambiar.dataset.cambiar)], { concepto_id: '', presentacion_id: '', busqueda: '' });
                this.renderRenglones();
                form.querySelector(`[data-buscar="${cambiar.dataset.cambiar}"]`)?.focus();
            }
        });
        this.renderRenglones();
    },

    alCambiar(e) {
        const el = e.target;
        const i = Number(el.dataset.renglon ?? el.dataset.buscar);
        const r = this.renglones[i];
        if (!r) return;
        if (el.dataset.buscar !== undefined) {
            // Solo al teclear: el "change" del blur rehace la lista y se perdería el clic en un resultado
            if (e.type !== 'input') return;
            r.busqueda = el.value;
            this.renderResultados(i);
            return;
        }
        const campo = el.dataset.campo;
        if (!campo || (e.type === 'input' && el.tagName === 'SELECT')) return;
        if (campo === 'tipo') Object.assign(r, { tipo: el.value, concepto_id: '', presentacion_id: '', busqueda: '' });
        else if (campo === 'cantidad') r.cantidad = el.value;
        else r[campo] = el.value;
        if (campo === 'cantidad' && e.type === 'input') {
            this.renderCalculo(i);
            this.renderTotal();
        } else {
            this.renderRenglones();
        }
    },

    renderResultados(i) {
        const r = this.renglones[i];
        const caja = this.formActual.querySelector(`[data-resultados="${i}"]`);
        if (!caja) return;
        const normal = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const q = normal(r.busqueda).trim();
        if (q.length < 2) { caja.hidden = true; caja.innerHTML = ''; return; }
        const lista = (r.tipo === 'medicina' ? this.state.medicinas : this.state.articulos)
            .filter(c => normal(`${c.nombre} ${c.codigo || ''} ${c.codigo_barra || ''} ${c.codigo_externo || ''}`).includes(q))
            .slice(0, 8);
        caja.hidden = false;
        caja.innerHTML = lista.length
            ? lista.map(c => {
                const existencia = r.tipo === 'medicina'
                    ? InventarioMedicinas.texto(Number(c.cantidad) || 0, InventarioMedicinas.unidadBase(c))
                    : `${Number(c.cantidad_disponible) || 0} ${c.unidad_medida || 'unid.'}`;
                return `<button type="button" class="concept-search-result" data-elegir="${this.e(c.id)}" data-renglon="${i}">
                    <span>${this.e(c.nombre)}</span><small>Hay ${this.e(existencia)}</small></button>`;
            }).join('')
            : '<div class="concept-search-empty">Sin resultados</div>';
    },

    renderCalculo(i) {
        const celda = this.formActual.querySelector(`[data-calculo="${i}"]`);
        const costoCelda = this.formActual.querySelector(`[data-costo="${i}"]`);
        const r = this.renglones[i];
        const c = this.calculo(r);
        if (!celda || !costoCelda) return;
        if (!c) { celda.innerHTML = ''; costoCelda.textContent = ''; return; }
        const resultante = c.existencia + (r.sentido === 'salida' ? -c.unidades : c.unidades);
        const t = (n) => r.tipo === 'medicina' ? InventarioMedicinas.texto(n, c.unidad) : `${n} ${c.unidad}`;
        celda.innerHTML = `<span>${this.e(t(c.existencia))}</span>
            <small class="${resultante < 0 ? 'reg-falta' : 'cot-sub'}">${resultante < 0 ? 'No alcanza: ' : 'Queda: '}${this.e(t(resultante))}</small>`;
        costoCelda.textContent = formatQ(c.unidades * c.costo);
    },

    renderTotal() {
        const total = this.renglones.reduce((s, r) => {
            const c = this.calculo(r);
            return c ? s + (r.sentido === 'salida' ? 1 : -1) * c.unidades * c.costo : s;
        }, 0);
        const caja = this.formActual.querySelector('[data-total]');
        caja.innerHTML = `Valor al costo: <strong>${formatQ(total)}</strong>`;
    },

    renderRenglones() {
        const form = this.formActual;
        const motivo = form.querySelector('#regMotivo').value;
        const conteo = motivo === 'ajuste_conteo';
        form.querySelector('[data-col-sentido]').hidden = !conteo;
        form.querySelector('[data-hint-sentido]').textContent = conteo
            ? 'Por cada renglón indique si faltó (sale del inventario) o sobró (entra) al contar.'
            : 'Todo lo que se registre aquí se descuenta del inventario al guardar.';
        form.querySelector('[data-obs-requerida]').hidden = motivo !== 'otro';
        form.querySelector('[data-renglones]').innerHTML = this.renglones.map((r, i) => {
            const c = this.concepto(r);
            let presentacion = '';
            if (c && r.tipo === 'medicina') {
                const lista = InventarioMedicinas.presentaciones(c);
                presentacion = lista.length > 1 ? `
                    <label class="sr-only" for="regPres${i}">Presentación</label>
                    <select id="regPres${i}" class="form-input reg-pres" data-campo="presentacion_id" data-renglon="${i}">
                        ${lista.map(p => `<option value="${this.e(p.id)}" ${String(p.id) === String(r.presentacion_id || '') ? 'selected' : ''}>${this.e(p.factor > 1 ? InventarioMedicinas.nombrePresentacion(c, p) : `${p.nombre} (suelta)`)}</option>`).join('')}
                    </select>` : `<small class="cot-sub">Por ${this.e(InventarioMedicinas.unidadBase(c).toLowerCase())}</small>`;
            }
            return `<tr>
                <td><label class="sr-only" for="regTipo${i}">Tipo</label>
                    <select id="regTipo${i}" class="form-input" data-campo="tipo" data-renglon="${i}">
                        <option value="medicina" ${r.tipo === 'medicina' ? 'selected' : ''}>Medicina</option>
                        <option value="articulo" ${r.tipo === 'articulo' ? 'selected' : ''}>Artículo</option>
                    </select></td>
                <td class="reg-concepto">${c ? `
                    <div class="reg-elegido"><strong>${this.e(c.nombre)}</strong>
                        <button type="button" class="btn-link" data-cambiar="${i}">Cambiar</button></div>
                    ${presentacion}` : `
                    <label class="sr-only" for="regBuscar${i}">Buscar ${r.tipo === 'medicina' ? 'medicina' : 'artículo'}</label>
                    <input id="regBuscar${i}" type="search" class="form-input" data-buscar="${i}" autocomplete="off"
                        placeholder="Buscar ${r.tipo === 'medicina' ? 'medicina' : 'artículo'} por nombre o código" value="${this.e(r.busqueda)}">
                    <div class="concept-search-results" data-resultados="${i}" hidden></div>`}</td>
                <td ${conteo ? '' : 'hidden'}><label class="sr-only" for="regSentido${i}">Movimiento</label>
                    <select id="regSentido${i}" class="form-input" data-campo="sentido" data-renglon="${i}">
                        <option value="salida" ${r.sentido === 'salida' ? 'selected' : ''}>Faltó (sale)</option>
                        <option value="entrada" ${r.sentido === 'entrada' ? 'selected' : ''}>Sobró (entra)</option>
                    </select></td>
                <td><label class="sr-only" for="regCantidad${i}">Cantidad</label>
                    <input id="regCantidad${i}" type="number" min="1" step="1" class="form-input reg-cantidad" data-campo="cantidad" data-renglon="${i}" value="${this.e(r.cantidad)}"></td>
                <td class="reg-existencia" data-calculo="${i}"></td>
                <td class="text-right" data-costo="${i}"></td>
                <td><button type="button" class="btn-icon btn-delete" data-quitar="${i}" title="Quitar renglón" aria-label="Quitar renglón ${i + 1}"><i class="fas fa-trash" aria-hidden="true"></i></button></td>
            </tr>`;
        }).join('');
        this.renglones.forEach((r, i) => {
            this.renderCalculo(i);
            if (!r.concepto_id && r.busqueda) this.renderResultados(i);
        });
        this.renderTotal();
    },

    async guardar(form) {
        const motivo = form.querySelector('#regMotivo').value;
        const observaciones = form.querySelector('#regObservaciones').value.trim();
        const datos = {
            fecha: form.querySelector('#regFecha').value,
            bodega_id: form.querySelector('#regBodega').value,
            motivo,
            observaciones: observaciones || null,
            items: this.renglones.filter(r => r.concepto_id).map(r => ({
                tipo: r.tipo,
                concepto_id: r.concepto_id,
                presentacion_id: r.tipo === 'medicina' && r.presentacion_id ? r.presentacion_id : null,
                cantidad: Number(r.cantidad),
                sentido: motivo === 'ajuste_conteo' ? r.sentido : 'salida'
            }))
        };
        if (!datos.fecha) throw new Error('Indique la fecha.');
        if (!datos.bodega_id) throw new Error('Elija la bodega.');
        if (!motivo) throw new Error('Elija el motivo.');
        if (motivo === 'otro' && observaciones.length < 3) throw new Error('Con motivo "Otro" explique en observaciones qué pasó.');
        if (!datos.items.length) throw new Error('Elija al menos una medicina o artículo.');
        if (datos.items.some(i => !Number.isInteger(i.cantidad) || i.cantidad <= 0)) throw new Error('Cada cantidad debe ser un entero mayor a cero.');
        const falta = this.renglones.find(r => {
            const c = this.calculo(r);
            return c && r.sentido === 'salida' && c.unidades > c.existencia;
        });
        if (falta) throw new Error(`No hay suficiente ${this.concepto(falta).nombre} para descontar.`);
        const data = await this.api('', { method: 'POST', body: JSON.stringify(datos) });
        this.notificar(data.message || 'Regulación aplicada', 'success');
        this.cargar();
    },

    // ---------- Detalle y anulación ----------

    ver(r) {
        const filas = r.items.map(i => `
            <tr>
                <td>${this.e(i.concepto_nombre)}<small class="cot-sub">${i.tipo === 'medicina' ? 'Medicina' : 'Artículo'}</small></td>
                <td class="reg-mov reg-mov-${i.sentido}">${this.e(this.textoMovimiento(i))}</td>
                <td class="text-right">${i.existencia_antes ?? '—'}</td>
                <td class="text-right">${formatQ(Number(i.costo_unitario) || 0)}</td>
                <td class="text-right">${formatQ((Number(i.costo_unitario) || 0) * i.unidades * (i.sentido === 'salida' ? 1 : -1))}</td>
            </tr>`).join('');
        this.dialogo(`Regulación ${this.e(r.numero)}`, `
            <dl class="reg-datos">
                <div><dt>Fecha</dt><dd>${formatFecha(r.fecha)}</dd></div>
                <div><dt>Bodega</dt><dd>${this.e(r.bodega_nombre)}</dd></div>
                <div><dt>Motivo</dt><dd>${this.e(this.MOTIVOS[r.motivo] || r.motivo)}</dd></div>
                <div><dt>Registró</dt><dd>${this.e(r.creado_por_nombre)}</dd></div>
                <div><dt>Estado</dt><dd><span class="reg-estado reg-estado-${this.e(r.estado)}">${r.estado === 'anulada' ? 'Anulada' : 'Aplicada'}</span></dd></div>
                ${r.observaciones ? `<div class="reg-datos-ancho"><dt>Observaciones</dt><dd>${this.e(r.observaciones)}</dd></div>` : ''}
                ${r.estado === 'anulada' ? `<div class="reg-datos-ancho"><dt>Anulada</dt><dd>${this.e(r.anulado_por_nombre || '')} · ${this.e(r.motivo_anulacion || '')}</dd></div>` : ''}
            </dl>
            <div class="table-responsive">
                <table class="data-table">
                    <thead><tr><th>Medicina o artículo</th><th>Movimiento</th><th class="text-right">Existencia antes</th>
                        <th class="text-right">Costo unitario</th><th class="text-right">Valor</th></tr></thead>
                    <tbody>${filas}</tbody>
                    <tfoot><tr><td colspan="4" class="text-right"><strong>Valor al costo</strong></td>
                        <td class="text-right"><strong>${formatQ(r.total_costo)}</strong></td></tr></tfoot>
                </table>
            </div>`, null, null, { ancho: true });
    },

    anular(r) {
        this.dialogo(`Anular ${this.e(r.numero)}`, `
            <p>Se devuelve al inventario todo lo que movió esta regulación (${r.items.length} renglón${r.items.length === 1 ? '' : 'es'}). Queda registrada como anulada.</p>
            <div class="form-group">
                <label for="regMotivoAnulacion">Motivo de la anulación <span class="required">*</span></label>
                <textarea id="regMotivoAnulacion" class="form-input" rows="2" maxlength="500" required></textarea>
            </div>`,
            `<i class="fas fa-ban" aria-hidden="true"></i> Anular ${this.e(r.numero)}`,
            async (f) => {
                const motivo = f.querySelector('#regMotivoAnulacion').value.trim();
                if (motivo.length < 3) throw new Error('Escriba por qué se anula.');
                const data = await this.api(`/${r.id}/anular`, { method: 'PUT', body: JSON.stringify({ motivo }) });
                this.notificar(data.message || 'Regulación anulada', 'success');
                this.cargar();
            },
            { peligro: true });
    }
};

window.RegulacionesModule = RegulacionesModule;
