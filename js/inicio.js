// ============================================
// INICIO - CENTRO DE INFORMACIÓN
// Reúne en un solo lugar los indicadores financieros (en quetzales)
// y operativos de la clínica, a partir de los reportes del backend.
// ============================================

const InicioModule = {
    cargando: false,

    init() {
        this.renderClinica();
        document.addEventListener('zentra:clinica-actualizada', () => this.renderClinica());
        document.getElementById('inicioRefreshBtn')?.addEventListener('click', () => this.refresh());
        document.querySelectorAll('[data-goto]').forEach(el => {
            el.addEventListener('click', event => {
                event.preventDefault();
                navigateToPage(el.dataset.goto);
            });
        });
        this.refresh();
    },

    // Fecha de hoy y primer día del mes en hora de Guatemala (YYYY-MM-DD)
    rangoMes() {
        const hoy = new Date().toLocaleDateString('en-CA', { timeZone: CONFIG.REGION.timeZone });
        return { inicio: `${hoy.slice(0, 8)}01`, fin: hoy };
    },

    async fetchJSON(path) {
        const res = await fetch(`${APIHelper.baseURL}${path}`, { headers: APIHelper.getHeaders() });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || `Error en ${path}`);
        return data.data;
    },

    async refresh() {
        if (this.cargando) return;
        this.cargando = true;
        const contenedor = document.getElementById('page-dashboard');
        contenedor?.setAttribute('aria-busy', 'true');

        const { inicio, fin } = this.rangoMes();
        const [finanzas, operacion] = await Promise.allSettled([
            this.fetchJSON(`/reports/financial-summary?startDate=${inicio}&endDate=${fin}`),
            this.fetchJSON('/reports/executive-summary')
        ]);

        this.renderFinanzas(finanzas.status === 'fulfilled' ? finanzas.value : null);
        this.renderOperacion(operacion.status === 'fulfilled' ? operacion.value : null);

        const actualizado = document.getElementById('inicioActualizado');
        if (actualizado) actualizado.textContent = `Actualizado ${formatFechaHora()}`;

        contenedor?.removeAttribute('aria-busy');
        this.cargando = false;
    },

    setValor(id, valor) {
        const el = document.getElementById(id);
        if (el) el.textContent = valor;
    },

    renderClinica() {
        const c = CONFIG.CLINICA;
        this.setValor('inicioClinicaNombre', c.nombre || 'Zentra MED');
        const detalle = [c.nit && `NIT ${c.nit}`, [c.municipio, c.departamento].filter(Boolean).join(', ')]
            .filter(Boolean).join(' · ');
        this.setValor('inicioClinicaDetalle', detalle);
    },

    renderFinanzas(d) {
        const sinDatos = '—';
        this.setValor('kpiIngresos', d ? formatQ(d.ingresos) : sinDatos);
        this.setValor('kpiEgresos', d ? formatQ(d.egresos) : sinDatos);
        this.setValor('kpiPorCobrar', d ? formatQ(d.saldoPorCobrar) : sinDatos);
        this.setValor('kpiMargen', d ? `${Number(d.margenNeto || 0).toFixed(1)}%` : sinDatos);

        const ganancia = Number(d?.ganancia || 0);
        const gananciaEl = document.getElementById('kpiGanancia');
        if (gananciaEl) {
            gananciaEl.textContent = d ? `Utilidad: ${formatQ(ganancia)}` : 'No se pudo conectar con el servidor';
            gananciaEl.className = `kpi-change ${!d ? '' : ganancia >= 0 ? 'positive' : 'negative'}`;
        }
        this.setValor('kpiCobros', d ? `Cobrado este mes: ${formatQ(d.cobrosRecibidos)}` : '');
    },

    renderOperacion(d) {
        const n = valor => (d ? Number(valor || 0).toLocaleString(CONFIG.REGION.locale) : '—');
        this.setValor('opPacientes', n(d?.pacientesActivos));
        this.setValor('opCitas', n(d?.citasHoy));
        this.setValor('opOrdenes', n(d?.ordenesPendientes));
        this.setValor('opCamas', d ? `${n(d.camasOcupadas)} / ${n(d.camasTotales)}` : '—');
        this.setValor('opHospitalizados', n(d?.hospitalizacionesActivas));
        this.setValor('opPersonal', n(d?.personalActivo));

        const lista = document.getElementById('inicioAlertas');
        if (!lista) return;
        const alertas = d?.alertas || [];
        lista.innerHTML = alertas.length
            ? alertas.map(a => `<li class="inicio-alerta ${a.tipo === 'critica' ? 'critica' : ''}">
                    <i class="fas ${a.tipo === 'critica' ? 'fa-circle-exclamation' : 'fa-circle-info'}" aria-hidden="true"></i>
                    <span>${a.mensaje}</span></li>`).join('')
            : `<li class="inicio-alerta vacia"><i class="fas fa-circle-check" aria-hidden="true"></i><span>${d ? 'Sin alertas operativas.' : 'Sin conexión con el servidor. Revisa tu sesión y vuelve a actualizar.'}</span></li>`;
    }
};

window.InicioModule = InicioModule;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => InicioModule.init());
} else {
    InicioModule.init();
}
