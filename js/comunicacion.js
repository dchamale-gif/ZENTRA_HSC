// ============================================
// COMUNICACIÓN - Notificaciones por usuario y chat interno
// Los contadores se consultan periódicamente; la conversación abierta se
// actualiza con más frecuencia y solo pide los mensajes nuevos.
// ============================================

const Comunicacion = {
    INTERVALO_RESUMEN: 30000,
    INTERVALO_CONVERSACION: 5000,
    INTERVALO_LISTA: 15000,

    yo: null,
    usuarios: [],
    conversacionCon: null,   // { id, nombre, roles }
    ultimoMensajeId: 0,
    timerResumen: null,
    timerChat: null,
    enviando: false,

    // ---------- Utilidades ----------
    e(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    },

    async api(path, options = {}) {
        const response = await authManager.fetchWithAuth(`/api/comunicacion${path}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers }
        });
        if (!response) throw new Error('La sesión expiró');
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw new Error(data.message || 'No se pudo conectar con el servidor');
        }
        return data.data;
    },

    nombreCompleto(u) {
        return [u.nombre, u.apellido].filter(Boolean).join(' ') || 'Usuario';
    },

    iniciales(u) {
        return this.nombreCompleto(u).split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
    },

    // "hace 5 min", "ayer", o la fecha si es más antiguo
    tiempoRelativo(fecha) {
        const segundos = Math.round((new Date(fecha) - Date.now()) / 1000);
        const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
        const abs = Math.abs(segundos);
        if (abs < 60) return 'ahora';
        if (abs < 3600) return rtf.format(Math.round(segundos / 60), 'minute');
        if (abs < 86400) return rtf.format(Math.round(segundos / 3600), 'hour');
        if (abs < 172800) return rtf.format(Math.round(segundos / 86400), 'day');
        return new Date(fecha).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
    },

    hora(fecha) {
        return new Date(fecha).toLocaleTimeString('es-GT', { hour: 'numeric', minute: '2-digit' });
    },

    setBadge(id, cantidad) {
        const badge = document.getElementById(id);
        if (!badge) return;
        badge.hidden = !cantidad;
        badge.textContent = cantidad > 99 ? '99+' : String(cantidad || '');
    },

    // ---------- Contadores ----------
    async actualizarResumen() {
        try {
            const { notificaciones, mensajes } = await this.api('/resumen');
            this.setBadge('notifBadge', notificaciones);
            this.setBadge('chatBadge', mensajes);
            document.getElementById('notifBtn')?.setAttribute('aria-label',
                notificaciones ? `Notificaciones (${notificaciones} sin leer)` : 'Notificaciones');
            document.getElementById('chatBtn')?.setAttribute('aria-label',
                mensajes ? `Mensajes (${mensajes} sin leer)` : 'Mensajes');
        } catch (error) {
            // Sin conexión: los contadores simplemente no se actualizan
        }
    },

    iniciarSondeo() {
        clearInterval(this.timerResumen);
        this.timerResumen = setInterval(() => {
            if (!document.hidden) this.actualizarResumen();
        }, this.INTERVALO_RESUMEN);
    },

    // ---------- Notificaciones ----------
    async abrirNotificaciones(abrir) {
        const boton = document.getElementById('notifBtn');
        const panel = document.getElementById('notifPanel');
        panel.hidden = !abrir;
        boton.setAttribute('aria-expanded', String(abrir));
        if (!abrir) return;

        const lista = document.getElementById('notifLista');
        lista.innerHTML = '<p class="com-vacio">Cargando…</p>';
        try {
            this.renderNotificaciones(await this.api('/notificaciones'));
        } catch (error) {
            lista.innerHTML = `<p class="com-vacio">No se pudieron cargar las notificaciones. ${this.e(error.message)}</p>`;
        }
    },

    renderNotificaciones(notificaciones) {
        const lista = document.getElementById('notifLista');
        document.getElementById('notifMarcarTodas').hidden = !notificaciones.some(n => !n.leida);

        if (!notificaciones.length) {
            lista.innerHTML = `
                <div class="com-vacio">
                    <i class="fas fa-bell-slash" aria-hidden="true"></i>
                    <strong>No tienes notificaciones</strong>
                    <span>Aquí aparecerán los avisos importantes para tu área, como nuevas órdenes médicas.</span>
                </div>`;
            return;
        }

        lista.innerHTML = notificaciones.map(n => `
            <button type="button" class="com-item${n.leida ? '' : ' no-leida'}" data-notif-id="${n.id}" data-enlace="${this.e(n.enlace || '')}">
                <span class="com-item-icono" aria-hidden="true"><i class="fas ${n.tipo === 'orden_medica' ? 'fa-file-prescription' : 'fa-bell'}"></i></span>
                <span class="com-item-texto">
                    <strong>${this.e(n.titulo)}</strong>
                    ${n.mensaje ? `<span>${this.e(n.mensaje)}</span>` : ''}
                    <time datetime="${this.e(n.created_at)}">${this.tiempoRelativo(n.created_at)}</time>
                </span>
                ${n.leida ? '' : '<span class="com-punto" aria-label="Sin leer"></span>'}
            </button>
        `).join('');
    },

    async abrirNotificacion(item) {
        const { notifId, enlace } = item.dataset;
        this.abrirNotificaciones(false);
        if (item.classList.contains('no-leida')) {
            try {
                await this.api(`/notificaciones/${notifId}/leida`, { method: 'PUT' });
            } catch (error) { /* se reintenta la próxima vez */ }
            this.actualizarResumen();
        }
        if (enlace && typeof navigateToPage === 'function') navigateToPage(this.destinoNotificacion(enlace));
    },

    // Quien no escribe órdenes médicas pero sí las traduce (enfermería) va directo a su pantalla
    destinoNotificacion(enlace) {
        if (enlace === 'ordenes-medicas' && Permisos.puede('ordenes_enfermeria', 'edit') && !Permisos.puede('ordenes_medicas', 'edit')) {
            return 'ordenes-enfermeria';
        }
        return enlace;
    },

    async marcarTodasLeidas() {
        try {
            await this.api('/notificaciones/leidas', { method: 'PUT' });
            this.renderNotificaciones(await this.api('/notificaciones'));
            this.actualizarResumen();
        } catch (error) {
            showNotification(`No se pudieron marcar como leídas. ${error.message}`, 'error');
        }
    },

    // ---------- Chat: panel ----------
    abrirChat() {
        this._focoPrevio = document.activeElement;
        document.getElementById('chatPanel').hidden = false;
        document.getElementById('chatBackdrop').hidden = false;
        document.getElementById('chatBtn').setAttribute('aria-expanded', 'true');
        document.body.classList.add('chat-abierto');
        this.mostrarLista();
    },

    cerrarChat() {
        clearInterval(this.timerChat);
        this.conversacionCon = null;
        document.getElementById('chatPanel').hidden = true;
        document.getElementById('chatBackdrop').hidden = true;
        document.getElementById('chatBtn').setAttribute('aria-expanded', 'false');
        document.body.classList.remove('chat-abierto');
        this.actualizarResumen();
        (this._focoPrevio || document.getElementById('chatBtn'))?.focus();
    },

    mostrarVista(vista, { titulo, subtitulo = '', volver = false }) {
        ['chatVistaLista', 'chatVistaNuevo', 'chatVistaConversacion'].forEach(id => {
            document.getElementById(id).hidden = id !== vista;
        });
        document.getElementById('chatTitulo').textContent = titulo;
        document.getElementById('chatSubtitulo').textContent = subtitulo;
        document.getElementById('chatVolver').hidden = !volver;
    },

    // ---------- Chat: conversaciones ----------
    async mostrarLista() {
        clearInterval(this.timerChat);
        this.conversacionCon = null;
        this.mostrarVista('chatVistaLista', { titulo: 'Mensajes' });
        document.getElementById('chatNuevoBtn').focus();
        await this.cargarConversaciones(true);
        this.timerChat = setInterval(() => {
            if (!document.hidden) this.cargarConversaciones();
        }, this.INTERVALO_LISTA);
    },

    async cargarConversaciones(mostrarCarga = false) {
        const contenedor = document.getElementById('chatConversaciones');
        if (mostrarCarga) contenedor.innerHTML = '<p class="com-vacio">Cargando…</p>';
        try {
            const conversaciones = await this.api('/conversaciones');
            if (!conversaciones.length) {
                contenedor.innerHTML = `
                    <div class="com-vacio">
                        <i class="fas fa-comments" aria-hidden="true"></i>
                        <strong>Aún no tienes conversaciones</strong>
                        <span>Usa "Nuevo mensaje" para escribirle a un compañero.</span>
                    </div>`;
                return;
            }
            contenedor.innerHTML = conversaciones.map(c => `
                <button type="button" class="chat-conv${c.no_leidos ? ' no-leida' : ''}" data-usuario-id="${c.usuario_id}">
                    <span class="user-avatar" aria-hidden="true">${this.e(this.iniciales(c))}</span>
                    <span class="chat-conv-texto">
                        <span class="chat-conv-fila">
                            <strong>${this.e(this.nombreCompleto(c))}</strong>
                            <time datetime="${this.e(c.ultimo_en)}">${this.tiempoRelativo(c.ultimo_en)}</time>
                        </span>
                        <span class="chat-conv-fila">
                            <span class="chat-conv-preview">${c.ultimo_es_mio ? 'Tú: ' : ''}${this.e(c.ultimo_mensaje)}</span>
                            ${c.no_leidos ? `<span class="com-badge-inline" aria-label="${c.no_leidos} sin leer">${c.no_leidos}</span>` : ''}
                        </span>
                    </span>
                </button>
            `).join('');
        } catch (error) {
            contenedor.innerHTML = `<p class="com-vacio">No se pudieron cargar las conversaciones. ${this.e(error.message)}</p>`;
        }
    },

    // ---------- Chat: nuevo mensaje ----------
    async mostrarNuevo() {
        clearInterval(this.timerChat);
        this.mostrarVista('chatVistaNuevo', { titulo: 'Nuevo mensaje', subtitulo: 'Elige a quién escribirle', volver: true });
        const buscador = document.getElementById('chatBuscarUsuario');
        buscador.value = '';
        buscador.focus();
        const contenedor = document.getElementById('chatUsuarios');
        contenedor.innerHTML = '<p class="com-vacio">Cargando…</p>';
        try {
            this.usuarios = await this.api('/usuarios');
            this.renderUsuarios('');
        } catch (error) {
            contenedor.innerHTML = `<p class="com-vacio">No se pudo cargar la lista de usuarios. ${this.e(error.message)}</p>`;
        }
    },

    renderUsuarios(filtro) {
        const texto = filtro.trim().toLowerCase();
        const lista = this.usuarios.filter(u =>
            !texto || `${this.nombreCompleto(u)} ${u.roles}`.toLowerCase().includes(texto));
        const contenedor = document.getElementById('chatUsuarios');
        if (!lista.length) {
            contenedor.innerHTML = `<p class="com-vacio">${this.usuarios.length ? 'Nadie coincide con la búsqueda.' : 'No hay otros usuarios activos.'}</p>`;
            return;
        }
        contenedor.innerHTML = lista.map(u => `
            <button type="button" class="chat-conv" data-usuario-id="${u.id}">
                <span class="user-avatar" aria-hidden="true">${this.e(this.iniciales(u))}</span>
                <span class="chat-conv-texto">
                    <strong>${this.e(this.nombreCompleto(u))}</strong>
                    <span class="chat-conv-preview">${this.e(u.roles || 'Sin rol')}</span>
                </span>
            </button>
        `).join('');
    },

    // ---------- Chat: conversación ----------
    async abrirConversacion(usuarioId) {
        clearInterval(this.timerChat);
        let usuario = this.usuarios.find(u => String(u.id) === String(usuarioId));
        if (!usuario) {
            try {
                this.usuarios = await this.api('/usuarios');
            } catch (error) { /* se muestra con los datos disponibles */ }
            usuario = this.usuarios.find(u => String(u.id) === String(usuarioId))
                || { id: Number(usuarioId), nombre: 'Usuario', roles: '' };
        }

        this.conversacionCon = usuario;
        this.ultimoMensajeId = 0;
        this.mostrarVista('chatVistaConversacion', {
            titulo: this.nombreCompleto(usuario),
            subtitulo: usuario.roles || '',
            volver: true
        });

        const contenedor = document.getElementById('chatMensajes');
        contenedor.innerHTML = '<p class="com-vacio">Cargando…</p>';
        document.getElementById('chatTexto').value = '';
        this.ajustarAltura();
        document.getElementById('chatTexto').focus();

        await this.cargarMensajes(true);
        this.actualizarResumen();
        this.timerChat = setInterval(() => {
            if (!document.hidden) this.cargarMensajes();
        }, this.INTERVALO_CONVERSACION);
    },

    async cargarMensajes(inicial = false) {
        const otro = this.conversacionCon;
        if (!otro) return;
        const contenedor = document.getElementById('chatMensajes');
        try {
            const mensajes = await this.api(`/mensajes/${otro.id}?despues=${this.ultimoMensajeId}`);
            if (this.conversacionCon !== otro) return; // se cambió de conversación mientras cargaba

            if (inicial) {
                contenedor.innerHTML = mensajes.length ? '' : `
                    <div class="com-vacio">
                        <i class="fas fa-comment-dots" aria-hidden="true"></i>
                        <strong>Empieza la conversación</strong>
                        <span>Los mensajes solo los ven tú y ${this.e(otro.nombre)}.</span>
                    </div>`;
            }
            if (mensajes.length) {
                contenedor.querySelector('.com-vacio')?.remove();
                this.agregarMensajes(mensajes);
            }
        } catch (error) {
            if (inicial) contenedor.innerHTML = `<p class="com-vacio">No se pudo cargar la conversación. ${this.e(error.message)}</p>`;
        }
    },

    agregarMensajes(mensajes) {
        const contenedor = document.getElementById('chatMensajes');
        const pegadoAbajo = contenedor.scrollHeight - contenedor.scrollTop - contenedor.clientHeight < 80;
        let ultimoDia = contenedor.dataset.ultimoDia || '';

        const html = mensajes.map(m => {
            const dia = new Date(m.created_at).toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });
            const separador = dia !== ultimoDia ? `<div class="chat-dia">${this.e(dia)}</div>` : '';
            ultimoDia = dia;
            const mio = m.remitente_id === this.yo;
            return `${separador}
                <div class="chat-msg ${mio ? 'mio' : 'suyo'}">
                    <p>${this.e(m.contenido)}</p>
                    <time datetime="${this.e(m.created_at)}">${this.hora(m.created_at)}</time>
                </div>`;
        }).join('');

        contenedor.dataset.ultimoDia = ultimoDia;
        contenedor.insertAdjacentHTML('beforeend', html);
        this.ultimoMensajeId = Math.max(this.ultimoMensajeId, ...mensajes.map(m => m.id));
        if (pegadoAbajo || mensajes.some(m => m.remitente_id === this.yo)) {
            contenedor.scrollTop = contenedor.scrollHeight;
        }
    },

    async enviar(event) {
        event.preventDefault();
        const campo = document.getElementById('chatTexto');
        const contenido = campo.value.trim();
        if (!contenido || !this.conversacionCon || this.enviando) return;

        this.enviando = true;
        document.getElementById('chatEnviar').disabled = true;
        try {
            const mensaje = await this.api('/mensajes', {
                method: 'POST',
                body: JSON.stringify({ destinatario_id: this.conversacionCon.id, contenido })
            });
            campo.value = '';
            this.ajustarAltura();
            document.getElementById('chatMensajes').querySelector('.com-vacio')?.remove();
            if (mensaje.id > this.ultimoMensajeId) this.agregarMensajes([mensaje]);
        } catch (error) {
            showNotification(`No se envió el mensaje. ${error.message}`, 'error');
        } finally {
            this.enviando = false;
            document.getElementById('chatEnviar').disabled = false;
            campo.focus();
        }
    },

    ajustarAltura() {
        const campo = document.getElementById('chatTexto');
        campo.style.height = 'auto';
        campo.style.height = `${Math.min(campo.scrollHeight, 140)}px`;
        campo.style.overflowY = campo.scrollHeight > 140 ? 'auto' : 'hidden';
    },

    // ---------- Arranque ----------
    init() {
        this.yo = authManager.getUser()?.id ?? null;

        const notifBtn = document.getElementById('notifBtn');
        const notifPanel = document.getElementById('notifPanel');
        notifBtn.addEventListener('click', e => {
            e.stopPropagation();
            this.abrirNotificaciones(notifPanel.hidden);
        });
        document.addEventListener('click', e => {
            if (!notifPanel.hidden && !notifPanel.contains(e.target)) this.abrirNotificaciones(false);
        });
        document.getElementById('notifLista').addEventListener('click', e => {
            const item = e.target.closest('[data-notif-id]');
            if (item) this.abrirNotificacion(item);
        });
        document.getElementById('notifMarcarTodas').addEventListener('click', e => {
            e.stopPropagation();
            this.marcarTodasLeidas();
        });

        document.getElementById('chatBtn').addEventListener('click', () => this.abrirChat());
        document.getElementById('chatCerrar').addEventListener('click', () => this.cerrarChat());
        document.getElementById('chatBackdrop').addEventListener('click', () => this.cerrarChat());
        document.getElementById('chatVolver').addEventListener('click', () => this.mostrarLista());
        document.getElementById('chatNuevoBtn').addEventListener('click', () => this.mostrarNuevo());
        document.getElementById('chatBuscarUsuario').addEventListener('input', e => this.renderUsuarios(e.target.value));
        ['chatConversaciones', 'chatUsuarios'].forEach(id => {
            document.getElementById(id).addEventListener('click', e => {
                const item = e.target.closest('[data-usuario-id]');
                if (item) this.abrirConversacion(item.dataset.usuarioId);
            });
        });

        const texto = document.getElementById('chatTexto');
        document.getElementById('chatForm').addEventListener('submit', e => this.enviar(e));
        texto.addEventListener('input', () => this.ajustarAltura());
        texto.addEventListener('keydown', e => {
            // Enter envía; Shift+Enter hace salto de línea
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                document.getElementById('chatForm').requestSubmit();
            }
        });

        // El foco no sale del panel de mensajes mientras está abierto
        const chatPanel = document.getElementById('chatPanel');
        chatPanel.addEventListener('keydown', e => {
            if (e.key !== 'Tab') return;
            const enfocables = [...chatPanel.querySelectorAll('button, textarea, input, [tabindex]:not([tabindex="-1"])')]
                .filter(el => !el.disabled && el.offsetParent !== null);
            if (!enfocables.length) return;
            const primero = enfocables[0];
            const ultimo = enfocables[enfocables.length - 1];
            if (e.shiftKey && document.activeElement === primero) {
                e.preventDefault();
                ultimo.focus();
            } else if (!e.shiftKey && document.activeElement === ultimo) {
                e.preventDefault();
                primero.focus();
            }
        });

        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            if (!notifPanel.hidden) {
                this.abrirNotificaciones(false);
                notifBtn.focus();
            } else if (!document.getElementById('chatPanel').hidden) {
                this.cerrarChat();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.actualizarResumen();
        });

        this.actualizarResumen();
        this.iniciarSondeo();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof authManager === 'undefined' || !authManager.isAuthenticated()) return;
    Comunicacion.init();
});
