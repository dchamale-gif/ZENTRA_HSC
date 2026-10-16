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
            throw new Error(result.message || result.error || `Error ${response.status}`);
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
        this.state.items = (cotizacion?.items || []).map(i => ({
            descripcion: i.descripcion,
            tipo_item: i.tipo_item,
            cantidad: Number(i.cantidad),
            precio_unitario: Number(i.precio_unitario),
            descuento: Number(i.descuento),
            medicina_id: i.medicina_id
        }));
        if (!cotizacion) this.agregarItem(false);

        const valor = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v ?? ''; };
        valor('cotClienteNombre', cotizacion?.cliente_nombre);
        valor('cotClienteTelefono', cotizacion?.cliente_telefono);
        valor('cotClienteDpi', cotizacion?.cliente_dpi);
        valor('cotClienteEmail', cotizacion?.cliente_email);
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
        this.state.items.push({ descripcion: '', tipo_item: 'servicio', cantidad: 1, precio_unitario: 0, descuento: 0 });
        if (render) {
            this.renderItems();
            const filas = document.querySelectorAll('#cotItemsBody tr');
            filas[filas.length - 1]?.querySelector('[data-campo="descripcion"]')?.focus();
        }
    },

    quitarItem(index) {
        this.state.items.splice(index, 1);
        this.renderItems();
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
            tbody.innerHTML = this.state.items.map((item, i) => `
                <tr data-index="${i}">
                    <td><input type="text" class="form-input" data-campo="descripcion" value="${this.e(item.descripcion)}" placeholder="Ej: Habitación privada (por día)" aria-label="Descripción" ${editable ? '' : 'disabled'}></td>
                    <td><select class="form-input" data-campo="tipo_item" aria-label="Tipo" ${editable ? '' : 'disabled'}>
                        ${this.TIPOS.map(([valor, texto]) => `<option value="${valor}" ${valor === item.tipo_item ? 'selected' : ''}>${texto}</option>`).join('')}
                    </select></td>
                    <td><input type="number" class="form-input cot-num" data-campo="cantidad" value="${item.cantidad}" min="1" step="1" aria-label="Cantidad" ${editable ? '' : 'disabled'}></td>
                    <td><input type="number" class="form-input cot-num" data-campo="precio_unitario" value="${item.precio_unitario}" min="0" step="0.01" aria-label="Precio unitario" ${editable ? '' : 'disabled'}></td>
                    <td><input type="number" class="form-input cot-num" data-campo="descuento" value="${item.descuento}" min="0" step="0.01" aria-label="Descuento" ${editable ? '' : 'disabled'}></td>
                    <td class="text-right"><strong data-total-item>${formatQ(this.totalItem(item))}</strong></td>
                    <td>${editable ? `<button type="button" class="btn-accion btn-accion-icono" data-quitar="${i}" title="Quitar concepto" aria-label="Quitar concepto"><i class="fas fa-trash" aria-hidden="true"></i></button>` : ''}</td>
                </tr>`).join('');
        }
        this.renderTotales();
    },

    onCambioItem(event) {
        const campo = event.target.dataset.campo;
        const fila = event.target.closest('tr[data-index]');
        if (!campo || !fila) return;
        const item = this.state.items[Number(fila.dataset.index)];
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
            motivo: valor('cotMotivo'),
            notas: valor('cotNotas'),
            vigencia_dias: Number(valor('cotVigencia')) || 15,
            estado,
            items: this.state.items.map(i => ({
                descripcion: String(i.descripcion || '').trim(),
                tipo_item: i.tipo_item,
                cantidad: Number(i.cantidad),
                precio_unitario: Number(i.precio_unitario),
                descuento: Number(i.descuento) || 0,
                medicina_id: i.medicina_id || null
            }))
        };
    },

    validar(datos) {
        if (!datos.cliente_nombre) return 'Escribe el nombre del cliente o selecciona un paciente';
        const items = datos.items.filter(i => i.descripcion);
        if (items.length === 0) return 'Agrega al menos un concepto con descripción';
        if (datos.items.some(i => !i.descripcion)) return 'Hay conceptos sin descripción. Escríbela o quita la fila.';
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
        this.state.items = this.state.items.filter(i => String(i.descripcion || '').trim());
        (plantilla.items || []).forEach(i => this.state.items.push({
            descripcion: i.descripcion,
            tipo_item: i.tipo_item || 'general',
            cantidad: Number(i.cantidad) || 1,
            precio_unitario: Number(i.precio_unitario) || 0,
            descuento: Number(i.descuento) || 0,
            medicina_id: i.medicina_id || null
        }));
        const motivo = document.getElementById('cotMotivo');
        if (motivo && !motivo.value.trim()) motivo.value = plantilla.nombre;
        this.renderItems();
        this.notificar(`Plantilla "${plantilla.nombre}" cargada. Ajusta precios y cantidades si hace falta.`, 'success');
    },

    async guardarComoPlantilla() {
        const datos = this.datosFormulario('borrador');
        const items = datos.items.filter(i => i.descripcion);
        if (items.length === 0) {
            this.notificar('Agrega conceptos antes de guardar la plantilla', 'warning');
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

    imprimir(c) {
        const e = v => this.e(v);
        const clinica = (typeof CONFIG !== 'undefined' && CONFIG.CLINICA) || { nombre: 'Zentra MED' };
        const tipos = Object.fromEntries(this.TIPOS);
        const iva = typeof desglosarIVA === 'function' ? desglosarIVA(c.total).iva : 0;
        const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Cotización ${e(c.numero)}</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2933; font-size: 12px; line-height: 1.45; padding: 28px; }
    .doc { max-width: 860px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f766e; padding-bottom: 12px; margin-bottom: 16px; }
    .clinica { font-size: 16px; font-weight: 700; color: #0f766e; }
    .clinica small { display: block; font-size: 11px; font-weight: 400; color: #52606d; }
    h1 { font-size: 20px; text-align: right; letter-spacing: .04em; }
    .meta { text-align: right; font-size: 11px; color: #52606d; }
    .meta strong { color: #1f2933; }
    .cliente { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 16px; padding: 10px 12px; border: 1px solid #d9e2e6; border-radius: 6px; margin-bottom: 14px; }
    .cliente span { display: block; font-size: 10px; text-transform: uppercase; color: #7b8794; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th, td { border: 1px solid #d9e2e6; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f7; font-size: 10.5px; text-transform: uppercase; }
    .num { text-align: right; white-space: nowrap; }
    .totales { margin-left: auto; width: 300px; }
    .totales div { display: flex; justify-content: space-between; padding: 4px 0; }
    .totales .total { border-top: 2px solid #0f766e; margin-top: 4px; padding-top: 8px; font-size: 15px; font-weight: 700; color: #0f766e; }
    .totales .nota { font-size: 10.5px; color: #52606d; }
    .notas { margin-top: 16px; padding: 10px 12px; background: #f6f8f9; border-radius: 6px; font-size: 11px; }
    .firmas { display: flex; gap: 40px; margin-top: 50px; }
    .firmas div { flex: 1; border-top: 1px solid #1f2933; padding-top: 4px; text-align: center; font-size: 11px; }
    footer { margin-top: 20px; font-size: 10px; color: #7b8794; text-align: center; }
    @media print { body { padding: 0; } @page { size: letter; margin: 14mm; } }
</style></head>
<body><div class="doc">
<header>
    <div class="clinica">${e(clinica.nombre || 'Zentra MED')}
        <small>${e([clinica.nit && `NIT ${clinica.nit}`, clinica.direccion, clinica.municipio, clinica.telefono].filter(x => x && String(x).trim() && String(x).trim() !== '+502').join(' · '))}</small>
    </div>
    <div><h1>COTIZACIÓN</h1>
        <div class="meta"><strong>${e(c.numero)}</strong><br>Fecha: ${formatFecha(c.created_at)}<br>Válida hasta: ${c.valida_hasta ? formatFecha(c.valida_hasta) : '—'}</div></div>
</header>
<div class="cliente">
    <div><span>Cliente</span>${e(c.cliente_nombre)}</div>
    <div><span>Teléfono</span>${e(c.cliente_telefono || '—')}</div>
    <div><span>DPI</span>${e(c.cliente_dpi || '—')}</div>
    ${c.motivo ? `<div style="grid-column: 1 / -1;"><span>Motivo</span>${e(c.motivo)}</div>` : ''}
</div>
<table>
    <thead><tr><th>Descripción</th><th>Tipo</th><th class="num">Cant.</th><th class="num">Precio unit.</th><th class="num">Descuento</th><th class="num">Total</th></tr></thead>
    <tbody>${(c.items || []).map(i => `<tr><td>${e(i.descripcion)}</td><td>${e(tipos[i.tipo_item] || i.tipo_item)}</td>
        <td class="num">${Number(i.cantidad)}</td><td class="num">${formatQ(i.precio_unitario)}</td>
        <td class="num">${Number(i.descuento) ? formatQ(i.descuento) : '—'}</td><td class="num">${formatQ(i.total)}</td></tr>`).join('')}</tbody>
</table>
<div class="totales">
    <div><span>Subtotal</span><span>${formatQ(c.subtotal)}</span></div>
    ${Number(c.descuento) ? `<div><span>Descuentos</span><span>-${formatQ(c.descuento)}</span></div>` : ''}
    <div class="total"><span>TOTAL</span><span>${formatQ(c.total)}</span></div>
    <div class="nota"><span>IVA (12%) incluido</span><span>${formatQ(iva)}</span></div>
</div>
${c.notas ? `<div class="notas"><strong>Condiciones:</strong> ${e(c.notas)}</div>` : ''}
<div class="firmas"><div>Elaborado por</div><div>Recibido por</div></div>
<footer>${e(clinica.nombre || 'Zentra MED')} · Cotización ${e(c.numero)} · Impresa el ${e(formatFechaHora())}</footer>
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
