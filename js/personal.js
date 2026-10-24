// ============================================
// MÓDULOS DE PERSONAL: PERSONAL MÉDICO Y PERSONAL (ADMINISTRATIVO Y DE APOYO)
// ============================================
// Ambos comparten la misma pantalla: foto y DPI, horario, disponibilidad para
// emergencias, documentos y el usuario del sistema vinculado. Cada uno indica sus
// datos propios (especialidad y colegiado, o puesto y área) en su configuración.

const crearModuloPersonal = (cfg) => {
    // Identificadores de los elementos de la pantalla y del formulario de este módulo
    const ids = cfg.ids;
    const campo = (nombre) => document.getElementById(`${ids.prefijo}${nombre}`);

    const modulo = {
    cfg,

    state: {
        personal: [],
        disponibilidad: [],
        searchTerm: '',
        filtroPropio: '',
        filtroEstado: 'activos',
        personalSeleccionado: null,
        // Imágenes del formulario: { valor: dataURL|null, cambiado: bool }
        imagenes: {},
        // Usuarios del sistema y roles, para vincular (solo administrador)
        usuarios: [],
        roles: [],
        ...cfg.estadoInicial
    },

    // Tipos de documento del personal (las claves las valida el servidor)
    TIPOS_DOCUMENTO: {
        titulo_universitario: 'Título universitario',
        titulo_especialidad: 'Título de especialidad',
        colegiado_activo: 'Constancia de colegiado activo',
        antecedentes_penales: 'Antecedentes penales',
        antecedentes_policiacos: 'Antecedentes policiacos',
        contrato: 'Contrato',
        curriculum: 'Currículum',
        tarjeta_salud: 'Tarjeta de salud',
        otro: 'Otro'
    },

    IMAGENES: {
        foto_perfil: { maxLado: 600, calidad: 0.82 },
        dpi_frente: { maxLado: 1600, calidad: 0.85 },
        dpi_reverso: { maxLado: 1600, calidad: 0.85 }
    },

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        this.loadData();
        console.log(`Módulo de ${cfg.textos.modulo} inicializado`);
    },

    modal() {
        return document.getElementById(ids.modal);
    },

    // Configurar event listeners
    setupEventListeners() {
        this.setupImagenes();
        this.setupUsuario();

        const dpiInput = campo('DPI');
        dpiInput?.addEventListener('input', () => {
            dpiInput.value = this.formatearDPI(dpiInput.value);
        });

        document.getElementById(ids.buscar)?.addEventListener('input', (e) => {
            this.state.searchTerm = e.target.value;
            this.renderPersonal();
        });

        document.getElementById(ids.filtroPropio)?.addEventListener('change', (e) => {
            this.state.filtroPropio = e.target.value;
            this.renderPersonal();
        });

        document.getElementById(ids.filtroEstado)?.addEventListener('change', (e) => {
            this.state.filtroEstado = e.target.value;
            this.renderPersonal();
        });

        document.getElementById(ids.nuevo)?.addEventListener('click', () => this.openNuevoPersonalModal());
    },

    getApiUrl(path = '') {
        const configuredUrl = typeof authManager !== 'undefined'
            ? authManager.apiBaseUrl
            : 'http://178.128.72.110:3011';
        const apiRoot = configuredUrl.replace(/\/$/, '').replace(/\/api$/, '');
        return `${apiRoot}/api/${cfg.api}${path}`;
    },

    getAuthToken() {
        return typeof authManager !== 'undefined' ? authManager.getToken() : null;
    },

    normalizePersonal(personal) {
        return {
            id: String(personal.id),
            nombre: personal.nombre || '',
            apellidoPaterno: personal.apellido_paterno ?? personal.apellidoPaterno ?? '',
            apellidoMaterno: personal.apellido_materno ?? personal.apellidoMaterno ?? '',
            ...cfg.profesional.normalizar(personal),
            telefono: personal.telefono || '',
            email: personal.email || '',
            horarioInicio: String(personal.horario_inicio ?? personal.horarioInicio ?? '08:00').slice(0, 5),
            horarioFin: String(personal.horario_fin ?? personal.horarioFin ?? '16:00').slice(0, 5),
            diasDisponibles: personal.dias_disponibles ?? personal.diasDisponibles ?? [],
            estado: personal.estado || 'activo',
            dpi: personal.dpi || '',
            fotoPerfil: personal.foto_perfil ?? personal.fotoPerfil ?? null,
            tieneDpiFrente: Boolean(personal.tiene_dpi_frente ?? personal.tieneDpiFrente),
            tieneDpiReverso: Boolean(personal.tiene_dpi_reverso ?? personal.tieneDpiReverso),
            // Sin la migración de personal el servidor no manda estos campos
            conExtras: (personal.disponible_emergencias ?? personal.disponibleEmergencias) !== undefined,
            disponibleEmergencias: Boolean(personal.disponible_emergencias ?? personal.disponibleEmergencias),
            telefonoEmergencia: personal.telefono_emergencia ?? personal.telefonoEmergencia ?? '',
            documentos: {
                total: Number(personal.documentos_total ?? personal.documentos?.total) || 0,
                vencidos: Number(personal.documentos_vencidos ?? personal.documentos?.vencidos) || 0,
                porVencer: Number(personal.documentos_por_vencer ?? personal.documentos?.porVencer) || 0
            },
            userId: personal.user_id ?? personal.userId ?? null,
            usuarioEmail: personal.usuario_email ?? personal.usuarioEmail ?? '',
            usuarioNombre: personal.usuario_nombre ?? personal.usuarioNombre ?? '',
            createdAt: personal.created_at ?? personal.createdAt ?? ''
        };
    },

    escapeHTML(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    nombreCompleto(personal) {
        return `${personal.nombre} ${personal.apellidoPaterno || ''} ${personal.apellidoMaterno || ''}`.replace(/\s+/g, ' ').trim();
    },

    // ---------- DPI ----------
    formatearDPI(valor) {
        const d = String(valor || '').replace(/\D/g, '').slice(0, 13);
        return [d.slice(0, 4), d.slice(4, 9), d.slice(9, 13)].filter(Boolean).join(' ');
    },

    // ---------- Imágenes ----------
    tileImagen(nombre) {
        return this.modal()?.querySelector(`.foto-tile[data-imagen="${nombre}"]`);
    },

    setupImagenes() {
        Object.keys(this.IMAGENES).forEach(nombre => {
            const tile = this.tileImagen(nombre);
            if (!tile) return;
            const input = tile.querySelector('input[type="file"]');
            input.addEventListener('change', async () => {
                const file = input.files?.[0];
                input.value = '';
                if (!file) return;
                if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
                    showNotification('Usa una imagen JPG, PNG o WEBP', 'error');
                    return;
                }
                tile.classList.add('cargando');
                try {
                    const { maxLado, calidad } = this.IMAGENES[nombre];
                    const dataURL = await this.comprimirImagen(file, maxLado, calidad);
                    this.setImagen(nombre, dataURL, true);
                } catch (error) {
                    console.error('Error procesando imagen:', error);
                    showNotification('No se pudo leer la imagen. Prueba con otra.', 'error');
                } finally {
                    tile.classList.remove('cargando');
                }
            });
            tile.querySelector('.foto-tile-quitar').addEventListener('click', () => this.setImagen(nombre, null, true));
        });
    },

    // Reduce la imagen y la convierte a JPEG base64 (data URL)
    comprimirImagen(file, maxLado, calidad) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * escala);
                canvas.height = Math.round(img.height * escala);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#fff'; // fondo blanco para PNG con transparencia
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/jpeg', calidad));
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Imagen inválida'));
            };
            img.src = url;
        });
    },

    setImagen(nombre, valor, cambiado = false) {
        this.state.imagenes[nombre] = { valor, cambiado: cambiado || this.state.imagenes[nombre]?.cambiado || false };
        const tile = this.tileImagen(nombre);
        if (!tile) return;
        const img = tile.querySelector('img');
        img.hidden = !valor;
        if (valor) img.src = valor; else img.removeAttribute('src');
        tile.querySelector('.foto-tile-vacio').hidden = Boolean(valor);
        tile.querySelector('.foto-tile-quitar').hidden = !valor;
        tile.querySelector('.foto-tile-acciones label span').textContent = valor ? 'Cambiar' : 'Subir';
        tile.classList.toggle('con-imagen', Boolean(valor));
    },

    resetImagenes() {
        this.state.imagenes = {};
        Object.keys(this.IMAGENES).forEach(nombre => this.setImagen(nombre, null));
        this.state.imagenes = {};
    },

    async fetchDocumentos(personalId) {
        const token = this.getAuthToken();
        if (!token) throw new Error('No hay token de autenticación');
        const response = await fetch(this.getApiUrl(`/${personalId}/documentos`), {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
        return data.documentos || {};
    },

    avatarHTML(personal, tamano = 36) {
        const iniciales = `${(personal.nombre || '?')[0]}${(personal.apellidoPaterno || '')[0] || ''}`.toUpperCase();
        return personal.fotoPerfil
            ? `<img class="personal-avatar" src="${personal.fotoPerfil}" alt="" style="width:${tamano}px;height:${tamano}px">`
            : `<span class="personal-avatar personal-avatar-iniciales" style="width:${tamano}px;height:${tamano}px" aria-hidden="true">${this.escapeHTML(iniciales)}</span>`;
    },

    // Cargar datos desde API
    async loadData() {
        try {
            const token = this.getAuthToken();
            if (!token) throw new Error('No hay token de autenticación');

            const personalResponse = await fetch(this.getApiUrl(), { headers: { Authorization: `Bearer ${token}` } });
            const personalData = await personalResponse.json().catch(() => ({}));
            if (!personalResponse.ok) {
                throw Object.assign(new Error(personalData.error || `No se pudo cargar el personal (${personalResponse.status})`),
                    { status: personalResponse.status });
            }
            await cfg.profesional.cargarCatalogos?.(this, token);
            this.state.personal = (personalData.personal || []).map(personal => this.normalizePersonal(personal));
            this.state.errorCarga = '';
            this.savePersonalToDB();
        } catch (error) {
            console.warn('Error cargando de API, usando localStorage:', error);
            // Sin la migración el módulo Personal aún no existe en el servidor: se avisa en lugar de mostrar datos viejos
            this.state.errorCarga = error.status === 503 ? error.message : '';
            this.loadDataFromLocalStorage();
        }

        this.renderPersonal();
    },

    // Cargar datos desde localStorage
    loadDataFromLocalStorage() {
        let guardado = [];
        try {
            guardado = JSON.parse(localStorage.getItem(cfg.almacenamiento) || '[]');
        } catch (error) { /* respaldo ilegible */ }
        this.state.personal = guardado.map(personal => this.normalizePersonal(personal));
    },

    // Guardar datos a localStorage
    savePersonalToDB() {
        // Sin fotos: localStorage tiene ~5 MB y las imágenes viven en el servidor
        const sinFotos = this.state.personal.map(({ fotoPerfil, ...resto }) => resto);
        try {
            localStorage.setItem(cfg.almacenamiento, JSON.stringify(sinFotos));
        } catch (error) {
            console.warn('No se pudo guardar el respaldo local del personal:', error);
        }
    },

    // Renderizar tabla de personal
    renderPersonal() {
        const container = document.getElementById(ids.tabla);
        if (!container) return;
        this.renderEmergencias();
        this.renderAvisoDocumentos();

        if (this.state.errorCarga && !this.state.personal.length) {
            container.innerHTML = `<p class="personal-error-carga"><i class="fas fa-database" aria-hidden="true"></i> ${this.escapeHTML(this.state.errorCarga)}</p>`;
            return;
        }

        const g = cfg.global;
        const personalFiltered = this.state.personal.filter(p => {
            // Filtro por búsqueda
            const searchLower = this.state.searchTerm.toLowerCase();
            const nombreCompleto = `${p.nombre || ''} ${p.apellidoPaterno || ''}`.toLowerCase();
            const dpiBuscado = searchLower.replace(/\D/g, '');
            const busquedaMatch = nombreCompleto.includes(searchLower) ||
                                (p.email || '').toLowerCase().includes(searchLower) ||
                                (dpiBuscado.length > 0 && (p.dpi || '').includes(dpiBuscado)) ||
                                cfg.profesional.textoBusqueda(p).toLowerCase().includes(searchLower);

            const propioMatch = !this.state.filtroPropio || cfg.profesional.filtrar(p, this.state.filtroPropio);

            // Filtro por estado
            let estadoMatch = true;
            if (this.state.filtroEstado === 'activos') {
                estadoMatch = p.estado === 'activo';
            } else if (this.state.filtroEstado === 'inactivos') {
                estadoMatch = p.estado !== 'activo';
            } else if (this.state.filtroEstado === 'emergencias') {
                estadoMatch = p.estado === 'activo' && p.disponibleEmergencias;
            }

            return busquedaMatch && propioMatch && estadoMatch;
        });

        // Ordenar alfabéticamente por apellido
        personalFiltered.sort((a, b) =>
            (a.apellidoPaterno || '').localeCompare(b.apellidoPaterno || '')
        );

        // Renderizar tabla
        if (personalFiltered.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <i class="fas fa-users" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                    <p style="font-size: 16px; margin: 10px 0;">
                        ${this.state.searchTerm ? 'No se encontró personal' : 'No hay personal registrado'}
                    </p>
                    <small>${this.state.searchTerm ? 'Intenta con otro término de búsqueda' : `Registra ${cfg.textos.registrar}`}</small>
                </div>
            `;
            return;
        }

        const [columnaA, columnaB] = cfg.profesional.columnas;
        let html = `
            <table style="width: 100%; border-collapse: collapse; background: white;">
                <thead style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <tr>
                        <th style="padding: 15px; text-align: left; font-weight: 600;">Nombre</th>
                        <th style="padding: 15px; text-align: left; font-weight: 600;">${columnaA.titulo}</th>
                        <th style="padding: 15px; text-align: left; font-weight: 600;">${columnaB.titulo}</th>
                        <th style="padding: 15px; text-align: left; font-weight: 600;">Contacto</th>
                        <th style="padding: 15px; text-align: left; font-weight: 600;">Horario</th>
                        <th style="padding: 15px; text-align: center; font-weight: 600;">Estado</th>
                        <th style="padding: 15px; text-align: center; font-weight: 600;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
        `;

        personalFiltered.forEach(personal => {
            const estadoBgColor = personal.estado === 'activo' ? '#4caf50' : '#f44336';
            const estadoTextColor = '#fff';

            html += `
                <tr style="border-bottom: 1px solid #eee; transition: background 0.2s;"
                    onmouseover="this.style.background='#f5f5f5'"
                    onmouseout="this.style.background='white'">
                    <td style="padding: 12px 15px; font-weight: 600;">
                        <div class="personal-nombre-celda">
                            ${this.avatarHTML(personal)}
                            <div>
                                <div>${this.escapeHTML(this.nombreCompleto(personal))}</div>
                                ${personal.dpi ? `<small class="personal-dpi">DPI ${this.formatearDPI(personal.dpi)}</small>` : ''}
                                ${personal.usuarioEmail ? `<small class="personal-usuario-vinculado" title="Usuario del sistema"><i class="fas fa-circle-user" aria-hidden="true"></i> ${this.escapeHTML(personal.usuarioEmail)}</small>` : ''}
                                ${personal.disponibleEmergencias ? '<span class="personal-badge-emergencia"><i class="fas fa-truck-medical" aria-hidden="true"></i> Emergencias</span>' : ''}
                            </div>
                        </div>
                    </td>
                    <td style="padding: 12px 15px;">${columnaA.celda(personal, this)}</td>
                    <td style="padding: 12px 15px;">${columnaB.celda(personal, this)}</td>
                    <td style="padding: 12px 15px; font-size: 12px;">
                        <div>${this.escapeHTML(personal.email)}</div>
                        <small style="color: #666;">${this.escapeHTML(personal.telefono)}</small>
                    </td>
                    <td style="padding: 12px 15px; font-size: 12px;">
                        ${personal.horarioInicio} - ${personal.horarioFin}
                    </td>
                    <td style="padding: 12px 15px; text-align: center;">
                        <span style="background: ${estadoBgColor}; color: ${estadoTextColor}; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                            ${personal.estado.charAt(0).toUpperCase() + personal.estado.slice(1)}
                        </span>
                    </td>
                    <td style="padding: 12px 15px; text-align: center;">
                        <button class="btn btn-sm btn-info" onclick="${g}.verDetalles('${personal.id}')" title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="${g}.editarPersonal('${personal.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="${g}.eliminarPersonal('${personal.id}')" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn btn-sm btn-success" onclick="${g}.verDisponibilidad('${personal.id}')" title="Ver disponibilidad">
                            <i class="fas fa-calendar-alt"></i>
                        </button>
                        ${personal.conExtras ? `
                        <button class="btn btn-sm personal-btn-emergencia${personal.disponibleEmergencias ? ' activo' : ''}" onclick="${g}.cambiarEmergencia('${personal.id}')"
                            title="${personal.disponibleEmergencias ? 'Quitar de emergencias' : 'Marcar como disponible para emergencias'}" aria-pressed="${personal.disponibleEmergencias}">
                            <i class="fas fa-truck-medical" aria-hidden="true"></i>
                        </button>
                        <button class="btn btn-sm personal-btn-documentos${personal.documentos.vencidos ? ' vencidos' : personal.documentos.porVencer ? ' por-vencer' : ''}" onclick="${g}.abrirDocumentos('${personal.id}')"
                            title="${this.escapeHTML(this.resumenDocumentos(personal))}">
                            <i class="fas fa-folder-open" aria-hidden="true"></i>${personal.documentos.total ? `<span class="personal-btn-conteo">${personal.documentos.total}</span>` : ''}
                        </button>` : ''}
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
            <div style="padding: 15px; background: #f5f5f5; text-align: right; font-size: 12px; color: #666;">
                Total: <strong>${personalFiltered.length}</strong> de <strong>${this.state.personal.length}</strong> personal
            </div>
        `;

        container.innerHTML = html;
    },

    // ---------- Emergencias ----------
    // Día ("lunes"…) y hora "HH:MM" actuales en la zona horaria de la clínica
    momentoActual() {
        const partes = Object.fromEntries(new Intl.DateTimeFormat('es-GT', {
            timeZone: CONFIG.REGION.timeZone, weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(new Date()).map(p => [p.type, p.value]));
        const dia = partes.weekday.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        return { dia, hora: `${partes.hour}:${partes.minute}` };
    },

    enTurno(personal, ahora = this.momentoActual()) {
        return (personal.diasDisponibles || []).includes(ahora.dia)
            && ahora.hora >= personal.horarioInicio && ahora.hora < personal.horarioFin;
    },

    telefonoEmergencia(personal) {
        return personal.telefonoEmergencia || personal.telefono;
    },

    // Tarjetas del personal activo que se puede llamar en una emergencia; primero los que están en turno
    renderEmergencias() {
        const panel = document.getElementById(ids.emergencias);
        if (!panel) return;
        const conExtras = this.state.personal.some(p => p.conExtras);
        panel.hidden = !conExtras;
        if (!conExtras) return;

        const ahora = this.momentoActual();
        const disponibles = this.state.personal
            .filter(p => p.estado === 'activo' && p.disponibleEmergencias)
            .map(p => ({ personal: p, turno: this.enTurno(p, ahora) }))
            .sort((a, b) => Number(b.turno) - Number(a.turno)
                || (a.personal.apellidoPaterno || '').localeCompare(b.personal.apellidoPaterno || ''));
        const [singular, plural] = cfg.textos.emergenciasConteo;

        panel.innerHTML = `
            <div class="personal-emergencias-encabezado">
                <h2 id="${ids.emergencias}Titulo"><i class="fas fa-truck-medical" aria-hidden="true"></i> Disponibles para emergencias</h2>
                <span class="personal-emergencias-total">${disponibles.length} ${disponibles.length === 1 ? singular : plural}</span>
            </div>
            ${disponibles.length ? `
                <ul class="personal-emergencias-lista">
                    ${disponibles.map(({ personal, turno }) => {
                        const telefono = this.telefonoEmergencia(personal);
                        return `
                        <li class="personal-emergencia-tarjeta">
                            ${this.avatarHTML(personal, 40)}
                            <div class="personal-emergencia-datos">
                                <strong>${this.escapeHTML(`${personal.nombre} ${personal.apellidoPaterno}`)}</strong>
                                <small>${this.escapeHTML(cfg.profesional.resumen(personal))}</small>
                                <span class="personal-emergencia-estado${turno ? ' en-turno' : ''}">${turno ? 'En turno ahora' : 'De llamada'} · ${personal.horarioInicio}–${personal.horarioFin}</span>
                            </div>
                            <a class="btn btn-sm btn-primary personal-emergencia-llamar" href="tel:${this.escapeHTML(telefono.replace(/[^\d+]/g, ''))}" title="Llamar a ${this.escapeHTML(personal.nombre)}">
                                <i class="fas fa-phone" aria-hidden="true"></i> ${this.escapeHTML(telefono)}
                            </a>
                        </li>`;
                    }).join('')}
                </ul>` : `
                <p class="personal-emergencias-vacio">Nadie está marcado para emergencias. Use el botón <i class="fas fa-truck-medical" aria-hidden="true"></i> del listado o la sección Emergencias al editar a una persona.</p>`}
        `;
    },

    async cambiarEmergencia(personalId) {
        const personal = this.state.personal.find(p => String(p.id) === String(personalId));
        if (!personal) return;
        try {
            const token = this.getAuthToken();
            if (!token) throw new Error('No hay token de autenticación');
            const response = await fetch(this.getApiUrl(`/${personalId}/emergencias`), {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ disponible_emergencias: !personal.disponibleEmergencias })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
            this.reemplazarPersonal(this.normalizePersonal(data.personal));
            showNotification(personal.disponibleEmergencias
                ? `${personal.nombre} ${personal.apellidoPaterno} ya no aparece en emergencias`
                : `${personal.nombre} ${personal.apellidoPaterno} quedó disponible para emergencias`, 'success');
        } catch (error) {
            showNotification(`No se pudo cambiar: ${error.message}`, 'error');
        }
    },

    reemplazarPersonal(actualizado) {
        this.state.personal = this.state.personal.map(p => String(p.id) === String(actualizado.id) ? actualizado : p);
        this.savePersonalToDB();
        this.renderPersonal();
    },

    // ---------- Documentos ----------
    resumenDocumentos(personal) {
        const { total, vencidos, porVencer } = personal.documentos;
        if (!total) return 'Documentos: ninguno';
        return [`Documentos: ${total}`, vencidos ? `${vencidos} vencido${vencidos === 1 ? '' : 's'}` : '',
            porVencer ? `${porVencer} por vencer` : ''].filter(Boolean).join(' · ');
    },

    renderAvisoDocumentos() {
        const aviso = document.getElementById(ids.aviso);
        if (!aviso) return;
        const conAviso = this.state.personal.filter(p => p.estado === 'activo' && (p.documentos.vencidos || p.documentos.porVencer));
        aviso.hidden = conAviso.length === 0;
        if (!conAviso.length) return;
        aviso.innerHTML = `
            <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
            <span><strong>Documentos por renovar:</strong>
                ${conAviso.map(p => `<button type="button" class="personal-aviso-enlace" onclick="${cfg.global}.abrirDocumentos('${p.id}')">${this.escapeHTML(`${p.nombre} ${p.apellidoPaterno}`)}</button>
                    <small>(${[p.documentos.vencidos ? `${p.documentos.vencidos} vencido${p.documentos.vencidos === 1 ? '' : 's'}` : '',
                        p.documentos.porVencer ? `${p.documentos.porVencer} por vencer` : ''].filter(Boolean).join(', ')})</small>`).join(', ')}
            </span>`;
    },

    hoyISO() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.REGION.timeZone }).format(new Date());
    },

    // Chip de vencimiento: vencido, por vencer (30 días) o vigente
    vencimientoHTML(fecha, diasAviso = 30) {
        if (!fecha) return '<span class="personal-doc-vence sin-fecha">Sin vencimiento</span>';
        const dias = Math.round((aFecha(fecha) - aFecha(this.hoyISO())) / 86400000);
        if (dias < 0) return `<span class="personal-doc-vence vencido">Venció el ${formatFecha(fecha)}</span>`;
        if (dias <= diasAviso) {
            const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`;
            return `<span class="personal-doc-vence por-vencer">Vence ${cuando} (${formatFecha(fecha)})</span>`;
        }
        return `<span class="personal-doc-vence">Vence el ${formatFecha(fecha)}</span>`;
    },

    tamanoTexto(bytes) {
        return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
    },

    async apiDocumentos(path, opciones = {}) {
        const token = this.getAuthToken();
        if (!token) throw new Error('No hay token de autenticación');
        const response = await fetch(this.getApiUrl(path), {
            ...opciones,
            headers: { Authorization: `Bearer ${token}`, ...(opciones.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || data.message || `Error ${response.status}`);
        return data;
    },

    abrirDocumentos(personalId) {
        const personal = this.state.personal.find(p => String(p.id) === String(personalId));
        if (!personal) {
            showNotification('Personal no encontrado', 'error');
            return;
        }
        document.querySelector('.modal-overlay.personal-docs-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay personal-docs-overlay';
        overlay.innerHTML = `
            <div class="modal-dialog personal-docs" role="dialog" aria-modal="true" aria-labelledby="personalDocsTitulo">
                <div class="modal-header">
                    <h2 id="personalDocsTitulo"><i class="fas fa-folder-open" aria-hidden="true"></i> Documentos · ${this.escapeHTML(`${personal.nombre} ${personal.apellidoPaterno}`)}</h2>
                    <button type="button" class="close-btn" aria-label="Cerrar">&times;</button>
                </div>
                <div class="modal-body">
                    <form class="personal-docs-form" novalidate>
                        <div class="personal-docs-campos">
                            <div class="form-group">
                                <label for="personalDocTipo">Tipo de documento <span class="required">*</span></label>
                                <select id="personalDocTipo" class="form-input" required>
                                    <option value="">-- Selecciona --</option>
                                    ${Object.entries(this.TIPOS_DOCUMENTO).map(([clave, etiqueta]) => `<option value="${clave}">${etiqueta}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="personalDocVence">Vence el</label>
                                <input type="date" id="personalDocVence" class="form-input">
                            </div>
                            <div class="form-group personal-docs-ancho">
                                <label for="personalDocArchivo">Archivo <span class="required">*</span></label>
                                <input type="file" id="personalDocArchivo" class="form-input" accept="application/pdf,image/jpeg,image/png,image/webp" required>
                                <small class="form-hint">PDF, JPG, PNG o WEBP de hasta 10 MB.</small>
                            </div>
                            <div class="form-group personal-docs-ancho">
                                <label for="personalDocNotas">Notas</label>
                                <input type="text" id="personalDocNotas" class="form-input" maxlength="300" placeholder="Ej.: número de constancia, institución…">
                            </div>
                        </div>
                        <p class="personal-docs-error" role="alert" hidden></p>
                        <button type="submit" class="btn btn-primary"><i class="fas fa-upload" aria-hidden="true"></i> Subir documento</button>
                    </form>
                    <div class="personal-docs-lista" aria-live="polite"><p class="form-hint">Cargando documentos…</p></div>
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
        overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });

        const form = overlay.querySelector('.personal-docs-form');
        const lista = overlay.querySelector('.personal-docs-lista');
        const error = overlay.querySelector('.personal-docs-error');
        let diasAviso = 30;
        let documentos = [];

        const mostrarError = (mensaje) => {
            error.textContent = mensaje || '';
            error.hidden = !mensaje;
        };
        form.addEventListener('input', () => mostrarError(''));

        // El resumen del listado (conteos y avisos) se recalcula con lo que hay en el diálogo
        const actualizarResumen = () => {
            const hoy = this.hoyISO();
            const limite = new Date(aFecha(hoy).getTime() + diasAviso * 86400000);
            personal.documentos = {
                total: documentos.length,
                vencidos: documentos.filter(d => d.fecha_vencimiento && d.fecha_vencimiento < hoy).length,
                porVencer: documentos.filter(d => d.fecha_vencimiento && d.fecha_vencimiento >= hoy && aFecha(d.fecha_vencimiento) <= limite).length
            };
            this.renderPersonal();
        };

        const pintar = () => {
            if (!documentos.length) {
                lista.innerHTML = '<p class="personal-docs-vacio">Aún no hay documentos. Suba el primero con el formulario de arriba.</p>';
                return;
            }
            lista.innerHTML = `<ul>${documentos.map(d => `
                <li class="personal-doc">
                    <i class="fas ${d.tipo_contenido === 'application/pdf' ? 'fa-file-pdf' : 'fa-file-image'} personal-doc-icono" aria-hidden="true"></i>
                    <div class="personal-doc-datos">
                        <strong>${this.escapeHTML(this.TIPOS_DOCUMENTO[d.tipo] || d.tipo)}</strong>
                        <small>${this.escapeHTML(d.nombre)} · ${this.tamanoTexto(d.tamano)}</small>
                        ${d.notas ? `<small>${this.escapeHTML(d.notas)}</small>` : ''}
                        <small>Subido el ${formatFecha(d.fecha)}${d.subido_por ? ` por ${this.escapeHTML(d.subido_por)}` : ''}</small>
                        ${this.vencimientoHTML(d.fecha_vencimiento, diasAviso)}
                    </div>
                    <div class="personal-doc-acciones">
                        <button type="button" class="btn btn-sm btn-secondary" data-ver="${d.id}"><i class="fas fa-eye" aria-hidden="true"></i> Ver</button>
                        <button type="button" class="btn btn-sm btn-danger" data-eliminar="${d.id}" aria-label="Eliminar ${this.escapeHTML(this.TIPOS_DOCUMENTO[d.tipo] || d.tipo)}"><i class="fas fa-trash" aria-hidden="true"></i></button>
                    </div>
                </li>`).join('')}</ul>`;
        };

        const cargar = async () => {
            try {
                const data = await this.apiDocumentos(`/${personalId}/archivos`);
                documentos = data.documentos || [];
                diasAviso = data.dias_aviso || diasAviso;
                pintar();
                actualizarResumen();
            } catch (e) {
                lista.innerHTML = `<p class="personal-docs-error">No se pudieron cargar los documentos: ${this.escapeHTML(e.message)}</p>`;
            }
        };

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tipo = form.querySelector('#personalDocTipo').value;
            const archivo = form.querySelector('#personalDocArchivo').files?.[0];
            const vence = form.querySelector('#personalDocVence').value;
            const notas = form.querySelector('#personalDocNotas').value.trim();
            if (!tipo) return mostrarError('Seleccione el tipo de documento.');
            if (!archivo) return mostrarError('Elija el archivo a subir.');
            if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(archivo.type)) return mostrarError('El archivo debe ser PDF, JPG, PNG o WEBP.');
            if (archivo.size > 10 * 1024 * 1024) return mostrarError('El archivo pesa más de 10 MB. Redúzcalo o escanéelo con menor resolución.');

            const boton = form.querySelector('button[type="submit"]');
            boton.disabled = true;
            boton.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Subiendo…';
            try {
                const params = new URLSearchParams({ tipo, nombre: archivo.name });
                if (vence) params.set('vencimiento', vence);
                if (notas) params.set('notas', notas);
                const data = await this.apiDocumentos(`/${personalId}/archivos?${params}`, {
                    method: 'POST',
                    headers: { 'Content-Type': archivo.type },
                    body: archivo
                });
                documentos.unshift(data.documento);
                form.reset();
                pintar();
                actualizarResumen();
                showNotification('Documento guardado', 'success');
            } catch (err) {
                mostrarError(`No se pudo subir: ${err.message}`);
            } finally {
                boton.disabled = false;
                boton.innerHTML = '<i class="fas fa-upload" aria-hidden="true"></i> Subir documento';
            }
        });

        lista.addEventListener('click', async (e) => {
            const ver = e.target.closest('[data-ver]');
            const eliminar = e.target.closest('[data-eliminar]');
            if (ver) {
                const documento = documentos.find(d => String(d.id) === ver.dataset.ver);
                this.verDocumento(documento);
            } else if (eliminar) {
                const documento = documentos.find(d => String(d.id) === eliminar.dataset.eliminar);
                if (!documento || !confirm(`¿Eliminar "${this.TIPOS_DOCUMENTO[documento.tipo] || documento.tipo}" (${documento.nombre})? No se puede deshacer.`)) return;
                eliminar.disabled = true;
                try {
                    await this.apiDocumentos(`/archivos/${documento.id}`, { method: 'DELETE' });
                    documentos = documentos.filter(d => d !== documento);
                    pintar();
                    actualizarResumen();
                    showNotification('Documento eliminado', 'success');
                } catch (err) {
                    eliminar.disabled = false;
                    showNotification(`No se pudo eliminar: ${err.message}`, 'error');
                }
            }
        });

        form.querySelector('#personalDocTipo').focus();
        cargar();
    },

    // Abre el documento en una pestaña nueva (se pide con el token, por eso no es un enlace directo)
    async verDocumento(documento) {
        if (!documento) return;
        // Abrir la pestaña ya, dentro del clic, para que el navegador no la bloquee
        const ventana = window.open('', '_blank');
        try {
            const token = this.getAuthToken();
            const response = await fetch(this.getApiUrl(`/archivos/${documento.id}`), {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || `Error ${response.status}`);
            }
            const url = URL.createObjectURL(await response.blob());
            if (ventana) {
                ventana.location.href = url;
            } else {
                // Si el navegador bloqueó la pestaña, se descarga
                const enlace = document.createElement('a');
                enlace.href = url;
                enlace.download = documento.nombre || 'documento';
                enlace.click();
            }
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {
            ventana?.close();
            showNotification(`No se pudo abrir el documento: ${error.message}`, 'error');
        }
    },

    // ---------- Usuario del sistema (solo administrador) ----------
    setupUsuario() {
        const select = campo('Usuario');
        select?.addEventListener('change', () => this.mostrarUsuarioNuevo());
    },

    seccionUsuario() {
        return this.modal()?.querySelector('.personal-usuario-seccion');
    },

    mostrarUsuarioNuevo() {
        const nuevo = this.modal()?.querySelector('.personal-usuario-nuevo');
        if (!nuevo) return;
        nuevo.hidden = campo('Usuario').value !== 'nuevo';
        // El email del usuario nuevo parte del email de la persona
        if (!nuevo.hidden && !campo('UsuarioEmail').value) campo('UsuarioEmail').value = campo('Email').value.trim();
    },

    // Llena la lista de usuarios: los libres y el de esta persona; los vinculados a otra persona se ven pero no se eligen
    async prepararUsuario(personal) {
        const seccion = this.seccionUsuario();
        if (!seccion) return;
        const visible = typeof Permisos !== 'undefined' && Permisos.esAdmin()
            && (personal ? personal.conExtras : this.state.personal.some(p => p.conExtras) || cfg.requiereMigracion);
        seccion.hidden = !visible;
        campo('UsuarioEmail').value = '';
        campo('UsuarioClave').value = '';
        if (!visible) return;

        const select = campo('Usuario');
        select.innerHTML = '<option value="">Cargando usuarios…</option>';
        select.disabled = true;
        try {
            const pedir = async (path) => {
                const response = await authManager.fetchWithAuth(`/api/usuarios${path}`);
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.message || 'No se pudieron cargar los usuarios');
                return data.data;
            };
            [this.state.usuarios, this.state.roles] = await Promise.all([pedir(''), pedir('/roles')]);
        } catch (error) {
            select.innerHTML = '<option value="">No se pudieron cargar los usuarios</option>';
            return;
        }

        const propio = personal?.userId ? String(personal.userId) : '';
        select.innerHTML = '<option value="">Sin usuario</option>' + this.state.usuarios.map(u => {
            const mismo = String(u.id) === propio;
            const ocupado = u.personal && !mismo;
            const nombre = `${u.nombre} ${u.apellido || ''}`.trim();
            return `<option value="${u.id}" ${ocupado ? 'disabled' : ''}>${this.escapeHTML(`${nombre} · ${u.email}`)}${ocupado ? ` (vinculado a ${this.escapeHTML(u.personal.nombre)})` : ''}${u.activo ? '' : ' (inactivo)'}</option>`;
        }).join('') + '<option value="nuevo">+ Crear usuario nuevo…</option>';
        select.value = propio;
        select.disabled = false;

        const rol = campo('UsuarioRol');
        rol.innerHTML = '<option value="">-- Selecciona rol --</option>' + this.state.roles
            .map(r => `<option value="${this.escapeHTML(r.nombre)}">${this.escapeHTML(typeof Permisos !== 'undefined' ? Permisos.nombreRol(r.nombre) : r.nombre)}</option>`).join('');
        if (cfg.rolSugerido && this.state.roles.some(r => r.nombre === cfg.rolSugerido)) rol.value = cfg.rolSugerido;
        this.mostrarUsuarioNuevo();
    },

    // Valor de user_id a enviar: undefined si no se toca, null para desvincular, o el id (creando el usuario si hace falta)
    async resolverUsuario(datosPersona) {
        const seccion = this.seccionUsuario();
        if (!seccion || seccion.hidden || campo('Usuario').disabled) return undefined;
        const valor = campo('Usuario').value;
        if (valor !== 'nuevo') return valor ? Number(valor) : null;

        const email = campo('UsuarioEmail').value.trim();
        const password = campo('UsuarioClave').value;
        const rol = campo('UsuarioRol').value;
        if (!email || !email.includes('@')) throw new Error('Escriba el email del usuario nuevo');
        if (password.length < 8) throw new Error('La contraseña del usuario nuevo debe tener al menos 8 caracteres');
        if (!rol) throw new Error('Seleccione el rol del usuario nuevo');

        const response = await authManager.fetchWithAuth('/api/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email, password, roles: [rol],
                nombre: datosPersona.nombre,
                apellido: [datosPersona.apellido_paterno, datosPersona.apellido_materno].filter(Boolean).join(' '),
                telefono: datosPersona.telefono
            })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'No se pudo crear el usuario');

        // Si después falla guardar a la persona, el usuario ya existe: queda elegido para reintentar
        const select = campo('Usuario');
        select.insertAdjacentHTML('beforeend', `<option value="${data.data.id}">${this.escapeHTML(`${datosPersona.nombre} · ${email}`)}</option>`);
        select.value = String(data.data.id);
        this.mostrarUsuarioNuevo();
        return data.data.id;
    },

    // ---------- Formulario ----------
    // Abrir modal para nuevo personal
    openNuevoPersonalModal() {
        const modal = this.modal();
        if (!modal) {
            showNotification('Modal no encontrado', 'error');
            return;
        }

        // Limpiar formulario
        campo('Nombre').value = '';
        campo('ApellidoPaterno').value = '';
        campo('ApellidoMaterno').value = '';
        cfg.profesional.limpiar(this);
        campo('Email').value = '';
        campo('Telefono').value = '';
        campo('HorarioInicio').value = '08:00';
        campo('HorarioFin').value = '16:00';
        campo('Estado').value = 'activo';
        this.setDiasLaborales(['lunes', 'martes', 'miercoles', 'jueves', 'viernes']);
        campo('DPI').value = '';
        this.setCamposEmergencia(false, '');
        this.resetImagenes();
        this.prepararUsuario(null);

        // Guardar que es creación nueva
        modal.dataset.personalId = '';

        // Actualizar título
        const titleElement = modal.querySelector('.modal-header h2');
        if (titleElement) {
            titleElement.innerHTML = `<i class="fas fa-user-plus"></i> ${cfg.textos.nuevo}`;
        }

        modal.style.display = 'block';
    },

    setCamposEmergencia(disponible, telefono) {
        const check = campo('DisponibleEmergencias');
        const tel = campo('TelefonoEmergencia');
        if (check) check.checked = disponible;
        if (tel) tel.value = telefono || '';
    },

    checkboxesDias() {
        return campo('DiasLaborales')?.querySelectorAll('input[type="checkbox"]') || [];
    },

    getDiasLaboralesSeleccionados() {
        return Array.from(this.checkboxesDias()).filter(input => input.checked).map(input => input.value);
    },

    setDiasLaborales(dias) {
        const seleccionados = new Set(dias || []);
        this.checkboxesDias().forEach(input => {
            input.checked = seleccionados.has(input.value);
        });
    },

    // Guardar personal
    async guardarPersonal() {
        const nombre = campo('Nombre')?.value?.trim();
        const apellidoPaterno = campo('ApellidoPaterno')?.value?.trim();
        const apellidoMaterno = campo('ApellidoMaterno')?.value?.trim();
        const email = campo('Email')?.value?.trim();
        const telefono = campo('Telefono')?.value?.trim();
        const horarioInicio = campo('HorarioInicio')?.value;
        const horarioFin = campo('HorarioFin')?.value;
        const estado = campo('Estado')?.value;
        const diasLaborales = this.getDiasLaboralesSeleccionados();
        const dpi = (campo('DPI')?.value || '').replace(/\D/g, '');
        const disponibleEmergencias = Boolean(campo('DisponibleEmergencias')?.checked);
        const telefonoEmergencia = campo('TelefonoEmergencia')?.value?.trim() || '';

        const modal = this.modal();
        const personalId = modal?.dataset.personalId;

        // Validaciones
        if (!nombre) {
            showNotification('Nombre es obligatorio', 'error');
            return;
        }

        if (!apellidoPaterno) {
            showNotification('Apellido paterno es obligatorio', 'error');
            return;
        }

        const propios = cfg.profesional.leer(this, personalId);
        if (propios.error) {
            showNotification(propios.error, 'error');
            return;
        }

        if (email && !email.includes('@')) {
            showNotification('Ingresa un email válido', 'error');
            return;
        }

        if (!telefono) {
            showNotification('Teléfono es obligatorio', 'error');
            return;
        }

        if (dpi && dpi.length !== 13) {
            showNotification('El DPI debe tener 13 dígitos', 'error');
            return;
        }

        if (diasLaborales.length === 0) {
            showNotification('Selecciona al menos un día laboral', 'error');
            return;
        }

        if (!horarioInicio || !horarioFin || horarioFin <= horarioInicio) {
            showNotification('La hora de fin debe ser posterior a la hora de inicio', 'error');
            return;
        }

        const saveButton = modal.querySelector('button[onclick*="guardarPersonal"]');
        if (saveButton) saveButton.disabled = true;

        try {
            const token = this.getAuthToken();
            if (!token) throw new Error('No hay token de autenticación');

            const datos = {
                nombre,
                apellido_paterno: apellidoPaterno,
                apellido_materno: apellidoMaterno,
                ...propios.valores,
                email: email || null,
                telefono,
                horario_inicio: horarioInicio,
                horario_fin: horarioFin,
                dias_disponibles: diasLaborales,
                estado,
                dpi: dpi || null,
                disponible_emergencias: disponibleEmergencias,
                telefono_emergencia: telefonoEmergencia || null,
                // Solo se envían las imágenes que cambiaron (null = quitar)
                ...Object.fromEntries(Object.entries(this.state.imagenes)
                    .filter(([, img]) => img.cambiado)
                    .map(([nombreImagen, img]) => [nombreImagen, img.valor]))
            };
            const userId = await this.resolverUsuario(datos);
            if (userId !== undefined) datos.user_id = userId;

            const response = await fetch(this.getApiUrl(personalId ? `/${personalId}` : ''), {
                method: personalId ? 'PUT' : 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(datos)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Error ${response.status}`);

            const personalGuardado = this.normalizePersonal(data.personal);
            this.state.imagenes = {};
            if (personalId) {
                this.state.personal = this.state.personal.map(personal =>
                    String(personal.id) === String(personalId) ? personalGuardado : personal
                );
            } else {
                this.state.personal.push(personalGuardado);
            }
            this.savePersonalToDB();
            this.renderPersonal();
            modal.style.display = 'none';
            showNotification(`✓ Personal ${personalId ? 'actualizado' : 'registrado'}: ${nombre} ${apellidoPaterno}`, 'success');
        } catch (error) {
            console.error('Error guardando personal:', error);
            showNotification(`No se pudo guardar: ${error.message}`, 'error');
        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    },

    // Ver detalles de personal
    verDetalles(personalId) {
        const personal = this.state.personal.find(p => String(p.id) === String(personalId));
        if (!personal) {
            showNotification('Personal no encontrado', 'error');
            return;
        }

        const g = cfg.global;
        const caja = (titulo, contenido) => `
            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                <strong style="color: #667eea;">${titulo}</strong><br>
                <p style="margin: 5px 0;">${contenido}</p>
            </div>`;
        const [propioA, propioB] = cfg.profesional.detalle(personal, this);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog" style="max-width: 600px;">
                <div class="modal-header">
                    <h2><i class="fas fa-user-md"></i> Detalles del Personal</h2>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; gap: 15px;">
                        <div class="personal-detalle-encabezado">
                            ${this.avatarHTML(personal, 88)}
                            <div>
                                <h3>${this.escapeHTML(this.nombreCompleto(personal))}</h3>
                                <p>DPI: ${personal.dpi ? this.formatearDPI(personal.dpi) : 'No registrado'}</p>
                            </div>
                        </div>
                        <div class="personal-detalle-dpi">
                            ${personal.tieneDpiFrente || personal.tieneDpiReverso
                                ? '<p class="form-hint">Cargando fotografías del DPI…</p>'
                                : '<p class="form-hint">Sin fotografías del DPI.</p>'}
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            ${caja('Nombre Completo', this.escapeHTML(this.nombreCompleto(personal)))}
                            ${caja(propioA.titulo, propioA.valor)}
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            ${caja(propioB.titulo, propioB.valor)}
                            ${caja('Estado', `<span style="background: ${personal.estado === 'activo' ? '#4caf50' : '#f44336'}; color: white; padding: 4px 8px; border-radius: 3px;">
                                ${personal.estado.charAt(0).toUpperCase() + personal.estado.slice(1)}</span>`)}
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            ${caja('Email', this.escapeHTML(personal.email) || '—')}
                            ${caja('Teléfono', this.escapeHTML(personal.telefono))}
                        </div>

                        ${personal.conExtras ? `
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            ${caja('Emergencias', personal.disponibleEmergencias
                                ? `Disponible · ${this.escapeHTML(this.telefonoEmergencia(personal))}`
                                : 'No disponible')}
                            ${caja('Documentos', this.escapeHTML(this.resumenDocumentos(personal).replace('Documentos: ', '')))}
                        </div>
                        ${caja('Usuario del sistema', personal.usuarioEmail
                            ? `${this.escapeHTML(personal.usuarioNombre)} · ${this.escapeHTML(personal.usuarioEmail)}`
                            : 'Sin usuario vinculado')}` : ''}

                        <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                            <strong style="color: #667eea;">Horario Laboral</strong><br>
                            <p style="margin: 5px 0;">${personal.horarioInicio} - ${personal.horarioFin}</p>
                            <small style="color: #666;">Días: ${(personal.diasDisponibles || []).join(', ')}</small>
                        </div>

                        <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px;">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
                            <button type="button" class="btn btn-info" onclick="${g}.editarPersonal('${personal.id}'); this.closest('.modal-overlay').remove();">
                                <i class="fas fa-edit"></i> Editar
                            </button>
                            <button type="button" class="btn btn-success" onclick="${g}.verDisponibilidad('${personal.id}'); this.closest('.modal-overlay').remove();">
                                <i class="fas fa-calendar-alt"></i> Ver Disponibilidad
                            </button>
                            ${personal.conExtras ? `
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove(); ${g}.abrirDocumentos('${personal.id}');">
                                <i class="fas fa-folder-open" aria-hidden="true"></i> Documentos
                            </button>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        if (personal.tieneDpiFrente || personal.tieneDpiReverso) {
            const contenedor = modal.querySelector('.personal-detalle-dpi');
            this.fetchDocumentos(personalId)
                .then(docs => {
                    const figura = (src, titulo) => src
                        ? `<figure><img src="${src}" alt="${titulo}"><figcaption>${titulo}</figcaption></figure>` : '';
                    contenedor.innerHTML = figura(docs.dpi_frente, 'DPI · frente') + figura(docs.dpi_reverso, 'DPI · reverso');
                })
                .catch(() => { contenedor.innerHTML = '<p class="form-hint">No se pudieron cargar las fotografías del DPI.</p>'; });
        }
    },

    // Editar personal
    editarPersonal(personalId) {
        const personal = this.state.personal.find(p => String(p.id) === String(personalId));
        if (!personal) {
            showNotification('Personal no encontrado', 'error');
            return;
        }

        // Llenar formulario
        campo('Nombre').value = personal.nombre;
        campo('ApellidoPaterno').value = personal.apellidoPaterno;
        campo('ApellidoMaterno').value = personal.apellidoMaterno || '';
        cfg.profesional.llenar(this, personal);
        campo('Email').value = personal.email;
        campo('Telefono').value = personal.telefono;
        campo('HorarioInicio').value = personal.horarioInicio;
        campo('HorarioFin').value = personal.horarioFin;
        campo('Estado').value = personal.estado;
        this.setDiasLaborales(personal.diasDisponibles);
        campo('DPI').value = this.formatearDPI(personal.dpi);
        this.setCamposEmergencia(personal.disponibleEmergencias, personal.telefonoEmergencia);
        this.resetImagenes();
        this.setImagen('foto_perfil', personal.fotoPerfil);
        this.prepararUsuario(personal);
        if (personal.tieneDpiFrente || personal.tieneDpiReverso) {
            this.fetchDocumentos(personalId)
                .then(docs => {
                    // No pisar una imagen que el usuario ya cambió mientras cargaba
                    ['dpi_frente', 'dpi_reverso'].forEach(nombreImagen => {
                        if (!this.state.imagenes[nombreImagen]?.cambiado) this.setImagen(nombreImagen, docs[nombreImagen] || null);
                    });
                })
                .catch(error => showNotification(`No se pudieron cargar las fotos del DPI: ${error.message}`, 'error'));
        }

        // Guardar ID para edición
        const modal = this.modal();
        modal.dataset.personalId = personalId;

        // Actualizar título
        const titleElement = modal.querySelector('.modal-header h2');
        if (titleElement) {
            titleElement.innerHTML = '<i class="fas fa-user-edit"></i> Editar Personal';
        }

        modal.style.display = 'block';
    },

    // Eliminar personal
    async eliminarPersonal(personalId) {
        const personal = this.state.personal.find(p => String(p.id) === String(personalId));

        if (!personal) {
            showNotification('Personal no encontrado', 'error');
            return;
        }

        if (confirm(`¿Deseas eliminar a ${personal.nombre} ${personal.apellidoPaterno}?${personal.usuarioEmail ? ` Su usuario (${personal.usuarioEmail}) no se elimina.` : ''}`)) {
            try {
                const token = this.getAuthToken();
                if (!token) throw new Error('No hay token de autenticación');
                const response = await fetch(this.getApiUrl(`/${personalId}`), {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || `Error ${response.status}`);

                this.state.personal = this.state.personal.filter(p => String(p.id) !== String(personalId));
                this.savePersonalToDB();
                this.renderPersonal();
                showNotification('✓ Personal eliminado', 'success');
            } catch (error) {
                console.error('Error eliminando personal:', error);
                showNotification(`No se pudo eliminar: ${error.message}`, 'error');
            }
        }
    },

    // Ver disponibilidad de personal
    verDisponibilidad(personalId) {
        const personal = this.state.personal.find(p => String(p.id) === String(personalId));
        if (!personal) {
            showNotification('Personal no encontrado', 'error');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog" style="max-width: 600px;">
                <div class="modal-header">
                    <h2><i class="fas fa-calendar-alt"></i> Disponibilidad - ${this.escapeHTML(personal.nombre)}</h2>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; gap: 15px;">
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                            <h4 style="margin: 0 0 15px 0; color: #667eea;">Horario Laboral</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div>
                                    <strong>Entrada</strong><br>
                                    <p style="margin: 5px 0; font-size: 18px;">${personal.horarioInicio}</p>
                                </div>
                                <div>
                                    <strong>Salida</strong><br>
                                    <p style="margin: 5px 0; font-size: 18px;">${personal.horarioFin}</p>
                                </div>
                            </div>
                        </div>

                        <div style="background: #e8f5e9; padding: 15px; border-radius: 5px;">
                            <h4 style="margin: 0 0 10px 0; color: #27ae60;">Días Disponibles</h4>
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                                ${['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map(dia => {
                                    const disponible = (personal.diasDisponibles || []).includes(dia);
                                    return `
                                        <div style="background: ${disponible ? '#4caf50' : '#ddd'}; color: ${disponible ? 'white' : '#666'}; padding: 10px; border-radius: 4px; text-align: center; font-weight: 600;">
                                            ${dia.charAt(0).toUpperCase() + dia.slice(1)}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        ${cfg.conCitas ? `
                        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px;">
                            <h4 style="margin: 0 0 10px 0; color: #1976d2;">Próximas Citas Disponibles</h4>
                            <p style="margin: 5px 0; color: #666; font-size: 13px;">
                                Próximas 5 horas disponibles para agendar citas médicas.
                            </p>
                            <ul style="margin: 10px 0; padding-left: 20px; font-size: 12px;">
                                <li>Hoy: 14:00 - 16:00 (2 horas)</li>
                                <li>Mañana: 08:00 - 16:00 (8 horas)</li>
                                <li>Miércoles: 08:00 - 16:00 (8 horas)</li>
                            </ul>
                        </div>` : ''}

                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
                            <button type="button" class="btn btn-info" onclick="${cfg.global}.editarDisponibilidad('${personal.id}'); this.closest('.modal-overlay').remove();">
                                <i class="fas fa-pencil-alt"></i> Editar Disponibilidad
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    // El horario y los días se editan en el formulario de la persona
    editarDisponibilidad(personalId) {
        this.editarPersonal(personalId);
    }
    };

    return modulo;
};

// ---------- Personal médico ----------
const PersonalModule = crearModuloPersonal({
    global: 'PersonalModule',
    pagina: 'personal',
    api: 'personal-medico',
    almacenamiento: 'personalMedico',
    conCitas: true,
    rolSugerido: 'doctor',
    ids: {
        prefijo: 'personal',
        modal: 'personalModal',
        tabla: 'personalTable',
        buscar: 'searchPersonal',
        filtroPropio: 'filterEspecialidadPersonal',
        filtroEstado: 'filterEstadoPersonal',
        nuevo: 'btnNuevoPersonal',
        emergencias: 'personalEmergencias',
        aviso: 'personalAvisoDocumentos'
    },
    textos: {
        modulo: 'Gestión de Personal médico',
        nuevo: 'Nuevo Personal Médico',
        registrar: 'nuevo personal médico',
        emergenciasConteo: ['médico', 'médicos']
    },
    estadoInicial: {
        especialidades: [
            { id: 1, nombre: 'Psiquiatría General', icon: 'fa-brain', color: '#8E44AD' },
            { id: 2, nombre: 'Psiquiatría Infantil', icon: 'fa-child', color: '#3498DB' },
            { id: 3, nombre: 'Psicología Clínica', icon: 'fa-couch', color: '#E74C3C' },
            { id: 4, nombre: 'Terapia Cognitivo-Conductual', icon: 'fa-lightbulb', color: '#F39C12' },
            { id: 5, nombre: 'Adicciones y Rehabilitación', icon: 'fa-leaf', color: '#27AE60' },
            { id: 6, nombre: 'Psiquiatría Forense', icon: 'fa-gavel', color: '#34495E' }
        ]
    },
    profesional: {
        normalizar: (personal) => ({
            especialidad: personal.especialidad || '',
            especialidadId: Number(personal.especialidad_id ?? personal.especialidadId),
            numeroColegiado: personal.numero_colegiado ?? personal.numeroColegiado ?? personal.licencia_profesional ?? personal.licenciaProf ?? ''
        }),
        async cargarCatalogos(modulo, token) {
            const response = await fetch(modulo.getApiUrl('/especialidades'), { headers: { Authorization: `Bearer ${token}` } });
            if (!response.ok) throw new Error(`No se pudieron cargar especialidades (${response.status})`);
            const data = await response.json();
            modulo.state.especialidades = (data.especialidades || []).map(e => ({ ...e, id: Number(e.id) }));
        },
        textoBusqueda: (p) => p.numeroColegiado || '',
        filtrar: (p, valor) => p.especialidadId == valor,
        resumen: (p) => p.especialidad || 'Sin especialidad',
        columnas: [
            {
                titulo: 'Especialidad',
                celda: (p, m) => {
                    const especialidad = m.state.especialidades.find(e => e.id == p.especialidadId);
                    return `<span style="background: #f0f4f8; color: #667eea; padding: 4px 8px; border-radius: 3px; font-size: 12px;">${m.escapeHTML(especialidad?.nombre || 'Sin especialidad')}</span>`;
                }
            },
            { titulo: 'Colegiado', celda: (p, m) => `<small>${m.escapeHTML(p.numeroColegiado || 'N/A')}</small>` }
        ],
        detalle: (p, m) => [
            { titulo: 'Especialidad', valor: m.escapeHTML(p.especialidad) },
            { titulo: 'Número de Colegiado', valor: m.escapeHTML(p.numeroColegiado) }
        ],
        limpiar(modulo) {
            this.cargarSelect(modulo);
            document.getElementById('personalEspecialidad').value = '';
            document.getElementById('personalColegiado').value = '';
        },
        llenar(modulo, p) {
            this.cargarSelect(modulo);
            document.getElementById('personalEspecialidad').value = p.especialidadId;
            document.getElementById('personalColegiado').value = p.numeroColegiado;
        },
        cargarSelect(modulo) {
            const select = document.getElementById('personalEspecialidad');
            if (!select) return;
            select.innerHTML = '<option value="">-- Selecciona especialidad --</option>' +
                modulo.state.especialidades.map(e => `<option value="${e.id}">${modulo.escapeHTML(e.nombre)}</option>`).join('');
        },
        leer(modulo, personalId) {
            const especialidadId = document.getElementById('personalEspecialidad')?.value;
            const numeroColegiado = document.getElementById('personalColegiado')?.value?.trim();
            if (!especialidadId) return { error: 'Selecciona una especialidad' };
            if (!numeroColegiado) return { error: 'El número de colegiado es obligatorio' };
            // Validar que el número de colegiado sea único
            const repetido = modulo.state.personal.some(p =>
                p.numeroColegiado === numeroColegiado && String(p.id) !== String(personalId));
            if (repetido) return { error: 'Este número de colegiado ya está registrado' };
            return { valores: { especialidad_id: Number(especialidadId), numero_colegiado: numeroColegiado } };
        }
    }
});

// ---------- Personal (administrativo y de apoyo) ----------
const PersonalGeneralModule = crearModuloPersonal({
    global: 'PersonalGeneralModule',
    pagina: 'personal-general',
    api: 'personal-general',
    almacenamiento: 'personalGeneral',
    requiereMigracion: true,
    ids: {
        prefijo: 'empleado',
        modal: 'empleadoModal',
        tabla: 'empleadosTable',
        buscar: 'searchEmpleados',
        filtroPropio: 'filterAreaEmpleados',
        filtroEstado: 'filterEstadoEmpleados',
        nuevo: 'btnNuevoEmpleado',
        emergencias: 'empleadosEmergencias',
        aviso: 'empleadosAvisoDocumentos'
    },
    textos: {
        modulo: 'Gestión de Personal',
        nuevo: 'Nuevo Personal',
        registrar: 'nuevo personal',
        emergenciasConteo: ['persona', 'personas']
    },
    profesional: {
        normalizar: (personal) => ({
            puesto: personal.puesto || '',
            area: personal.area || ''
        }),
        textoBusqueda: (p) => `${p.puesto} ${p.area}`,
        filtrar: (p, valor) => p.area === valor,
        resumen: (p) => [p.puesto, p.area].filter(Boolean).join(' · '),
        columnas: [
            { titulo: 'Puesto', celda: (p, m) => m.escapeHTML(p.puesto) },
            {
                titulo: 'Área',
                celda: (p, m) => p.area
                    ? `<span style="background: #f0f4f8; color: #667eea; padding: 4px 8px; border-radius: 3px; font-size: 12px;">${m.escapeHTML(p.area)}</span>`
                    : '<small>—</small>'
            }
        ],
        detalle: (p, m) => [
            { titulo: 'Puesto', valor: m.escapeHTML(p.puesto) },
            { titulo: 'Área', valor: m.escapeHTML(p.area) || '—' }
        ],
        limpiar() {
            document.getElementById('empleadoPuesto').value = '';
            document.getElementById('empleadoArea').value = '';
        },
        llenar(modulo, p) {
            document.getElementById('empleadoPuesto').value = p.puesto;
            const area = document.getElementById('empleadoArea');
            // Un área guardada que ya no está en la lista se conserva como opción
            if (p.area && ![...area.options].some(o => o.value === p.area)) area.add(new Option(p.area, p.area));
            area.value = p.area;
        },
        leer() {
            const puesto = document.getElementById('empleadoPuesto')?.value?.trim();
            if (!puesto) return { error: 'El puesto es obligatorio' };
            return { valores: { puesto, area: document.getElementById('empleadoArea')?.value || null } };
        }
    }
});

window.PersonalModule = PersonalModule;
window.PersonalGeneralModule = PersonalGeneralModule;

// Inicializar cuando el DOM esté listo
const iniciarModulosPersonal = () => {
    [PersonalModule, PersonalGeneralModule].forEach(m => {
        if (typeof Permisos === 'undefined' || Permisos.puedeVerPagina(m.cfg.pagina)) m.init();
    });
};
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarModulosPersonal);
} else {
    iniciarModulosPersonal();
}
