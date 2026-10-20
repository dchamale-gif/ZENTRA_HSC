// ============================================
// MÓDULO DE ÓRDENES DE ENFERMERÍA
// ============================================
// Vista dividida: a la izquierda la orden del médico (solo lectura), a la derecha
// la traducción de enfermería en indicaciones concretas. Ambas quedan a la vista
// a la vez para copiar lo indicado sin cambiar de pantalla.

const OrdenesEnfermeriaModule = {
    TIPOS: [
        { valor: 'medicamento', texto: 'Medicamento' },
        { valor: 'procedimiento', texto: 'Procedimiento' },
        { valor: 'cuidado', texto: 'Cuidado' },
        { valor: 'control_signos', texto: 'Signos vitales' },
        { valor: 'dieta', texto: 'Dieta' },
        { valor: 'laboratorio', texto: 'Laboratorio' },
        { valor: 'otro', texto: 'Otro' }
    ],

    ESTADOS: [
        { valor: 'pendiente', texto: 'Pendiente' },
        { valor: 'cumplida', texto: 'Cumplida' },
        { valor: 'suspendida', texto: 'Suspendida' }
    ],

    state: {
        ordenes: [],
        seleccionada: null,
        busqueda: '',
        filtro: 'por_traducir',
        cargando: false,
        sinGuardar: false,
        iniciado: false
    },

    init() {
        if (this.state.iniciado) return;
        this.state.iniciado = true;

        document.getElementById('oeBuscar')?.addEventListener('input', e => {
            this.state.busqueda = e.target.value;
            this.renderLista();
        });
        document.getElementById('oeFiltros')?.addEventListener('click', e => {
            const boton = e.target.closest('[data-oe-filtro]');
            if (!boton) return;
            this.state.filtro = boton.dataset.oeFiltro;
            document.querySelectorAll('#oeFiltros [data-oe-filtro]').forEach(b => {
                const activo = b === boton;
                b.classList.toggle('activo', activo);
                b.setAttribute('aria-pressed', String(activo));
            });
            this.renderLista();
        });
        document.getElementById('oeActualizar')?.addEventListener('click', () => this.cargar());
        document.getElementById('oeLista')?.addEventListener('click', e => {
            const item = e.target.closest('[data-oe-orden]');
            if (item) this.seleccionar(item.dataset.oeOrden);
        });

        const panel = document.getElementById('oeEnfermeria');
        panel?.addEventListener('input', () => { this.state.sinGuardar = true; });
        panel?.addEventListener('change', () => { this.state.sinGuardar = true; });
        panel?.addEventListener('click', e => {
            const accion = e.target.closest('[data-oe-accion]');
            if (!accion) return;
            const { oeAccion, indice } = accion.dataset;
            if (oeAccion === 'agregar') this.agregarFila();
            if (oeAccion === 'quitar') this.quitarFila(Number(indice));
            if (oeAccion === 'servicios') this.agregarServiciosDelMedico();
            if (oeAccion === 'eliminar') this.eliminar();
        });
        panel?.addEventListener('submit', e => {
            e.preventDefault();
            this.guardar();
        });

        window.addEventListener('beforeunload', e => {
            if (this.state.sinGuardar) e.preventDefault();
        });
    },

    // ---------- Utilidades ----------
    puedeEditar() {
        return Permisos.puede('ordenes_enfermeria', 'edit');
    },

    async api(path = '', options = {}) {
        const response = await fetch(`${authManager.apiBaseUrl}/api/ordenes-enfermeria${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${authManager.getToken()}`,
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) throw new Error(data.message || `Error ${response.status}`);
        return data;
    },

    nombrePaciente(o) {
        return [o.paciente_nombre, o.paciente_apellido_paterno, o.paciente_apellido_materno].filter(Boolean).join(' ');
    },

    fecha(valor) {
        if (!valor) return '—';
        return typeof formatFecha === 'function' ? formatFecha(String(valor).split('T')[0]) : String(valor).split('T')[0];
    },

    // Situación de la traducción, para la lista y el encabezado
    situacion(o) {
        if (o.estado === 'cancelada') return { clave: 'cancelada', texto: 'Orden cancelada' };
        if (!o.enfermeria_id) return { clave: 'por-traducir', texto: 'Por traducir' };
        if (o.orden_cambio) return { clave: 'cambio', texto: 'El médico la modificó' };
        const items = o.indicaciones || [];
        const abiertas = items.filter(i => i.estado === 'pendiente').length;
        if (items.length && abiertas === 0) return { clave: 'cumplida', texto: 'Cumplida' };
        if (abiertas < items.length) return { clave: 'en-curso', texto: 'En curso' };
        return { clave: 'traducida', texto: 'Traducida' };
    },

    confirmarDescartar() {
        return !this.state.sinGuardar || confirm('Hay cambios sin guardar en la orden de enfermería. ¿Descartarlos?');
    },

    // ---------- Carga ----------
    async cargar() {
        this.init();
        const lista = document.getElementById('oeLista');
        if (!lista) return;
        this.state.cargando = true;
        if (!this.state.ordenes.length) lista.innerHTML = '<p class="oe-vacio">Cargando órdenes…</p>';

        try {
            const { data } = await this.api();
            this.state.ordenes = data || [];
            this.renderLista();
            // Mantener la selección (con datos frescos) si sigue existiendo y no hay cambios pendientes
            const actual = this.state.seleccionada;
            if (actual && !this.state.sinGuardar) {
                const fresca = this.state.ordenes.find(o => String(o.id) === String(actual.id));
                fresca ? this.seleccionar(fresca.id, { forzar: true }) : this.limpiarSeleccion();
            } else if (!actual) {
                this.limpiarSeleccion();
            }
        } catch (error) {
            lista.innerHTML = `<p class="oe-vacio">No se pudieron cargar las órdenes.<br><small>${escapeHtml(error.message)}</small></p>`;
        } finally {
            this.state.cargando = false;
        }
    },

    // Abre la pantalla con una orden médica ya elegida (desde Órdenes médicas)
    async abrir(ordenMedicaId) {
        if (!this.confirmarDescartar()) return;
        this.state.sinGuardar = false;
        this.state.filtro = 'todas';
        document.querySelectorAll('#oeFiltros [data-oe-filtro]').forEach(b => {
            const activo = b.dataset.oeFiltro === 'todas';
            b.classList.toggle('activo', activo);
            b.setAttribute('aria-pressed', String(activo));
        });
        this.state.seleccionada = { id: ordenMedicaId };
        navigateToPage('ordenes-enfermeria');
    },

    // ---------- Lista ----------
    filtradas() {
        const texto = this.state.busqueda.trim().toLocaleLowerCase('es');
        return this.state.ordenes.filter(o => {
            const s = this.situacion(o).clave;
            if (this.state.filtro === 'por_traducir' && !['por-traducir', 'cambio'].includes(s)) return false;
            if (this.state.filtro === 'traducidas' && ['por-traducir', 'cancelada'].includes(s)) return false;
            if (!texto) return true;
            return `${this.nombrePaciente(o)} ${o.paciente_dpi || ''} ${o.doctor || ''} ${o.descripcion || ''} ${o.id}`
                .toLocaleLowerCase('es').includes(texto);
        });
    },

    renderLista() {
        const lista = document.getElementById('oeLista');
        if (!lista) return;
        const ordenes = this.filtradas();
        const porTraducir = this.state.ordenes.filter(o => ['por-traducir', 'cambio'].includes(this.situacion(o).clave)).length;
        const contador = document.getElementById('oeContadorPendientes');
        if (contador) {
            contador.textContent = porTraducir;
            contador.hidden = porTraducir === 0;
        }

        if (!ordenes.length) {
            const mensaje = this.state.filtro === 'por_traducir' && !this.state.busqueda
                ? 'No hay órdenes médicas pendientes de traducir.'
                : 'No hay órdenes que coincidan.';
            lista.innerHTML = `<p class="oe-vacio">${mensaje}</p>`;
            return;
        }

        const seleccionadaId = String(this.state.seleccionada?.id ?? '');
        lista.innerHTML = ordenes.map(o => {
            const s = this.situacion(o);
            const activa = String(o.id) === seleccionadaId;
            return `
                <button type="button" class="oe-item${activa ? ' activa' : ''}" data-oe-orden="${o.id}" aria-pressed="${activa}">
                    <span class="oe-item-fila">
                        <strong>${escapeHtml(this.nombrePaciente(o))}</strong>
                        <span class="oe-item-fecha">${this.fecha(o.fecha_orden)}</span>
                    </span>
                    <span class="oe-item-desc">${escapeHtml(o.descripcion || '')}</span>
                    <span class="oe-item-fila">
                        <small>${escapeHtml(o.doctor || 'Sin médico')}</small>
                        <span class="oe-situacion oe-situacion-${s.clave}">${s.texto}</span>
                    </span>
                </button>`;
        }).join('');
    },

    // ---------- Selección ----------
    seleccionar(id, { forzar = false } = {}) {
        const orden = this.state.ordenes.find(o => String(o.id) === String(id));
        if (!orden) return;
        if (!forzar && String(this.state.seleccionada?.id) !== String(id) && !this.confirmarDescartar()) return;

        this.state.seleccionada = orden;
        this.state.sinGuardar = false;
        this.renderLista();
        this.renderMedico(orden);
        this.renderEnfermeria(orden);
        document.getElementById('oeLayout')?.classList.add('con-seleccion');
    },

    limpiarSeleccion() {
        this.state.seleccionada = null;
        this.state.sinGuardar = false;
        document.getElementById('oeLayout')?.classList.remove('con-seleccion');
        const medico = document.getElementById('oeMedico');
        const enfermeria = document.getElementById('oeEnfermeria');
        if (medico) medico.innerHTML = `
            <div class="oe-panel-vacio">
                <i class="fas fa-file-prescription" aria-hidden="true"></i>
                <p>Elija una orden de la lista para ver lo que indicó el médico.</p>
            </div>`;
        if (enfermeria) enfermeria.innerHTML = `
            <div class="oe-panel-vacio">
                <i class="fas fa-user-nurse" aria-hidden="true"></i>
                <p>Aquí escribirá las indicaciones de enfermería, con la orden del médico a la vista.</p>
            </div>`;
    },

    renderMedico(o) {
        const panel = document.getElementById('oeMedico');
        if (!panel) return;
        const servicios = Array.isArray(o.servicios) ? o.servicios : [];
        panel.innerHTML = `
            <header class="oe-panel-header">
                <div>
                    <span class="oe-panel-etiqueta"><i class="fas fa-user-doctor" aria-hidden="true"></i> Orden del médico</span>
                    <h2>${escapeHtml(this.nombrePaciente(o))}</h2>
                    <p class="oe-panel-sub">DPI ${escapeHtml(o.paciente_dpi || 'N/A')} · Orden #${o.id}</p>
                </div>
                <span class="oe-situacion oe-situacion-medica-${escapeHtml(o.estado)}">${escapeHtml(o.estado.charAt(0).toUpperCase() + o.estado.slice(1))}</span>
            </header>
            <dl class="oe-datos">
                <div><dt>Médico</dt><dd>${escapeHtml(o.doctor || '—')}</dd></div>
                <div><dt>Fecha</dt><dd>${this.fecha(o.fecha_orden)}</dd></div>
            </dl>
            <section class="oe-bloque">
                <h3>Indicaciones del médico</h3>
                <p class="oe-texto">${escapeHtml(o.descripcion || '—')}</p>
            </section>
            ${servicios.length ? `
            <section class="oe-bloque">
                <h3>Servicios solicitados</h3>
                <ul class="oe-servicios">
                    ${servicios.map(s => `<li><span>${escapeHtml(s.nombre)}</span><small>${escapeHtml(s.categoria || '')}</small></li>`).join('')}
                </ul>
            </section>` : ''}
            ${o.notas ? `
            <section class="oe-bloque">
                <h3>Notas del médico</h3>
                <p class="oe-texto">${escapeHtml(o.notas)}</p>
            </section>` : ''}`;
    },

    renderEnfermeria(o) {
        const panel = document.getElementById('oeEnfermeria');
        if (!panel) return;
        const editable = this.puedeEditar();
        const indicaciones = (o.indicaciones && o.indicaciones.length)
            ? o.indicaciones
            : (editable ? [this.filaVacia()] : []);
        const s = this.situacion(o);
        const autor = o.enfermeria_id
            ? `Última actualización: ${escapeHtml(o.actualizado_por_nombre || o.creado_por_nombre || '—')} · ${escapeHtml(typeof formatFechaHora === 'function' ? formatFechaHora(o.enfermeria_actualizada) : String(o.enfermeria_actualizada || ''))}`
            : 'Todavía no se ha traducido esta orden.';

        panel.innerHTML = `
            <form class="oe-form" novalidate>
                <header class="oe-panel-header">
                    <div>
                        <span class="oe-panel-etiqueta"><i class="fas fa-user-nurse" aria-hidden="true"></i> Orden de enfermería</span>
                        <h2>Indicaciones para el paciente</h2>
                        <p class="oe-panel-sub">${autor}</p>
                    </div>
                    <span class="oe-situacion oe-situacion-${s.clave}">${s.texto}</span>
                </header>

                ${o.orden_cambio ? `
                <div class="oe-aviso" role="status">
                    <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
                    <span>El médico modificó su orden después de la última traducción. Revise las indicaciones y guarde para confirmarlas.</span>
                </div>` : ''}
                ${o.estado === 'cancelada' ? `
                <div class="oe-aviso" role="status">
                    <i class="fas fa-ban" aria-hidden="true"></i>
                    <span>El médico canceló esta orden. Suspenda las indicaciones que sigan pendientes.</span>
                </div>` : ''}

                ${editable ? `
                <div class="oe-filas" id="oeFilas">
                    ${indicaciones.map((item, i) => this.renderFila(item, i)).join('')}
                </div>
                <div class="oe-acciones-filas">
                    <button type="button" class="btn btn-secondary" data-oe-accion="agregar"><i class="fas fa-plus" aria-hidden="true"></i> Agregar indicación</button>
                    ${(o.servicios || []).length ? `<button type="button" class="btn btn-outline" data-oe-accion="servicios"><i class="fas fa-arrow-right" aria-hidden="true"></i> Traer servicios solicitados</button>` : ''}
                </div>
                <div class="form-group oe-observaciones">
                    <label for="oeObservaciones">Observaciones de enfermería</label>
                    <textarea id="oeObservaciones" rows="3" maxlength="2000" placeholder="Alergias, precauciones, coordinación con otros turnos…">${escapeHtml(o.observaciones || '')}</textarea>
                </div>
                <footer class="oe-pie">
                    ${o.enfermeria_id ? '<button type="button" class="btn btn-outline oe-eliminar" data-oe-accion="eliminar"><i class="fas fa-trash" aria-hidden="true"></i> Eliminar</button>' : ''}
                    <button type="submit" class="btn btn-primary" id="oeGuardar"><i class="fas fa-floppy-disk" aria-hidden="true"></i> Guardar orden de enfermería</button>
                </footer>
                ` : this.renderSoloLectura(indicaciones, o)}
            </form>`;
    },

    renderSoloLectura(indicaciones, o) {
        if (!indicaciones.length) return '<p class="oe-vacio">Enfermería aún no ha traducido esta orden.</p>';
        return `
            <ol class="oe-lectura">
                ${indicaciones.map(item => `
                    <li>
                        <span class="oe-lectura-tipo">${escapeHtml(this.TIPOS.find(t => t.valor === item.tipo)?.texto || 'Otro')}</span>
                        <strong>${escapeHtml(item.descripcion)}</strong>
                        <small>${['dosis', 'via', 'frecuencia', 'horario'].map(c => item[c]).filter(Boolean).map(escapeHtml).join(' · ')}</small>
                        <span class="oe-situacion oe-estado-${escapeHtml(item.estado)}">${escapeHtml(this.ESTADOS.find(e => e.valor === item.estado)?.texto || '')}</span>
                    </li>`).join('')}
            </ol>
            ${o.observaciones ? `<section class="oe-bloque"><h3>Observaciones</h3><p class="oe-texto">${escapeHtml(o.observaciones)}</p></section>` : ''}`;
    },

    filaVacia(datos = {}) {
        return { tipo: 'medicamento', descripcion: '', dosis: '', via: '', frecuencia: '', horario: '', estado: 'pendiente', ...datos };
    },

    renderFila(item, i) {
        const id = `oeFila${i}`;
        const opciones = (lista, valor) => lista.map(op => `<option value="${op.valor}"${op.valor === valor ? ' selected' : ''}>${op.texto}</option>`).join('');
        return `
            <fieldset class="oe-fila" data-indice="${i}">
                <legend class="sr-only">Indicación ${i + 1}</legend>
                <div class="oe-fila-cabecera">
                    <span class="oe-fila-numero">${i + 1}</span>
                    <label class="sr-only" for="${id}Tipo">Tipo</label>
                    <select id="${id}Tipo" data-campo="tipo" class="form-input">${opciones(this.TIPOS, item.tipo)}</select>
                    <label class="sr-only" for="${id}Estado">Estado</label>
                    <select id="${id}Estado" data-campo="estado" class="form-input oe-fila-estado">${opciones(this.ESTADOS, item.estado)}</select>
                    <button type="button" class="btn-accion btn-accion-icono btn-accion-peligro" data-oe-accion="quitar" data-indice="${i}" title="Quitar indicación" aria-label="Quitar indicación ${i + 1}"><i class="fas fa-xmark" aria-hidden="true"></i></button>
                </div>
                <label class="sr-only" for="${id}Desc">Indicación</label>
                <textarea id="${id}Desc" data-campo="descripcion" rows="2" maxlength="500" class="form-input" placeholder="Ej.: Ceftriaxona 1 g, curación de herida, dieta blanda…">${escapeHtml(item.descripcion)}</textarea>
                <div class="oe-fila-detalle">
                    ${[['dosis', 'Dosis', '1 g'], ['via', 'Vía', 'IV, VO, IM…'], ['frecuencia', 'Frecuencia', 'Cada 8 h'], ['horario', 'Horario', '06:00 · 14:00 · 22:00']]
                        .map(([campo, texto, ejemplo]) => `
                        <label class="oe-campo">
                            <span>${texto}</span>
                            <input type="text" data-campo="${campo}" maxlength="100" class="form-input" value="${escapeHtml(item[campo] || '')}" placeholder="${ejemplo}">
                        </label>`).join('')}
                </div>
            </fieldset>`;
    },

    // Lee el formulario tal como está en pantalla
    leerFilas() {
        return [...document.querySelectorAll('#oeFilas .oe-fila')].map(fila => {
            const item = {};
            fila.querySelectorAll('[data-campo]').forEach(campo => { item[campo.dataset.campo] = campo.value.trim(); });
            return item;
        });
    },

    redibujarFilas(filas) {
        const contenedor = document.getElementById('oeFilas');
        if (contenedor) contenedor.innerHTML = filas.map((item, i) => this.renderFila(item, i)).join('');
    },

    agregarFila(datos) {
        const filas = this.leerFilas();
        filas.push(this.filaVacia(datos));
        this.redibujarFilas(filas);
        this.state.sinGuardar = true;
        document.querySelector(`#oeFilas .oe-fila:last-child textarea`)?.focus();
    },

    quitarFila(indice) {
        const filas = this.leerFilas();
        filas.splice(indice, 1);
        this.redibujarFilas(filas.length ? filas : [this.filaVacia()]);
        this.state.sinGuardar = true;
    },

    // Copia los servicios que pidió el médico como indicaciones (sin duplicar)
    agregarServiciosDelMedico() {
        const servicios = this.state.seleccionada?.servicios || [];
        const filas = this.leerFilas().filter(f => f.descripcion);
        const existentes = new Set(filas.map(f => f.descripcion.toLocaleLowerCase('es')));
        servicios
            .filter(s => !existentes.has(String(s.nombre).toLocaleLowerCase('es')))
            .forEach(s => filas.push(this.filaVacia({
                tipo: /laborator/i.test(s.categoria || '') ? 'laboratorio' : 'procedimiento',
                descripcion: s.nombre
            })));
        this.redibujarFilas(filas.length ? filas : [this.filaVacia()]);
        this.state.sinGuardar = true;
    },

    // ---------- Guardar / eliminar ----------
    async guardar() {
        const orden = this.state.seleccionada;
        if (!orden || !this.puedeEditar()) return;

        const indicaciones = this.leerFilas().filter(f => f.descripcion || f.dosis || f.via || f.frecuencia || f.horario);
        const incompleta = indicaciones.findIndex(f => !f.descripcion);
        if (!indicaciones.length) {
            showNotification('Escriba al menos una indicación', 'warning');
            document.querySelector('#oeFilas textarea')?.focus();
            return;
        }
        if (incompleta >= 0) {
            showNotification(`Escriba qué indica la fila ${incompleta + 1}`, 'warning');
            document.querySelectorAll('#oeFilas .oe-fila textarea')[incompleta]?.focus();
            return;
        }

        const boton = document.getElementById('oeGuardar');
        if (boton) boton.disabled = true;
        try {
            await this.api(`/${encodeURIComponent(orden.id)}`, {
                method: 'PUT',
                body: JSON.stringify({
                    indicaciones,
                    observaciones: document.getElementById('oeObservaciones')?.value || ''
                })
            });
            this.state.sinGuardar = false;
            showNotification('Orden de enfermería guardada', 'success');
            await this.cargar();
        } catch (error) {
            showNotification(`No se pudo guardar: ${error.message}`, 'error');
        } finally {
            if (boton) boton.disabled = false;
        }
    },

    async eliminar() {
        const orden = this.state.seleccionada;
        if (!orden?.enfermeria_id) return;
        if (!confirm(`¿Eliminar las indicaciones de enfermería de ${this.nombrePaciente(orden)}? La orden del médico no se borra.`)) return;
        try {
            await this.api(`/${encodeURIComponent(orden.id)}`, { method: 'DELETE' });
            this.state.sinGuardar = false;
            showNotification('Orden de enfermería eliminada', 'success');
            await this.cargar();
        } catch (error) {
            showNotification(`No se pudo eliminar: ${error.message}`, 'error');
        }
    }
};
