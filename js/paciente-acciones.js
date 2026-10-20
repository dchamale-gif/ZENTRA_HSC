// ============================================
// ACCIONES RÁPIDAS DEL PACIENTE
// En Gestión de Pacientes, al hacer clic en un paciente aparece un menú con
// sus registros clínicos; cada opción abre su popup sin entrar a la ficha.
// ============================================

const PacienteAccionesModule = {
    OPCIONES: [
        { clave: 'historia', icono: 'fa-notes-medical', texto: 'Historia clínica' },
        { clave: 'evolucion', icono: 'fa-chart-line', texto: 'Evolución' },
        { clave: 'medicamentos', icono: 'fa-pills', texto: 'Control de medicamentos' },
        { clave: 'laboratorios', icono: 'fa-flask', texto: 'Laboratorios' },
        { clave: 'cotizacion', icono: 'fa-file-invoice-dollar', texto: 'Cotización' }
    ],

    init() {
        if (this._iniciado) return;
        this._iniciado = true;

        document.addEventListener('click', e => {
            const menu = document.getElementById('pacAccionesMenu');
            const opcion = e.target.closest('#pacAccionesMenu [data-opcion]');
            if (opcion) {
                this.cerrarMenu();
                this.ejecutar(opcion.dataset.opcion, menu.dataset.pacienteId);
                return;
            }
            if (menu && !menu.contains(e.target)) this.cerrarMenu();

            // Clic en una fila de la tabla de pacientes (no en sus botones)
            const fila = e.target.closest('#pacientesTableContainer tr[data-pacient-id]');
            if (fila && !e.target.closest('button, a, input, select')) {
                this.abrirMenu(fila.dataset.pacientId, e.clientX, e.clientY, fila);
            }
        });

        document.addEventListener('keydown', e => {
            const fila = e.target.closest?.('#pacientesTableContainer tr[data-pacient-id]');
            if (fila && e.target === fila && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                const r = fila.getBoundingClientRect();
                this.abrirMenu(fila.dataset.pacientId, r.left + 24, r.bottom, fila);
                return;
            }
            const menu = document.getElementById('pacAccionesMenu');
            if (menu && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
                e.preventDefault();
                const botones = [...menu.querySelectorAll('[data-opcion]')];
                const actual = botones.indexOf(document.activeElement);
                const siguiente = (actual + (e.key === 'ArrowDown' ? 1 : -1) + botones.length) % botones.length;
                botones[siguiente].focus();
            }
            if (e.key === 'Escape') {
                if (menu) {
                    this.cerrarMenu(true);
                } else if (!document.querySelector('.modal:not(.pac-popup)[style*="flex"]')) {
                    // Solo se cierra el popup si no hay otro modal abierto encima
                    this.cerrarPopup();
                }
            }
        });

        document.querySelector('.pages-container')?.addEventListener('scroll', () => this.cerrarMenu(), { passive: true });
        window.addEventListener('resize', () => this.cerrarMenu());

        // Refrescar el popup abierto cuando cambian notas o medicamentos
        document.addEventListener('zentra:historia-actualizada', () => this._refrescar?.());
    },

    // ---------- Utilidades ----------
    e(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    notificar(mensaje, tipo = 'info') {
        if (typeof showNotification === 'function') showNotification(mensaje, tipo);
        else alert(mensaje);
    },

    paciente(id) {
        const buscar = lista => (lista || []).find(p => String(p.id) === String(id));
        return buscar(typeof PacientesModule !== 'undefined' && PacientesModule.state?.pacientes)
            || buscar(typeof HistoriaClinicaModule !== 'undefined' && HistoriaClinicaModule.state?.pacientes)
            || null;
    },

    nombre(p) {
        return [p.nombre, p.apellidoPaterno || p.apellido_paterno, p.apellidoMaterno || p.apellido_materno].filter(Boolean).join(' ');
    },

    async api(path, options = {}) {
        const response = await fetch(`${authManager.apiBaseUrl}${path}`, {
            ...options,
            headers: { Authorization: `Bearer ${authManager.getToken()}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw new Error(data.message || data.error || `Error ${response.status}`);
        }
        return data;
    },

    // ---------- Menú ----------
    abrirMenu(pacienteId, x, y, fila) {
        const p = this.paciente(pacienteId);
        if (!p || !this.OPCIONES.length) return;
        this.cerrarMenu();
        this._filaOrigen = fila;
        fila?.classList.add('pac-fila-activa');

        const menu = document.createElement('div');
        menu.id = 'pacAccionesMenu';
        menu.className = 'pac-menu';
        menu.setAttribute('role', 'menu');
        menu.dataset.pacienteId = p.id;
        menu.innerHTML = `
            <div class="pac-menu-cabecera">
                <strong>${this.e(this.nombre(p))}</strong>
                <small>${this.e(p.dpi ? `DPI ${p.dpi}` : (p.telefono ? `Tel. ${p.telefono}` : ''))}</small>
            </div>
            ${this.OPCIONES.map(o => `
                <button type="button" class="pac-menu-opcion" role="menuitem" data-opcion="${o.clave}">
                    <i class="fas ${o.icono}" aria-hidden="true"></i><span>${o.texto}</span>
                </button>`).join('')}`;
        document.body.appendChild(menu);

        // Ubicar junto al clic sin salirse de la pantalla
        const margen = 8;
        const { width, height } = menu.getBoundingClientRect();
        menu.style.left = `${Math.max(margen, Math.min(x, window.innerWidth - width - margen))}px`;
        menu.style.top = `${y + height + margen > window.innerHeight ? Math.max(margen, y - height) : y}px`;
        menu.querySelector('[data-opcion]')?.focus({ preventScroll: true });
    },

    cerrarMenu(devolverFoco = false) {
        document.getElementById('pacAccionesMenu')?.remove();
        this._filaOrigen?.classList.remove('pac-fila-activa');
        if (devolverFoco) this._filaOrigen?.focus();
    },

    ejecutar(clave, pacienteId) {
        const p = this.paciente(pacienteId);
        if (!p) {
            this.notificar('No se encontró el paciente', 'error');
            return;
        }
        const acciones = {
            historia: () => this.abrirHistoria(p),
            evolucion: () => this.abrirEvolucion(p),
            medicamentos: () => this.abrirMedicamentos(p),
            laboratorios: () => this.abrirLaboratorios(p),
            cotizacion: () => this.abrirCotizaciones(p)
        };
        acciones[clave]?.();
    },

    // ---------- Popup genérico ----------
    abrirPopup({ titulo, icono, paciente, acciones = '' }) {
        this.cerrarPopup();
        const modal = document.createElement('div');
        modal.id = 'pacAccionPopup';
        modal.className = 'modal pac-popup';
        modal.style.display = 'flex';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'pacAccionPopupTitulo');
        modal.innerHTML = `
            <div class="modal-content modal-content-xl">
                <div class="modal-header">
                    <div>
                        <h2 id="pacAccionPopupTitulo"><i class="fas ${icono}" aria-hidden="true"></i> ${this.e(titulo)}</h2>
                        <small class="pac-popup-paciente">${this.e(this.nombre(paciente))}</small>
                    </div>
                    <div class="pac-popup-acciones">
                        ${acciones}
                        <button type="button" class="modal-close" data-cerrar aria-label="Cerrar">&times;</button>
                    </div>
                </div>
                <div class="modal-body" id="pacAccionPopupCuerpo"><p class="cot-sub">Cargando…</p></div>
            </div>`;
        modal.addEventListener('click', e => {
            if (e.target === modal || e.target.closest('[data-cerrar]')) this.cerrarPopup();
        });
        document.body.appendChild(modal);
        modal.querySelector('[data-cerrar]').focus({ preventScroll: true });
        return { modal, cuerpo: modal.querySelector('#pacAccionPopupCuerpo') };
    },

    cerrarPopup() {
        const modal = document.getElementById('pacAccionPopup');
        if (!modal) return;
        modal.remove();
        this._refrescar = null;
        this._filaOrigen?.focus?.({ preventScroll: true });
    },

    // Deja al paciente seleccionado en Historia Clínica (notas, prescripciones y agenda lo usan)
    seleccionarEnHistoria(p) {
        if (typeof HistoriaClinicaModule === 'undefined') {
            this.notificar('El módulo de Historia Clínica no está disponible', 'error');
            return false;
        }
        HistoriaClinicaModule.selectPacient(p.id);
        if (String(HistoriaClinicaModule.state.pacienteSeleccionado?.id) !== String(p.id)) {
            HistoriaClinicaModule.state.pacienteSeleccionado = JSON.parse(JSON.stringify(p));
        }
        return true;
    },

    // ---------- Historia clínica ----------
    abrirHistoria(p) {
        if (!this.seleccionarEnHistoria(p)) return;
        const { modal, cuerpo } = this.abrirPopup({
            titulo: 'Historia clínica',
            icono: 'fa-notes-medical',
            paciente: p,
            acciones: `
                <button type="button" class="btn btn-secondary btn-small" data-accion="imprimir"><i class="fas fa-print" aria-hidden="true"></i> Imprimir</button>
                <button type="button" class="btn btn-primary btn-small" data-accion="nota"><i class="fas fa-plus" aria-hidden="true"></i> Nueva nota</button>`
        });
        modal.querySelector('[data-accion="imprimir"]').addEventListener('click', () => {
            this.seleccionarEnHistoria(p);
            HistoriaClinicaModule.imprimirHistoriaClinica();
        });
        modal.querySelector('[data-accion="nota"]').addEventListener('click', () => {
            this.seleccionarEnHistoria(p);
            HistoriaClinicaModule.openNoteModal();
        });
        this._refrescar = () => {
            HistoriaClinicaModule.state.pacienteSeleccionado = JSON.parse(JSON.stringify(p));
            HistoriaClinicaModule.renderHistoriaClinica(cuerpo);
        };
        this._refrescar();
    },

    // ---------- Evolución ----------
    abrirEvolucion(p) {
        if (!this.seleccionarEnHistoria(p)) return;
        const { modal, cuerpo } = this.abrirPopup({
            titulo: 'Evolución',
            icono: 'fa-chart-line',
            paciente: p,
            acciones: '<button type="button" class="btn btn-primary btn-small" data-accion="nota"><i class="fas fa-plus" aria-hidden="true"></i> Nueva nota de evolución</button>'
        });
        modal.querySelector('[data-accion="nota"]').addEventListener('click', async () => {
            this.seleccionarEnHistoria(p);
            await HistoriaClinicaModule.openNoteModal();
            document.getElementById('noteTipo').value = 'Seguimiento';
            document.getElementById('noteModalTitle').innerHTML = '<i class="fas fa-chart-line"></i> Nueva nota de evolución';
        });
        cuerpo.addEventListener('click', e => {
            const editar = e.target.closest('[data-editar-nota]');
            if (editar) HistoriaClinicaModule.editNote(p.id, editar.dataset.editarNota);
        });

        this._refrescar = () => {
            const historia = HistoriaClinicaModule.state.historiasClinicas.find(h => String(h.pacienteId ?? h.pacientId) === String(p.id));
            const notas = [...(historia?.notas || [])].reverse();
            cuerpo.innerHTML = notas.length
                ? `<ol class="pac-evolucion">${notas.map(n => `
                    <li>
                        <div class="pac-evolucion-cabecera">
                            <span class="cot-tag">${this.e(n.tipo)}</span>
                            <small>${this.e(n.fecha ? formatFecha(n.fecha) : '')}${n.medico ? ` · ${this.e(n.medico)}` : ''}</small>
                            <button type="button" class="btn-accion btn-accion-icono" data-editar-nota="${this.e(n.id)}" title="Editar nota" aria-label="Editar nota"><i class="fas fa-pen" aria-hidden="true"></i></button>
                        </div>
                        <p>${this.e(n.contenido)}</p>
                    </li>`).join('')}</ol>`
                : '<div class="cot-vacio"><p>Este paciente aún no tiene notas de evolución.</p><small>Usa "Nueva nota de evolución" para registrar la primera.</small></div>';
        };
        this._refrescar();
    },

    // ---------- Control de medicamentos ----------
    async abrirMedicamentos(p) {
        if (!this.seleccionarEnHistoria(p)) return;
        await HistoriaClinicaModule.openNoteModal();
        HistoriaClinicaModule.switchTab('agenda');
        document.getElementById('noteModalTitle').innerHTML = `<i class="fas fa-pills"></i> Control de medicamentos · ${this.e(this.nombre(p))}`;
    },

    // ---------- Laboratorios ----------
    abrirLaboratorios(p) {
        const { cuerpo } = this.abrirPopup({ titulo: 'Laboratorios', icono: 'fa-flask', paciente: p });
        this.montarLaboratorios(cuerpo, p.id, { prefijo: 'pacLab', enfocar: true });
    },

    // Panel de laboratorios del paciente (lista + alta). Se usa en este menú y en la
    // pestaña Laboratorios de la ficha del paciente; ambos leen /api/laboratorios.
    // Sin <form>: la ficha ya es un formulario y no se pueden anidar.
    montarLaboratorios(contenedor, pacienteId, { prefijo = 'lab', enfocar = false } = {}) {
        const editable = typeof Permisos === 'undefined' || Permisos.puede('laboratorios', 'edit');
        const hoy = (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })();
        contenedor.innerHTML = `
            ${editable ? `
            <div class="pac-lab-form" role="group" aria-label="Agregar laboratorio">
                <div class="form-group">
                    <label for="${prefijo}Tipo">Examen <span class="required">*</span></label>
                    <input type="text" id="${prefijo}Tipo" data-lab="tipo" class="form-input" placeholder="Ej: Hematología completa">
                </div>
                <div class="form-group">
                    <label for="${prefijo}Fecha">Fecha <span class="required">*</span></label>
                    <input type="date" id="${prefijo}Fecha" data-lab="fecha" class="form-input" value="${hoy}">
                </div>
                <div class="form-group pac-lab-resultado">
                    <label for="${prefijo}Resultado">Resultado</label>
                    <textarea id="${prefijo}Resultado" data-lab="resultado" class="form-input" rows="2" placeholder="Resultado o interpretación"></textarea>
                </div>
                <div class="pac-lab-guardar">
                    <button type="button" class="btn btn-primary" data-lab="agregar"><i class="fas fa-plus" aria-hidden="true"></i> Agregar laboratorio</button>
                </div>
            </div>` : ''}
            <div data-lab="lista"><p class="cot-sub">Cargando laboratorios…</p></div>`;

        const campo = nombre => contenedor.querySelector(`[data-lab="${nombre}"]`);
        const lista = campo('lista');
        const cargar = async () => {
            try {
                const labs = await this.api(`/api/laboratorios/${encodeURIComponent(pacienteId)}`);
                const filas = Array.isArray(labs) ? labs : (labs.data || []);
                lista.innerHTML = filas.length
                    ? `<div class="table-responsive"><table class="data-table">
                        <thead><tr><th>Examen</th><th>Fecha</th><th>Resultado</th>${editable ? '<th></th>' : ''}</tr></thead>
                        <tbody>${filas.map(l => `<tr>
                            <td><strong>${this.e(l.tipo)}</strong></td>
                            <td>${this.e(l.fecha ? formatFecha(String(l.fecha).slice(0, 10)) : '')}</td>
                            <td class="pac-lab-texto">${this.e(l.resultado || '—')}</td>
                            ${editable ? `<td><button type="button" class="btn-accion btn-accion-icono btn-accion-peligro" data-borrar-lab="${this.e(l.id)}" data-nombre="${this.e(l.tipo)}" title="Eliminar laboratorio" aria-label="Eliminar laboratorio ${this.e(l.tipo)}"><i class="fas fa-trash" aria-hidden="true"></i></button></td>` : ''}
                        </tr>`).join('')}</tbody></table></div>`
                    : '<div class="cot-vacio"><p>Sin laboratorios registrados.</p></div>';
            } catch (error) {
                lista.innerHTML = `<div class="cot-vacio"><p>No se pudieron cargar los laboratorios.</p><small>${this.e(error.message)}</small></div>`;
            }
        };

        const agregar = async () => {
            const tipo = campo('tipo');
            const fecha = campo('fecha');
            const resultado = campo('resultado');
            if (!tipo.value.trim() || !fecha.value) {
                this.notificar('Escribe el examen y la fecha', 'warning');
                (tipo.value.trim() ? fecha : tipo).focus();
                return;
            }
            const boton = campo('agregar');
            boton.disabled = true;
            try {
                await this.api('/api/laboratorios', {
                    method: 'POST',
                    body: JSON.stringify({ paciente_id: pacienteId, tipo: tipo.value.trim(), fecha: fecha.value, resultado: resultado.value.trim() })
                });
                tipo.value = '';
                resultado.value = '';
                tipo.focus();
                this.notificar('Laboratorio agregado', 'success');
                await cargar();
            } catch (error) {
                this.notificar(`No se pudo guardar el laboratorio: ${error.message}`, 'error');
            } finally {
                boton.disabled = false;
            }
        };

        if (editable) {
            campo('agregar').addEventListener('click', agregar);
            // Enter en examen o fecha agrega (sin enviar el formulario de la ficha)
            [campo('tipo'), campo('fecha')].forEach(input => input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    agregar();
                }
            }));
        }

        lista.addEventListener('click', async e => {
            const borrar = e.target.closest('[data-borrar-lab]');
            if (!borrar || !confirm(`¿Eliminar el laboratorio "${borrar.dataset.nombre}"?`)) return;
            try {
                await this.api(`/api/laboratorios/${encodeURIComponent(borrar.dataset.borrarLab)}`, { method: 'DELETE' });
                this.notificar('Laboratorio eliminado', 'success');
                await cargar();
            } catch (error) {
                this.notificar(`No se pudo eliminar: ${error.message}`, 'error');
            }
        });

        cargar();
        if (enfocar && editable) setTimeout(() => campo('tipo')?.focus(), 50);
    },

    // ---------- Cotizaciones ----------
    abrirCotizaciones(p) {
        const { modal, cuerpo } = this.abrirPopup({
            titulo: 'Cotizaciones',
            icono: 'fa-file-invoice-dollar',
            paciente: p,
            acciones: '<button type="button" class="btn btn-primary btn-small" data-accion="nueva"><i class="fas fa-plus" aria-hidden="true"></i> Nueva cotización</button>'
        });
        const irAlEditor = async (id = null) => {
            this.cerrarPopup();
            navigateToPage('cotizaciones');
            await CotizacionesModule.abrirEditor(id);
            if (!id) CotizacionesModule.seleccionarPaciente(p);
        };
        modal.querySelector('[data-accion="nueva"]').addEventListener('click', () => irAlEditor());

        cuerpo.addEventListener('click', e => {
            const boton = e.target.closest('[data-cot]');
            if (!boton) return;
            if (boton.dataset.accion === 'abrir') irAlEditor(boton.dataset.cot);
            if (boton.dataset.accion === 'imprimir') CotizacionesModule.imprimirPorId(boton.dataset.cot);
        });

        (async () => {
            try {
                const { data = [] } = await this.api(`/api/cotizaciones?paciente_id=${encodeURIComponent(p.id)}`);
                cuerpo.innerHTML = data.length
                    ? `<div class="table-responsive"><table class="data-table">
                        <thead><tr><th>Número</th><th>Fecha</th><th>Motivo</th><th class="text-right">Total</th><th>Estado</th><th class="text-center">Acciones</th></tr></thead>
                        <tbody>${data.map(c => {
                            const estado = CotizacionesModule.estadoVisible(c);
                            return `<tr>
                                <td><strong>${this.e(c.numero)}</strong></td>
                                <td>${formatFecha(c.created_at)}</td>
                                <td><small>${this.e(c.motivo || '—')}</small></td>
                                <td class="text-right"><strong>${formatQ(c.total)}</strong></td>
                                <td><span class="cot-estado cot-estado-${estado.clave}">${estado.texto}</span></td>
                                <td><div class="acciones-saldo">
                                    <button type="button" class="btn-accion btn-accion-icono" data-cot="${this.e(c.id)}" data-accion="abrir" title="Abrir" aria-label="Abrir cotización ${this.e(c.numero)}"><i class="fas fa-pen" aria-hidden="true"></i></button>
                                    <button type="button" class="btn-accion btn-accion-icono" data-cot="${this.e(c.id)}" data-accion="imprimir" title="Imprimir" aria-label="Imprimir cotización ${this.e(c.numero)}"><i class="fas fa-print" aria-hidden="true"></i></button>
                                </div></td>
                            </tr>`;
                        }).join('')}</tbody></table></div>`
                    : '<div class="cot-vacio"><p>Este paciente no tiene cotizaciones.</p><small>Usa "Nueva cotización" para crear una con sus datos ya cargados.</small></div>';
            } catch (error) {
                cuerpo.innerHTML = `<div class="cot-vacio"><p>No se pudieron cargar las cotizaciones.</p><small>${this.e(error.message)}</small></div>`;
            }
        })();
    }
};

window.PacienteAccionesModule = PacienteAccionesModule;
document.addEventListener('DOMContentLoaded', () => PacienteAccionesModule.init());
