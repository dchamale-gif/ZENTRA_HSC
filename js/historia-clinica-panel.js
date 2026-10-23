// ============================================
// HISTORIA CLÍNICA - PANEL DE TRES RECUADROS
// ============================================
// Filtros arriba; a la izquierda los pacientes; a la derecha arriba los datos generales
// y abajo la historia clínica con los antecedentes, más las historias anteriores.
// Historias y antecedentes viven en el servidor (/api/historias-clinicas). Evolución,
// prescripciones y medicamentos siguen en HistoriaClinicaModule y se muestran en pestañas.

const HistoriaPanelModule = {
    TIPOS: [
        { valor: 'consulta', texto: 'Consulta' },
        { valor: 'ingreso', texto: 'Ingreso' },
        { valor: 'emergencia', texto: 'Emergencia' },
        { valor: 'control', texto: 'Control' }
    ],

    CAMPOS_HISTORIA: [
        { clave: 'motivo_consulta', texto: 'Motivo de consulta', filas: 2, requerido: true },
        { clave: 'enfermedad_actual', texto: 'Historia de la enfermedad actual', filas: 4 },
        { clave: 'revision_sistemas', texto: 'Revisión por sistemas', filas: 3 },
        { clave: 'examen_fisico', texto: 'Examen físico', filas: 4 },
        { clave: 'impresion_clinica', texto: 'Impresión clínica / diagnóstico', filas: 2, requerido: true },
        { clave: 'plan', texto: 'Plan', filas: 3 }
    ],

    SIGNOS: [
        { clave: 'pa', texto: 'PA', unidad: 'mmHg', ejemplo: '120/80' },
        { clave: 'fc', texto: 'FC', unidad: 'lpm' },
        { clave: 'fr', texto: 'FR', unidad: 'rpm' },
        { clave: 'temp', texto: 'T°', unidad: '°C' },
        { clave: 'sat', texto: 'SatO₂', unidad: '%' },
        { clave: 'peso', texto: 'Peso', unidad: 'kg' },
        { clave: 'talla', texto: 'Talla', unidad: 'cm' }
    ],

    ANTECEDENTES: [
        { clave: 'personales', texto: 'Personales patológicos' },
        { clave: 'quirurgicos', texto: 'Quirúrgicos' },
        { clave: 'traumaticos', texto: 'Traumáticos' },
        { clave: 'alergicos', texto: 'Alérgicos' },
        { clave: 'familiares', texto: 'Familiares' },
        { clave: 'habitos', texto: 'Hábitos' },
        { clave: 'gineco_obstetricos', texto: 'Gineco-obstétricos' },
        { clave: 'medicamentos_habituales', texto: 'Medicamentos habituales' }
    ],

    PESTANAS: [
        { clave: 'historia', texto: 'Historia y antecedentes' },
        { clave: 'evolucion', texto: 'Evolución' },
        { clave: 'prescripciones', texto: 'Prescripciones' },
        { clave: 'medicamentos', texto: 'Medicamentos' }
    ],

    state: {
        iniciado: false,
        filtros: { texto: '', estado: 'activos', tipo: '', medico: '', desde: '', hasta: '' },
        resumen: {},
        medicos: [],
        filtroServidor: false,
        avisoServidor: '',
        pacienteId: null,
        historias: [],
        historia: null,
        antecedentes: null,
        pestana: 'historia',
        cargando: false,
        cambios: { historia: false, antecedentes: false }
    },

    // ---------- Utilidades ----------
    e(valor) {
        return escapeHtml(valor ?? '');
    },

    puedeEditar() {
        return Permisos.puede('historia_clinica', 'edit');
    },

    esMedico() {
        return Permisos.puede('historia_clinica_cierre', 'edit');
    },

    hayCambios() {
        return this.state.cambios.historia || this.state.cambios.antecedentes;
    },

    confirmarDescartar() {
        return !this.hayCambios() || confirm('Hay cambios sin guardar en la historia clínica. ¿Descartarlos?');
    },

    async api(path = '', options = {}) {
        const response = await fetch(`${authManager.apiBaseUrl}/api/historias-clinicas${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${authManager.getToken()}`,
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw Object.assign(new Error(data.message || data.error || `Error ${response.status}`), { status: response.status });
        }
        return data;
    },

    pacientesBase() {
        return (typeof HistoriaClinicaModule !== 'undefined' && HistoriaClinicaModule.state.pacientes) || [];
    },

    paciente(id = this.state.pacienteId) {
        return this.pacientesBase().find(p => String(p.id) === String(id)) || null;
    },

    nombre(p) {
        return [p.nombre, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(' ');
    },

    edad(p) {
        const edad = p.fechaNacimiento ? HistoriaClinicaModule.calculateAge(p.fechaNacimiento) : null;
        return Number.isFinite(edad) ? `${edad} años` : '';
    },

    fecha(valor) {
        return valor ? formatFecha(String(valor).slice(0, 10)) : '—';
    },

    tipoTexto(valor) {
        return this.TIPOS.find(t => t.valor === valor)?.texto || 'Consulta';
    },

    tipoServicio(p) {
        return { agudo: 'Agudo', cronico: 'Crónico', coex: 'COEX' }[p.tipoServicio] || '';
    },

    hoy() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    // ---------- Inicio y filtros ----------
    init() {
        if (this.state.iniciado) return;
        this.state.iniciado = true;
        // Siempre this.state.filtros: "Limpiar filtros" lo reemplaza por un objeto nuevo
        const enlazar = (id, campo, evento, servidor = false) => document.getElementById(id)?.addEventListener(evento, e => {
            this.state.filtros[campo] = e.target.value;
            if (servidor) this.cargarResumen().then(() => this.renderLista());
            else this.renderLista();
        });
        enlazar('hc2Buscar', 'texto', 'input');
        enlazar('hc2Estado', 'estado', 'change');
        enlazar('hc2Tipo', 'tipo', 'change');
        enlazar('hc2Medico', 'medico', 'change', true);
        enlazar('hc2Desde', 'desde', 'change', true);
        enlazar('hc2Hasta', 'hasta', 'change', true);
        document.getElementById('hc2Limpiar')?.addEventListener('click', () => this.limpiarFiltros());

        document.getElementById('hc2Lista')?.addEventListener('click', e => {
            const item = e.target.closest('[data-hc2-paciente]');
            if (item) this.seleccionar(item.dataset.hc2Paciente);
        });

        const panel = document.getElementById('hc2Historia');
        panel?.addEventListener('click', e => this.alHacerClic(e));
        panel?.addEventListener('input', e => {
            const seccion = e.target.closest('[data-hc2-seccion]')?.dataset.hc2Seccion;
            if (seccion) this.state.cambios[seccion] = true;
            if (e.target.dataset.signo === 'peso' || e.target.dataset.signo === 'talla') this.actualizarImc();
        });
        document.getElementById('hc2Datos')?.addEventListener('click', e => {
            if (e.target.closest('[data-hc2="ficha"]')) PacientesModule.editPacient(this.state.pacienteId);
        });

        window.addEventListener('beforeunload', e => {
            if (this.hayCambios()) e.preventDefault();
        });
    },

    limpiarFiltros() {
        this.state.filtros = { texto: '', estado: 'activos', tipo: '', medico: '', desde: '', hasta: '' };
        ['hc2Buscar', 'hc2Tipo', 'hc2Medico', 'hc2Desde', 'hc2Hasta'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const estado = document.getElementById('hc2Estado');
        if (estado) estado.value = 'activos';
        this.cargarResumen().then(() => this.renderLista());
    },

    // Lo llama HistoriaClinicaModule al cargar los pacientes
    alCargarPacientes() {
        this.init();
        this.cargarResumen().then(() => {
            this.renderLista();
            if (this.state.pacienteId) this.renderDatos();
            else this.renderSinSeleccion();
        });
    },

    async cargarResumen() {
        const { medico, desde, hasta } = this.state.filtros;
        const params = new URLSearchParams();
        if (medico) params.set('medico', medico);
        if (desde) params.set('desde', desde);
        if (hasta) params.set('hasta', hasta);
        this.state.filtroServidor = Boolean(medico || desde || hasta);
        try {
            const { data } = await this.api(`/resumen?${params}`);
            this.state.resumen = Object.fromEntries((data.pacientes || []).map(r => [String(r.paciente_id), r]));
            this.state.medicos = data.medicos || [];
            this.state.avisoServidor = '';
        } catch (error) {
            this.state.resumen = {};
            this.state.avisoServidor = error.message;
        }
        this.renderSelectMedicos();
    },

    renderSelectMedicos() {
        const select = document.getElementById('hc2Medico');
        if (!select) return;
        const actual = this.state.filtros.medico;
        select.innerHTML = '<option value="">Todos</option>' +
            this.state.medicos.map(m => `<option value="${this.e(m)}">${this.e(m)}</option>`).join('');
        select.value = this.state.medicos.includes(actual) ? actual : '';
    },

    filtrados() {
        const { texto, estado, tipo } = this.state.filtros;
        // Sin tildes ni mayúsculas: "mendez" encuentra "Méndez"
        const normalizar = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const palabras = normalizar(texto).trim().split(/\s+/).filter(Boolean);
        return this.pacientesBase().filter(p => {
            if (estado === 'activos' && p.estado && p.estado !== 'activo') return false;
            if (tipo && p.tipoServicio !== tipo) return false;
            if (this.state.filtroServidor && !this.state.resumen[String(p.id)]) return false;
            if (!palabras.length) return true;
            const texto = normalizar([p.nombre, p.apellidoPaterno, p.apellidoMaterno, p.dpi, p.telefono].join(' '));
            return palabras.every(palabra => texto.includes(palabra));
        }).sort((a, b) => {
            // Primero los de consulta más reciente
            const fa = this.state.resumen[String(a.id)]?.ultima_fecha || '';
            const fb = this.state.resumen[String(b.id)]?.ultima_fecha || '';
            return fb.localeCompare(fa) || this.nombre(a).localeCompare(this.nombre(b), 'es');
        });
    },

    renderLista() {
        const lista = document.getElementById('hc2Lista');
        if (!lista) return;
        const f = this.state.filtros;
        const limpiar = document.getElementById('hc2Limpiar');
        if (limpiar) limpiar.hidden = !(f.texto || f.estado !== 'activos' || f.tipo || f.medico || f.desde || f.hasta);

        const pacientes = this.filtrados();
        const contador = document.getElementById('hc2Contador');
        if (contador) contador.textContent = pacientes.length;
        if (!pacientes.length) {
            lista.innerHTML = `<p class="hc2-vacio">${this.pacientesBase().length ? 'Ningún paciente coincide con los filtros.' : 'No hay pacientes registrados.'}</p>`;
            return;
        }
        lista.innerHTML = pacientes.map(p => {
            const r = this.state.resumen[String(p.id)];
            const activo = String(p.id) === String(this.state.pacienteId);
            const detalle = [p.dpi ? `DPI ${p.dpi}` : '', this.edad(p)].filter(Boolean).join(' · ');
            return `
                <button type="button" class="hc2-paciente${activo ? ' activo' : ''}" data-hc2-paciente="${this.e(p.id)}" aria-pressed="${activo}">
                    <span class="hc2-paciente-fila">
                        <strong>${this.e(this.nombre(p))}</strong>
                        ${this.tipoServicio(p) ? `<span class="hc2-tipo hc2-tipo-${this.e(p.tipoServicio)}">${this.tipoServicio(p)}</span>` : ''}
                    </span>
                    ${detalle ? `<small>${this.e(detalle)}</small>` : ''}
                    <small class="hc2-paciente-ultima">
                        ${r ? `Última consulta ${this.fecha(r.ultima_fecha)}` : 'Sin historias'}
                        ${r?.tiene_abierta ? '<span class="hc2-abierta" title="Tiene una historia abierta">Abierta</span>' : ''}
                    </small>
                </button>`;
        }).join('');
    },

    // ---------- Selección ----------
    renderSinSeleccion() {
        const datos = document.getElementById('hc2Datos');
        const historia = document.getElementById('hc2Historia');
        if (datos) datos.innerHTML = '<div class="hc2-vacio-grande"><i class="fas fa-user" aria-hidden="true"></i><p>Elija un paciente de la lista para ver sus datos.</p></div>';
        if (historia) historia.innerHTML = `<div class="hc2-vacio-grande"><i class="fas fa-notes-medical" aria-hidden="true"></i><p>Aquí verá su historia clínica, antecedentes e historias anteriores.</p>
            ${this.state.avisoServidor ? `<p class="hc2-aviso">${this.e(this.state.avisoServidor)}</p>` : ''}</div>`;
    },

    async seleccionar(pacienteId, { forzar = false } = {}) {
        if (!forzar && String(pacienteId) !== String(this.state.pacienteId) && !this.confirmarDescartar()) return;
        const p = this.paciente(pacienteId);
        if (!p) return;
        this.state.pacienteId = p.id;
        this.state.cambios = { historia: false, antecedentes: false };
        HistoriaClinicaModule.state.pacienteSeleccionado = JSON.parse(JSON.stringify(p));
        this.renderLista();
        this.renderDatos();
        document.getElementById('hc2Historia').innerHTML = '<p class="hc2-vacio">Cargando historia clínica…</p>';

        try {
            const [{ data: historias }, { data: antecedentes }] = await Promise.all([
                this.api(`/paciente/${encodeURIComponent(p.id)}`),
                this.api(`/antecedentes/${encodeURIComponent(p.id)}`)
            ]);
            if (String(this.state.pacienteId) !== String(p.id)) return; // cambió mientras cargaba
            this.state.historias = historias || [];
            this.state.antecedentes = antecedentes;
            // La actual: la abierta, o la más reciente
            const actual = this.state.historias.find(h => h.estado === 'abierta') || this.state.historias[0];
            this.state.historia = actual ? (await this.api(`/${actual.id}`)).data : null;
            this.renderDatos();
            this.renderHistoria();
        } catch (error) {
            this.state.historias = [];
            this.state.historia = null;
            document.getElementById('hc2Historia').innerHTML = `<div class="hc2-vacio-grande"><p>No se pudo cargar la historia clínica.</p><p class="hc2-aviso">${this.e(error.message)}</p></div>`;
        }
    },

    async verHistoria(id) {
        if (String(id) === String(this.state.historia?.id)) return;
        if (!this.confirmarDescartar()) return;
        try {
            this.state.historia = (await this.api(`/${encodeURIComponent(id)}`)).data;
            this.state.cambios.historia = false;
            this.state.pestana = 'historia';
            this.renderHistoria();
            document.getElementById('hc2Historia')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            showNotification(`No se pudo abrir la historia: ${error.message}`, 'error');
        }
    },

    esActual() {
        const actual = this.state.historias.find(h => h.estado === 'abierta') || this.state.historias[0];
        return !this.state.historia || String(actual?.id) === String(this.state.historia.id);
    },

    // ---------- Datos generales ----------
    renderDatos() {
        const contenedor = document.getElementById('hc2Datos');
        const p = this.paciente();
        if (!contenedor || !p) return;
        const alergias = this.state.antecedentes?.alergicos?.trim();
        const campos = [
            ['DPI', p.dpi || p.pasaporte],
            ['Edad', this.edad(p)],
            ['Fecha de nacimiento', p.fechaNacimiento ? this.fecha(p.fechaNacimiento) : ''],
            ['Género', { M: 'Masculino', F: 'Femenino', masculino: 'Masculino', femenino: 'Femenino' }[p.genero] || p.genero],
            ['Teléfono', p.telefono],
            ['Correo', p.email],
            ['Municipio', p.municipio]
        ].filter(([, valor]) => valor);
        contenedor.innerHTML = `
            <div class="hc2-datos-cabecera">
                ${p.foto ? `<img class="hc2-foto" src="${this.e(p.foto)}" alt="">` : `<span class="hc2-foto hc2-foto-vacia" aria-hidden="true">${this.e((p.nombre || '?').charAt(0))}${this.e((p.apellidoPaterno || '').charAt(0))}</span>`}
                <div class="hc2-datos-nombre">
                    <h2>${this.e(this.nombre(p))}</h2>
                    <p>${[this.tipoServicio(p), p.estado && p.estado !== 'activo' ? 'Inactivo' : ''].filter(Boolean).map(t => `<span class="hc2-tipo hc2-tipo-${this.e(p.tipoServicio)}">${t}</span>`).join(' ')}</p>
                </div>
                ${Permisos.puede('caratula') ? '<button type="button" class="btn btn-secondary btn-small" data-hc2="ficha"><i class="fas fa-id-card" aria-hidden="true"></i> Ver ficha</button>' : ''}
            </div>
            <dl class="hc2-datos-grid">
                ${campos.map(([etiqueta, valor]) => `<div><dt>${etiqueta}</dt><dd>${this.e(valor)}</dd></div>`).join('')}
            </dl>
            <p class="hc2-alergias${alergias ? ' con-alergias' : ''}">
                <i class="fas fa-${alergias ? 'triangle-exclamation' : 'circle-check'}" aria-hidden="true"></i>
                ${alergias ? `<strong>Alergias:</strong> ${this.e(alergias)}` : 'Sin alergias registradas en antecedentes'}
            </p>`;
    },

    // ---------- Recuadro de historia ----------
    renderHistoria() {
        const contenedor = document.getElementById('hc2Historia');
        if (!contenedor || !this.state.pacienteId) return;
        contenedor.innerHTML = `
            <div class="hc2-pestanas" role="tablist" aria-label="Secciones de la historia">
                ${this.PESTANAS.map(t => `<button type="button" role="tab" class="hc2-pestana${t.clave === this.state.pestana ? ' activa' : ''}" aria-selected="${t.clave === this.state.pestana}" data-hc2-pestana="${t.clave}">${t.texto}</button>`).join('')}
            </div>
            <div class="hc2-contenido" id="hc2Contenido" role="tabpanel"></div>`;
        this.renderContenido();
    },

    renderContenido() {
        const contenido = document.getElementById('hc2Contenido');
        if (!contenido) return;
        const pestana = this.state.pestana;
        if (pestana === 'historia') {
            contenido.innerHTML = this.htmlHistoria();
            this.actualizarImc();
            return;
        }

        // Pestañas que siguen en HistoriaClinicaModule (datos de este navegador)
        const hc = HistoriaClinicaModule;
        const p = this.paciente();
        hc.state.pacienteSeleccionado = JSON.parse(JSON.stringify(p));
        const local = hc.state.historiasClinicas.find(h => String(h.pacienteId ?? h.pacientId) === String(p.id));
        const nota = '<p class="hc2-nota-local">Estos registros se guardan solo en este navegador mientras se pasan al servidor.</p>';
        if (pestana === 'evolucion') {
            contenido.innerHTML = `
                <div class="hc2-barra"><button type="button" class="btn btn-primary btn-small" data-hc2="nota"><i class="fas fa-plus" aria-hidden="true"></i> Agregar nota</button></div>
                ${hc.htmlEvolucion(local).trim() || '<p class="hc2-vacio">Sin notas de evolución.</p>'}${nota}`;
        } else if (pestana === 'prescripciones') {
            contenido.innerHTML = `
                <div class="hc2-barra"><button type="button" class="btn btn-primary btn-small" data-hc2="prescripcion"><i class="fas fa-plus" aria-hidden="true"></i> Nueva prescripción</button></div>
                ${hc.htmlPrescripciones(local).trim() || '<p class="hc2-vacio">Sin prescripciones.</p>'}${nota}`;
        } else if (pestana === 'medicamentos') {
            const activos = hc.state.medicamentosAsignados.filter(m => String(m.pacienteId) === String(p.id) && m.estado === 'activo');
            contenido.innerHTML = `${hc.htmlMedicamentosActivos(activos).trim() || '<p class="hc2-vacio">Sin medicamentos en tratamiento.</p>'}${nota}`;
        }
    },

    // Lo llama HistoriaClinicaModule cuando cambian notas, prescripciones o medicamentos
    refrescarPestanas() {
        if (this.state.pacienteId && this.state.pestana !== 'historia') this.renderContenido();
    },

    htmlHistoria() {
        const h = this.state.historia;
        const medico = this.esMedico();
        const hayAbierta = this.state.historias.some(x => x.estado === 'abierta');
        const botonNueva = medico && !hayAbierta
            ? '<button type="button" class="btn btn-primary btn-small" data-hc2="nueva"><i class="fas fa-plus" aria-hidden="true"></i> Nueva historia</button>'
            : '';

        if (!h) {
            return `
                <div class="hc2-vacio-grande">
                    <i class="fas fa-file-medical" aria-hidden="true"></i>
                    <p>Este paciente no tiene historias clínicas.</p>
                    ${botonNueva || '<p class="hc2-nota-local">El médico abre la historia en la consulta o el ingreso.</p>'}
                </div>
                ${this.htmlAntecedentes(this.state.antecedentes, this.puedeEditar())}
                ${this.puedeEditar() ? '<div class="hc2-acciones"><button type="button" class="btn btn-primary" data-hc2="guardar"><i class="fas fa-floppy-disk" aria-hidden="true"></i> Guardar antecedentes</button></div>' : ''}`;
        }

        const abierta = h.estado === 'abierta';
        const editable = abierta && this.puedeEditar();
        // En una historia cerrada se ven los antecedentes como estaban al cerrarla
        const antecedentes = abierta ? this.state.antecedentes : (h.antecedentes_al_cierre || {});
        const antecedentesEditables = abierta && this.puedeEditar();
        const admin = Permisos.esAdmin();

        return `
            ${!this.esActual() ? `
            <div class="hc2-viendo" role="status">
                <i class="fas fa-clock-rotate-left" aria-hidden="true"></i>
                <span>Viendo la historia del <strong>${this.fecha(h.fecha)}</strong> (${h.estado === 'cerrada' ? 'cerrada' : 'abierta'}).</span>
                <button type="button" class="btn btn-secondary btn-small" data-hc2="actual">Volver a la actual</button>
            </div>` : ''}

            <div class="hc2-encabezado">
                <div>
                    <h3>Historia clínica · ${this.tipoTexto(h.tipo)} · ${this.fecha(h.fecha)}</h3>
                    <p>${this.e(h.medico_nombre || '—')} · <span class="hc2-estado hc2-estado-${h.estado}">${abierta ? 'Abierta' : 'Cerrada'}</span>
                       ${h.cerrada_en ? ` · Cerrada por ${this.e(h.cerrada_por_nombre || '—')} el ${this.e(formatFechaHora(h.cerrada_en))}` : ''}</p>
                </div>
                <div class="hc2-encabezado-acciones">
                    ${botonNueva}
                    <button type="button" class="btn btn-secondary btn-small" data-hc2="imprimir"><i class="fas fa-print" aria-hidden="true"></i> Imprimir</button>
                    ${admin && !abierta ? '<button type="button" class="btn btn-secondary btn-small" data-hc2="reabrir"><i class="fas fa-lock-open" aria-hidden="true"></i> Reabrir</button>' : ''}
                    ${admin ? '<button type="button" class="btn btn-outline btn-small hc2-eliminar" data-hc2="eliminar"><i class="fas fa-trash" aria-hidden="true"></i> Eliminar</button>' : ''}
                </div>
            </div>

            <div class="hc2-cuerpo">
                <div class="hc2-formulario" data-hc2-seccion="historia">
                    ${editable ? `
                    <div class="hc2-fila-dos">
                        <label class="hc2-campo"><span>Tipo</span>
                            <select class="form-input" data-campo="tipo">${this.TIPOS.map(t => `<option value="${t.valor}"${t.valor === h.tipo ? ' selected' : ''}>${t.texto}</option>`).join('')}</select>
                        </label>
                        <label class="hc2-campo"><span>Fecha</span>
                            <input type="date" class="form-input" data-campo="fecha" value="${this.e(String(h.fecha).slice(0, 10))}" max="${this.hoy()}">
                        </label>
                    </div>` : ''}
                    ${this.CAMPOS_HISTORIA.slice(0, 3).map(c => this.htmlCampo(c, h, editable)).join('')}
                    ${this.htmlSignos(h, editable)}
                    ${this.CAMPOS_HISTORIA.slice(3).map(c => this.htmlCampo(c, h, editable)).join('')}
                </div>
                ${this.htmlAntecedentes(antecedentes, antecedentesEditables, !abierta)}
            </div>

            ${editable || (abierta && medico) ? `
            <div class="hc2-acciones">
                ${editable ? '<button type="button" class="btn btn-primary" data-hc2="guardar"><i class="fas fa-floppy-disk" aria-hidden="true"></i> Guardar</button>' : ''}
                ${abierta && medico ? '<button type="button" class="btn btn-secondary" data-hc2="cerrar"><i class="fas fa-lock" aria-hidden="true"></i> Cerrar historia</button>' : ''}
            </div>` : ''}

            ${this.htmlAnteriores()}`;
    },

    htmlCampo(campo, h, editable) {
        const valor = h[campo.clave] || '';
        if (editable) {
            return `
                <label class="hc2-campo"><span>${campo.texto}${campo.requerido ? ' <small>(necesario para cerrar)</small>' : ''}</span>
                    <textarea class="form-input" data-campo="${campo.clave}" rows="${campo.filas}">${this.e(valor)}</textarea>
                </label>`;
        }
        return `
            <div class="hc2-campo hc2-lectura">
                <span>${campo.texto}</span>
                <p>${valor ? this.e(valor) : '<em>Sin registrar</em>'}</p>
            </div>`;
    },

    htmlSignos(h, editable) {
        const s = h.signos_vitales || {};
        const celdas = this.SIGNOS.map(sv => editable
            ? `<label class="hc2-signo"><span>${sv.texto} <small>${sv.unidad}</small></span>
                   <input type="text" class="form-input" inputmode="${sv.clave === 'pa' ? 'text' : 'decimal'}" maxlength="20" data-signo="${sv.clave}" value="${this.e(s[sv.clave] || '')}" placeholder="${sv.ejemplo || ''}"></label>`
            : `<div class="hc2-signo"><span>${sv.texto} <small>${sv.unidad}</small></span><strong>${this.e(s[sv.clave] || '—')}</strong></div>`).join('');
        return `
            <fieldset class="hc2-signos">
                <legend>Signos vitales</legend>
                <div class="hc2-signos-grid">
                    ${celdas}
                    <div class="hc2-signo"><span>IMC <small>kg/m²</small></span><strong id="hc2Imc">—</strong></div>
                </div>
            </fieldset>`;
    },

    // IMC = peso / talla² (talla en metros), a partir de lo que está en pantalla
    actualizarImc() {
        const salida = document.getElementById('hc2Imc');
        if (!salida) return;
        const leer = clave => {
            const input = document.querySelector(`#hc2Contenido [data-signo="${clave}"]`);
            const texto = input ? input.value : (this.state.historia?.signos_vitales || {})[clave];
            return Number(String(texto || '').replace(',', '.'));
        };
        const peso = leer('peso');
        const talla = leer('talla') / 100;
        salida.textContent = peso > 0 && talla > 0 ? (peso / (talla * talla)).toFixed(1) : '—';
    },

    htmlAntecedentes(antecedentes, editable, alCierre = false) {
        const a = antecedentes || {};
        return `
            <aside class="hc2-antecedentes" data-hc2-seccion="antecedentes" aria-label="Antecedentes">
                <h4>Antecedentes</h4>
                <p class="hc2-antecedentes-nota">${alCierre
                    ? 'Como estaban al cerrar esta historia.'
                    : (a.updated_at ? `Actualizados por ${this.e(a.actualizado_por_nombre || '—')} · ${this.e(formatFechaHora(a.updated_at))}` : 'Del paciente; se comparten con todas sus historias.')}</p>
                ${this.ANTECEDENTES.map(c => editable
                    ? `<label class="hc2-campo"><span>${c.texto}</span><textarea class="form-input" rows="2" data-antecedente="${c.clave}">${this.e(a[c.clave] || '')}</textarea></label>`
                    : `<div class="hc2-campo hc2-lectura"><span>${c.texto}</span><p>${a[c.clave] ? this.e(a[c.clave]) : '<em>Sin registrar</em>'}</p></div>`).join('')}
            </aside>`;
    },

    htmlAnteriores() {
        const historias = this.state.historias;
        if (historias.length < 2 && this.esActual()) return '';
        const vista = String(this.state.historia?.id);
        return `
            <section class="hc2-anteriores" aria-label="Historias del paciente">
                <h4>Historias clínicas del paciente <small>(${historias.length})</small></h4>
                <ul>
                    ${historias.map(h => `
                        <li>
                            <button type="button" class="hc2-anterior${String(h.id) === vista ? ' activa' : ''}" data-hc2-historia="${h.id}" aria-current="${String(h.id) === vista}">
                                <span class="hc2-anterior-fecha">${this.fecha(h.fecha)}</span>
                                <span class="hc2-anterior-tipo">${this.tipoTexto(h.tipo)}</span>
                                <span class="hc2-anterior-motivo">${this.e(h.motivo_consulta || h.impresion_clinica || 'Sin motivo registrado')}</span>
                                <span class="hc2-anterior-medico">${this.e(h.medico_nombre || '')}</span>
                                <span class="hc2-estado hc2-estado-${h.estado}">${h.estado === 'abierta' ? 'Abierta' : 'Cerrada'}</span>
                            </button>
                        </li>`).join('')}
                </ul>
            </section>`;
    },

    // ---------- Acciones ----------
    alHacerClic(e) {
        const pestana = e.target.closest('[data-hc2-pestana]');
        if (pestana) {
            if (pestana.dataset.hc2Pestana !== 'historia' && this.state.cambios.historia && !this.confirmarDescartar()) return;
            if (pestana.dataset.hc2Pestana !== 'historia') this.state.cambios = { historia: false, antecedentes: false };
            this.state.pestana = pestana.dataset.hc2Pestana;
            this.renderHistoria();
            return;
        }
        const historia = e.target.closest('[data-hc2-historia]');
        if (historia) return this.verHistoria(historia.dataset.hc2Historia);

        const accion = e.target.closest('[data-hc2]')?.dataset.hc2;
        const hc = HistoriaClinicaModule;
        const acciones = {
            nueva: () => this.nueva(),
            guardar: () => this.guardar(),
            cerrar: () => this.cerrar(),
            reabrir: () => this.reabrir(),
            eliminar: () => this.eliminar(),
            imprimir: () => this.imprimir(),
            actual: () => {
                const actual = this.state.historias.find(h => h.estado === 'abierta') || this.state.historias[0];
                if (actual) this.verHistoria(actual.id);
            },
            nota: () => {
                hc.state.pacienteSeleccionado = JSON.parse(JSON.stringify(this.paciente()));
                hc.openNoteModal().then(() => hc.switchTab('nota'));
            },
            prescripcion: () => {
                hc.state.pacienteSeleccionado = JSON.parse(JSON.stringify(this.paciente()));
                hc.openNoteModal().then(() => hc.switchTab('prescripcion'));
            }
        };
        acciones[accion]?.();
    },

    leerHistoria() {
        const datos = { signos_vitales: {} };
        document.querySelectorAll('#hc2Contenido [data-hc2-seccion="historia"] [data-campo]').forEach(el => { datos[el.dataset.campo] = el.value; });
        document.querySelectorAll('#hc2Contenido [data-signo]').forEach(el => { datos.signos_vitales[el.dataset.signo] = el.value.trim(); });
        return datos;
    },

    leerAntecedentes() {
        const datos = {};
        document.querySelectorAll('#hc2Contenido [data-antecedente]').forEach(el => { datos[el.dataset.antecedente] = el.value; });
        return datos;
    },

    // Guarda lo que cambió: la historia abierta y/o los antecedentes. Devuelve false si algo falló.
    async guardar({ silencioso = false } = {}) {
        const boton = document.querySelector('#hc2Contenido [data-hc2="guardar"]');
        if (boton) boton.disabled = true;
        try {
            const pacienteId = this.state.pacienteId;
            if (this.state.cambios.historia && this.state.historia?.estado === 'abierta') {
                this.state.historia = (await this.api(`/${this.state.historia.id}`, { method: 'PUT', body: JSON.stringify(this.leerHistoria()) })).data;
                this.state.cambios.historia = false;
            }
            if (this.state.cambios.antecedentes) {
                this.state.antecedentes = (await this.api(`/antecedentes/${encodeURIComponent(pacienteId)}`, { method: 'PUT', body: JSON.stringify(this.leerAntecedentes()) })).data;
                this.state.cambios.antecedentes = false;
            }
            await this.recargarLista();
            if (!silencioso) showNotification('Historia clínica guardada', 'success');
            this.renderDatos();
            this.renderContenido();
            return true;
        } catch (error) {
            showNotification(`No se pudo guardar: ${error.message}`, 'error');
            return false;
        } finally {
            if (boton) boton.disabled = false;
        }
    },

    // Refresca la lista de historias del paciente y el resumen de la columna izquierda
    async recargarLista() {
        const { data } = await this.api(`/paciente/${encodeURIComponent(this.state.pacienteId)}`);
        this.state.historias = data || [];
        await this.cargarResumen();
        this.renderLista();
    },

    async nueva() {
        if (!this.confirmarDescartar()) return;
        try {
            const { data } = await this.api('', { method: 'POST', body: JSON.stringify({ paciente_id: this.state.pacienteId, tipo: 'consulta', fecha: this.hoy() }) });
            this.state.historia = data;
            this.state.cambios = { historia: false, antecedentes: false };
            await this.recargarLista();
            this.renderContenido();
            showNotification('Historia clínica abierta. Complete los datos y guarde.', 'success');
            document.querySelector('#hc2Contenido [data-campo="motivo_consulta"]')?.focus();
        } catch (error) {
            showNotification(`No se pudo abrir la historia: ${error.message}`, 'error');
        }
    },

    async cerrar() {
        const h = this.state.historia;
        if (!h) return;
        if (this.hayCambios() && !(await this.guardar({ silencioso: true }))) return;
        if (!confirm(`¿Cerrar la historia clínica del ${this.fecha(h.fecha)}? Después ya no se podrá editar; quedará guardada con los antecedentes de hoy.`)) return;
        try {
            this.state.historia = (await this.api(`/${h.id}/cerrar`, { method: 'POST' })).data;
            await this.recargarLista();
            this.renderContenido();
            showNotification('Historia clínica cerrada', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async reabrir() {
        const h = this.state.historia;
        if (!h || !confirm(`¿Reabrir la historia del ${this.fecha(h.fecha)} para editarla?`)) return;
        try {
            this.state.historia = (await this.api(`/${h.id}/reabrir`, { method: 'POST' })).data;
            await this.recargarLista();
            this.renderContenido();
            showNotification('Historia clínica reabierta', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async eliminar() {
        const h = this.state.historia;
        if (!h || !confirm(`¿Eliminar la historia clínica del ${this.fecha(h.fecha)}? No se puede deshacer.`)) return;
        try {
            await this.api(`/${h.id}`, { method: 'DELETE' });
            showNotification('Historia clínica eliminada', 'success');
            this.state.cambios = { historia: false, antecedentes: false };
            await this.seleccionar(this.state.pacienteId, { forzar: true });
            await this.cargarResumen();
            this.renderLista();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    imprimir() {
        const h = this.state.historia;
        const p = this.paciente();
        if (!h || !p) return;
        const e = valor => this.e(valor);
        const clinica = (typeof CONFIG !== 'undefined' && CONFIG.CLINICA) || { nombre: 'Zentra MED' };
        const antecedentes = h.estado === 'abierta' ? (this.state.antecedentes || {}) : (h.antecedentes_al_cierre || {});
        const signos = h.signos_vitales || {};
        const texto = valor => valor ? `<p>${e(valor)}</p>` : '<p class="vacio">Sin registrar</p>';
        const ventana = window.open('', '_blank');
        if (!ventana) {
            showNotification('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes para este sitio.', 'warning');
            return;
        }
        ventana.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Historia clínica - ${e(this.nombre(p))} - ${e(this.fecha(h.fecha))}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2933; font-size: 12px; line-height: 1.45; padding: 28px; }
  .doc { max-width: 900px; margin: 0 auto; }
  header { display: flex; justify-content: space-between; border-bottom: 2px solid #1d5bd8; padding-bottom: 10px; margin-bottom: 14px; }
  header strong { font-size: 15px; color: #1d5bd8; }
  h1 { font-size: 17px; text-align: right; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #52606d; margin: 14px 0 6px; border-bottom: 1px solid #e4e8ef; padding-bottom: 3px; }
  .datos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 16px; }
  .datos b { color: #52606d; font-weight: 600; }
  .signos { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
  .signos div { border: 1px solid #e4e8ef; border-radius: 4px; padding: 4px; text-align: center; }
  .signos span { display: block; font-size: 10px; color: #52606d; }
  .campo { margin-bottom: 8px; } .campo b { display: block; color: #52606d; }
  p { white-space: pre-wrap; } .vacio { color: #8a94a6; font-style: italic; }
  .ant { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
  footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; color: #52606d; }
  .firma { border-top: 1px solid #1f2933; padding-top: 4px; width: 240px; text-align: center; margin-top: 40px; }
  @media print { body { padding: 0; } }
</style></head><body><div class="doc">
<header><div><strong>${e(clinica.nombre || 'Zentra MED')}</strong></div>
<div><h1>HISTORIA CLÍNICA</h1><div style="text-align:right">${e(this.tipoTexto(h.tipo))} · ${e(this.fecha(h.fecha))} · ${h.estado === 'abierta' ? 'Abierta' : 'Cerrada'}</div></div></header>
<h2>Datos generales</h2>
<div class="datos">
  <div><b>Paciente:</b> ${e(this.nombre(p))}</div><div><b>DPI:</b> ${e(p.dpi || p.pasaporte || '—')}</div><div><b>Edad:</b> ${e(this.edad(p) || '—')}</div>
  <div><b>Género:</b> ${e(p.genero || '—')}</div><div><b>Teléfono:</b> ${e(p.telefono || '—')}</div><div><b>Médico:</b> ${e(h.medico_nombre || '—')}</div>
</div>
<h2>Historia clínica</h2>
${this.CAMPOS_HISTORIA.slice(0, 3).map(c => `<div class="campo"><b>${c.texto}</b>${texto(h[c.clave])}</div>`).join('')}
<div class="campo"><b>Signos vitales</b><div class="signos">${this.SIGNOS.map(s => `<div><span>${s.texto} (${s.unidad})</span>${e(signos[s.clave] || '—')}</div>`).join('')}<div><span>IMC</span>${(() => { const peso = Number(String(signos.peso || '').replace(',', '.')); const talla = Number(String(signos.talla || '').replace(',', '.')) / 100; return peso > 0 && talla > 0 ? (peso / (talla * talla)).toFixed(1) : '—'; })()}</div></div></div>
${this.CAMPOS_HISTORIA.slice(3).map(c => `<div class="campo"><b>${c.texto}</b>${texto(h[c.clave])}</div>`).join('')}
<h2>Antecedentes${h.estado === 'cerrada' ? ' (al cierre de esta historia)' : ''}</h2>
<div class="ant">${this.ANTECEDENTES.map(c => `<div class="campo"><b>${c.texto}</b>${texto(antecedentes[c.clave])}</div>`).join('')}</div>
<footer><span>Impreso el ${e(formatFechaHora(new Date()))}</span><div class="firma">${e(h.medico_nombre || 'Médico tratante')}</div></footer>
</div></body></html>`);
        ventana.document.close();
        setTimeout(() => ventana.print(), 250);
    }
};

window.HistoriaPanelModule = HistoriaPanelModule;
