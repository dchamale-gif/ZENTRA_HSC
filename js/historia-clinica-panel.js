// ============================================
// HISTORIA CLÍNICA - PANEL DE TRES RECUADROS
// ============================================
// Filtros arriba; a la izquierda los pacientes; a la derecha arriba los datos generales
// y abajo la historia clínica con los antecedentes, más las historias anteriores.
// Historias y antecedentes viven en el servidor (/api/historias-clinicas). Las órdenes médicas
// y las notas de enfermería quedan ligadas a la historia abierta y se ven en sus pestañas.
// La evolución médica también vive en el servidor (/api/evoluciones).
// Prescripciones y medicamentos salen de las órdenes médicas transcritas por enfermería
// con las medicinas del catálogo.

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

    TURNOS: [
        { valor: 'manana', texto: 'Mañana' },
        { valor: 'tarde', texto: 'Tarde' },
        { valor: 'noche', texto: 'Noche' }
    ],

    TIPOS_EVOLUCION: ['Seguimiento', 'Observación', 'Diagnóstico', 'Control', 'Indicaciones', 'Evaluación', 'Contraindicación', 'Procedimiento'],

    PESTANAS: [
        { clave: 'historia', texto: 'Historia' },
        { clave: 'signos', texto: 'Signos vitales' },
        { clave: 'ordenes', texto: 'Órdenes' },
        { clave: 'notas', texto: 'Notas de enfermería' },
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
        ordenes: [],
        notas: [],
        editandoNota: null,
        evoluciones: [],
        medicosEvolucion: null,
        evolucionForm: null, // null, 'nueva' o el id de la evolución que el admin modifica
        tomas: [],
        signoForm: null, // null, 'nueva' o el id de la toma de signos vitales que se corrige
        refrescando: false,
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
            throw Object.assign(new Error(data.message || data.error || `Error ${response.status}`), { status: response.status, datos: data });
        }
        return data;
    },

    // Otros recursos de la API (órdenes, notas de enfermería)
    async apiGeneral(path, options = {}) {
        const response = await fetch(`${authManager.apiBaseUrl}/api${path}`, {
            ...options,
            headers: { Authorization: `Bearer ${authManager.getToken()}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) throw new Error(data.message || data.error || `Error ${response.status}`);
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

        // Órdenes, transcripciones o historias que cambiaron en otra pantalla, ventana o usuario
        document.addEventListener('zentra:ordenes-cambiaron', e => {
            const detalle = e.detail || {};
            if (detalle.origen === 'historia' && !detalle.remoto) return;
            // Una orden dada desde esta misma ventana (p. ej. desde la pestaña Órdenes) se refleja enseguida
            if (!detalle.remoto && this.state.pacienteId && String(detalle.pacienteId) === String(this.state.pacienteId)) {
                this.alCambiarOrdenes().catch(() => { /* se verá en el próximo refresco */ });
            } else if (typeof ZentraSync === 'undefined' || ZentraSync.estaVisible('historia-clinica')) {
                this.refrescar().catch(() => { /* se verá en el próximo refresco */ });
            }
        });
        if (typeof ZentraSync !== 'undefined') ZentraSync.registrar('historia-clinica', () => this.refrescar());
    },

    // Avisa a Órdenes médicas, Órdenes de enfermería y a otras ventanas
    avisar() {
        if (typeof ZentraSync !== 'undefined') ZentraSync.avisar({ pacienteId: this.state.pacienteId, origen: 'historia' });
    },

    // Alguien está escribiendo: el refresco automático espera
    ocupado() {
        if (this.hayCambios() || this.state.editandoNota || this.state.evolucionForm || this.state.signoForm || document.querySelector('.hc2-dialogo')) return true;
        if (document.querySelector('#hc2Contenido [data-hc2-nota="texto"]')?.value.trim()) return true;
        const activo = document.activeElement;
        return !!activo?.closest('#hc2Historia') && activo.matches('input, textarea, select') && !activo.closest('.hc2-nota-form');
    },

    // Datos frescos del servidor sin interrumpir a quien escribe
    async refrescar() {
        if (this.ocupado()) return;
        if (!this.state.pacienteId) {
            await this.cargarResumen();
            this.renderLista();
            return;
        }
        await this.alCambiarOrdenes();
    },

    async alCambiarOrdenes() {
        const pacienteId = this.state.pacienteId;
        const conCambios = this.hayCambios();
        const veiaActual = this.esActual();
        const antes = this.state.historia?.id;
        await this.recargarLista();
        if (String(this.state.pacienteId) !== String(pacienteId)) return;
        if (!conCambios) {
            // La historia que se veía (o la recién abierta) con su estado actual; pudo cerrarse o eliminarse
            const abierta = this.state.historias.find(h => h.estado === 'abierta');
            const sigue = this.state.historias.find(h => String(h.id) === String(antes));
            const destino = (veiaActual && abierta) || sigue || this.state.historias[0];
            const [historia, antecedentes] = await Promise.all([
                destino ? this.api(`/${destino.id}`) : null,
                this.api(`/antecedentes/${encodeURIComponent(pacienteId)}`)
            ]);
            if (String(this.state.pacienteId) !== String(pacienteId) || this.hayCambios()) return;
            this.state.historia = historia?.data || null;
            this.state.antecedentes = antecedentes.data;
            this.renderDatos();
        } else if (!['ordenes', 'notas'].includes(this.state.pestana)) {
            return; // el formulario de la historia tiene cambios sin guardar
        }
        this.state.refrescando = true;
        try {
            if (String(antes) !== String(this.state.historia?.id) || !document.getElementById('hc2Contenido')) await this.renderHistoria();
            else await this.renderContenido();
        } finally {
            this.state.refrescando = false;
        }
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
            if (!this.state.pacienteId) return this.renderSinSeleccion();
            // Al volver a la pantalla: lo que cambió mientras tanto en órdenes, notas o historias
            this.renderDatos();
            this.refrescar().catch(() => { /* se verá en el próximo refresco */ });
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
        return this.renderContenido();
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
        if (pestana === 'ordenes' || pestana === 'notas') {
            return this.renderOrdenesYNotas(contenido, pestana);
        }
        if (pestana === 'evolucion') {
            return this.renderEvolucion(contenido);
        }
        if (pestana === 'signos') {
            return this.renderSignos(contenido);
        }

        if (pestana === 'prescripciones' || pestana === 'medicamentos') {
            return this.renderMedicacion(contenido, pestana);
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
                    ${this.CAMPOS_HISTORIA.map(c => this.htmlCampo(c, h, editable)).join('')}
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

    // ---------- Signos vitales: cada toma con fecha y hora ----------
    // Los registra quien edita la historia (enfermería o médico); la lista es de todas las historias del paciente
    async renderSignos(contenido) {
        const pacienteId = this.state.pacienteId;
        if (!this.state.refrescando) contenido.innerHTML = '<p class="hc2-vacio">Cargando signos vitales…</p>';
        let error = '';
        try {
            this.state.tomas = (await this.apiGeneral(`/signos-vitales?paciente_id=${encodeURIComponent(pacienteId)}`)).data || [];
        } catch (e) {
            this.state.tomas = [];
            error = e.message;
        }
        if (String(this.state.pacienteId) !== String(pacienteId) || this.state.pestana !== 'signos') return; // cambió mientras cargaba
        contenido.innerHTML = this.htmlSignosVitales(error);
        this.actualizarImc();
    },

    // IMC = peso / talla² (talla en metros)
    imc(valores = {}) {
        const peso = Number(String(valores.peso || '').replace(',', '.'));
        const talla = Number(String(valores.talla || '').replace(',', '.')) / 100;
        return peso > 0 && talla > 0 ? (peso / (talla * talla)).toFixed(1) : '';
    },

    puedeCorregirToma(t) {
        const admin = Permisos.esAdmin();
        return this.puedeEditar() && (admin || (String(t.registrado_por_id) === String(Permisos.usuario().id) && t.historia_estado === 'abierta'));
    },

    htmlSignosVitales(error) {
        const tomas = this.state.tomas;
        const hayAbierta = this.state.historias.some(h => h.estado === 'abierta');
        const puedeRegistrar = this.puedeEditar() && (hayAbierta || this.esMedico());
        const ultima = tomas[0];

        const tarjetaUltima = ultima ? `
            <section class="hc2-signos hc2-signos-ultima" aria-label="Última toma">
                <div class="hc2-evol-cabecera">
                    <strong>Última toma</strong>
                    <span class="hc2-signos-cuando">${this.e(this.fechaHora(ultima.fecha_hora))} · ${this.e(ultima.registrado_por_nombre || '—')}</span>
                </div>
                <div class="hc2-signos-grid">
                    ${this.SIGNOS.map(sv => `<div class="hc2-signo"><span>${sv.texto} <small>${sv.unidad}</small></span><strong>${this.e(ultima.valores?.[sv.clave] || '—')}</strong></div>`).join('')}
                    <div class="hc2-signo"><span>IMC <small>kg/m²</small></span><strong>${this.imc(ultima.valores) || '—'}</strong></div>
                </div>
                ${ultima.nota ? `<p class="hc2-signos-nota">${this.e(ultima.nota)}</p>` : ''}
            </section>` : '';

        // Historial agrupado por día, la toma más reciente primero
        const dias = [];
        tomas.forEach(t => {
            const dia = String(t.fecha_hora).slice(0, 10);
            if (dias[dias.length - 1]?.dia !== dia) dias.push({ dia, tomas: [] });
            dias[dias.length - 1].tomas.push(t);
        });
        const nombreDia = dia => {
            const [a, m, d] = dia.split('-').map(Number);
            const texto = new Date(a, m - 1, d).toLocaleDateString('es', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
            return texto.charAt(0).toUpperCase() + texto.slice(1);
        };
        const columnas = this.SIGNOS.length + 4;
        const historial = tomas.length ? `
            <h3 class="hc2-subtitulo">Historial por fecha (${tomas.length} ${tomas.length === 1 ? 'toma' : 'tomas'})</h3>
            <div class="hc2-tabla-med-envoltura">
                <table class="hc2-tabla-med hc2-tabla-signos">
                    <thead><tr>
                        <th scope="col">Hora</th>
                        ${this.SIGNOS.map(sv => `<th scope="col">${sv.texto} <small>${sv.unidad}</small></th>`).join('')}
                        <th scope="col">IMC</th><th scope="col">Registró</th><th scope="col"><span class="sr-only">Acciones</span></th>
                    </tr></thead>
                    ${dias.map(({ dia, tomas: delDia }) => `<tbody>
                        <tr class="hc2-signos-dia"><th scope="rowgroup" colspan="${columnas}">${this.e(nombreDia(dia))}</th></tr>
                        ${delDia.map(t => `<tr${String(t.id) === String(this.state.signoForm) ? ' class="editando"' : ''}>
                            <td>${this.e(String(t.fecha_hora).slice(11, 16))}</td>
                            ${this.SIGNOS.map(sv => `<td>${this.e(t.valores?.[sv.clave] || '—')}</td>`).join('')}
                            <td>${this.imc(t.valores) || '—'}</td>
                            <td>${this.e(t.registrado_por_nombre || '—')}${t.nota ? `<small class="hc2-signos-nota-fila">${this.e(t.nota)}</small>` : ''}</td>
                            <td>${this.puedeCorregirToma(t) ? `<div class="hc2-entrada-acciones hc2-signos-acciones">
                                <button type="button" class="btn-accion btn-accion-icono" data-hc2="editar-signos" data-toma="${t.id}" title="Corregir" aria-label="Corregir signos vitales"><i class="fas fa-pen" aria-hidden="true"></i></button>
                                <button type="button" class="btn-accion btn-accion-icono btn-accion-peligro" data-hc2="borrar-signos" data-toma="${t.id}" title="Eliminar" aria-label="Eliminar signos vitales"><i class="fas fa-trash" aria-hidden="true"></i></button>
                            </div>` : ''}</td>
                        </tr>`).join('')}
                    </tbody>`).join('')}
                </table>
            </div>` : `<p class="hc2-vacio">${error ? '' : 'Sin signos vitales registrados.'}</p>`;

        return `
            <div class="hc2-evol-encabezado">
                <h3>Signos vitales</h3>
                ${puedeRegistrar && !this.state.signoForm ? '<button type="button" class="btn btn-primary btn-small" data-hc2="registrar-signos"><i class="fas fa-plus" aria-hidden="true"></i> Registrar signos vitales</button>' : ''}
            </div>
            ${this.puedeEditar() && !puedeRegistrar ? '<p class="hc2-nota-local"><i class="fas fa-circle-info" aria-hidden="true"></i> Para registrar signos vitales el médico debe abrir la historia clínica.</p>' : ''}
            ${error ? `<p class="hc2-aviso">${this.e(error)}</p>` : ''}
            ${this.state.signoForm ? this.htmlFormSignos() : ''}
            ${tarjetaUltima}${historial}`;
    },

    htmlFormSignos() {
        const editando = this.state.signoForm !== 'nueva'
            ? this.state.tomas.find(t => String(t.id) === String(this.state.signoForm))
            : null;
        const v = editando?.valores || {};
        const sinHistoriaAbierta = !editando && !this.state.historias.some(h => h.estado === 'abierta');
        return `
            <div class="hc2-nota-form hc2-evol-form hc2-signos-form" role="group" aria-label="${editando ? 'Corregir signos vitales' : 'Registrar signos vitales'}">
                <h4>${editando ? 'Corregir signos vitales' : 'Nueva toma de signos vitales'}</h4>
                <label class="hc2-campo hc2-signos-fecha"><span>Fecha y hora</span>
                    <input type="datetime-local" class="form-input" data-hc2-toma="fecha" value="${this.e(editando?.fecha_hora || this.ahoraLocal())}">
                </label>
                <div class="hc2-signos-grid">
                    ${this.SIGNOS.map(sv => `<label class="hc2-signo"><span>${sv.texto} <small>${sv.unidad}</small></span>
                        <input type="text" class="form-input" inputmode="${sv.clave === 'pa' ? 'text' : 'decimal'}" maxlength="20" data-signo="${sv.clave}" value="${this.e(v[sv.clave] || '')}" placeholder="${sv.ejemplo || ''}"></label>`).join('')}
                    <div class="hc2-signo"><span>IMC <small>kg/m²</small></span><strong id="hc2Imc">—</strong></div>
                </div>
                <label class="hc2-campo"><span>Nota (opcional)</span>
                    <input type="text" class="form-input" maxlength="500" data-hc2-toma="nota" value="${this.e(editando?.nota || '')}" placeholder="Ej.: en reposo, posterior a medicamento, paciente agitado…">
                </label>
                ${sinHistoriaAbierta ? '<p class="hc2-nota-local"><i class="fas fa-circle-info" aria-hidden="true"></i> El paciente no tiene historia abierta: al guardar se abre la historia de hoy.</p>' : ''}
                <div class="hc2-barra">
                    <button type="button" class="btn btn-secondary btn-small" data-hc2="cancelar-signos">Cancelar</button>
                    <button type="button" class="btn btn-primary btn-small" data-hc2="guardar-signos"><i class="fas fa-floppy-disk" aria-hidden="true"></i> ${editando ? 'Guardar corrección' : 'Guardar signos vitales'}</button>
                </div>
            </div>`;
    },

    abrirFormSignos(valor) {
        this.state.signoForm = valor;
        const contenido = document.getElementById('hc2Contenido');
        if (!contenido) return;
        contenido.innerHTML = this.htmlSignosVitales('');
        this.actualizarImc();
        const form = contenido.querySelector('.hc2-signos-form');
        form?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        form?.querySelector('[data-signo]')?.focus({ preventScroll: true });
    },

    async guardarSignos() {
        const form = document.querySelector('#hc2Contenido .hc2-signos-form');
        if (!form) return;
        const valores = {};
        form.querySelectorAll('[data-signo]').forEach(el => { if (el.value.trim()) valores[el.dataset.signo] = el.value.trim(); });
        if (!Object.keys(valores).length) {
            showNotification('Escriba al menos un signo vital', 'warning');
            form.querySelector('[data-signo]')?.focus();
            return;
        }
        const editando = this.state.signoForm !== 'nueva' ? this.state.signoForm : null;
        const datos = {
            paciente_id: this.state.pacienteId,
            fecha_hora: form.querySelector('[data-hc2-toma="fecha"]').value,
            nota: form.querySelector('[data-hc2-toma="nota"]').value,
            valores
        };
        const boton = form.querySelector('[data-hc2="guardar-signos"]');
        boton.disabled = true;
        try {
            const respuesta = await this.apiGeneral(editando ? `/signos-vitales/${editando}` : '/signos-vitales', { method: editando ? 'PUT' : 'POST', body: JSON.stringify(datos) });
            this.state.signoForm = null;
            showNotification(respuesta.data?.historia_abierta_automaticamente
                ? 'Signos vitales registrados. Se abrió la historia clínica de hoy.'
                : editando ? 'Signos vitales corregidos' : 'Signos vitales registrados', 'success');
            if (respuesta.data?.historia_abierta_automaticamente) await this.alCambiarOrdenes();
            else await this.renderContenido();
            this.avisar();
        } catch (error) {
            showNotification(`No se pudieron guardar los signos vitales: ${error.message}`, 'error');
            boton.disabled = false;
        }
    },

    async borrarSignos(id) {
        const t = this.state.tomas.find(item => String(item.id) === String(id));
        if (!t || !confirm(`¿Eliminar la toma de signos vitales del ${this.fechaHora(t.fecha_hora)}?`)) return;
        try {
            await this.apiGeneral(`/signos-vitales/${id}`, { method: 'DELETE' });
            if (String(this.state.signoForm) === String(id)) this.state.signoForm = null;
            showNotification('Toma de signos vitales eliminada', 'success');
            await this.renderContenido();
            this.avisar();
        } catch (error) {
            showNotification(`No se pudo eliminar: ${error.message}`, 'error');
        }
    },

    // IMC del formulario de signos, mientras se escribe
    actualizarImc() {
        const salida = document.getElementById('hc2Imc');
        if (!salida) return;
        const leer = clave => document.querySelector(`#hc2Contenido [data-signo="${clave}"]`)?.value;
        salida.textContent = this.imc({ peso: leer('peso'), talla: leer('talla') }) || '—';
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

    // ---------- Órdenes médicas y notas de enfermería de la historia ----------
    async cargarOrdenesYNotas(historiaId) {
        const [ordenes, notas] = await Promise.allSettled([
            this.apiGeneral(`/ordenes-enfermeria?historia_id=${historiaId}`),
            this.apiGeneral(`/notas-enfermeria?historia_id=${historiaId}`)
        ]);
        return {
            ordenes: ordenes.status === 'fulfilled' ? ordenes.value.data || [] : null,
            notas: notas.status === 'fulfilled' ? notas.value.data || [] : null,
            error: [ordenes, notas].find(r => r.status === 'rejected')?.reason?.message || ''
        };
    },

    async renderOrdenesYNotas(contenido, pestana) {
        const h = this.state.historia;
        if (!h) {
            contenido.innerHTML = `<div class="hc2-vacio-grande"><i class="fas fa-file-medical" aria-hidden="true"></i>
                <p>Este paciente no tiene historia clínica. ${pestana === 'ordenes'
                    ? 'La primera orden médica abre la historia del día.'
                    : 'Las notas de enfermería se escriben dentro de una historia abierta.'}</p>
                ${pestana === 'ordenes' && this.puedeOrdenar() ? '<button type="button" class="btn btn-primary btn-small" data-hc2="nueva-orden"><i class="fas fa-plus" aria-hidden="true"></i> Nueva orden médica</button>' : ''}</div>`;
            return;
        }
        if (!this.state.refrescando) contenido.innerHTML = '<p class="hc2-vacio">Cargando…</p>';
        const { ordenes, notas, error } = await this.cargarOrdenesYNotas(h.id);
        if (String(this.state.historia?.id) !== String(h.id) || this.state.pestana !== pestana) return; // cambió mientras cargaba
        this.state.ordenes = ordenes || [];
        this.state.notas = notas || [];
        const aviso = `${!this.esActual() || h.estado === 'cerrada' ? `<p class="hc2-nota-local"><i class="fas fa-lock" aria-hidden="true"></i> Historia ${h.estado === 'cerrada' ? 'cerrada' : 'anterior'} del ${this.fecha(h.fecha)}: sus registros quedan en solo lectura.</p>` : ''}
            ${error ? `<p class="hc2-aviso">${this.e(error)}</p>` : ''}`;
        contenido.innerHTML = pestana === 'ordenes' ? this.htmlOrdenes(ordenes, aviso) : this.htmlNotas(aviso);
        if (pestana === 'notas' && !this.state.refrescando) contenido.querySelector('[data-hc2-nota="texto"]')?.focus({ preventScroll: true });
    },

    puedeOrdenar() {
        return Permisos.puede('ordenes_medicas', 'edit') && typeof OrdenesmedicasModule !== 'undefined';
    },

    htmlOrdenes(ordenes, aviso) {
        const h = this.state.historia;
        const abierta = h.estado === 'abierta';
        const barra = abierta && this.puedeOrdenar()
            ? '<div class="hc2-barra"><button type="button" class="btn btn-primary btn-small" data-hc2="nueva-orden"><i class="fas fa-plus" aria-hidden="true"></i> Nueva orden médica</button></div>'
            : '';
        if (ordenes === null) return `${barra}${aviso}`;
        if (!ordenes.length) return `${barra}<p class="hc2-vacio">Esta historia no tiene órdenes médicas.</p>${aviso}`;
        const puedeAbrir = typeof OrdenesEnfermeriaModule !== 'undefined' && Permisos.puedeVerPagina('ordenes-enfermeria');
        const pendientes = ordenes.filter(o => o.estado === 'pendiente').length;
        return `${barra}
            <p class="ficha-ordenes-resumen">${ordenes.length} ${ordenes.length === 1 ? 'orden' : 'órdenes'}${pendientes ? ` · ${pendientes} pendiente${pendientes === 1 ? '' : 's'}` : ''}</p>
            ${ordenes.map(o => OrdenesEnfermeriaModule.htmlTarjetaOrden(o, puedeAbrir)).join('')}
            ${aviso}`;
    },

    turnoActual() {
        const hora = new Date().getHours();
        return hora >= 7 && hora < 13 ? 'manana' : (hora >= 13 && hora < 19 ? 'tarde' : 'noche');
    },

    // Línea de tiempo: notas de enfermería + transcripciones de las órdenes del médico
    htmlNotas(aviso) {
        const h = this.state.historia;
        const editable = h.estado === 'abierta' && Permisos.puede('notas_enfermeria', 'edit');
        const editando = this.state.notas.find(n => String(n.id) === String(this.state.editandoNota));
        const yo = String(Permisos.usuario().id);
        const admin = Permisos.esAdmin();
        const turno = editando?.turno || this.turnoActual();

        const formulario = editable ? `
            <div class="hc2-nota-form" role="group" aria-label="${editando ? 'Editar nota de enfermería' : 'Nueva nota de enfermería'}">
                <div class="hc2-fila-dos">
                    <label class="hc2-campo"><span>Turno</span>
                        <select class="form-input" data-hc2-nota="turno">${this.TURNOS.map(t => `<option value="${t.valor}"${t.valor === turno ? ' selected' : ''}>${t.texto}</option>`).join('')}</select>
                    </label>
                    <label class="hc2-campo"><span>Relacionada con la orden</span>
                        <select class="form-input" data-hc2-nota="orden">
                            <option value="">Ninguna</option>
                            ${this.state.ordenes.map(o => `<option value="${o.id}"${String(o.id) === String(editando?.orden_medica_id) ? ' selected' : ''}>#${o.id} · ${this.e(String(o.descripcion || '').slice(0, 60))}</option>`).join('')}
                        </select>
                    </label>
                </div>
                <label class="hc2-campo"><span>${editando ? 'Editar nota' : 'Nota de enfermería'}</span>
                    <textarea class="form-input" rows="3" maxlength="5000" data-hc2-nota="texto" placeholder="Estado del paciente, cuidados realizados, medicamentos administrados, observaciones…">${this.e(editando?.nota || '')}</textarea>
                </label>
                <div class="hc2-barra">
                    ${editando ? '<button type="button" class="btn btn-secondary btn-small" data-hc2="cancelar-nota">Cancelar</button>' : ''}
                    <button type="button" class="btn btn-primary btn-small" data-hc2="guardar-nota"><i class="fas fa-floppy-disk" aria-hidden="true"></i> ${editando ? 'Guardar cambios' : 'Guardar nota'}</button>
                </div>
            </div>` : '';

        const entradas = [
            ...this.state.notas.map(n => ({ tipo: 'nota', fecha: n.fecha_hora, n })),
            ...this.state.ordenes.filter(o => o.enfermeria_id).map(o => ({ tipo: 'transcripcion', fecha: o.enfermeria_actualizada, o }))
        ].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

        const timeline = entradas.length ? `<ol class="hc2-timeline">${entradas.map(entrada => {
            if (entrada.tipo === 'transcripcion') {
                const o = entrada.o;
                return `
                <li class="hc2-entrada hc2-entrada-transcripcion">
                    <div class="hc2-entrada-cabecera">
                        <strong>Transcripción de la orden #${o.id}</strong>
                        <span>${this.e(o.actualizado_por_nombre || o.creado_por_nombre || '—')} · ${this.e(formatFechaHora(o.enfermeria_actualizada))}</span>
                    </div>
                    <p class="hc2-entrada-orden">${this.e(String(o.descripcion || '').slice(0, 160))}</p>
                    <ul class="hc2-indicaciones">${(o.indicaciones || []).map(i => `<li>${this.e(i.descripcion)}${['dosis', 'via', 'frecuencia', 'horario'].map(c => i[c]).filter(Boolean).length ? ` <small>${this.e(['dosis', 'via', 'frecuencia', 'horario'].map(c => i[c]).filter(Boolean).join(' · '))}</small>` : ''}</li>`).join('')}</ul>
                    ${o.observaciones ? `<p class="hc2-entrada-texto">${this.e(o.observaciones)}</p>` : ''}
                </li>`;
            }
            const n = entrada.n;
            const propia = String(n.autor_id) === yo || admin;
            return `
                <li class="hc2-entrada${String(n.id) === String(this.state.editandoNota) ? ' editando' : ''}">
                    <div class="hc2-entrada-cabecera">
                        <strong>Nota · Turno ${this.TURNOS.find(t => t.valor === n.turno)?.texto.toLowerCase() || n.turno}</strong>
                        <span>${this.e(n.autor_nombre || '—')} · ${this.e(formatFechaHora(n.fecha_hora))}${n.updated_at && n.updated_at !== n.created_at ? ' · editada' : ''}</span>
                    </div>
                    ${n.orden_medica_id ? `<p class="hc2-entrada-orden">Sobre la orden #${n.orden_medica_id}: ${this.e(n.orden_descripcion || '')}</p>` : ''}
                    <p class="hc2-entrada-texto">${this.e(n.nota)}</p>
                    ${editable && propia ? `<div class="hc2-entrada-acciones">
                        <button type="button" class="btn-accion btn-accion-icono" data-hc2="editar-nota" data-nota="${n.id}" title="Editar nota" aria-label="Editar nota"><i class="fas fa-pen" aria-hidden="true"></i></button>
                        <button type="button" class="btn-accion btn-accion-icono btn-accion-peligro" data-hc2="borrar-nota" data-nota="${n.id}" title="Eliminar nota" aria-label="Eliminar nota"><i class="fas fa-trash" aria-hidden="true"></i></button>
                    </div>` : ''}
                </li>`;
        }).join('')}</ol>` : '<p class="hc2-vacio">Sin notas ni transcripciones de enfermería en esta historia.</p>';

        return `${formulario}${timeline}${aviso}`;
    },

    async guardarNota() {
        const contenido = document.getElementById('hc2Contenido');
        const texto = contenido.querySelector('[data-hc2-nota="texto"]');
        if (!texto.value.trim()) {
            showNotification('Escriba la nota', 'warning');
            texto.focus();
            return;
        }
        const datos = {
            historia_id: this.state.historia.id,
            turno: contenido.querySelector('[data-hc2-nota="turno"]').value,
            orden_medica_id: contenido.querySelector('[data-hc2-nota="orden"]').value || null,
            nota: texto.value
        };
        const boton = contenido.querySelector('[data-hc2="guardar-nota"]');
        boton.disabled = true;
        try {
            const editando = this.state.editandoNota;
            await this.apiGeneral(editando ? `/notas-enfermeria/${editando}` : '/notas-enfermeria', { method: editando ? 'PUT' : 'POST', body: JSON.stringify(datos) });
            this.state.editandoNota = null;
            showNotification(editando ? 'Nota actualizada' : 'Nota de enfermería guardada', 'success');
            this.renderContenido();
            this.avisar();
        } catch (error) {
            showNotification(`No se pudo guardar la nota: ${error.message}`, 'error');
            boton.disabled = false;
        }
    },

    async borrarNota(id) {
        if (!confirm('¿Eliminar esta nota de enfermería?')) return;
        try {
            await this.apiGeneral(`/notas-enfermeria/${id}`, { method: 'DELETE' });
            if (String(this.state.editandoNota) === String(id)) this.state.editandoNota = null;
            showNotification('Nota eliminada', 'success');
            this.renderContenido();
            this.avisar();
        } catch (error) {
            showNotification(`No se pudo eliminar: ${error.message}`, 'error');
        }
    },

    // ---------- Prescripciones y medicamentos (de las órdenes médicas) ----------
    // Los medicamentos que el médico ordena y enfermería transcribe del catálogo de Medicinas
    async renderMedicacion(contenido, pestana) {
        const pacienteId = this.state.pacienteId;
        if (!this.state.refrescando) contenido.innerHTML = '<p class="hc2-vacio">Cargando…</p>';
        let ordenes = [];
        let error = '';
        try {
            ordenes = (await this.apiGeneral(`/ordenes-enfermeria?paciente_id=${encodeURIComponent(pacienteId)}`)).data || [];
        } catch (e) {
            error = e.message;
        }
        if (String(this.state.pacienteId) !== String(pacienteId) || this.state.pestana !== pestana) return; // cambió mientras cargaba
        contenido.innerHTML = `${error ? `<p class="hc2-aviso">No se pudieron cargar las órdenes: ${this.e(error)}</p>` : ''}
            ${pestana === 'prescripciones' ? this.htmlPrescripciones(ordenes) : this.htmlMedicamentos(ordenes)}
            ${this.htmlMedicacionLocal(pestana)}`;
    },

    medicamentosDe(orden) {
        return (orden.indicaciones || []).filter(i => i.tipo === 'medicamento');
    },

    // Activo: indicación pendiente en una orden pendiente de una historia que no está cerrada
    medicamentoActivo(orden, item) {
        return item.estado === 'pendiente' && orden.estado === 'pendiente' && orden.historia_estado !== 'cerrada';
    },

    textoEstado(valor) {
        return { pendiente: 'Pendiente', cumplida: 'Cumplida', suspendida: 'Suspendida', completada: 'Completada', cancelada: 'Cancelada' }[valor] || valor || '—';
    },

    htmlNombreMedicamento(item) {
        const c = item.catalogo;
        return `<strong>${this.e(c?.nombre || item.descripcion)}</strong>${c?.detalle ? ` <small>${this.e(c.detalle)}</small>` : ''}
            ${c?.origen === 'medicina' ? (c.codigo ? ` <span class="hc2-med-codigo">${this.e(c.codigo)}</span>` : '') : ' <span class="hc2-med-sin-catalogo" title="Registrado a mano, antes de exigir el catálogo">Sin catálogo</span>'}`;
    },

    htmlPrescripciones(ordenes) {
        const conMedicamentos = ordenes.filter(o => this.medicamentosDe(o).length);
        const sinTranscribir = ordenes.filter(o => !o.enfermeria_id && o.estado === 'pendiente');
        const boton = this.puedeOrdenar()
            ? '<button type="button" class="btn btn-primary btn-small" data-hc2="nueva-orden"><i class="fas fa-plus" aria-hidden="true"></i> Nueva orden médica</button>'
            : '';
        return `
            <div class="hc2-evol-encabezado"><h3>Prescripciones</h3>${boton}</div>
            <p class="hc2-nota-local">El médico prescribe en la orden médica; enfermería la transcribe con las medicinas del catálogo y aquí quedan todas, la más reciente primero.</p>
            ${sinTranscribir.length ? `<div class="hc2-med-pendientes" role="status">
                <strong>${sinTranscribir.length === 1 ? '1 orden aún sin transcribir' : `${sinTranscribir.length} órdenes aún sin transcribir`} por enfermería:</strong>
                <ul>${sinTranscribir.map(o => `<li>#${o.id} · ${this.e(this.fecha(o.fecha_orden))} · ${this.e(String(o.descripcion || '').slice(0, 90))}</li>`).join('')}</ul>
            </div>` : ''}
            ${conMedicamentos.length ? `<ol class="hc2-evoluciones">${conMedicamentos.map(o => `
                <li class="hc2-evol">
                    <div class="hc2-evol-cabecera">
                        <div class="hc2-evol-titulo"><strong>Orden #${o.id}</strong><span class="hc2-med-estado hc2-med-estado-${this.e(o.estado)}">${this.textoEstado(o.estado)}</span></div>
                        <time>${this.e(this.fecha(o.fecha_orden))}</time>
                    </div>
                    <p class="hc2-evol-medico"><i class="fas fa-user-doctor" aria-hidden="true"></i> ${this.e(o.doctor || '—')}${o.historia_fecha ? ` · Historia del ${this.e(this.fecha(o.historia_fecha))}${o.historia_estado === 'cerrada' ? ' (cerrada)' : ''}` : ''}</p>
                    <div class="hc2-tabla-med-envoltura">
                        <table class="hc2-tabla-med">
                            <thead><tr><th scope="col">Medicamento</th><th scope="col">Dosis</th><th scope="col">Vía</th><th scope="col">Frecuencia</th><th scope="col">Horario</th><th scope="col">Estado</th></tr></thead>
                            <tbody>${this.medicamentosDe(o).map(item => `<tr>
                                <td>${this.htmlNombreMedicamento(item)}</td>
                                <td>${this.e(item.dosis || '—')}</td><td>${this.e(item.via || '—')}</td>
                                <td>${this.e(item.frecuencia || '—')}</td><td>${this.e(item.horario || '—')}</td>
                                <td><span class="hc2-med-estado hc2-med-estado-${this.e(item.estado)}">${this.textoEstado(item.estado)}</span></td>
                            </tr>`).join('')}</tbody>
                        </table>
                    </div>
                    <p class="hc2-med-pie">Transcribió ${this.e(o.actualizado_por_nombre || o.creado_por_nombre || '—')}${o.enfermeria_actualizada ? ` · ${this.e(formatFechaHora(o.enfermeria_actualizada))}` : ''}</p>
                </li>`).join('')}</ol>`
            : '<p class="hc2-vacio">Sin medicamentos prescritos en las órdenes médicas.</p>'}`;
    },

    htmlMedicamentos(ordenes) {
        const todos = ordenes.flatMap(o => this.medicamentosDe(o).map(item => ({ o, item })));
        const activos = todos.filter(({ o, item }) => this.medicamentoActivo(o, item));
        const anteriores = todos.filter(({ o, item }) => !this.medicamentoActivo(o, item));
        const tarjeta = ({ o, item }, activo) => `
            <li class="hc2-med${activo ? ' hc2-med-activo' : ''}">
                <div class="hc2-evol-cabecera">
                    <div class="hc2-med-nombre">${this.htmlNombreMedicamento(item)}</div>
                    <span class="hc2-med-estado hc2-med-estado-${this.e(activo ? 'activo' : item.estado)}">${activo ? 'En tratamiento' : this.textoEstado(o.estado === 'pendiente' || item.estado !== 'pendiente' ? item.estado : o.estado)}</span>
                </div>
                <p class="hc2-med-dosis">${this.e([item.dosis, item.via, item.frecuencia].filter(Boolean).join(' · ') || 'Sin dosis indicada')}${item.horario ? ` <span>· Horario: ${this.e(item.horario)}</span>` : ''}</p>
                <p class="hc2-med-pie">Orden #${o.id} del ${this.e(this.fecha(o.fecha_orden))} · ${this.e(o.doctor || '—')}</p>
            </li>`;
        return `
            <div class="hc2-evol-encabezado"><h3>Medicamentos en tratamiento</h3></div>
            ${activos.length
                ? `<ul class="hc2-meds">${activos.map(m => tarjeta(m, true)).join('')}</ul>`
                : '<p class="hc2-vacio">Sin medicamentos en tratamiento. Aparecen aquí cuando enfermería transcribe una orden médica con medicinas del catálogo.</p>'}
            ${anteriores.length ? `
            <h3 class="hc2-subtitulo">Anteriores, cumplidos o suspendidos (${anteriores.length})</h3>
            <ul class="hc2-meds">${anteriores.map(m => tarjeta(m, false)).join('')}</ul>` : ''}`;
    },

    // Registros que quedaron guardados solo en este navegador antes de usar las órdenes
    htmlMedicacionLocal(pestana) {
        const hc = HistoriaClinicaModule;
        const id = String(this.state.pacienteId);
        if (pestana === 'prescripciones') {
            const local = hc.state.historiasClinicas.find(h => String(h.pacienteId ?? h.pacientId) === id);
            if (!local?.prescripciones?.length) return '';
            return `<details class="hc2-evol-local"><summary>Prescripciones anteriores guardadas solo en este navegador (${local.prescripciones.length})</summary>${hc.htmlPrescripciones(local)}</details>`;
        }
        const activos = hc.state.medicamentosAsignados.filter(m => String(m.pacienteId) === id && m.estado === 'activo');
        if (!activos.length) return '';
        return `<details class="hc2-evol-local"><summary>Medicamentos anteriores guardados solo en este navegador (${activos.length})</summary>${hc.htmlMedicamentosActivos(activos)}</details>`;
    },

    // ---------- Evolución médica ----------
    puedeEvolucionar() {
        return Permisos.puede('historia_clinica_cierre', 'edit');
    },

    // 'YYYY-MM-DDTHH:MM' → 'dd/mm/aaaa HH:MM'
    fechaHora(valor) {
        const [fecha, hora = ''] = String(valor || '').split('T');
        return fecha ? `${this.fecha(fecha)} ${hora.slice(0, 5)}`.trim() : '—';
    },

    ahoraLocal() {
        const d = new Date();
        const dos = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
    },

    async apiEvoluciones(path = '', options = {}) {
        return this.apiGeneral(`/evoluciones${path}`, options);
    },

    async renderEvolucion(contenido) {
        const pacienteId = this.state.pacienteId;
        if (!this.state.refrescando) contenido.innerHTML = '<p class="hc2-vacio">Cargando evolución…</p>';
        let error = '';
        try {
            const pedidos = [this.apiEvoluciones(`?paciente_id=${encodeURIComponent(pacienteId)}`)];
            if (Permisos.esAdmin() && !this.state.medicosEvolucion) pedidos.push(this.apiEvoluciones('/medicos'));
            const [lista, medicos] = await Promise.all(pedidos);
            this.state.evoluciones = lista.data || [];
            if (medicos) this.state.medicosEvolucion = medicos.data || [];
        } catch (e) {
            this.state.evoluciones = [];
            error = e.message;
        }
        if (String(this.state.pacienteId) !== String(pacienteId) || this.state.pestana !== 'evolucion') return; // cambió mientras cargaba
        contenido.innerHTML = this.htmlEvolucion(error);
    },

    htmlEvolucion(error) {
        const evoluciones = this.state.evoluciones;
        const formulario = this.state.evolucionForm ? this.htmlFormEvolucion() : '';
        const puedeAgregar = this.puedeEvolucionar() && !this.state.evolucionForm;
        const admin = Permisos.esAdmin();

        const tarjetas = evoluciones.length ? `<ol class="hc2-evoluciones">${evoluciones.map((ev, i) => `
            <li class="hc2-evol${i === 0 ? ' hc2-evol-ultima' : ''}${String(ev.id) === String(this.state.evolucionForm) ? ' editando' : ''}">
                <div class="hc2-evol-cabecera">
                    <div class="hc2-evol-titulo">
                        <strong>${this.e(ev.tipo)}</strong>
                        ${i === 0 ? '<span class="hc2-evol-etiqueta">Última</span>' : ''}
                    </div>
                    <time datetime="${this.e(ev.fecha_hora)}">${this.e(this.fechaHora(ev.fecha_hora))}</time>
                </div>
                <p class="hc2-evol-medico"><i class="fas fa-user-doctor" aria-hidden="true"></i> ${this.e(ev.medico_nombre || '—')}${ev.especialidad ? ` · ${this.e(ev.especialidad)}` : ''}</p>
                <p class="hc2-entrada-texto">${this.e(ev.contenido)}</p>
                ${(ev.cambios || []).map(c => `<p class="hc2-evol-cambio"><i class="fas fa-pen-to-square" aria-hidden="true"></i> Modificada por ${this.e(c.usuario)} el ${this.e(formatFechaHora(c.fecha))}: ${this.e(c.motivo)}</p>`).join('')}
                <div class="hc2-evol-pie">
                    <small>Historia del ${this.e(this.fecha(ev.historia_fecha))}${ev.historia_estado === 'cerrada' ? ' (cerrada)' : ''}</small>
                    ${admin ? `<div class="hc2-entrada-acciones">
                        <button type="button" class="btn-accion btn-accion-icono" data-hc2="editar-evolucion" data-evolucion="${ev.id}" title="Modificar evolución" aria-label="Modificar evolución"><i class="fas fa-pen" aria-hidden="true"></i></button>
                        <button type="button" class="btn-accion btn-accion-icono btn-accion-peligro" data-hc2="eliminar-evolucion" data-evolucion="${ev.id}" title="Eliminar evolución" aria-label="Eliminar evolución"><i class="fas fa-trash" aria-hidden="true"></i></button>
                    </div>` : ''}
                </div>
            </li>`).join('')}</ol>`
            : `<p class="hc2-vacio">${error ? '' : 'Sin evoluciones médicas registradas.'}</p>`;

        // Notas que quedaron guardadas solo en este navegador antes de pasar la evolución al servidor
        const hc = HistoriaClinicaModule;
        const local = hc.state.historiasClinicas.find(h => String(h.pacienteId ?? h.pacientId) === String(this.state.pacienteId));
        const anteriores = local?.notas?.length ? `
            <details class="hc2-evol-local">
                <summary>Notas de evolución anteriores guardadas solo en este navegador (${local.notas.length})</summary>
                ${hc.htmlEvolucion(local)}
            </details>` : '';

        return `
            <div class="hc2-evol-encabezado">
                <h3>Evolución médica</h3>
                ${puedeAgregar ? '<button type="button" class="btn btn-primary btn-small" data-hc2="agregar-evolucion"><i class="fas fa-plus" aria-hidden="true"></i> Agregar evolución</button>' : ''}
            </div>
            ${error ? `<p class="hc2-aviso">${this.e(error)}</p>` : ''}
            ${formulario}${tarjetas}${anteriores}`;
    },

    htmlFormEvolucion() {
        const editando = this.state.evolucionForm !== 'nueva'
            ? this.state.evoluciones.find(ev => String(ev.id) === String(this.state.evolucionForm))
            : null;
        const yo = Permisos.usuario();
        const miNombre = `${yo.nombre || ''} ${yo.apellido || ''}`.trim() || yo.email || '';
        const admin = Permisos.esAdmin();
        const medicos = this.state.medicosEvolucion || [];
        // Al modificar: el médico registrado (por usuario o por nombre); si ya no está en la lista se conserva tal cual
        const registrado = editando && (medicos.find(m => editando.medico_id && m.usuario_id != null && String(m.usuario_id) === String(editando.medico_id))
            || medicos.find(m => m.nombre === editando.medico_nombre));
        const elegido = editando
            ? (registrado ? registrado.clave : 'actual')
            : (medicos.some(m => m.clave === `u:${yo.id}`) ? `u:${yo.id}` : '');
        const sinHistoriaAbierta = !editando && !this.state.historias.some(h => h.estado === 'abierta');

        const campoMedico = admin
            ? `<select class="form-input" data-hc2-evol="medico" required>
                    <option value="">${medicos.length ? 'Elija el médico' : 'No hay médicos registrados'}</option>
                    ${elegido === 'actual' ? `<option value="actual" selected>${this.e(editando.medico_nombre || 'Médico registrado')}${editando.especialidad ? ` · ${this.e(editando.especialidad)}` : ''}</option>` : ''}
                    ${medicos.map(m => `<option value="${this.e(m.clave)}"${m.clave === elegido ? ' selected' : ''}>${this.e(m.nombre)}${m.especialidad ? ` · ${this.e(m.especialidad)}` : ''}</option>`).join('')}
               </select>`
            : `<input type="text" class="form-input" value="${this.e(miNombre)}" readonly aria-describedby="hc2EvolMedicoAyuda">
               <small id="hc2EvolMedicoAyuda">Se registra a su nombre.</small>`;

        return `
            <div class="hc2-nota-form hc2-evol-form" role="group" aria-label="${editando ? 'Modificar evolución' : 'Nueva evolución'}">
                <h4>${editando ? 'Modificar evolución' : 'Nueva evolución'}</h4>
                <div class="hc2-fila-tres">
                    <label class="hc2-campo"><span>Médico</span>${campoMedico}</label>
                    <label class="hc2-campo"><span>Tipo</span>
                        <select class="form-input" data-hc2-evol="tipo">${this.TIPOS_EVOLUCION.map(t => `<option${t === (editando?.tipo || 'Seguimiento') ? ' selected' : ''}>${t}</option>`).join('')}</select>
                    </label>
                    <label class="hc2-campo"><span>Fecha y hora</span>
                        <input type="datetime-local" class="form-input" data-hc2-evol="fecha" value="${this.e(editando?.fecha_hora || this.ahoraLocal())}">
                    </label>
                </div>
                <label class="hc2-campo"><span>Evolución</span>
                    <textarea class="form-input" rows="6" maxlength="10000" data-hc2-evol="contenido" placeholder="Estado actual, cambios desde la última evaluación, hallazgos, conducta a seguir…">${this.e(editando?.contenido || '')}</textarea>
                </label>
                ${editando ? `<label class="hc2-campo"><span>Motivo del cambio <span class="required">*</span></span>
                    <textarea class="form-input" rows="2" maxlength="1000" data-hc2-evol="motivo" placeholder="Por qué se modifica esta evolución (queda registrado)"></textarea>
                </label>` : ''}
                ${sinHistoriaAbierta ? '<p class="hc2-nota-local"><i class="fas fa-circle-info" aria-hidden="true"></i> El paciente no tiene historia abierta: al guardar se abre la historia de hoy.</p>' : ''}
                <div class="hc2-barra">
                    <button type="button" class="btn btn-secondary btn-small" data-hc2="cancelar-evolucion">Cancelar</button>
                    <button type="button" class="btn btn-primary btn-small" data-hc2="guardar-evolucion"><i class="fas fa-floppy-disk" aria-hidden="true"></i> ${editando ? 'Guardar cambios' : 'Guardar evolución'}</button>
                </div>
            </div>`;
    },

    async abrirFormEvolucion(valor) {
        this.state.evolucionForm = valor;
        if (Permisos.esAdmin() && !this.state.medicosEvolucion) {
            try {
                this.state.medicosEvolucion = (await this.apiEvoluciones('/medicos')).data || [];
            } catch (error) {
                this.state.medicosEvolucion = [];
            }
        }
        const contenido = document.getElementById('hc2Contenido');
        if (!contenido) return;
        contenido.innerHTML = this.htmlEvolucion('');
        const form = contenido.querySelector('.hc2-evol-form');
        form?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        form?.querySelector('[data-hc2-evol="contenido"]')?.focus({ preventScroll: true });
    },

    async guardarEvolucion() {
        const form = document.querySelector('#hc2Contenido .hc2-evol-form');
        if (!form) return;
        const campo = nombre => form.querySelector(`[data-hc2-evol="${nombre}"]`);
        const editando = this.state.evolucionForm !== 'nueva' ? this.state.evolucionForm : null;
        const avisar = (mensaje, el) => {
            showNotification(mensaje, 'warning');
            el?.focus();
        };
        if (!campo('contenido').value.trim()) return avisar('Escriba la evolución', campo('contenido'));
        if (campo('medico') && !campo('medico').value) return avisar('Elija el médico', campo('medico'));
        if (editando && campo('motivo').value.trim().length < 5) return avisar('Escriba el motivo del cambio (al menos 5 caracteres)', campo('motivo'));

        const datos = {
            paciente_id: this.state.pacienteId,
            tipo: campo('tipo').value,
            fecha_hora: campo('fecha').value,
            contenido: campo('contenido').value,
            ...(campo('medico') ? { medico_clave: campo('medico').value } : {}),
            ...(editando ? { motivo: campo('motivo').value } : {})
        };
        const boton = form.querySelector('[data-hc2="guardar-evolucion"]');
        boton.disabled = true;
        try {
            const respuesta = await this.apiEvoluciones(editando ? `/${editando}` : '', { method: editando ? 'PUT' : 'POST', body: JSON.stringify(datos) });
            this.state.evolucionForm = null;
            showNotification(respuesta.data?.historia_abierta_automaticamente
                ? 'Evolución guardada. Se abrió la historia clínica de hoy.'
                : editando ? 'Evolución modificada' : 'Evolución guardada', 'success');
            if (respuesta.data?.historia_abierta_automaticamente) await this.alCambiarOrdenes();
            else await this.renderContenido();
            this.avisar();
        } catch (error) {
            showNotification(`No se pudo guardar la evolución: ${error.message}`, 'error');
            boton.disabled = false;
        }
    },

    async eliminarEvolucion(id) {
        const ev = this.state.evoluciones.find(item => String(item.id) === String(id));
        if (!ev) return;
        const motivo = await this.pedirMotivo({
            titulo: 'Eliminar evolución',
            texto: `Evolución de ${ev.medico_nombre || 'médico sin nombre'} del ${this.fechaHora(ev.fecha_hora)}. Deja de verse en la historia; la eliminación y su motivo quedan registrados.`,
            boton: 'Eliminar evolución'
        });
        if (!motivo) return;
        try {
            await this.apiEvoluciones(`/${id}`, { method: 'DELETE', body: JSON.stringify({ motivo }) });
            if (String(this.state.evolucionForm) === String(id)) this.state.evolucionForm = null;
            showNotification('Evolución eliminada', 'success');
            await this.renderContenido();
            this.avisar();
        } catch (error) {
            showNotification(`No se pudo eliminar: ${error.message}`, 'error');
        }
    },

    // Diálogo que exige escribir un motivo; devuelve el texto o null si se cancela
    pedirMotivo({ titulo, texto, boton }) {
        return new Promise(resolver => {
            const capa = document.createElement('div');
            capa.className = 'modal-overlay hc2-dialogo';
            capa.innerHTML = `
                <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="hc2MotivoTitulo" style="max-width: 480px;">
                    <div class="modal-header"><h2 id="hc2MotivoTitulo">${this.e(titulo)}</h2></div>
                    <div class="modal-body">
                        <p>${this.e(texto)}</p>
                        <label class="hc2-campo"><span>Motivo <span class="required">*</span></span>
                            <textarea class="form-input" rows="3" maxlength="1000" data-motivo placeholder="Explique por qué"></textarea>
                        </label>
                        <p class="hc2-aviso" data-motivo-error hidden>Escriba el motivo (al menos 5 caracteres).</p>
                        <div class="hc2-barra">
                            <button type="button" class="btn btn-secondary" data-motivo-accion="cancelar">Cancelar</button>
                            <button type="button" class="btn btn-danger" data-motivo-accion="aceptar">${this.e(boton)}</button>
                        </div>
                    </div>
                </div>`;
            const campo = capa.querySelector('[data-motivo]');
            const terminar = valor => {
                capa.remove();
                document.removeEventListener('keydown', alTeclear);
                resolver(valor);
            };
            const alTeclear = e => { if (e.key === 'Escape') terminar(null); };
            capa.addEventListener('click', e => {
                const accion = e.target.closest('[data-motivo-accion]')?.dataset.motivoAccion;
                if (accion === 'cancelar' || e.target === capa) return terminar(null);
                if (accion !== 'aceptar') return;
                if (campo.value.trim().length < 5) {
                    capa.querySelector('[data-motivo-error]').hidden = false;
                    campo.focus();
                    return;
                }
                terminar(campo.value.trim());
            });
            campo.addEventListener('input', () => { capa.querySelector('[data-motivo-error]').hidden = true; });
            document.addEventListener('keydown', alTeclear);
            document.body.appendChild(capa);
            campo.focus();
        });
    },

    // Al cerrar con órdenes pendientes: el médico decide si quedan completadas o canceladas
    elegirDestinoPendientes(pendientes) {
        return new Promise(resolver => {
            const capa = document.createElement('div');
            capa.className = 'modal-overlay hc2-dialogo';
            capa.innerHTML = `
                <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="hc2DialogoTitulo" style="max-width: 520px;">
                    <div class="modal-header"><h2 id="hc2DialogoTitulo">Órdenes pendientes</h2></div>
                    <div class="modal-body">
                        <p>Antes de cerrar la historia, indique cómo quedan ${pendientes.length === 1 ? 'esta orden pendiente' : `estas ${pendientes.length} órdenes pendientes`}:</p>
                        <ul class="hc2-pendientes">${pendientes.map(o => `<li><strong>#${o.id}</strong> ${this.e(o.descripcion)}</li>`).join('')}</ul>
                        <div class="hc2-barra">
                            <button type="button" class="btn btn-secondary" data-destino="">Volver</button>
                            <button type="button" class="btn btn-outline" data-destino="cancelada">Marcar canceladas</button>
                            <button type="button" class="btn btn-primary" data-destino="completada">Marcar completadas</button>
                        </div>
                    </div>
                </div>`;
            const terminar = valor => {
                capa.remove();
                document.removeEventListener('keydown', alTeclear);
                resolver(valor || null);
            };
            const alTeclear = e => { if (e.key === 'Escape') terminar(null); };
            capa.addEventListener('click', e => {
                const boton = e.target.closest('[data-destino]');
                if (boton) terminar(boton.dataset.destino);
                else if (e.target === capa) terminar(null);
            });
            document.addEventListener('keydown', alTeclear);
            document.body.appendChild(capa);
            capa.querySelector('[data-destino="completada"]').focus();
        });
    },

    // ---------- Acciones ----------
    alHacerClic(e) {
        const pestana = e.target.closest('[data-hc2-pestana]');
        if (pestana) {
            const cambia = pestana.dataset.hc2Pestana !== this.state.pestana;
            if (cambia && !this.confirmarDescartar()) return;
            if (cambia) this.state.cambios = { historia: false, antecedentes: false };
            this.state.pestana = pestana.dataset.hc2Pestana;
            this.state.editandoNota = null;
            this.state.evolucionForm = null;
            this.state.signoForm = null;
            this.renderHistoria();
            return;
        }
        const historia = e.target.closest('[data-hc2-historia]');
        if (historia) return this.verHistoria(historia.dataset.hc2Historia);
        const transcribir = e.target.closest('[data-ficha-orden]');
        if (transcribir) return OrdenesEnfermeriaModule.abrir(transcribir.dataset.fichaOrden);

        const accion = e.target.closest('[data-hc2]')?.dataset.hc2;
        const acciones = {
            nueva: () => this.nueva(),
            guardar: () => this.guardar(),
            cerrar: () => this.cerrar(),
            reabrir: () => this.reabrir(),
            eliminar: () => this.eliminar(),
            imprimir: () => this.imprimir(),
            'nueva-orden': () => OrdenesmedicasModule.nuevaOrdenPara(this.state.pacienteId),
            'guardar-nota': () => this.guardarNota(),
            'editar-nota': () => {
                this.state.editandoNota = e.target.closest('[data-nota]').dataset.nota;
                this.renderContenido();
            },
            'cancelar-nota': () => {
                this.state.editandoNota = null;
                this.renderContenido();
            },
            'borrar-nota': () => this.borrarNota(e.target.closest('[data-nota]').dataset.nota),
            'registrar-signos': () => this.abrirFormSignos('nueva'),
            'editar-signos': () => this.abrirFormSignos(e.target.closest('[data-toma]').dataset.toma),
            'cancelar-signos': () => {
                this.state.signoForm = null;
                this.renderContenido();
            },
            'guardar-signos': () => this.guardarSignos(),
            'borrar-signos': () => this.borrarSignos(e.target.closest('[data-toma]').dataset.toma),
            'agregar-evolucion': () => this.abrirFormEvolucion('nueva'),
            'editar-evolucion': () => this.abrirFormEvolucion(e.target.closest('[data-evolucion]').dataset.evolucion),
            'cancelar-evolucion': () => {
                this.state.evolucionForm = null;
                this.renderContenido();
            },
            'guardar-evolucion': () => this.guardarEvolucion(),
            'eliminar-evolucion': () => this.eliminarEvolucion(e.target.closest('[data-evolucion]').dataset.evolucion),
            actual: () => {
                const actual = this.state.historias.find(h => h.estado === 'abierta') || this.state.historias[0];
                if (actual) this.verHistoria(actual.id);
            }
        };
        acciones[accion]?.();
    },

    // Lo que no está en la pestaña visible se envía tal como está guardado (los signos vitales van por toma)
    leerHistoria() {
        const h = this.state.historia || {};
        const datos = { tipo: h.tipo, fecha: String(h.fecha || '').slice(0, 10) || undefined };
        this.CAMPOS_HISTORIA.forEach(c => { datos[c.clave] = h[c.clave] ?? ''; });
        document.querySelectorAll('#hc2Contenido [data-hc2-seccion="historia"] [data-campo]').forEach(el => { datos[el.dataset.campo] = el.value; });
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
            this.avisar();
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
            this.avisar();
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
        if (!confirm(`¿Cerrar la historia clínica del ${this.fecha(h.fecha)}? Después ya no se podrá editar, ni sus órdenes y notas de enfermería; quedará guardada con los antecedentes de hoy.`)) return;
        try {
            let respuesta;
            try {
                respuesta = await this.api(`/${h.id}/cerrar`, { method: 'POST', body: '{}' });
            } catch (error) {
                if (error.datos?.code !== 'ORDENES_PENDIENTES') throw error;
                const destino = await this.elegirDestinoPendientes(error.datos.pendientes || []);
                if (!destino) return;
                respuesta = await this.api(`/${h.id}/cerrar`, { method: 'POST', body: JSON.stringify({ ordenes_pendientes: destino }) });
            }
            this.state.historia = respuesta.data;
            await this.recargarLista();
            this.renderContenido();
            this.avisar();
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
            this.avisar();
            showNotification('Historia clínica reabierta', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async eliminar() {
        const h = this.state.historia;
        if (!h || !confirm(`¿Eliminar la historia clínica del ${this.fecha(h.fecha)}? Se borran también sus notas de enfermería y su evolución médica; sus órdenes médicas quedan sin historia. No se puede deshacer.`)) return;
        try {
            await this.api(`/${h.id}`, { method: 'DELETE' });
            showNotification('Historia clínica eliminada', 'success');
            this.state.cambios = { historia: false, antecedentes: false };
            await this.seleccionar(this.state.pacienteId, { forzar: true });
            await this.cargarResumen();
            this.renderLista();
            this.avisar();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async imprimir() {
        const h = this.state.historia;
        const p = this.paciente();
        if (!h || !p) return;
        const e = valor => this.e(valor);
        const clinica = (typeof CONFIG !== 'undefined' && CONFIG.CLINICA) || { nombre: 'Zentra MED' };
        const antecedentes = h.estado === 'abierta' ? (this.state.antecedentes || {}) : (h.antecedentes_al_cierre || {});
        const texto = valor => valor ? `<p>${e(valor)}</p>` : '<p class="vacio">Sin registrar</p>';
        const ventana = window.open('', '_blank');
        if (!ventana) {
            showNotification('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes para este sitio.', 'warning');
            return;
        }
        ventana.document.write('<p style="font-family: sans-serif; padding: 24px">Preparando la historia clínica…</p>');
        const [{ ordenes, notas }, evoluciones, tomas] = await Promise.all([
            this.cargarOrdenesYNotas(h.id),
            this.apiEvoluciones(`?paciente_id=${encodeURIComponent(p.id)}`).then(r => (r.data || []).filter(ev => String(ev.historia_id) === String(h.id))).catch(() => []),
            this.apiGeneral(`/signos-vitales?paciente_id=${encodeURIComponent(p.id)}`).then(r => (r.data || []).filter(t => String(t.historia_id) === String(h.id))).catch(() => [])
        ]);
        const seccionSignos = tomas.length ? `<table class="tabla-signos"><thead><tr><th>Fecha y hora</th>${this.SIGNOS.map(s => `<th>${s.texto} (${s.unidad})</th>`).join('')}<th>IMC</th><th>Registró</th></tr></thead>
<tbody>${[...tomas].reverse().map(t => `<tr><td>${e(this.fechaHora(t.fecha_hora))}</td>${this.SIGNOS.map(s => `<td>${e(t.valores?.[s.clave] || '—')}</td>`).join('')}<td>${this.imc(t.valores) || '—'}</td><td>${e(t.registrado_por_nombre || '')}${t.nota ? ` — ${e(t.nota)}` : ''}</td></tr>`).join('')}</tbody></table>`
            : '<p class="vacio">Sin registrar</p>';
        const turno = valor => this.TURNOS.find(t => t.valor === valor)?.texto || valor;
        const seccionOrdenes = (ordenes || []).length ? `
<h2>Órdenes médicas y transcripción de enfermería</h2>
${ordenes.map(o => `<div class="orden"><b>Orden #${o.id} · ${e(this.fecha(o.fecha_orden))} · ${e(o.doctor || '')} · ${e(o.estado)}</b>
  <p>${e(o.descripcion || '')}</p>
  ${(o.indicaciones || []).length ? `<ul>${o.indicaciones.map(i => `<li>${e(i.descripcion)}${['dosis', 'via', 'frecuencia', 'horario'].map(c => i[c]).filter(Boolean).length ? ` — ${e(['dosis', 'via', 'frecuencia', 'horario'].map(c => i[c]).filter(Boolean).join(' · '))}` : ''} (${e(i.estado)})</li>`).join('')}</ul>
  <small>Transcribió: ${e(o.actualizado_por_nombre || o.creado_por_nombre || '—')}</small>` : '<p class="vacio">Sin transcripción de enfermería</p>'}</div>`).join('')}` : '';
        const seccionNotas = (notas || []).length ? `
<h2>Notas de enfermería</h2>
${[...notas].reverse().map(n => `<div class="orden"><b>${e(formatFechaHora(n.fecha_hora))} · Turno ${e(turno(n.turno))} · ${e(n.autor_nombre || '')}</b>${n.orden_medica_id ? ` <small>(orden #${n.orden_medica_id})</small>` : ''}<p>${e(n.nota)}</p></div>`).join('')}` : '';
        const seccionEvolucion = evoluciones.length ? `
<h2>Evolución médica</h2>
${[...evoluciones].reverse().map(ev => `<div class="orden"><b>${e(this.fechaHora(ev.fecha_hora))} · ${e(ev.tipo)} · ${e(ev.medico_nombre || '')}${ev.especialidad ? ` (${e(ev.especialidad)})` : ''}</b><p>${e(ev.contenido)}</p>${(ev.cambios || []).length ? `<small>Modificada: ${ev.cambios.map(c => `${e(c.usuario)}, ${e(formatFechaHora(c.fecha))}: ${e(c.motivo)}`).join(' · ')}</small>` : ''}</div>`).join('')}` : '';
        ventana.document.open();
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
  .tabla-signos { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 4px; }
  .tabla-signos th, .tabla-signos td { border: 1px solid #e4e8ef; padding: 3px 5px; text-align: center; }
  .tabla-signos th { color: #52606d; font-weight: 600; }
  .campo { margin-bottom: 8px; } .campo b { display: block; color: #52606d; }
  p { white-space: pre-wrap; } .vacio { color: #8a94a6; font-style: italic; }
  .ant { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
  .orden { border: 1px solid #e4e8ef; border-radius: 4px; padding: 6px 8px; margin-bottom: 6px; page-break-inside: avoid; }
  .orden ul { margin: 4px 0 4px 18px; } .orden small { color: #52606d; }
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
<div class="campo"><b>Signos vitales</b>${seccionSignos}</div>
${this.CAMPOS_HISTORIA.slice(3).map(c => `<div class="campo"><b>${c.texto}</b>${texto(h[c.clave])}</div>`).join('')}
<h2>Antecedentes${h.estado === 'cerrada' ? ' (al cierre de esta historia)' : ''}</h2>
<div class="ant">${this.ANTECEDENTES.map(c => `<div class="campo"><b>${c.texto}</b>${texto(antecedentes[c.clave])}</div>`).join('')}</div>
${seccionEvolucion}
${seccionOrdenes}
${seccionNotas}
<footer><span>Impreso el ${e(formatFechaHora(new Date()))}</span><div class="firma">${e(h.medico_nombre || 'Médico tratante')}</div></footer>
</div></body></html>`);
        ventana.document.close();
        setTimeout(() => ventana.print(), 250);
    }
};

window.HistoriaPanelModule = HistoriaPanelModule;
