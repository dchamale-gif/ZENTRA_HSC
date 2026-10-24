// ============================================
// BUSCADOR CON LISTADO DESPLEGABLE REUTILIZABLE
// ============================================
// Agrega un listado de coincidencias en vivo a cualquier campo de búsqueda,
// conservando el filtro que cada módulo ya aplica sobre su tabla.

const LiveSearch = {
    instances: [],
    activeInstance: null,
    ready: false,

    normalize(value) {
        return String(value ?? '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    },

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[char]);
    },

    // Evalúa un callback del config sin romper la búsqueda si el dato viene incompleto.
    safeCall(fn, record, fallback = '') {
        try {
            const value = fn(record);
            return value === undefined || value === null ? fallback : value;
        } catch (error) {
            return fallback;
        }
    },

    records(instance) {
        try {
            const data = instance.source();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    },

    attach(config) {
        const input = typeof config.input === 'string'
            ? document.getElementById(config.input)
            : config.input;

        if (!input || input.dataset.liveSearch === 'on') return null;

        input.dataset.liveSearch = 'on';
        input.setAttribute('autocomplete', 'off');

        const dropdown = document.createElement('div');
        dropdown.className = 'live-search-results';
        dropdown.hidden = true;
        document.body.appendChild(dropdown);

        const instance = {
            input,
            dropdown,
            source: config.source,
            label: config.label,
            meta: config.meta || (() => ''),
            extra: config.extra || (() => ''),
            query: config.query || config.label,
            container: config.container || null,
            limit: config.limit || 8,
            emptyText: config.emptyText || 'Sin coincidencias',
            onSelect: config.onSelect || null,
            matches: [],
            activeIndex: -1
        };

        input.addEventListener('input', () => this.open(instance));
        input.addEventListener('focus', () => this.open(instance));
        input.addEventListener('keydown', event => this.onKeyDown(instance, event));
        input.addEventListener('blur', () => setTimeout(() => this.close(instance), 150));

        // mousedown por defecto quitaría el foco del input antes del click.
        dropdown.addEventListener('mousedown', event => event.preventDefault());
        dropdown.addEventListener('click', event => {
            const option = event.target.closest('.live-search-option');
            if (!option) return;
            const record = instance.matches[Number(option.dataset.index)];
            if (record) this.select(instance, record);
        });

        this.instances.push(instance);
        return instance;
    },

    filter(instance, term) {
        const words = this.normalize(term).split(/\s+/).filter(Boolean);
        const all = this.records(instance);

        if (!words.length) return all.slice(0, instance.limit);

        const matches = [];
        for (const record of all) {
            const haystack = this.normalize([
                this.safeCall(instance.label, record),
                this.safeCall(instance.meta, record),
                this.safeCall(instance.extra, record)
            ].join(' '));

            if (words.every(word => haystack.includes(word))) {
                matches.push(record);
                if (matches.length >= instance.limit) break;
            }
        }
        return matches;
    },

    // Resalta las coincidencias sin romper el escapado de HTML.
    highlightText(value, words) {
        const raw = String(value ?? '');
        const safe = this.escapeHtml(raw);
        if (!words.length) return safe;

        const normalized = this.normalize(raw);
        // El mapeo por índice sólo es fiable si normalizar no cambió la longitud.
        if (normalized.length !== raw.length) return safe;

        const ranges = [];
        for (const word of words) {
            let from = 0;
            while (from <= normalized.length - word.length) {
                const index = normalized.indexOf(word, from);
                if (index === -1) break;
                ranges.push([index, index + word.length]);
                from = index + word.length;
            }
        }
        if (!ranges.length) return safe;

        ranges.sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (const range of ranges) {
            const last = merged[merged.length - 1];
            if (last && range[0] <= last[1]) {
                last[1] = Math.max(last[1], range[1]);
            } else {
                merged.push([range[0], range[1]]);
            }
        }

        let output = '';
        let cursor = 0;
        for (const [start, end] of merged) {
            output += this.escapeHtml(raw.slice(cursor, start));
            output += `<mark>${this.escapeHtml(raw.slice(start, end))}</mark>`;
            cursor = end;
        }
        return output + this.escapeHtml(raw.slice(cursor));
    },

    render(instance, term) {
        if (!instance.matches.length) {
            instance.dropdown.innerHTML =
                `<div class="live-search-empty">${this.escapeHtml(instance.emptyText)}</div>`;
            return;
        }

        const words = this.normalize(term).split(/\s+/).filter(Boolean);
        instance.dropdown.innerHTML = instance.matches.map((record, index) => {
            const label = this.highlightText(this.safeCall(instance.label, record), words);
            const meta = this.safeCall(instance.meta, record);
            const active = index === instance.activeIndex ? ' is-active' : '';
            return `<button type="button" class="live-search-option${active}" data-index="${index}">
                <strong>${label}</strong>
                ${meta ? `<small>${this.escapeHtml(meta)}</small>` : ''}
            </button>`;
        }).join('');
    },

    position(instance) {
        const rect = instance.input.getBoundingClientRect();
        const dropdown = instance.dropdown;
        const spaceBelow = window.innerHeight - rect.bottom;

        dropdown.style.left = `${rect.left}px`;
        dropdown.style.width = `${rect.width}px`;

        if (spaceBelow < 160 && rect.top > spaceBelow) {
            dropdown.style.top = 'auto';
            dropdown.style.bottom = `${window.innerHeight - rect.top + 4}px`;
        } else {
            dropdown.style.bottom = 'auto';
            dropdown.style.top = `${rect.bottom + 4}px`;
        }
    },

    open(instance) {
        // Evita que los eventos sintéticos de select() reabran el listado.
        if (instance.suppressOpen) return;

        const term = instance.input.value;
        instance.matches = this.filter(instance, term);
        instance.activeIndex = -1;
        this.render(instance, term);
        instance.dropdown.hidden = false;
        this.position(instance);
        this.activeInstance = instance;
    },

    close(instance) {
        instance.dropdown.hidden = true;
        instance.activeIndex = -1;
        if (this.activeInstance === instance) this.activeInstance = null;
    },

    onKeyDown(instance, event) {
        if (event.key === 'Escape') {
            this.close(instance);
            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (instance.dropdown.hidden) {
                this.open(instance);
                return;
            }
            if (!instance.matches.length) return;

            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            const total = instance.matches.length;
            instance.activeIndex = (instance.activeIndex + step + total) % total;
            this.render(instance, instance.input.value);

            const active = instance.dropdown.querySelector('.is-active');
            if (active) active.scrollIntoView({ block: 'nearest' });
            return;
        }

        if (event.key === 'Enter' && !instance.dropdown.hidden && instance.activeIndex >= 0) {
            const record = instance.matches[instance.activeIndex];
            if (record) {
                event.preventDefault();
                this.select(instance, record);
            }
        }
    },

    select(instance, record) {
        const value = String(this.safeCall(instance.query, record));
        instance.suppressOpen = true;
        instance.input.value = value;

        // Reutiliza el filtro propio de cada módulo (input, keyup inline o change).
        instance.input.dispatchEvent(new Event('input', { bubbles: true }));
        instance.input.dispatchEvent(new Event('keyup', { bubbles: true }));
        instance.input.dispatchEvent(new Event('change', { bubbles: true }));
        instance.suppressOpen = false;

        this.close(instance);

        if (typeof instance.onSelect === 'function') {
            instance.onSelect(record, instance);
            return;
        }
        this.highlightRow(instance, value);
    },

    highlightRow(instance, value) {
        if (!instance.container) return;
        const container = document.getElementById(instance.container);
        if (!container) return;

        const needle = this.normalize(value).trim();
        if (!needle) return;

        requestAnimationFrame(() => {
            let rows = container.querySelectorAll('tbody tr');
            if (!rows.length) rows = container.querySelectorAll('tr');
            const list = rows.length ? Array.from(rows) : Array.from(container.children);

            const hit = list.find(row => this.normalize(row.textContent).includes(needle));
            if (!hit) return;

            document.querySelectorAll('.live-search-hit')
                .forEach(row => row.classList.remove('live-search-hit'));
            hit.classList.add('live-search-hit');
            hit.scrollIntoView({ block: 'center', behavior: 'smooth' });
            setTimeout(() => hit.classList.remove('live-search-hit'), 2400);
        });
    },

    init() {
        if (this.ready) return;
        this.ready = true;

        const reposition = () => {
            if (this.activeInstance) this.position(this.activeInstance);
        };
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);

        this.registerDefaults();
    },

    // ============================================
    // REGISTRO DE BUSCADORES DEL SISTEMA
    // ============================================

    patientName(patient) {
        return [
            patient.nombre,
            patient.apellidoPaterno || patient.apellido_paterno,
            patient.apellidoMaterno || patient.apellido_materno
        ].filter(Boolean).join(' ').trim() || 'Paciente sin nombre';
    },

    patientMeta(patient) {
        const dpi = patient.dpi || patient.cedula || 'Sin DPI';
        const contact = patient.email || patient.telefono || 'Sin contacto';
        return `${dpi} · ${contact}`;
    },

    // Prefiere un dato único (DPI) para que el filtro aísle un solo registro.
    patientQuery(patient) {
        return patient.dpi || patient.cedula || this.patientName(patient);
    },

    // Las órdenes solo guardan pacienteId; el nombre vive en el catálogo del módulo.
    ordenPacienteNombre(orden) {
        if (typeof OrdenesmedicasModule === 'undefined') return '';
        const pacientes = OrdenesmedicasModule.state?.pacientes || [];
        const paciente = pacientes.find(p => String(p.id) === String(orden.pacienteId));
        return paciente ? this.patientName(paciente) : '';
    },

    registerDefaults() {
        const patients = () => (typeof PacientesModule !== 'undefined'
            ? PacientesModule.state?.pacientes : []) || [];

        // --- Pacientes ---
        this.attach({
            input: 'searchPacient',
            source: patients,
            label: p => this.patientName(p),
            meta: p => this.patientMeta(p),
            query: p => this.patientQuery(p),
            extra: p => `${p.telefono || ''} ${p.email || ''}`,
            container: 'pacientesTableContainer',
            emptyText: 'Sin pacientes que coincidan'
        });

        // --- Historia Clínica ---
        this.attach({
            input: 'searchPacientHistoria',
            source: () => (typeof HistoriaClinicaModule !== 'undefined'
                ? HistoriaClinicaModule.state?.pacientes : patients()) || [],
            label: p => this.patientName(p),
            meta: p => this.patientMeta(p),
            query: p => this.patientName(p),
            container: 'pacientesHistoriaList',
            emptyText: 'Sin pacientes que coincidan'
        });

        // --- Saldo del Paciente ---
        this.attach({
            input: 'searchSaldo',
            source: () => (typeof SaldoPacienteModule !== 'undefined'
                ? SaldoPacienteModule.state?.pacientes : patients()) || [],
            label: p => this.patientName(p),
            meta: p => this.patientMeta(p),
            query: p => this.patientQuery(p),
            container: 'tablaSaldos',
            emptyText: 'Sin pacientes que coincidan'
        });

        // --- Personal Médico (doctores) ---
        this.attach({
            input: 'searchPersonal',
            source: () => (typeof PersonalModule !== 'undefined'
                ? PersonalModule.state?.personal : []) || [],
            label: d => `${d.nombre || ''} ${d.apellidoPaterno || ''}`.trim() || 'Sin nombre',
            meta: d => `${d.especialidad || 'Sin especialidad'} · ${d.numeroColegiado || d.email || ''}`,
            // El filtro de PersonalModule compara contra "nombre apellidoPaterno".
            query: d => `${d.nombre || ''} ${d.apellidoPaterno || ''}`.trim(),
            extra: d => `${d.email || ''} ${d.numeroColegiado || ''}`,
            container: 'personalTable',
            emptyText: 'Sin personal que coincida'
        });

        // --- Personal (administrativo y de apoyo) ---
        this.attach({
            input: 'searchEmpleados',
            source: () => (typeof PersonalGeneralModule !== 'undefined'
                ? PersonalGeneralModule.state?.personal : []) || [],
            label: d => `${d.nombre || ''} ${d.apellidoPaterno || ''}`.trim() || 'Sin nombre',
            meta: d => [d.puesto, d.area].filter(Boolean).join(' · '),
            query: d => `${d.nombre || ''} ${d.apellidoPaterno || ''}`.trim(),
            extra: d => `${d.email || ''} ${d.puesto || ''} ${d.area || ''}`,
            container: 'empleadosTable',
            emptyText: 'Sin personal que coincida'
        });

        // --- Medicinas ---
        this.attach({
            input: 'searchMedicine',
            source: () => (typeof MedicinasModule !== 'undefined'
                ? MedicinasModule.state?.medicinas : []) || [],
            label: m => m.nombre || 'Medicina sin nombre',
            meta: m => [
                m.principioActivo,
                m.dosis && `${m.dosis} ${m.unidadDosis || ''}`.trim(),
                m.presentacion,
                m.lote && `Lote ${m.lote}`,
                m.codigoBarra,
                m.activo === false && 'Inactiva'
            ].filter(Boolean).join(' · '),
            query: m => m.nombre || '',
            // Mismos campos que usa la búsqueda del listado de medicinas
            extra: m => (typeof MedicinasModule !== 'undefined' && MedicinasModule.textoBusqueda)
                ? MedicinasModule.textoBusqueda(m) : '',
            container: 'medicinesTableContainer',
            emptyText: 'Sin medicinas que coincidan'
        });

        // --- Códigos de Artículos ---
        this.attach({
            input: 'searchArticulos',
            source: () => (typeof CodigosArticulosModule !== 'undefined'
                ? CodigosArticulosModule.state?.articulos : []) || [],
            label: a => a.nombre || 'Artículo sin nombre',
            meta: a => [a.concepto, a.codigoVenta, a.codigoCompra].filter(Boolean).join(' · '),
            query: a => a.codigoVenta || a.nombre || '',
            container: 'articulosTableContainer',
            emptyText: 'Sin artículos que coincidan'
        });

        // --- Órdenes Médicas ---
        this.attach({
            input: 'searchOrdenMedica',
            source: () => (typeof OrdenesmedicasModule !== 'undefined'
                ? OrdenesmedicasModule.state?.ordenes : []) || [],
            label: o => this.ordenPacienteNombre(o) || `Orden ${o.id}`,
            meta: o => [o.id, o.descripcion].filter(Boolean).join(' · '),
            query: o => String(o.id || ''),
            extra: o => `${this.ordenPacienteNombre(o)} ${o.descripcion || ''} ${o.estado || ''}`,
            container: 'ordenesTable',
            emptyText: 'Sin órdenes que coincidan'
        });

        // --- Movimientos de Caja ---
        this.attach({
            input: 'searchMovimientos',
            source: () => (typeof CajaModule !== 'undefined'
                ? CajaModule.state?.movimientos : []) || [],
            label: m => m.descripcion || m.tipo || 'Movimiento',
            meta: m => [m.tipo, m.cliente, m.referencia, m.fecha].filter(Boolean).join(' · '),
            query: m => String(m.id || m.referencia || m.descripcion || ''),
            extra: m => `${m.cliente || ''} ${m.referencia || ''}`,
            container: 'movementsTable',
            emptyText: 'Sin movimientos que coincidan'
        });

        // --- Inventario ---
        this.attach({
            input: 'searchProduct',
            source: () => (typeof getProductsData === 'function' ? getProductsData() : []),
            label: p => p.name || 'Producto',
            meta: p => [p.category, p.id].filter(Boolean).join(' · '),
            query: p => p.name || '',
            container: 'inventoryTable',
            emptyText: 'Sin productos que coincidan'
        });

        // --- Buscadores dentro de modales (seleccionan paciente) ---
        this.attach({
            input: 'modalSearchPaciente',
            source: patients,
            label: p => this.patientName(p),
            meta: p => this.patientMeta(p),
            query: p => this.patientQuery(p),
            emptyText: 'Sin pacientes que coincidan'
        });

        this.attach({
            input: 'modalBuscaPacienteEstado',
            source: patients,
            label: p => this.patientName(p),
            meta: p => this.patientMeta(p),
            query: p => this.patientQuery(p),
            emptyText: 'Sin pacientes que coincidan'
        });

        // --- Facturación: pacientes, productos y pagos ---
        const facturacion = () => (typeof SaldoPacienteFacturacion !== 'undefined'
            ? SaldoPacienteFacturacion.state : null);

        this.attach({
            input: 'modalBuscaPacienteFactura',
            source: () => facturacion()?.pacientes || [],
            label: p => this.patientName(p),
            meta: p => this.patientMeta(p),
            query: p => this.patientQuery(p),
            container: 'tablaPacientesFactura',
            emptyText: 'Sin pacientes que coincidan'
        });

        this.attach({
            input: 'modalBuscaProducto',
            source: () => facturacion()?.productos || [],
            label: p => p.concepto || p.nombre || p.subfamilia || p.familia || 'Producto',
            meta: p => [p.codigo_venta || p.codigo_compra, p.familia, p.subfamilia]
                .filter(Boolean).join(' · '),
            // filtrarProductos() compara contra nombre, código, familia y subfamilia.
            query: p => p.codigo_venta || p.concepto || p.nombre || '',
            extra: p => `${p.familia || ''} ${p.subfamilia || ''}`,
            container: 'tablaProductosFactura',
            emptyText: 'Sin productos que coincidan'
        });

        this.attach({
            input: 'buscarPago',
            source: () => facturacion()?.pagos_realizados || [],
            label: p => p.referencia || p.voucher || p.numero_cheque || `Pago ${p.id || ''}`.trim(),
            meta: p => [p.metodo, p.monto != null ? formatQ(p.monto) : '', p.fecha]
                .filter(Boolean).join(' · '),
            // buscarPagos() sólo filtra por referencia, voucher o número de cheque.
            query: p => p.referencia || p.voucher || p.numero_cheque || '',
            container: 'tablaPagosRealizados',
            emptyText: 'Sin pagos que coincidan'
        });

        // En Órdenes Médicas el modal usa un <select>: lo sincronizamos al elegir.
        this.attach({
            input: 'buscarPacienteOrden',
            source: () => (typeof OrdenesmedicasModule !== 'undefined'
                ? OrdenesmedicasModule.state?.pacientes : patients()) || [],
            label: p => this.patientName(p),
            meta: p => this.patientMeta(p),
            query: p => {
                const nombre = [p.nombre, p.apellidoPaterno || p.apellido_paterno,
                    p.apellidoMaterno || p.apellido_materno].filter(Boolean).join(' ').trim();
                return nombre || p.dpi || p.cedula || '';
            },
            emptyText: 'Sin pacientes que coincidan',
            onSelect: record => {
                const select = document.getElementById('ordenPacienteId');
                if (!select) return;
                select.value = String(record.id);
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => LiveSearch.init());
} else {
    LiveSearch.init();
}
