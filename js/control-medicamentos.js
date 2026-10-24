// ============================================
// CONTROL DE MEDICAMENTOS (Órdenes de enfermería)
// ============================================
// Vista aparte junto a "Órdenes": la semana día por día con cada dosis por paciente.
// Las dosis salen de los medicamentos que enfermería transcribe de la orden médica
// (frecuencia u horario); al marcar una dosis queda registrada en el servidor con quién
// y cuándo. Un medicamento se suspende con motivo desde una dosis y se puede reanudar.

const ControlMedicamentosModule = {
    state: {
        iniciado: false,
        vista: 'ordenes',
        semana: null, // lunes de la semana a la vista
        paciente: '',
        medicamentos: [],
        registros: [],
        cargando: false,
        error: ''
    },

    init() {
        if (this.state.iniciado) return;
        this.state.iniciado = true;
        this.state.semana = this.lunes(new Date());

        document.getElementById('oeVistas')?.addEventListener('click', e => {
            const boton = e.target.closest('[data-oe-vista]');
            if (boton) this.mostrarVista(boton.dataset.oeVista);
        });
        document.getElementById('oeVistas')?.addEventListener('keydown', e => {
            if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            const destino = this.state.vista === 'ordenes' ? 'control' : 'ordenes';
            this.mostrarVista(destino);
            document.querySelector(`[data-oe-vista="${destino}"]`)?.focus();
        });
        document.getElementById('oeActualizar')?.addEventListener('click', () => {
            if (this.state.vista === 'control') this.cargar();
        });

        const contenedor = document.getElementById('oeControl');
        contenedor?.addEventListener('click', e => this.alHacerClic(e));
        contenedor?.addEventListener('change', e => {
            if (e.target.matches('[data-cm="paciente"]')) {
                this.state.paciente = e.target.value;
                this.render();
            }
        });

        // Transcripciones o dosis que cambiaron en otra pantalla, ventana o usuario
        document.addEventListener('zentra:ordenes-cambiaron', e => {
            if (e.detail?.origen === 'control-medicamentos' && !e.detail.remoto) return;
            if (this.visible()) this.cargar({ silencioso: true });
        });
        if (typeof ZentraSync !== 'undefined') {
            ZentraSync.registrar('ordenes-enfermeria', () => (this.visible() && !document.querySelector('.cm-dialogo') ? this.cargar({ silencioso: true }) : null));
        }

        try {
            if (localStorage.getItem('oeVista') === 'control') this.mostrarVista('control');
        } catch (error) { /* sin almacenamiento: queda en Órdenes */ }
    },

    // La llama app.js al entrar a Órdenes de enfermería
    alMostrarPagina() {
        this.init();
        if (this.state.vista === 'control') this.cargar();
    },

    visible() {
        return this.state.vista === 'control' && (typeof ZentraSync === 'undefined' || ZentraSync.estaVisible('ordenes-enfermeria'));
    },

    puedeEditar() {
        return Permisos.puede('ordenes_enfermeria', 'edit') || Permisos.puede('control_medicamentos', 'edit');
    },

    mostrarVista(vista) {
        if (vista === 'ordenes' || vista === 'control') this.state.vista = vista;
        const control = this.state.vista === 'control';
        document.getElementById('oeLayout').hidden = control;
        document.getElementById('oeControl').hidden = !control;
        document.querySelectorAll('#oeVistas [data-oe-vista]').forEach(b => {
            const activa = b.dataset.oeVista === this.state.vista;
            b.classList.toggle('activa', activa);
            b.setAttribute('aria-selected', String(activa));
            b.tabIndex = activa ? 0 : -1;
        });
        const descripcion = document.getElementById('oeDescripcion');
        if (descripcion) {
            descripcion.textContent = control
                ? 'Cada día de la semana con las dosis de los medicamentos transcritos, por paciente. Marque cada dosis al darla.'
                : 'Elija una orden: la del médico queda a la izquierda mientras escribe a la derecha las indicaciones de enfermería.';
        }
        try { localStorage.setItem('oeVista', this.state.vista); } catch (error) { /* sin almacenamiento */ }
        if (control) this.cargar();
    },

    // ---------- Fechas ----------
    clave(fecha) {
        const d = fecha instanceof Date ? fecha : new Date(fecha);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    lunes(fecha) {
        const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return d;
    },

    dias() {
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(this.state.semana);
            d.setDate(d.getDate() + i);
            return d;
        });
    },

    // ---------- Datos ----------
    async api(path, options = {}) {
        const response = await fetch(`${authManager.apiBaseUrl}/api/administracion-medicamentos${path}`, {
            ...options,
            headers: { Authorization: `Bearer ${authManager.getToken()}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) throw new Error(data.message || data.error || `Error ${response.status}`);
        return data;
    },

    async cargar({ silencioso = false } = {}) {
        const contenedor = document.getElementById('oeControl');
        if (!contenedor || this.state.cargando) return;
        this.state.cargando = true;
        if (!silencioso && !this.state.medicamentos.length) contenedor.innerHTML = '<p class="cm-vacio">Cargando control de medicamentos…</p>';
        const dias = this.dias();
        try {
            const { data } = await this.api(`?desde=${this.clave(dias[0])}&hasta=${this.clave(dias[6])}`);
            this.state.medicamentos = data.medicamentos || [];
            this.state.registros = data.registros || [];
            this.state.error = '';
        } catch (error) {
            this.state.error = error.message;
        } finally {
            this.state.cargando = false;
        }
        this.render();
    },

    // Aplicaciones de un día: las horas del horario ("08:00 · 20:00") o, si no hay, las que da la frecuencia
    aplicaciones(m) {
        const horas = [...new Set([...String(m.horario || '').matchAll(/\b([01]?\d|2[0-3])[:.h]([0-5]\d)\b/g)]
            .map(x => `${x[1].padStart(2, '0')}:${x[2]}`))].sort();
        if (horas.length) return horas.map((hora, i) => ({ aplicacion: i + 1, hora }));
        const frecuencia = String(m.frecuencia || '').toLowerCase();
        let veces = 1;
        const cadaHoras = frecuencia.match(/(?:cada|c\/)\s*(\d+(?:[.,]\d+)?)\s*(?:h|hr|hora)/);
        const vecesDia = frecuencia.match(/(\d+)\s*(?:veces|vez)/);
        if (cadaHoras) veces = Math.floor(24 / Number(cadaHoras[1].replace(',', '.')));
        else if (vecesDia) veces = Number(vecesDia[1]);
        veces = Math.min(Math.max(Number.isFinite(veces) ? veces : 1, 1), 24);
        return Array.from({ length: veces }, (_, i) => ({ aplicacion: i + 1, hora: null }));
    },

    // Suspensión registrada en el control, o la indicación marcada como suspendida en la transcripción
    suspension(m) {
        if (m.suspension) return m.suspension;
        if (m.estado === 'suspendida') return { desde: m.fecha_transcripcion, aplicacion: 1, motivo: 'Suspendido en la transcripción' };
        return null;
    },

    registro(m, dia, aplicacion) {
        return this.state.registros.find(r => String(r.orden_medica_id) === String(m.orden_medica_id)
            && r.medicina_clave === m.clave && r.fecha === dia && Number(r.aplicacion) === aplicacion);
    },

    // Dosis de un día con su estado: pendiente | dado | suspendido
    dosisDelDia(dia) {
        const dosis = [];
        this.state.medicamentos
            .filter(m => !this.state.paciente || String(m.paciente_id) === this.state.paciente)
            .forEach(m => {
                if (dia < m.fecha_orden) return;
                const terminado = m.fecha_fin && dia > m.fecha_fin;
                const susp = this.suspension(m);
                this.aplicaciones(m).forEach(({ aplicacion, hora }) => {
                    const registro = this.registro(m, dia, aplicacion);
                    if (terminado && !registro) return;
                    const suspendida = susp && (dia > susp.desde || (dia === susp.desde && aplicacion >= Number(susp.aplicacion || 1)));
                    dosis.push({
                        m, dia, aplicacion, hora, registro,
                        total: this.aplicaciones(m).length,
                        estado: registro ? 'dado' : suspendida ? 'suspendido' : 'pendiente',
                        susp: suspendida ? susp : null,
                        bloqueada: m.historia_estado === 'cerrada'
                    });
                });
            });
        return dosis.sort((a, b) => String(a.hora || '99').localeCompare(String(b.hora || '99'))
            || a.m.paciente_nombre.localeCompare(b.m.paciente_nombre, 'es') || a.aplicacion - b.aplicacion);
    },

    // ---------- Pantalla ----------
    e(valor) {
        return escapeHtml(valor ?? '');
    },

    render() {
        const contenedor = document.getElementById('oeControl');
        if (!contenedor) return;
        const dias = this.dias();
        const hoy = this.clave(new Date());
        const pacientes = [...new Map(this.state.medicamentos.map(m => [String(m.paciente_id), m.paciente_nombre])).entries()]
            .sort((a, b) => a[1].localeCompare(b[1], 'es'));
        if (this.state.paciente && !pacientes.some(([id]) => id === this.state.paciente)) this.state.paciente = '';
        const rango = `${dias[0].toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })} al ${dias[6].toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        const enfoque = document.activeElement?.closest('#oeControl') ? document.activeElement.dataset.cm || document.activeElement.dataset.cmDosis : null;

        const tarjetas = dias.map(d => {
            const dia = this.clave(d);
            const dosis = this.dosisDelDia(dia);
            const dadas = dosis.filter(x => x.estado === 'dado').length;
            const activas = dosis.filter(x => x.estado !== 'suspendido').length;
            const suspendidas = dosis.length - activas;
            return `
                <div class="day-card-agenda cm-dia${dia === hoy ? ' today' : ''}${dia < hoy ? ' cm-pasado' : ''}">
                    <div><i class="fas fa-calendar-day" aria-hidden="true"></i> ${this.e(d.toLocaleDateString('es-GT', { weekday: 'short' }).toUpperCase())}<br><span>${this.e(d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' }))}</span></div>
                    <div>${dosis.length ? dosis.map(x => this.htmlDosis(x, dia > hoy)).join('') : '<div class="cm-sin">Sin medicamentos</div>'}</div>
                    <div>${dosis.length ? `${dadas} de ${activas} dada${activas !== 1 ? 's' : ''}${suspendidas ? ` · ${suspendidas} suspendida${suspendidas !== 1 ? 's' : ''}` : ''}` : '0 aplicaciones'}</div>
                </div>`;
        }).join('');

        contenedor.innerHTML = `
            <div class="cm-barra">
                <label class="cm-campo"><span>Paciente</span>
                    <select class="form-input" data-cm="paciente">
                        <option value="">Todos los pacientes (${pacientes.length})</option>
                        ${pacientes.map(([id, nombre]) => `<option value="${this.e(id)}"${id === this.state.paciente ? ' selected' : ''}>${this.e(nombre)}</option>`).join('')}
                    </select>
                </label>
                <div class="cm-semana" role="group" aria-label="Semana">
                    <button type="button" class="btn btn-secondary btn-small" data-cm="anterior" aria-label="Semana anterior"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                    <strong>Semana del ${this.e(rango)}</strong>
                    <button type="button" class="btn btn-secondary btn-small" data-cm="siguiente" aria-label="Semana siguiente"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
                    <button type="button" class="btn btn-secondary btn-small" data-cm="hoy"${this.clave(this.state.semana) === this.clave(this.lunes(new Date())) ? ' disabled' : ''}>Esta semana</button>
                </div>
            </div>
            ${this.state.error ? `<p class="cm-error">No se pudo cargar el control de medicamentos: ${this.e(this.state.error)}</p>` : ''}
            ${!this.state.error && !this.state.medicamentos.length ? '<p class="cm-vacio">Esta semana no hay medicamentos transcritos. Aparecen aquí cuando enfermería transcribe una orden médica con medicinas del catálogo, con su frecuencia u horario.</p>' : ''}
            <div class="cm-grid">${tarjetas}</div>
            ${this.htmlResumen(dias)}`;

        if (enfoque) contenedor.querySelector(`[data-cm="${enfoque}"], [data-cm-dosis="${enfoque}"]`)?.focus();
    },

    htmlDosis(x, futura) {
        const { m } = x;
        const id = `${m.orden_medica_id}|${m.clave}|${x.dia}|${x.aplicacion}`;
        const editable = this.puedeEditar() && !x.bloqueada;
        const titulos = {
            pendiente: futura ? 'Dosis de un día futuro' : 'No se ha dado. Clic para marcar como dada.',
            dado: `Dada por ${x.registro?.registrado_por_nombre || '—'}${x.registro?.registrado_en ? ` el ${formatFechaHora(x.registro.registrado_en)}` : ''}. Clic para desmarcar.`,
            suspendido: `Suspendido desde el ${formatFecha(x.susp?.desde)}: ${x.susp?.motivo || ''}. Clic para reanudar.`
        };
        const iconos = { pendiente: '', dado: '<i class="fas fa-check" aria-hidden="true"></i>', suspendido: '<i class="fas fa-xmark" aria-hidden="true"></i>' };
        const accion = x.estado === 'suspendido' ? 'reanudar' : 'marcar';
        const deshabilitado = !editable || (x.estado === 'pendiente' && futura);
        const detalle = [m.dosis, m.via].filter(Boolean).join(' · ');
        return `
            <div class="mar-item mar-${x.estado}">
                <button type="button" class="mar-check" data-cm-accion="${accion}" data-cm-dosis="${this.e(id)}"
                        title="${this.e(titulos[x.estado])}" aria-label="${this.e(`${m.nombre}, ${m.paciente_nombre}: ${titulos[x.estado]}`)}"${deshabilitado ? ' disabled' : ''}>${iconos[x.estado]}</button>
                <div class="mar-info">
                    <strong title="${this.e(m.nombre)}">${this.e(m.nombre)}</strong>
                    ${this.state.paciente ? '' : `<span>${this.e(m.paciente_nombre)}</span>`}
                    <span class="mar-dosis">${this.e([x.hora, detalle || 'Sin dosis', x.total > 1 ? `${x.aplicacion}/${x.total}` : ''].filter(Boolean).join(' · '))}</span>
                    ${x.estado === 'dado' ? `<span class="cm-quien">${this.e(x.registro.registrado_por_nombre || '')}</span>` : ''}
                    ${x.estado === 'suspendido' ? `<span class="mar-motivo" title="${this.e(x.susp.motivo)}">${this.e(x.susp.motivo)}</span>` : ''}
                </div>
                ${x.estado === 'pendiente' && editable ? `
                <button type="button" class="mar-suspender" data-cm-accion="suspender" data-cm-dosis="${this.e(id)}"
                        title="Suspender este medicamento a partir de esta dosis" aria-label="Suspender ${this.e(m.nombre)}">
                    <i class="fas fa-ban" aria-hidden="true"></i>
                </button>` : ''}
            </div>`;
    },

    // Resumen de la semana por paciente: medicamentos, dosis dadas y suspendidas
    htmlResumen(dias) {
        const porPaciente = new Map();
        dias.forEach(d => this.dosisDelDia(this.clave(d)).forEach(x => {
            const p = porPaciente.get(x.m.paciente_id) || { nombre: x.m.paciente_nombre, medicamentos: new Map() };
            const med = p.medicamentos.get(x.m.clave + x.m.orden_medica_id) || { nombre: x.m.nombre, dosis: [x.m.dosis, x.m.via, x.m.frecuencia].filter(Boolean).join(' · '), dadas: 0, total: 0, suspendido: false };
            if (x.estado !== 'suspendido') med.total += 1;
            if (x.estado === 'dado') med.dadas += 1;
            if (this.suspension(x.m)) med.suspendido = true;
            p.medicamentos.set(x.m.clave + x.m.orden_medica_id, med);
            porPaciente.set(x.m.paciente_id, p);
        }));
        if (!porPaciente.size) return '';
        return `
            <section class="cm-resumen" aria-label="Resumen de la semana">
                <h3><i class="fas fa-pills" aria-hidden="true"></i> Resumen de la semana</h3>
                <div class="cm-resumen-grid">
                    ${[...porPaciente.values()].map(p => `
                    <div class="cm-resumen-paciente">
                        <strong>${this.e(p.nombre)}</strong>
                        <ul>${[...p.medicamentos.values()].map(med => `
                            <li><span>${this.e(med.nombre)}${med.dosis ? ` <small>${this.e(med.dosis)}</small>` : ''}${med.suspendido ? ' <span class="mar-suspendido-tag">Suspendido</span>' : ''}</span>
                                <b>${med.dadas}/${med.total}</b></li>`).join('')}</ul>
                    </div>`).join('')}
                </div>
            </section>`;
    },

    // ---------- Acciones ----------
    dosisPorId(id) {
        const [orden, clave, dia, aplicacion] = String(id).split('|');
        const m = this.state.medicamentos.find(x => String(x.orden_medica_id) === orden && x.clave === clave);
        if (!m) return null;
        const hora = this.aplicaciones(m).find(a => a.aplicacion === Number(aplicacion))?.hora || null;
        return { m, dia, aplicacion: Number(aplicacion), hora };
    },

    alHacerClic(e) {
        const nav = e.target.closest('[data-cm]')?.dataset.cm;
        if (nav === 'anterior' || nav === 'siguiente') {
            this.state.semana.setDate(this.state.semana.getDate() + (nav === 'anterior' ? -7 : 7));
            this.cargar();
            return;
        }
        if (nav === 'hoy') {
            this.state.semana = this.lunes(new Date());
            this.cargar();
            return;
        }
        const boton = e.target.closest('[data-cm-accion]');
        if (!boton || boton.disabled) return;
        const dosis = this.dosisPorId(boton.dataset.cmDosis);
        if (!dosis) return;
        if (boton.dataset.cmAccion === 'marcar') this.marcar(dosis, !boton.closest('.mar-dado'));
        if (boton.dataset.cmAccion === 'suspender') this.suspender(dosis);
        if (boton.dataset.cmAccion === 'reanudar') this.reanudar(dosis);
    },

    avisar(pacienteId) {
        if (typeof ZentraSync !== 'undefined') ZentraSync.avisar({ pacienteId, origen: 'control-medicamentos' });
    },

    async marcar({ m, dia, aplicacion, hora }, dado) {
        if (!dado && !confirm(`¿Desmarcar la dosis de ${m.nombre} del ${formatFecha(dia)}${hora ? ` a las ${hora}` : ''}?`)) return;
        try {
            await this.api('/dosis', {
                method: 'PUT',
                body: JSON.stringify({ orden_medica_id: m.orden_medica_id, medicina_clave: m.clave, fecha: dia, aplicacion, hora, dado })
            });
            await this.cargar({ silencioso: true });
            this.avisar(m.paciente_id);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async suspender({ m, dia, aplicacion, hora }) {
        const motivo = await this.pedirMotivo(m, dia, aplicacion, hora);
        if (!motivo) return;
        try {
            await this.api('/suspension', {
                method: 'POST',
                body: JSON.stringify({ orden_medica_id: m.orden_medica_id, medicina_clave: m.clave, desde: dia, aplicacion, motivo })
            });
            showNotification(`${m.nombre} suspendido`, 'success');
            await this.cargar({ silencioso: true });
            this.avisar(m.paciente_id);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async reanudar({ m }) {
        const susp = this.suspension(m);
        if (!confirm(`¿Reanudar ${m.nombre} de ${m.paciente_nombre}?${susp ? `\n\nSe quita la suspensión del ${formatFecha(susp.desde)} (motivo: ${susp.motivo}).` : ''}`)) return;
        try {
            await this.api('/suspension', {
                method: 'DELETE',
                body: JSON.stringify({ orden_medica_id: m.orden_medica_id, medicina_clave: m.clave })
            });
            showNotification(`${m.nombre} reanudado`, 'success');
            await this.cargar({ silencioso: true });
            this.avisar(m.paciente_id);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    // Diálogo con el motivo de la suspensión; devuelve el texto o null
    pedirMotivo(m, dia, aplicacion, hora) {
        return new Promise(resolver => {
            const previo = document.activeElement;
            const capa = document.createElement('div');
            capa.className = 'modal-overlay cm-dialogo';
            capa.innerHTML = `
                <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="cmSuspenderTitulo" style="max-width: 460px;">
                    <div class="modal-header"><h2 id="cmSuspenderTitulo"><i class="fas fa-ban" aria-hidden="true"></i> Suspender medicamento</h2></div>
                    <div class="modal-body">
                        <p><strong>${this.e(m.nombre)}</strong>${m.dosis ? ` · ${this.e(m.dosis)}` : ''}</p>
                        <p class="form-hint">${this.e(m.paciente_nombre)} · Se suspende desde el ${this.e(formatFecha(dia))}${hora ? ` a las ${this.e(hora)}` : aplicacion > 1 ? `, aplicación ${aplicacion}` : ''} en adelante.</p>
                        <label class="cm-campo"><span>Motivo de la suspensión <span class="required">*</span></span>
                            <textarea class="form-input" rows="3" maxlength="500" data-cm-motivo placeholder="Ej.: reacción adversa, indicación médica, alta del paciente…"></textarea>
                        </label>
                        <p class="cm-error" data-cm-motivo-error hidden>Escriba el motivo (al menos 3 caracteres).</p>
                        <div class="hc2-barra">
                            <button type="button" class="btn btn-secondary" data-cm-dialogo="cancelar">Cancelar</button>
                            <button type="button" class="btn btn-danger" data-cm-dialogo="aceptar"><i class="fas fa-ban" aria-hidden="true"></i> Suspender medicamento</button>
                        </div>
                    </div>
                </div>`;
            const campo = capa.querySelector('[data-cm-motivo]');
            const terminar = valor => {
                capa.remove();
                document.removeEventListener('keydown', alTeclear);
                previo?.focus?.();
                resolver(valor);
            };
            const alTeclear = ev => { if (ev.key === 'Escape') terminar(null); };
            capa.addEventListener('click', ev => {
                const accion = ev.target.closest('[data-cm-dialogo]')?.dataset.cmDialogo;
                if (accion === 'cancelar' || ev.target === capa) return terminar(null);
                if (accion !== 'aceptar') return;
                if (campo.value.trim().length < 3) {
                    capa.querySelector('[data-cm-motivo-error]').hidden = false;
                    campo.focus();
                    return;
                }
                terminar(campo.value.trim());
            });
            campo.addEventListener('input', () => { capa.querySelector('[data-cm-motivo-error]').hidden = true; });
            document.addEventListener('keydown', alTeclear);
            document.body.appendChild(capa);
            campo.focus();
        });
    }
};

window.ControlMedicamentosModule = ControlMedicamentosModule;
