// ============================================
// MÓDULO DE COTIZACIONES
// Cotizaciones para pacientes o interesados. Se precargan con plantillas,
// se guardan como borrador, se generan (imprimen) y, cuando el paciente
// ingresa, pasan como cargos a su estado de cuenta.
// ============================================

const CotizacionesModule = {
    state: {
        cotizaciones: [],
        plantillas: [],
        actual: null,          // cotización abierta en el editor
        items: [],             // conceptos del editor
        catalogo: [],          // artículos y medicinas que se pueden cotizar
        filtroEstado: '',
        busqueda: '',
        guardando: false
    },

    TIPOS: [
        ['servicio', 'Servicio / consulta'],
        ['internamiento', 'Internamiento'],
        ['medicina', 'Medicamento'],
        ['insumo', 'Insumo'],
        ['examen', 'Examen de laboratorio'],
        ['honorarios', 'Honorarios'],
        ['equipo', 'Equipo médico'],
        ['general', 'Otro']
    ],

    ESTADOS: {
        borrador: 'Borrador',
        generada: 'Generada',
        ingresada: 'Ingresada',
        anulada: 'Anulada'
    },

    NOTAS_PREDETERMINADAS: 'Precios en quetzales, incluyen IVA. Los montos pueden variar según la evolución clínica del paciente.',

    init() {
        if (this._iniciado) return;
        this._iniciado = true;

        document.getElementById('cotNuevaBtn')?.addEventListener('click', () => this.abrirEditor());
        document.getElementById('cotPlantillasBtn')?.addEventListener('click', () => this.abrirPlantillas());
        document.getElementById('cotBusqueda')?.addEventListener('input', e => {
            this.state.busqueda = e.target.value;
            clearTimeout(this._busquedaTimer);
            this._busquedaTimer = setTimeout(() => this.cargar(), 250);
        });
        document.getElementById('cotFiltroEstado')?.addEventListener('change', e => {
            this.state.filtroEstado = e.target.value;
            this.cargar();
        });

        // Editor
        document.getElementById('cotVolverBtn')?.addEventListener('click', () => this.cerrarEditor());
        document.getElementById('cotAgregarItemBtn')?.addEventListener('click', () => this.agregarItem());
        document.getElementById('cotCargarPlantillaBtn')?.addEventListener('click', () => this.cargarPlantillaEnEditor());
        document.getElementById('cotGuardarBtn')?.addEventListener('click', () => this.guardar('borrador'));
        document.getElementById('cotGenerarBtn')?.addEventListener('click', () => this.generar());
        document.getElementById('cotComoPlantillaBtn')?.addEventListener('click', () => this.guardarComoPlantilla());
        document.getElementById('cotIngresarBtn')?.addEventListener('click', () => this.abrirIngreso());
        document.getElementById('cotAnularBtn')?.addEventListener('click', () => this.anular());
        document.getElementById('cotQuitarPacienteBtn')?.addEventListener('click', () => this.seleccionarPaciente(null));

        const busquedaPaciente = document.getElementById('cotBuscarPaciente');
        busquedaPaciente?.addEventListener('input', () => this.sugerirPacientes(busquedaPaciente.value, 'cotSugerenciasPaciente', p => this.seleccionarPaciente(p)));
        busquedaPaciente?.addEventListener('blur', () => setTimeout(() => this.ocultarSugerencias('cotSugerenciasPaciente'), 150));

        const tabla = document.getElementById('cotItemsBody');
        tabla?.addEventListener('input', e => this.onCambioItem(e));
        tabla?.addEventListener('change', e => this.onCambioItem(e));
        tabla?.addEventListener('keydown', e => this.onTeclaBuscador(e));
        tabla?.addEventListener('focusin', e => {
            if (e.target.dataset.campo === 'buscar' && e.target.value.trim()) this.sugerirCatalogo(e.target);
        });
        tabla?.addEventListener('focusout', e => {
            if (e.target.dataset.campo === 'buscar') setTimeout(() => this.ocultarCatalogo(), 150);
        });
        document.querySelector('.pages-container')?.addEventListener('scroll', () => this.ocultarCatalogo(), { passive: true });
        tabla?.addEventListener('click', e => {
            const quitar = e.target.closest('[data-quitar]');
            if (quitar) this.quitarItem(Number(quitar.dataset.quitar));
        });

        document.getElementById('cotLista')?.addEventListener('click', e => {
            const boton = e.target.closest('[data-accion]');
            if (!boton) return;
            const id = boton.dataset.id;
            if (boton.dataset.accion === 'abrir') this.abrirEditor(id);
            if (boton.dataset.accion === 'imprimir') this.imprimirPorId(id);
            if (boton.dataset.accion === 'ingresar') this.abrirEditor(id).then(() => this.abrirIngreso());
            if (boton.dataset.accion === 'eliminar') this.eliminar(id);
        });
    },

    // ---------- Utilidades ----------
    e(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    redondear(valor) {
        return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
    },

    async api(path, options = {}) {
        const token = authManager?.getToken?.();
        if (!token) throw new Error('No hay sesión activa');
        const response = await fetch(`${authManager.apiBaseUrl}/api/cotizaciones${path}`, {
            ...options,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.success === false) {
            // En errores del servidor, el detalle técnico viene en result.error
            const detalle = result.error && result.error !== result.message ? ` (${result.error})` : '';
            throw new Error(`${result.message || result.error || `Error ${response.status}`}${detalle}`);
        }
        return result;
    },

    notificar(mensaje, tipo = 'info') {
        if (typeof showNotification === 'function') showNotification(mensaje, tipo);
        else alert(mensaje);
    },

    estaEditable() {
        return !this.state.actual || ['borrador', 'generada'].includes(this.state.actual.estado);
    },

    hoyKey() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    estadoVisible(c) {
        const vencida = ['borrador', 'generada'].includes(c.estado) && c.valida_hasta && String(c.valida_hasta).slice(0, 10) < this.hoyKey();
        return { clave: vencida ? 'vencida' : c.estado, texto: vencida ? 'Vencida' : this.ESTADOS[c.estado] || c.estado };
    },

    // ---------- Catálogo (artículos + medicinas) ----------
    async cargarCatalogo() {
        if (this._catalogoPromesa) return this._catalogoPromesa;
        const pedir = async path => {
            const response = await fetch(`${authManager.apiBaseUrl}${path}`, { headers: { Authorization: `Bearer ${authManager.getToken()}` } });
            if (!response.ok) throw new Error(`Error ${response.status}`);
            return response.json();
        };
        const tipos = new Set(this.TIPOS.map(([valor]) => valor));
        this._catalogoPromesa = Promise.allSettled([
            pedir('/api/codigos-articulos?activo=true'),
            pedir('/api/medicinas?activo=true')
        ]).then(([articulos, medicinas]) => {
            const lista = [];
            if (articulos.status === 'fulfilled') {
                (articulos.value.articulos || []).forEach(a => {
                    const tipo = String(a.tipo || a.categoria || '').trim().toLowerCase();
                    lista.push({
                        origen: 'articulo',
                        id: String(a.id),
                        nombre: a.nombre_articulo || 'Sin nombre',
                        codigo: a.codigo || a.codigo_barras || a.codigo_alternativo || '',
                        precio: Number(a.precio_unitario ?? 0),
                        tipo_item: tipos.has(tipo) && tipo !== 'medicina' ? tipo : 'general'
                    });
                });
            }
            if (medicinas.status === 'fulfilled') {
                (medicinas.value.medicinas || []).forEach(m => lista.push({
                    origen: 'medicina',
                    id: String(m.id),
                    nombre: m.nombre || 'Sin nombre',
                    codigo: m.codigo_interno || m.codigo_externo || m.codigo_barra || '',
                    precio: Number(m.precio_venta ?? 0),
                    tipo_item: 'medicina'
                }));
            }
            if (articulos.status === 'rejected' || medicinas.status === 'rejected') {
                this._catalogoPromesa = null; // reintentar la próxima vez
                this.notificar('No se pudo cargar por completo el listado de artículos y medicinas', 'warning');
            }
            this.state.catalogo = lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
            return this.state.catalogo;
        });
        return this._catalogoPromesa;
    },

    sugerirCatalogo(input) {
        const normalizar = v => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const terminos = normalizar(input.value).split(/\s+/).filter(Boolean);
        if (terminos.length === 0) {
            this.ocultarCatalogo();
            return;
        }
        const resultados = this.state.catalogo.filter(p => {
            const texto = normalizar(`${p.nombre} ${p.codigo}`);
            return terminos.every(t => texto.includes(t));
        }).slice(0, 12);

        let caja = document.getElementById('cotCatalogoSugerencias');
        if (!caja) {
            caja = document.createElement('div');
            caja.id = 'cotCatalogoSugerencias';
            caja.className = 'patient-suggestions cot-catalogo';
            caja.setAttribute('role', 'listbox');
            caja.addEventListener('mousedown', e => e.preventDefault());
            caja.addEventListener('click', e => {
                const opcion = e.target.closest('[data-opcion]');
                if (opcion) this.elegirDelCatalogo(Number(opcion.dataset.opcion));
            });
            document.body.appendChild(caja);
        }
        this._catalogoResultados = resultados;
        this._catalogoFila = Number(input.closest('tr[data-index]').dataset.index);
        this._catalogoActivo = resultados.length ? 0 : -1;
        caja.innerHTML = resultados.length
            ? resultados.map((p, i) => `<button type="button" class="patient-suggestion" role="option" data-opcion="${i}">
                    <strong>${this.e(p.nombre)}</strong>
                    <span>${p.origen === 'medicina' ? 'Medicina' : 'Artículo'}${p.codigo ? ` · ${this.e(p.codigo)}` : ''} · ${formatQ(p.precio)}</span></button>`).join('')
            : `<div class="patient-suggestion-empty">${this.state.catalogo.length ? 'Ningún artículo o medicina coincide.' : 'Cargando listado de artículos y medicinas…'}</div>`;
        const r = input.getBoundingClientRect();
        caja.style.top = `${r.bottom + 4}px`;
        caja.style.left = `${r.left}px`;
        caja.style.width = `${Math.max(r.width, 320)}px`;
        caja.style.display = 'block';
        this.marcarOpcionActiva();
    },

    marcarOpcionActiva() {
        document.querySelectorAll('#cotCatalogoSugerencias [data-opcion]').forEach((el, i) => {
            el.classList.toggle('activa', i === this._catalogoActivo);
            if (i === this._catalogoActivo) el.scrollIntoView({ block: 'nearest' });
        });
    },

    ocultarCatalogo() {
        const caja = document.getElementById('cotCatalogoSugerencias');
        if (caja) caja.style.display = 'none';
        this._catalogoResultados = [];
    },

    onTeclaBuscador(event) {
        if (event.target.dataset.campo !== 'buscar' || !this._catalogoResultados?.length) return;
        const total = this._catalogoResultados.length;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            this._catalogoActivo = (this._catalogoActivo + (event.key === 'ArrowDown' ? 1 : -1) + total) % total;
            this.marcarOpcionActiva();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            this.elegirDelCatalogo(this._catalogoActivo);
        } else if (event.key === 'Escape') {
            this.ocultarCatalogo();
        }
    },

    elegirDelCatalogo(indice) {
        const producto = this._catalogoResultados?.[indice];
        const item = this.state.items[this._catalogoFila];
        if (!producto || !item) return;
        Object.assign(item, {
            descripcion: producto.nombre,
            tipo_item: producto.tipo_item,
            precio_unitario: producto.precio,
            articulo_id: producto.origen === 'articulo' ? producto.id : null,
            medicina_id: producto.origen === 'medicina' ? producto.id : null,
            codigo: producto.codigo
        });
        const fila = this._catalogoFila;
        this.ocultarCatalogo();
        this.renderItems();
        document.querySelector(`#cotItemsBody tr[data-index="${fila}"] [data-campo="cantidad"]`)?.focus();
    },

    // Datos de catálogo (código) para mostrar en filas ya guardadas
    enlazarCatalogo(item) {
        const producto = this.state.catalogo.find(p =>
            (item.articulo_id && p.origen === 'articulo' && p.id === String(item.articulo_id)) ||
            (item.medicina_id && p.origen === 'medicina' && p.id === String(item.medicina_id)));
        return producto ? { ...item, codigo: producto.codigo } : item;
    },

    // ---------- Listado ----------
    async cargar() {
        this.init();
        const contenedor = document.getElementById('cotLista');
        if (!contenedor) return;
        try {
            const params = new URLSearchParams();
            if (this.state.filtroEstado) params.set('estado', this.state.filtroEstado);
            if (this.state.busqueda.trim()) params.set('q', this.state.busqueda.trim());
            const [lista, plantillas] = await Promise.all([
                this.api(`?${params}`),
                this.api('/plantillas').catch(() => ({ data: this.state.plantillas }))
            ]);
            this.state.cotizaciones = lista.data || [];
            this.state.plantillas = plantillas.data || [];
            this.renderLista();
        } catch (error) {
            contenedor.innerHTML = `<div class="cot-vacio"><p>No se pudieron cargar las cotizaciones.</p><small>${this.e(error.message)}</small></div>`;
        }
    },

    renderLista() {
        const contenedor = document.getElementById('cotLista');
        const lista = this.state.cotizaciones;
        if (lista.length === 0) {
            contenedor.innerHTML = `
                <div class="cot-vacio">
                    <p>${this.state.busqueda || this.state.filtroEstado ? 'No hay cotizaciones con estos filtros.' : 'Aún no hay cotizaciones.'}</p>
                    <button type="button" class="btn btn-primary" onclick="CotizacionesModule.abrirEditor()"><i class="fas fa-plus" aria-hidden="true"></i> Nueva cotización</button>
                </div>`;
            return;
        }
        contenedor.innerHTML = `
            <div class="table-responsive">
                <table class="data-table cot-tabla">
                    <thead><tr>
                        <th>Número</th><th>Fecha</th><th>Cliente</th><th>Motivo</th>
                        <th class="text-right">Total</th><th>Válida hasta</th><th>Estado</th><th class="text-center">Acciones</th>
                    </tr></thead>
                    <tbody>
                        ${lista.map(c => {
                            const estado = this.estadoVisible(c);
                            const editable = ['borrador', 'generada'].includes(c.estado);
                            return `<tr>
                                <td><strong>${this.e(c.numero)}</strong></td>
                                <td>${formatFecha(c.created_at)}</td>
                                <td>${this.e(c.cliente_nombre)}${c.paciente_id ? ' <span class="cot-tag">Paciente</span>' : ''}
                                    ${c.cliente_telefono ? `<small class="cot-sub">${this.e(c.cliente_telefono)}</small>` : ''}</td>
                                <td><small>${this.e(c.motivo || '—')}</small></td>
                                <td class="text-right"><strong>${formatQ(c.total)}</strong><small class="cot-sub">${c.total_items} concepto${c.total_items === 1 ? '' : 's'}</small></td>
                                <td>${c.valida_hasta ? formatFecha(c.valida_hasta) : '—'}</td>
                                <td><span class="cot-estado cot-estado-${estado.clave}">${estado.texto}</span>
                                    ${c.numero_factura ? `<small class="cot-sub">Factura ${this.e(c.numero_factura)}</small>` : ''}</td>
                                <td><div class="acciones-saldo">
                                    <button type="button" class="btn-accion btn-accion-icono" data-accion="abrir" data-id="${this.e(c.id)}" title="${editable ? 'Abrir / editar' : 'Ver'}" aria-label="Abrir cotización"><i class="fas ${editable ? 'fa-pen' : 'fa-eye'}" aria-hidden="true"></i></button>
                                    <button type="button" class="btn-accion btn-accion-icono" data-accion="imprimir" data-id="${this.e(c.id)}" title="Imprimir" aria-label="Imprimir cotización"><i class="fas fa-print" aria-hidden="true"></i></button>
                                    ${editable ? `<button type="button" class="btn-accion btn-accion-primaria" data-accion="ingresar" data-id="${this.e(c.id)}" title="El paciente ingresa: pasar a su estado de cuenta"><i class="fas fa-right-to-bracket" aria-hidden="true"></i> Ingresar</button>` : ''}
                                    ${Permisos.esAdmin() ? `<button type="button" class="btn-accion btn-accion-icono btn-accion-peligro" data-accion="eliminar" data-id="${this.e(c.id)}" title="Eliminar" aria-label="Eliminar cotización ${this.e(c.numero)}"><i class="fas fa-trash" aria-hidden="true"></i></button>` : ''}
                                </div></td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
    },

    // ---------- Editor ----------
    async abrirEditor(id = null) {
        this.init();
        let cotizacion = null;
        if (id) {
            try {
                cotizacion = (await this.api(`/${encodeURIComponent(id)}`)).data;
            } catch (error) {
                this.notificar(`No se pudo abrir la cotización: ${error.message}`, 'error');
                return;
            }
        }
        this.state.actual = cotizacion;
        await this.cargarCatalogo();
        this.state.items = (cotizacion?.items || []).map(i => this.enlazarCatalogo({
            descripcion: i.descripcion,
            contenido: i.contenido || '',
            tipo_item: i.tipo_item,
            cantidad: Number(i.cantidad),
            precio_unitario: Number(i.precio_unitario),
            descuento: Number(i.descuento),
            articulo_id: i.articulo_id || null,
            medicina_id: i.medicina_id || null
        }));
        if (!cotizacion) this.agregarItem(false);

        const valor = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v ?? ''; };
        valor('cotClienteNombre', cotizacion?.cliente_nombre);
        valor('cotClienteTelefono', cotizacion?.cliente_telefono);
        valor('cotClienteDpi', cotizacion?.cliente_dpi);
        valor('cotClienteEmail', cotizacion?.cliente_email);
        valor('cotClienteResponsable', cotizacion?.cliente_responsable);
        valor('cotMotivo', cotizacion?.motivo);
        valor('cotVigencia', cotizacion?.vigencia_dias || 15);
        valor('cotNotas', cotizacion ? cotizacion.notas : this.NOTAS_PREDETERMINADAS);
        valor('cotBuscarPaciente', '');
        this.state.pacienteId = cotizacion?.paciente_id || null;
        this.renderPacienteVinculado(cotizacion?.paciente_id ? { id: cotizacion.paciente_id, nombre: cotizacion.paciente_nombre || cotizacion.cliente_nombre } : null);

        this.renderPlantillasSelect();
        this.renderEncabezadoEditor();
        this.renderItems();
        document.getElementById('cotListado').hidden = true;
        document.getElementById('cotEditor').hidden = false;
        document.querySelector('.pages-container')?.scrollTo({ top: 0 });
        if (!cotizacion) setTimeout(() => document.getElementById('cotClienteNombre')?.focus(), 50);
    },

    cerrarEditor() {
        this.ocultarCatalogo();
        document.getElementById('cotEditor').hidden = true;
        document.getElementById('cotListado').hidden = false;
        this.state.actual = null;
        this.cargar();
    },

    renderEncabezadoEditor() {
        const c = this.state.actual;
        const editable = this.estaEditable();
        const titulo = document.getElementById('cotEditorTitulo');
        if (titulo) {
            const estado = c ? this.estadoVisible(c) : null;
            titulo.innerHTML = c
                ? `${this.e(c.numero)} <span class="cot-estado cot-estado-${estado.clave}">${estado.texto}</span>`
                : 'Nueva cotización';
        }
        const aviso = document.getElementById('cotAvisoEstado');
        if (aviso) {
            if (c?.estado === 'ingresada') {
                aviso.hidden = false;
                aviso.className = 'cot-aviso cot-aviso-ok';
                aviso.innerHTML = `<i class="fas fa-circle-check" aria-hidden="true"></i> <span>Paciente ingresado (${formatFechaHora(c.fecha_ingreso)}). Cargada a su estado de cuenta con la factura <strong>${this.e(c.numero_factura)}</strong>.</span>`;
            } else if (c?.estado === 'anulada') {
                aviso.hidden = false;
                aviso.className = 'cot-aviso cot-aviso-error';
                aviso.innerHTML = `<i class="fas fa-ban" aria-hidden="true"></i> Cotización anulada: ${this.e(c.motivo_anulacion || '')}`;
            } else {
                aviso.hidden = true;
            }
        }
        document.querySelectorAll('#cotEditor [data-solo-editable]').forEach(el => { el.hidden = !editable; });
        document.querySelectorAll('#cotEditor input, #cotEditor textarea, #cotEditor select').forEach(el => {
            if (!el.closest('[data-siempre-activo]')) el.disabled = !editable;
        });
        const ingresar = document.getElementById('cotIngresarBtn');
        const anular = document.getElementById('cotAnularBtn');
        if (ingresar) ingresar.hidden = !editable;
        if (anular) anular.hidden = !(editable && c);
    },

    agregarItem(render = true) {
        this.state.items.push({ descripcion: '', contenido: '', tipo_item: 'general', cantidad: 1, precio_unitario: 0, descuento: 0, articulo_id: null, medicina_id: null });
        if (render) {
            this.renderItems();
            const filas = document.querySelectorAll('#cotItemsBody tr');
            filas[filas.length - 1]?.querySelector('[data-campo="buscar"]')?.focus();
        }
    },

    quitarItem(index) {
        this.state.items.splice(index, 1);
        this.renderItems();
    },

    esDelCatalogo(item) {
        return Boolean(item.articulo_id || item.medicina_id);
    },

    totalItem(item) {
        return this.redondear(Math.max(0, (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0) - (Number(item.descuento) || 0)));
    },

    renderItems() {
        const tbody = document.getElementById('cotItemsBody');
        if (!tbody) return;
        const editable = this.estaEditable();
        if (this.state.items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center cot-sub" style="padding: 18px;">Sin conceptos. Agrega uno o carga una plantilla.</td></tr>`;
        } else {
            tbody.innerHTML = this.state.items.map((item, i) => {
                const delCatalogo = this.esDelCatalogo(item);
                const origen = item.medicina_id ? 'Medicina' : 'Artículo';
                const detalle = delCatalogo
                    ? `<small class="cot-sub cot-origen">${origen}${item.codigo ? ` · ${this.e(item.codigo)}` : ''}</small>`
                    : (String(item.descripcion || '').trim()
                        ? '<small class="cot-origen cot-origen-error">Elige el concepto del listado de artículos o medicinas</small>'
                        : '');
                const tipos = item.medicina_id
                    ? this.TIPOS.filter(([valor]) => valor === 'medicina')
                    : this.TIPOS.filter(([valor]) => valor !== 'medicina');
                return `
                <tr data-index="${i}">
                    <td><input type="search" class="form-input${delCatalogo || !String(item.descripcion || '').trim() ? '' : ' cot-input-error'}" data-campo="buscar" value="${this.e(item.descripcion)}" placeholder="Buscar artículo o medicina" aria-label="Concepto (artículo o medicina)" autocomplete="off" ${editable ? '' : 'disabled'}>
                        ${detalle}
                        <textarea class="form-input cot-contenido" data-campo="contenido" rows="${Math.min(6, Math.max(2, String(item.contenido || '').split('\n').length))}" placeholder="Qué contiene (un punto por línea, opcional)" aria-label="Qué contiene" ${editable ? '' : 'disabled'}>${this.e(item.contenido)}</textarea></td>
                    <td><select class="form-input" data-campo="tipo_item" aria-label="Tipo" ${editable && !item.medicina_id ? '' : 'disabled'}>
                        ${tipos.map(([valor, texto]) => `<option value="${valor}" ${valor === item.tipo_item ? 'selected' : ''}>${texto}</option>`).join('')}
                    </select></td>
                    <td><input type="number" class="form-input cot-num" data-campo="cantidad" value="${item.cantidad}" min="1" step="1" aria-label="Cantidad" ${editable ? '' : 'disabled'}></td>
                    <td><input type="number" class="form-input cot-num" data-campo="precio_unitario" value="${item.precio_unitario}" min="0" step="0.01" aria-label="Precio unitario" ${editable ? '' : 'disabled'}></td>
                    <td><input type="number" class="form-input cot-num" data-campo="descuento" value="${item.descuento}" min="0" step="0.01" aria-label="Descuento" ${editable ? '' : 'disabled'}></td>
                    <td class="text-right"><strong data-total-item>${formatQ(this.totalItem(item))}</strong></td>
                    <td>${editable ? `<button type="button" class="btn-accion btn-accion-icono" data-quitar="${i}" title="Quitar concepto" aria-label="Quitar concepto"><i class="fas fa-trash" aria-hidden="true"></i></button>` : ''}</td>
                </tr>`;
            }).join('');
        }
        this.renderTotales();
    },

    onCambioItem(event) {
        const campo = event.target.dataset.campo;
        const fila = event.target.closest('tr[data-index]');
        if (!campo || !fila) return;
        const item = this.state.items[Number(fila.dataset.index)];
        if (campo === 'buscar') {
            // Escribir en el buscador suelta el concepto elegido hasta escoger otro del listado
            if (event.type !== 'input') return;
            if (this.esDelCatalogo(item)) {
                Object.assign(item, { articulo_id: null, medicina_id: null, codigo: '' });
                const detalle = fila.querySelector('.cot-origen');
                if (detalle) detalle.remove();
            }
            item.descripcion = event.target.value;
            this.cargarCatalogo().then(() => {
                if (document.activeElement === event.target) this.sugerirCatalogo(event.target);
            });
            return;
        }
        item[campo] = ['cantidad', 'precio_unitario', 'descuento'].includes(campo)
            ? Number(event.target.value) || 0
            : event.target.value;
        fila.querySelector('[data-total-item]').textContent = formatQ(this.totalItem(item));
        this.renderTotales();
    },

    calcularTotales() {
        const subtotal = this.redondear(this.state.items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0), 0));
        const descuento = this.redondear(this.state.items.reduce((s, i) => s + (Number(i.descuento) || 0), 0));
        const total = this.redondear(subtotal - descuento);
        const iva = typeof desglosarIVA === 'function' ? desglosarIVA(total).iva : this.redondear(total - total / 1.12);
        return { subtotal, descuento, total, iva };
    },

    renderTotales() {
        const t = this.calcularTotales();
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('cotSubtotal', formatQ(t.subtotal));
        set('cotDescuento', `-${formatQ(t.descuento)}`);
        set('cotTotal', formatQ(t.total));
        set('cotIvaIncluido', formatQ(t.iva));
    },

    // ---------- Paciente ----------
    async obtenerPacientes() {
        if (typeof PacientesModule !== 'undefined' && PacientesModule.state?.pacientes?.length) {
            return PacientesModule.state.pacientes;
        }
        if (this._pacientesCache) return this._pacientesCache;
        try {
            const response = await fetch(`${authManager.apiBaseUrl}/api/pacientes`, { headers: { Authorization: `Bearer ${authManager.getToken()}` } });
            const data = await response.json();
            this._pacientesCache = typeof DataNormalizer !== 'undefined' ? DataNormalizer.normalizePacientes(data.pacientes || []) : (data.pacientes || []);
        } catch (error) {
            this._pacientesCache = [];
        }
        return this._pacientesCache;
    },

    nombrePaciente(p) {
        return [p.nombre, p.apellidoPaterno || p.apellido_paterno, p.apellidoMaterno || p.apellido_materno].filter(Boolean).join(' ');
    },

    async sugerirPacientes(termino, contenedorId, alSeleccionar) {
        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) return;
        const texto = String(termino || '').trim().toLowerCase();
        if (texto.length < 2) {
            this.ocultarSugerencias(contenedorId);
            return;
        }
        const normalizar = v => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const t = normalizar(texto);
        const digitos = t.replace(/\D/g, '');
        const pacientes = (await this.obtenerPacientes()).filter(p =>
            normalizar(this.nombrePaciente(p)).includes(t) ||
            (digitos && String(p.dpi || '').replace(/\D/g, '').includes(digitos)) ||
            (digitos && String(p.telefono || '').replace(/\D/g, '').includes(digitos))
        ).slice(0, 8);

        this._sugerencias = pacientes;
        this._alSeleccionar = alSeleccionar;
        contenedor.innerHTML = pacientes.length
            ? pacientes.map((p, i) => `<button type="button" class="patient-suggestion" onmousedown="event.preventDefault()" onclick="CotizacionesModule.elegirSugerencia(${i}, '${contenedorId}')">
                    <strong>${this.e(this.nombrePaciente(p))}</strong><span>DPI ${this.e(p.dpi || '—')} · Tel. ${this.e(p.telefono || '—')}</span></button>`).join('')
            : '<div class="patient-suggestion-empty">No hay pacientes registrados que coincidan.</div>';
        contenedor.style.display = 'block';
    },

    elegirSugerencia(index, contenedorId) {
        const paciente = this._sugerencias?.[index];
        this.ocultarSugerencias(contenedorId);
        if (paciente && this._alSeleccionar) this._alSeleccionar(paciente);
    },

    ocultarSugerencias(contenedorId) {
        const contenedor = document.getElementById(contenedorId);
        if (contenedor) contenedor.style.display = 'none';
    },

    seleccionarPaciente(paciente) {
        this.state.pacienteId = paciente ? paciente.id : null;
        if (paciente) {
            const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
            set('cotClienteNombre', this.nombrePaciente(paciente));
            set('cotClienteTelefono', paciente.telefono);
            set('cotClienteDpi', paciente.dpi);
            set('cotClienteEmail', paciente.email);
            document.getElementById('cotBuscarPaciente').value = '';
        }
        this.renderPacienteVinculado(paciente ? { id: paciente.id, nombre: this.nombrePaciente(paciente) || paciente.nombre } : null);
    },

    renderPacienteVinculado(paciente) {
        const caja = document.getElementById('cotPacienteVinculado');
        const busqueda = document.getElementById('cotBuscarPacienteGrupo');
        if (!caja) return;
        caja.hidden = !paciente;
        if (busqueda) busqueda.hidden = Boolean(paciente);
        const nombre = document.getElementById('cotPacienteVinculadoNombre');
        if (nombre) nombre.textContent = paciente ? paciente.nombre : '';
    },

    // ---------- Guardar / generar ----------
    datosFormulario(estado) {
        const valor = id => document.getElementById(id)?.value?.trim() || '';
        return {
            paciente_id: this.state.pacienteId || null,
            cliente_nombre: valor('cotClienteNombre'),
            cliente_telefono: valor('cotClienteTelefono'),
            cliente_dpi: valor('cotClienteDpi'),
            cliente_email: valor('cotClienteEmail'),
            cliente_responsable: valor('cotClienteResponsable'),
            motivo: valor('cotMotivo'),
            notas: valor('cotNotas'),
            vigencia_dias: Number(valor('cotVigencia')) || 15,
            estado,
            items: this.state.items
                .filter(i => this.esDelCatalogo(i) || String(i.descripcion || '').trim())
                .map(i => ({
                    descripcion: String(i.descripcion || '').trim(),
                    contenido: String(i.contenido || '').trim(),
                    tipo_item: i.tipo_item,
                    cantidad: Number(i.cantidad),
                    precio_unitario: Number(i.precio_unitario),
                    descuento: Number(i.descuento) || 0,
                    articulo_id: i.articulo_id || null,
                    medicina_id: i.medicina_id || null
                }))
        };
    },

    validar(datos) {
        if (!datos.cliente_nombre) return 'Escribe el nombre del cliente o selecciona un paciente';
        if (datos.items.length === 0) return 'Agrega al menos un concepto del listado de artículos o medicinas';
        const fuera = datos.items.find(i => !this.esDelCatalogo(i));
        if (fuera) return `"${fuera.descripcion}" no es del listado. Búscalo y elígelo entre los artículos o medicinas, o quita la fila.`;
        if (datos.items.some(i => !Number.isInteger(i.cantidad) || i.cantidad < 1)) return 'Las cantidades deben ser números enteros mayores a 0';
        if (datos.items.some(i => i.precio_unitario < 0 || i.descuento < 0)) return 'Los precios y descuentos no pueden ser negativos';
        if (datos.items.some(i => i.descuento > i.cantidad * i.precio_unitario)) return 'Un descuento es mayor que el subtotal de su concepto';
        return null;
    },

    async guardar(estado = 'borrador', { silencioso = false } = {}) {
        if (this.state.guardando) return null;
        const datos = this.datosFormulario(estado);
        const error = this.validar(datos);
        if (error) {
            this.notificar(error, 'warning');
            return null;
        }
        this.state.guardando = true;
        document.querySelectorAll('#cotEditor .cot-acciones button').forEach(b => { b.disabled = true; });
        try {
            const id = this.state.actual?.id;
            const result = await this.api(id ? `/${encodeURIComponent(id)}` : '', {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(datos)
            });
            this.state.actual = result.data;
            this.renderEncabezadoEditor();
            if (!silencioso) this.notificar(`Cotización ${result.data.numero} guardada`, 'success');
            return result.data;
        } catch (err) {
            this.notificar(`No se pudo guardar: ${err.message}`, 'error');
            return null;
        } finally {
            this.state.guardando = false;
            document.querySelectorAll('#cotEditor .cot-acciones button').forEach(b => { b.disabled = false; });
        }
    },

    async generar() {
        const cotizacion = await this.guardar('generada', { silencioso: true });
        if (!cotizacion) return;
        this.notificar(`Cotización ${cotizacion.numero} generada`, 'success');
        this.imprimir(cotizacion);
    },

    // ---------- Ingreso del paciente ----------
    abrirIngreso() {
        const c = this.state.actual;
        if (!c) {
            this.notificar('Guarda la cotización antes de ingresar al paciente', 'warning');
            return;
        }
        if (!['borrador', 'generada'].includes(c.estado)) return;

        document.getElementById('cotIngresoModal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'cotIngresoModal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 520px;">
                <div class="modal-header">
                    <h2><i class="fas fa-right-to-bracket" aria-hidden="true"></i> Ingreso del paciente</h2>
                    <button type="button" class="modal-close" aria-label="Cerrar" onclick="document.getElementById('cotIngresoModal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 12px;">La cotización <strong>${this.e(c.numero)}</strong> por <strong>${formatQ(c.total)}</strong> se cargará al estado de cuenta del paciente con estos mismos precios.</p>
                    <div class="form-group">
                        <label for="cotIngresoBuscar">Paciente que ingresa <span class="required">*</span></label>
                        <div class="patient-search-box">
                            <input type="search" id="cotIngresoBuscar" class="form-input" placeholder="Buscar por nombre, DPI o teléfono" autocomplete="off">
                            <div id="cotIngresoSugerencias" class="patient-suggestions" style="display: none;"></div>
                        </div>
                        <p id="cotIngresoSeleccionado" class="patient-selected-info" hidden></p>
                    </div>
                    <p class="form-hint">¿Es un paciente nuevo? <a href="#" id="cotRegistrarPaciente">Regístralo en Pacientes</a> y vuelve a esta cotización.</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('cotIngresoModal').remove()">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="cotIngresoConfirmar" disabled><i class="fas fa-check" aria-hidden="true"></i> Ingresar y cargar a su cuenta</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        let pacienteElegido = null;
        const confirmar = modal.querySelector('#cotIngresoConfirmar');
        const seleccionado = modal.querySelector('#cotIngresoSeleccionado');
        const elegir = paciente => {
            pacienteElegido = paciente;
            seleccionado.hidden = false;
            seleccionado.innerHTML = `<i class="fas fa-circle-check" aria-hidden="true"></i><span><strong>${this.e(this.nombrePaciente(paciente) || paciente.nombre)}</strong><br>DPI ${this.e(paciente.dpi || '—')} · Tel. ${this.e(paciente.telefono || '—')}</span>`;
            confirmar.disabled = false;
        };
        const buscar = modal.querySelector('#cotIngresoBuscar');
        buscar.addEventListener('input', () => this.sugerirPacientes(buscar.value, 'cotIngresoSugerencias', elegir));
        buscar.addEventListener('blur', () => setTimeout(() => this.ocultarSugerencias('cotIngresoSugerencias'), 150));

        // Si la cotización ya estaba ligada a un paciente, se propone ese
        if (c.paciente_id) {
            this.obtenerPacientes().then(pacientes => {
                const p = pacientes.find(item => String(item.id) === String(c.paciente_id));
                elegir(p || { id: c.paciente_id, nombre: c.paciente_nombre || c.cliente_nombre });
            });
        } else {
            buscar.value = c.cliente_nombre || '';
            buscar.focus();
            this.sugerirPacientes(buscar.value, 'cotIngresoSugerencias', elegir);
        }

        modal.querySelector('#cotRegistrarPaciente').addEventListener('click', event => {
            event.preventDefault();
            modal.remove();
            navigateToPage('pacientes');
            setTimeout(() => document.getElementById('addPacientBtn')?.click(), 150);
        });

        confirmar.addEventListener('click', async () => {
            if (!pacienteElegido) return;
            confirmar.disabled = true;
            try {
                const result = await this.api(`/${encodeURIComponent(c.id)}/ingresar`, {
                    method: 'POST',
                    body: JSON.stringify({ paciente_id: pacienteElegido.id })
                });
                modal.remove();
                this.state.actual = result.data;
                this.renderEncabezadoEditor();
                this.renderItems();
                this.notificar(result.message || 'Cotización cargada al estado de cuenta', 'success');
                if (typeof SaldoPacienteFacturacion !== 'undefined' && SaldoPacienteFacturacion.refrescarSaldoDelPaciente) {
                    SaldoPacienteFacturacion.refrescarSaldoDelPaciente(pacienteElegido.id);
                }
            } catch (error) {
                confirmar.disabled = false;
                this.notificar(`No se pudo ingresar: ${error.message}`, 'error');
            }
        });
    },

    async anular() {
        const c = this.state.actual;
        if (!c) return;
        const motivo = prompt(`Motivo para anular la cotización ${c.numero}:`);
        if (motivo === null) return;
        if (!motivo.trim()) {
            this.notificar('Escribe el motivo de la anulación', 'warning');
            return;
        }
        try {
            await this.api(`/${encodeURIComponent(c.id)}/anular`, { method: 'POST', body: JSON.stringify({ motivo }) });
            this.notificar(`Cotización ${c.numero} anulada`, 'success');
            await this.abrirEditor(c.id);
        } catch (error) {
            this.notificar(`No se pudo anular: ${error.message}`, 'error');
        }
    },

    // Solo administrador
    async eliminar(id) {
        if (!Permisos.esAdmin()) return;
        const c = this.state.cotizaciones.find(item => item.id === id);
        if (!c) return;
        const aviso = c.estado === 'ingresada'
            ? '\n\nYa fue ingresada: los cargos que pasó al estado de cuenta del paciente se conservan.'
            : '';
        if (!confirm(`¿Eliminar la cotización ${c.numero}? No se puede deshacer.${aviso}`)) return;
        try {
            await this.api(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
            this.notificar(`Cotización ${c.numero} eliminada`, 'success');
            await this.cargar();
        } catch (error) {
            this.notificar(`No se pudo eliminar: ${error.message}`, 'error');
        }
    },

    // ---------- Plantillas ----------
    renderPlantillasSelect() {
        const select = document.getElementById('cotPlantillaSelect');
        if (!select) return;
        const plantillas = this.state.plantillas;
        select.innerHTML = plantillas.length
            ? '<option value="">Elegir plantilla…</option>' + plantillas.map(p => {
                const total = (p.items || []).reduce((s, i) => s + this.totalItem(i), 0);
                return `<option value="${p.id}">${this.e(p.nombre)} · ${formatQ(total)}</option>`;
            }).join('')
            : '<option value="">No hay plantillas guardadas</option>';
    },

    cargarPlantillaEnEditor() {
        const id = document.getElementById('cotPlantillaSelect')?.value;
        const plantilla = this.state.plantillas.find(p => String(p.id) === String(id));
        if (!plantilla) {
            this.notificar('Elige una plantilla', 'warning');
            return;
        }
        // Quitar filas vacías antes de agregar los conceptos de la plantilla
        this.state.items = this.state.items.filter(i => this.esDelCatalogo(i) || String(i.descripcion || '').trim());
        (plantilla.items || []).forEach(i => this.state.items.push(this.enlazarCatalogo({
            descripcion: i.descripcion,
            contenido: i.contenido || '',
            tipo_item: i.tipo_item || 'general',
            cantidad: Number(i.cantidad) || 1,
            precio_unitario: Number(i.precio_unitario) || 0,
            descuento: Number(i.descuento) || 0,
            articulo_id: i.articulo_id || null,
            medicina_id: i.medicina_id || null
        })));
        const motivo = document.getElementById('cotMotivo');
        if (motivo && !motivo.value.trim()) motivo.value = plantilla.nombre;
        this.renderItems();
        this.notificar(`Plantilla "${plantilla.nombre}" cargada. Ajusta precios y cantidades si hace falta.`, 'success');
    },

    async guardarComoPlantilla() {
        const datos = this.datosFormulario('borrador');
        const items = datos.items;
        if (items.length === 0) {
            this.notificar('Agrega conceptos antes de guardar la plantilla', 'warning');
            return;
        }
        const fuera = items.find(i => !this.esDelCatalogo(i));
        if (fuera) {
            this.notificar(`"${fuera.descripcion}" no es del listado de artículos o medicinas. Elígelo del listado o quita la fila.`, 'warning');
            return;
        }
        const nombre = prompt('Nombre de la plantilla (ej. "Internamiento 7 días"):', datos.motivo || '');
        if (!nombre || !nombre.trim()) return;
        const existente = this.state.plantillas.find(p => p.nombre.toLowerCase() === nombre.trim().toLowerCase());
        if (existente && !confirm(`Ya existe la plantilla "${existente.nombre}". ¿Reemplazar sus conceptos?`)) return;
        try {
            const result = await this.api(existente ? `/plantillas/${existente.id}` : '/plantillas', {
                method: existente ? 'PUT' : 'POST',
                body: JSON.stringify({ nombre: nombre.trim(), items })
            });
            this.state.plantillas = [...this.state.plantillas.filter(p => p.id !== result.data.id), result.data]
                .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
            this.renderPlantillasSelect();
            this.notificar(`Plantilla "${result.data.nombre}" guardada`, 'success');
        } catch (error) {
            this.notificar(`No se pudo guardar la plantilla: ${error.message}`, 'error');
        }
    },

    async abrirPlantillas() {
        try {
            this.state.plantillas = (await this.api('/plantillas')).data || [];
        } catch (error) {
            this.notificar(`No se pudieron cargar las plantillas: ${error.message}`, 'error');
            return;
        }
        document.getElementById('cotPlantillasModal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'cotPlantillasModal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        const render = () => {
            const lista = this.state.plantillas;
            modal.querySelector('#cotPlantillasLista').innerHTML = lista.length
                ? lista.map(p => {
                    const total = (p.items || []).reduce((s, i) => s + this.totalItem(i), 0);
                    return `<li class="cot-plantilla">
                        <div><strong>${this.e(p.nombre)}</strong>
                            <small class="cot-sub">${(p.items || []).length} concepto${(p.items || []).length === 1 ? '' : 's'} · ${formatQ(total)}</small>
                            <small class="cot-sub">${this.e((p.items || []).map(i => i.descripcion).join(', '))}</small></div>
                        <div class="acciones-saldo">
                            <button type="button" class="btn-accion" data-usar="${p.id}"><i class="fas fa-file-circle-plus" aria-hidden="true"></i> Nueva cotización</button>
                            <button type="button" class="btn-accion btn-accion-icono" data-borrar="${p.id}" title="Eliminar plantilla" aria-label="Eliminar plantilla"><i class="fas fa-trash" aria-hidden="true"></i></button>
                        </div></li>`;
                }).join('')
                : '<li class="cot-vacio"><p>No hay plantillas.</p><small>Crea una cotización, agrega sus conceptos y usa "Guardar como plantilla".</small></li>';
        };
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 640px;">
                <div class="modal-header">
                    <h2><i class="fas fa-layer-group" aria-hidden="true"></i> Plantillas de cotización</h2>
                    <button type="button" class="modal-close" aria-label="Cerrar" onclick="document.getElementById('cotPlantillasModal').remove()">&times;</button>
                </div>
                <div class="modal-body"><ul id="cotPlantillasLista" class="cot-plantillas"></ul></div>
            </div>`;
        document.body.appendChild(modal);
        render();
        modal.addEventListener('click', async event => {
            const usar = event.target.closest('[data-usar]');
            const borrar = event.target.closest('[data-borrar]');
            if (usar) {
                modal.remove();
                await this.abrirEditor();
                document.getElementById('cotPlantillaSelect').value = usar.dataset.usar;
                this.state.items = [];
                this.cargarPlantillaEnEditor();
            }
            if (borrar) {
                const plantilla = this.state.plantillas.find(p => String(p.id) === borrar.dataset.borrar);
                if (!plantilla || !confirm(`¿Eliminar la plantilla "${plantilla.nombre}"?`)) return;
                try {
                    await this.api(`/plantillas/${plantilla.id}`, { method: 'DELETE' });
                    this.state.plantillas = this.state.plantillas.filter(p => p.id !== plantilla.id);
                    render();
                } catch (error) {
                    this.notificar(`No se pudo eliminar: ${error.message}`, 'error');
                }
            }
        });
    },

    // ---------- Impresión ----------
    async imprimirPorId(id) {
        try {
            this.imprimir((await this.api(`/${encodeURIComponent(id)}`)).data);
        } catch (error) {
            this.notificar(`No se pudo cargar la cotización: ${error.message}`, 'error');
        }
    },

    // Conceptos agrupados por tipo, en el orden en que aparece cada tipo
    agruparPorTipo(items) {
        const grupos = new Map();
        (items || []).forEach(item => {
            const tipo = item.tipo_item || 'general';
            if (!grupos.has(tipo)) grupos.set(tipo, []);
            grupos.get(tipo).push(item);
        });
        return [...grupos.entries()];
    },

    imprimir(c) {
        const e = v => this.e(v);
        const clinica = (typeof CONFIG !== 'undefined' && CONFIG.CLINICA) || { nombre: 'Zentra MED' };
        const tipos = Object.fromEntries(this.TIPOS);
        // Precios con IVA incluido: el subtotal impreso es la base sin IVA
        const total = this.redondear(c.total);
        const iva = typeof desglosarIVA === 'function' ? desglosarIVA(total).iva : this.redondear(total - total / 1.12);
        const base = this.redondear(total - iva);
        const descuento = Number(c.descuento) || 0;
        const fecha = formatFecha(c.fecha_generada || c.created_at);
        // Logo propio en img/logo-clinica.png; si no existe se usa el de Zentra
        const logo = new URL('img/logo-clinica.png', location.href).href;
        const logoRespaldo = new URL('img/zentra-logo.png', location.href).href;

        const filas = this.agruparPorTipo(c.items).map(([tipo, items]) => items.map((i, n) => {
            const lineas = String(i.contenido || '').split('\n').map(l => l.trim()).filter(Boolean);
            const desc = Number(i.descuento) || 0;
            return `<tr>
                ${n === 0 ? `<td class="servicio" rowspan="${items.length}">${e(tipos[tipo] || tipo)}</td>` : ''}
                <td class="obs"><div class="concepto">${e(i.descripcion)}</div>
                    ${lineas.length ? `<ul>${lineas.map(l => `<li>${e(l.replace(/^[-•*]\s*/, ''))}</li>`).join('')}</ul>` : ''}</td>
                <td class="cant">${Number(i.cantidad)}</td>
                <td class="num"><span>Q</span>${formatNumero(i.precio_unitario)}</td>
                <td class="num"><span>Q</span>${formatNumero(i.total)}
                    ${desc ? `<small>Desc. ${formatQ(desc)}</small>` : ''}</td>
            </tr>`;
        }).join('')).join('');

        const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Cotización ${e(c.numero)}</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #111; font-size: 13px; line-height: 1.35; padding: 24px; }
    .doc { max-width: 860px; margin: 0 auto; }
    .cabecera { display: flex; align-items: flex-start; gap: 16px; }
    .cabecera-izq { flex: 1; }
    .barra { background: #2f8fce; color: #fff; text-align: center; font-size: 19px; padding: 10px 12px; }
    .logo { width: 150px; height: 120px; object-fit: contain; flex-shrink: 0; }
    .numero { display: grid; grid-template-columns: 1fr 1fr; margin: 26px 0 30px; }
    .datos div { margin-bottom: 6px; }
    .datos span { display: inline-block; min-width: 170px; }
    table { width: 100%; border-collapse: collapse; margin-top: 22px; }
    th { background: #2f8fce; color: #fff; font-weight: 400; padding: 4px 6px; border: 2px solid #111; }
    td { border: 2px solid #111; padding: 4px 8px; vertical-align: middle; }
    td.servicio { width: 19%; font-size: 14px; }
    td.obs { width: 37%; }
    td.obs .concepto { font-weight: 600; }
    td.obs ul { list-style: none; padding-left: 8px; }
    td.obs li::before { content: '- '; }
    td.cant { width: 13%; text-align: center; }
    td.num { width: 15.5%; text-align: right; white-space: nowrap; }
    td.num span { float: left; }
    td.num small { display: block; font-size: 10.5px; color: #555; }
    .totales td { border: 2px solid #111; text-align: center; }
    .totales td.vacio { border: 0; }
    .totales td.valor { text-align: right; white-space: nowrap; }
    .totales td.valor span { float: left; }
    .totales tr.total td:not(.vacio) { font-weight: 700; }
    .notas { margin-top: 18px; font-size: 12px; }
    .vigencia { margin-top: 6px; font-size: 12px; color: #444; }
    @media print {
        body { padding: 0; }
        @page { size: letter; margin: 12mm; }
        .barra, th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        tr { page-break-inside: avoid; }
    }
</style></head>
<body><div class="doc">
<div class="cabecera">
    <div class="cabecera-izq">
        <div class="barra">Cotización de servicios hospitalarios</div>
        <div class="numero"><span>Número de cotización</span><span>${e(c.numero)}</span></div>
        <div class="datos">
            <div><span>Nombre del cotizador:</span>${e(c.cotizador_nombre || '')}</div>
            <div><span>Fecha:</span>${e(fecha)}</div>
            <div><span>Nombre del paciente:</span>${e(c.cliente_nombre)}</div>
            <div><span>Familiar / Responsable:</span>${e(c.cliente_responsable || '')}</div>
            <div><span>Teléfono de contacto:</span>${e(c.cliente_telefono || '')}</div>
            ${c.motivo ? `<div><span>Motivo:</span>${e(c.motivo)}</div>` : ''}
        </div>
    </div>
    <img class="logo" src="${e(logo)}" alt="${e(clinica.nombre || '')}" onerror="if (this.src !== '${e(logoRespaldo)}') this.src = '${e(logoRespaldo)}'; else this.remove();">
</div>
<table>
    <thead><tr><th>Servicio</th><th>Observaciones</th><th>Cant</th><th>Costo Unitario</th><th>Total</th></tr></thead>
    <tbody>${filas}</tbody>
    <tbody class="totales">
        ${descuento ? `
        <tr><td class="vacio"></td><td colspan="3">Suma de conceptos</td><td class="valor"><span>Q</span>${formatNumero(c.subtotal)}</td></tr>
        <tr><td class="vacio"></td><td colspan="3">Descuentos</td><td class="valor"><span>Q</span>-${formatNumero(descuento)}</td></tr>` : ''}
        <tr><td class="vacio"></td><td colspan="3">Subtotal</td><td class="valor"><span>Q</span>${formatNumero(base)}</td></tr>
        <tr><td class="vacio"></td><td colspan="3">IVA</td><td class="valor"><span>Q</span>${formatNumero(iva)}</td></tr>
        <tr class="total"><td class="vacio"></td><td colspan="3">TOTAL</td><td class="valor"><span>Q</span>${formatNumero(total)}</td></tr>
    </tbody>
</table>
${c.notas ? `<p class="notas"><strong>Condiciones:</strong> ${e(c.notas)}</p>` : ''}
<p class="vigencia">Cotización válida hasta el ${c.valida_hasta ? e(formatFecha(c.valida_hasta)) : '—'}.</p>
</div></body></html>`;

        const ventana = window.open('', '_blank', 'width=900,height=900');
        if (!ventana) {
            this.notificar('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.', 'warning');
            return;
        }
        ventana.document.write(html);
        ventana.document.close();
        setTimeout(() => ventana.print(), 300);
    }
};

window.CotizacionesModule = CotizacionesModule;
