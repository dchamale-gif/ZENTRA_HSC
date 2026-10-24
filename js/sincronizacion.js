// ============================================
// SINCRONIZACIÓN ENTRE PANTALLAS Y VENTANAS
// Órdenes médicas, órdenes de enfermería e historia clínica se mantienen al día entre sí:
// - Lo que se guarda en una pantalla se avisa a las demás, también a otras ventanas
//   o pestañas del mismo navegador.
// - La pantalla a la vista vuelve a consultar al servidor cada 30 s y al regresar
//   a la ventana, para recoger lo que guardaron otros usuarios.
// ============================================

const ZentraSync = {
    EVENTO: 'zentra:ordenes-cambiaron',
    CLAVE: 'zentra-sync',
    INTERVALO: 30000,
    canal: null,
    vistas: {},

    init() {
        if ('BroadcastChannel' in window) {
            this.canal = new BroadcastChannel(this.CLAVE);
            this.canal.onmessage = e => this.emitir({ ...e.data, remoto: true });
        } else {
            window.addEventListener('storage', e => {
                if (e.key !== this.CLAVE || !e.newValue) return;
                try { this.emitir({ ...JSON.parse(e.newValue), remoto: true }); } catch (error) { /* mensaje ilegible */ }
            });
        }
        setInterval(() => this.refrescarVisible(), this.INTERVALO);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.refrescarVisible();
        });
    },

    emitir(detalle) {
        document.dispatchEvent(new CustomEvent(this.EVENTO, { detail: detalle }));
    },

    // Avisa a esta ventana y a las demás abiertas. detalle: { pacienteId, origen }
    avisar(detalle = {}) {
        this.emitir(detalle);
        const mensaje = { ...detalle, momento: Date.now() };
        if (this.canal) {
            this.canal.postMessage(mensaje);
        } else {
            try { localStorage.setItem(this.CLAVE, JSON.stringify(mensaje)); } catch (error) { /* sin almacenamiento */ }
        }
    },

    // Cada pantalla indica cómo refrescarse; cada una decide si puede hacerlo sin perder lo que se escribe
    registrar(pagina, refrescar) {
        (this.vistas[pagina] ||= []).push(refrescar);
    },

    estaVisible(pagina) {
        return !document.hidden && typeof currentPage !== 'undefined' && currentPage === pagina;
    },

    refrescarVisible() {
        if (document.hidden || typeof currentPage === 'undefined') return;
        (this.vistas[currentPage] || []).forEach(refrescar => {
            Promise.resolve(refrescar()).catch(() => { /* se reintenta en el próximo ciclo */ });
        });
    }
};

ZentraSync.init();
