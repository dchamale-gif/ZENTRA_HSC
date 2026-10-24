// ============================================
// TEMA CLARO / OSCURO POR PERFIL
// ============================================
// Cada usuario elige Claro, Oscuro o Automático (el del sistema operativo) en el menú
// de su perfil. Se guarda en su usuario (servidor) y en este equipo, para aplicarlo
// antes de pintar la página (ver el script del <head> de index.html).

const Tema = {
    CLAVE: 'zentra_tema',
    OPCIONES: [
        { valor: 'claro', texto: 'Claro', icono: 'fa-sun' },
        { valor: 'oscuro', texto: 'Oscuro', icono: 'fa-moon' },
        { valor: 'sistema', texto: 'Automático', icono: 'fa-circle-half-stroke' }
    ],
    consultaOscuro: window.matchMedia('(prefers-color-scheme: dark)'),

    preferido() {
        try {
            const guardado = localStorage.getItem(this.CLAVE);
            if (this.OPCIONES.some(o => o.valor === guardado)) return guardado;
        } catch (error) { /* sin almacenamiento */ }
        return 'claro';
    },

    // Pone data-theme en <html>; "sistema" sigue al sistema operativo
    aplicar(tema = this.preferido()) {
        const oscuro = tema === 'oscuro' || (tema === 'sistema' && this.consultaOscuro.matches);
        document.documentElement.dataset.theme = oscuro ? 'dark' : 'light';
        document.querySelectorAll('[data-tema-opcion]').forEach(boton => {
            boton.setAttribute('aria-checked', String(boton.dataset.temaOpcion === tema));
        });
    },

    guardarLocal(tema) {
        try { localStorage.setItem(this.CLAVE, tema); } catch (error) { /* sin almacenamiento */ }
    },

    // El tema del perfil manda: al entrar con otro usuario en este equipo se usa el suyo
    sincronizar(usuario) {
        if (!usuario?.tema || usuario.tema === this.preferido()) return;
        this.guardarLocal(usuario.tema);
        this.aplicar(usuario.tema);
    },

    async elegir(tema) {
        const anterior = this.preferido();
        this.guardarLocal(tema);
        this.aplicar(tema);
        if (typeof authManager === 'undefined') return;
        const usuario = authManager.getUser();
        if (usuario) authManager.saveUser({ ...usuario, tema });
        try {
            const response = await authManager.fetchWithAuth('/api/auth/preferencias', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tema })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
        } catch (error) {
            // El tema ya se ve en este equipo; solo no quedó en el perfil
            if (anterior !== tema && typeof showNotification === 'function') {
                showNotification(`El tema se aplicó en este equipo, pero no se guardó en su perfil: ${error.message}`, 'warning');
            }
        }
    },

    // Selector de tema dentro del menú del usuario, antes de "Cerrar sesión"
    crearSelector() {
        const panel = document.getElementById('userMenuPanel');
        if (!panel || panel.querySelector('.user-menu-tema')) return;
        const grupo = document.createElement('div');
        grupo.className = 'user-menu-tema';
        grupo.innerHTML = `
            <span class="user-menu-tema-titulo" id="userMenuTemaTitulo">Tema</span>
            <div class="user-menu-tema-opciones" role="radiogroup" aria-labelledby="userMenuTemaTitulo">
                ${this.OPCIONES.map(o => `
                    <button type="button" role="radio" aria-checked="false" data-tema-opcion="${o.valor}">
                        <i class="fas ${o.icono}" aria-hidden="true"></i> ${o.texto}
                    </button>`).join('')}
            </div>`;
        panel.insertBefore(grupo, panel.querySelector('[data-action="logout"]'));
        grupo.addEventListener('click', (e) => {
            e.stopPropagation();
            const boton = e.target.closest('[data-tema-opcion]');
            if (boton) this.elegir(boton.dataset.temaOpcion);
        });
        // Flechas para moverse entre las opciones, como en un grupo de radios
        grupo.addEventListener('keydown', (e) => {
            if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            e.preventDefault();
            const botones = [...grupo.querySelectorAll('[data-tema-opcion]')];
            const actual = botones.indexOf(document.activeElement);
            const siguiente = botones[(actual + (e.key === 'ArrowRight' ? 1 : -1) + botones.length) % botones.length];
            siguiente.focus();
            this.elegir(siguiente.dataset.temaOpcion);
        });
    },

    init() {
        const usuario = typeof authManager !== 'undefined' ? authManager.getUser() : null;
        if (usuario?.tema) this.guardarLocal(usuario.tema);
        this.crearSelector();
        this.aplicar();
        this.consultaOscuro.addEventListener('change', () => {
            if (this.preferido() === 'sistema') this.aplicar('sistema');
        });
        // Lo impreso siempre sale en claro
        window.addEventListener('beforeprint', () => { document.documentElement.dataset.theme = 'light'; });
        window.addEventListener('afterprint', () => this.aplicar());
    }
};

window.Tema = Tema;
Tema.aplicar();
document.addEventListener('DOMContentLoaded', () => Tema.init());
