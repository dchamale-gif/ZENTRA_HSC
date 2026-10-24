// ============================================
// INVENTARIO DE BIENES (MOBILIARIO Y EQUIPO)
// ============================================
// Cada bien con su área, estado y la fecha de ese estado; historial de cambios,
// bajas con fecha y motivo, y cargo al paciente cuando daña un bien.

const InventarioActivos = {
    state: {
        activos: [],
        pacientes: null,
        buscar: '',
        area: '',
        estado: 'vigentes',
        categoria: '',
        error: ''
    },

    ESTADOS: {
        bueno: 'Bueno',
        regular: 'Regular',
        malo: 'Dañado',
        en_reparacion: 'En reparación',
        dado_de_baja: 'Dado de baja'
    },

    MOTIVOS_BAJA: {
        danado: 'Dañado o roto',
        obsoleto: 'Obsoleto',
        extraviado: 'Extraviado',
        robo: 'Robo',
        vencido: 'Vencido',
        donado: 'Donado',
        otro: 'Otro'
    },

    init() {
        document.getElementById('btnNuevoActivo')?.addEventListener('click', () => this.abrirFormulario());
        const filtros = { invBuscar: 'buscar', invFiltroArea: 'area', invFiltroEstado: 'estado', invFiltroCategoria: 'categoria' };
        Object.entries(filtros).forEach(([id, clave]) => {
            document.getElementById(id)?.addEventListener(id === 'invBuscar' ? 'input' : 'change', (e) => {
                this.state[clave] = e.target.value;
                this.render();
            });
        });
        document.getElementById('invTabla')?.addEventListener('click', (e) => {
            const boton = e.target.closest('[data-accion]');
            if (!boton) return;
            const activo = this.state.activos.find(a => String(a.id) === boton.dataset.id);
            if (!activo) return;
            const acciones = {
                editar: () => this.abrirFormulario(activo),
                estado: () => this.abrirEstado(activo),
                baja: () => this.abrirBaja(activo),
                historial: () => this.abrirHistorial(activo),
                eliminar: () => this.eliminar(activo)
            };
            acciones[boton.dataset.accion]?.();
        });
        this.cargar();
    },

    async api(path = '', opciones = {}) {
        const response = await authManager.fetchWithAuth(`/api/inventario-activos${path}`, {
            ...opciones,
            headers: { 'Content-Type': 'application/json', ...opciones.headers }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) throw new Error(data.message || data.error || `Error ${response.status}`);
        return data;
    },

    async cargar() {
        try {
            const data = await this.api();
            this.state.activos = data.data || [];
            this.state.error = '';
        } catch (error) {
            this.state.error = error.message;
        }
        this.llenarFiltros();
        this.render();
    },

    puedeEditar() {
        return typeof Permisos === 'undefined' || Permisos.puede('inventario', 'edit');
    },

    hoy() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.REGION.timeZone }).format(new Date());
    },

    // Las áreas y categorías del filtro salen de lo registrado
    llenarFiltros() {
        const llenar = (id, valores, todas) => {
            const select = document.getElementById(id);
            if (!select) return;
            const actual = select.value;
            select.innerHTML = `<option value="">${todas}</option>` +
                valores.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
            select.value = valores.includes(actual) ? actual : '';
        };
        const unicos = clave => [...new Set(this.state.activos.map(a => a[clave]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        llenar('invFiltroArea', unicos('area'), 'Todas las áreas');
        llenar('invFiltroCategoria', unicos('categoria'), 'Todas las categorías');
        this.state.area = document.getElementById('invFiltroArea')?.value || '';
        this.state.categoria = document.getElementById('invFiltroCategoria')?.value || '';
    },

    filtrados() {
        const termino = this.state.buscar.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
        return this.state.activos.filter(a => {
            if (this.state.area && a.area !== this.state.area) return false;
            if (this.state.categoria && a.categoria !== this.state.categoria) return false;
            if (this.state.estado === 'vigentes' && a.estado === 'dado_de_baja') return false;
            if (this.state.estado && this.state.estado !== 'vigentes' && a.estado !== this.state.estado) return false;
            if (!termino) return true;
            return [a.codigo, a.nombre, a.serie, a.marca, a.modelo, a.ubicacion, a.area]
                .join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(termino);
        });
    },

    estadoHTML(activo) {
        return `<span class="inv-estado inv-estado-${activo.estado}">${this.ESTADOS[activo.estado] || activo.estado}</span>
            <small>desde ${formatFecha(activo.fecha_estado)}</small>`;
    },

    render() {
        const tbody = document.getElementById('invTabla');
        if (!tbody) return;
        const boton = document.getElementById('btnNuevoActivo');
        if (boton) boton.hidden = !this.puedeEditar();

        if (this.state.error) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center">${escapeHtml(this.state.error)}</td></tr>`;
            document.getElementById('invResumen').innerHTML = '';
            return;
        }

        const vigentes = this.state.activos.filter(a => a.estado !== 'dado_de_baja');
        const cuenta = estado => vigentes.filter(a => a.estado === estado).length;
        const valor = vigentes.reduce((total, a) => total + Number(a.valor_unitario) * a.cantidad, 0);
        document.getElementById('invResumen').innerHTML = `
            <div><span>Bienes en uso</span><strong>${vigentes.length}</strong></div>
            <div><span>Dañados</span><strong class="${cuenta('malo') ? 'inv-alerta' : ''}">${cuenta('malo')}</strong></div>
            <div><span>En reparación</span><strong>${cuenta('en_reparacion')}</strong></div>
            <div><span>Dados de baja</span><strong>${this.state.activos.length - vigentes.length}</strong></div>
            <div><span>Valor en uso</span><strong>${formatQ(valor)}</strong></div>`;

        const lista = this.filtrados();
        if (!lista.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center">${this.state.activos.length
                ? 'Ningún bien coincide con los filtros.'
                : 'Aún no hay bienes registrados. Agregue el primero con «Agregar bien».'}</td></tr>`;
            return;
        }

        const editar = this.puedeEditar();
        tbody.innerHTML = lista.map(a => {
            const baja = a.estado === 'dado_de_baja';
            const detalle = [a.categoria, [a.marca, a.modelo].filter(Boolean).join(' '), a.serie && `Serie ${a.serie}`].filter(Boolean).join(' · ');
            return `
            <tr class="${baja ? 'inv-fila-baja' : ''}">
                <td data-label="Código"><strong>${escapeHtml(a.codigo)}</strong></td>
                <td data-label="Bien">
                    <span class="inv-nombre">${escapeHtml(a.nombre)}</span>
                    ${detalle ? `<small>${escapeHtml(detalle)}</small>` : ''}
                    ${a.cargos_paciente ? `<small class="inv-cargo-badge"><i class="fas fa-user-injured" aria-hidden="true"></i> ${a.cargos_paciente} cargo${a.cargos_paciente === 1 ? '' : 's'} a paciente</small>` : ''}
                </td>
                <td data-label="Área">${escapeHtml(a.area)}${a.ubicacion ? `<small>${escapeHtml(a.ubicacion)}</small>` : ''}</td>
                <td data-label="Cantidad" class="inv-num">${a.cantidad}</td>
                <td data-label="Estado">${this.estadoHTML(a)}</td>
                <td data-label="Valor" class="inv-num">${formatQ(Number(a.valor_unitario) * Math.max(a.cantidad, baja ? 0 : 1))}</td>
                <td data-label="Acciones" class="actions inv-acciones">
                    <button type="button" class="btn-icon" data-accion="historial" data-id="${a.id}" title="Historial" aria-label="Historial de ${escapeHtml(a.nombre)}"><i class="fas fa-clock-rotate-left"></i></button>
                    ${editar && !baja ? `
                    <button type="button" class="btn-icon btn-edit" data-accion="editar" data-id="${a.id}" title="Editar" aria-label="Editar ${escapeHtml(a.nombre)}"><i class="fas fa-edit"></i></button>
                    <button type="button" class="btn btn-secondary btn-small" data-accion="estado" data-id="${a.id}">Cambiar estado</button>
                    <button type="button" class="btn btn-danger btn-small" data-accion="baja" data-id="${a.id}">Dar de baja</button>` : ''}
                    ${editar && typeof Permisos !== 'undefined' && Permisos.esAdmin() && !a.cargos_paciente ? `
                    <button type="button" class="btn-icon btn-delete" data-accion="eliminar" data-id="${a.id}" title="Eliminar registro equivocado" aria-label="Eliminar ${escapeHtml(a.nombre)}"><i class="fas fa-trash"></i></button>` : ''}
                </td>
            </tr>`;
        }).join('');
    },

    // ---------- Diálogos ----------
    dialogo({ titulo, cuerpo, accion, clase = '' }) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-dialog inv-dialogo ${clase}" role="dialog" aria-modal="true" aria-labelledby="invDialogoTitulo">
                <div class="modal-header">
                    <h2 id="invDialogoTitulo">${titulo}</h2>
                    <button type="button" class="close-btn" aria-label="Cerrar">&times;</button>
                </div>
                <form class="modal-body" novalidate>
                    ${cuerpo}
                    <p class="inv-error" role="alert" hidden></p>
                    ${accion ? `<div class="inv-dialogo-acciones">
                        <button type="button" class="btn btn-secondary" data-cerrar>Cancelar</button>
                        <button type="submit" class="btn ${accion.clase || 'btn-primary'}">${accion.texto}</button>
                    </div>` : ''}
                </form>
            </div>`;
        document.body.appendChild(overlay);
        const alTeclear = (e) => { if (e.key === 'Escape') cerrar(); };
        const cerrar = () => {
            overlay.remove();
            document.removeEventListener('keydown', alTeclear);
        };
        document.addEventListener('keydown', alTeclear);
        overlay.querySelector('.close-btn').addEventListener('click', cerrar);
        overlay.querySelector('[data-cerrar]')?.addEventListener('click', cerrar);
        overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });
        const form = overlay.querySelector('form');
        const error = overlay.querySelector('.inv-error');
        const mostrarError = (mensaje) => {
            error.textContent = mensaje || '';
            error.hidden = !mensaje;
        };
        form.addEventListener('input', () => mostrarError(''));
        if (accion) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const boton = form.querySelector('button[type="submit"]');
                boton.disabled = true;
                try {
                    const resultado = await accion.enviar(form);
                    if (resultado === false) return;
                    cerrar();
                } catch (err) {
                    mostrarError(err.message);
                } finally {
                    boton.disabled = false;
                }
            });
        }
        setTimeout(() => form.querySelector('input:not([type="hidden"]), select, textarea')?.focus(), 0);
        return { overlay, form, mostrarError, cerrar };
    },

    campo(id, etiqueta, control, { requerido = false, ancho = false, ayuda = '' } = {}) {
        return `<div class="form-group${ancho ? ' inv-ancho' : ''}">
            <label for="${id}">${etiqueta}${requerido ? ' <span class="required">*</span>' : ''}</label>
            ${control}
            ${ayuda ? `<small class="form-hint">${ayuda}</small>` : ''}
        </div>`;
    },

    actualizarLocal(activo) {
        const i = this.state.activos.findIndex(a => String(a.id) === String(activo.id));
        if (i >= 0) this.state.activos[i] = { ...this.state.activos[i], ...activo };
        else this.state.activos.push(activo);
        this.llenarFiltros();
        this.render();
    },

    abrirFormulario(activo = null) {
        const v = (clave) => escapeHtml(activo?.[clave] ?? '');
        const { form } = this.dialogo({
            titulo: activo ? `Editar · ${escapeHtml(activo.codigo)}` : 'Agregar bien',
            accion: {
                texto: '<i class="fas fa-save" aria-hidden="true"></i> Guardar',
                enviar: async (f) => {
                    const datos = Object.fromEntries(new FormData(f));
                    if (!datos.nombre.trim()) throw new Error('Escriba el nombre del bien.');
                    if (!datos.area.trim()) throw new Error('Indique el área.');
                    const data = await this.api(activo ? `/${activo.id}` : '', {
                        method: activo ? 'PUT' : 'POST',
                        body: JSON.stringify({ ...datos, cantidad: Number(datos.cantidad), valor_unitario: Number(datos.valor_unitario || 0) })
                    });
                    this.actualizarLocal(data.data);
                    showNotification(data.message, 'success');
                }
            },
            cuerpo: `
                <div class="inv-campos">
                    ${this.campo('invNombre', 'Nombre del bien', `<input id="invNombre" name="nombre" class="form-input" maxlength="150" required value="${v('nombre')}" placeholder="Ej.: Cama hospitalaria, silla de ruedas">`, { requerido: true, ancho: true })}
                    ${this.campo('invCodigo', 'Código', `<input id="invCodigo" name="codigo" class="form-input" maxlength="40" value="${v('codigo')}" autocomplete="off">`, { ayuda: activo ? '' : 'Vacío: se asigna uno (INV-0001…).' })}
                    ${this.campo('invCategoria', 'Categoría', `<input id="invCategoria" name="categoria" class="form-input" list="invCategorias" maxlength="60" value="${v('categoria')}" autocomplete="off">`)}
                    ${this.campo('invArea', 'Área', `<input id="invArea" name="area" class="form-input" list="invAreas" maxlength="80" required value="${v('area')}" autocomplete="off">`, { requerido: true })}
                    ${this.campo('invUbicacion', 'Ubicación', `<input id="invUbicacion" name="ubicacion" class="form-input" maxlength="120" value="${v('ubicacion')}" placeholder="Ej.: Habitación 4">`)}
                    ${this.campo('invMarca', 'Marca', `<input id="invMarca" name="marca" class="form-input" maxlength="80" value="${v('marca')}">`)}
                    ${this.campo('invModelo', 'Modelo', `<input id="invModelo" name="modelo" class="form-input" maxlength="80" value="${v('modelo')}">`)}
                    ${this.campo('invSerie', 'No. de serie', `<input id="invSerie" name="serie" class="form-input" maxlength="80" value="${v('serie')}" autocomplete="off">`)}
                    ${this.campo('invCantidad', 'Cantidad', `<input id="invCantidad" name="cantidad" type="number" min="1" step="1" class="form-input" required value="${activo?.cantidad ?? 1}">`, { requerido: true })}
                    ${this.campo('invValor', 'Valor unitario (Q)', `<input id="invValor" name="valor_unitario" type="number" min="0" step="0.01" class="form-input" value="${activo ? Number(activo.valor_unitario) : ''}">`, { ayuda: 'Se sugiere como monto al cargar un daño al paciente.' })}
                    ${this.campo('invAdquisicion', 'Fecha de adquisición', `<input id="invAdquisicion" name="fecha_adquisicion" type="date" class="form-input" max="${this.hoy()}" value="${v('fecha_adquisicion')}">`)}
                    ${activo ? '' : `
                    ${this.campo('invEstadoInicial', 'Estado', `<select id="invEstadoInicial" name="estado" class="form-input">
                        ${['bueno', 'regular', 'malo', 'en_reparacion'].map(e => `<option value="${e}">${this.ESTADOS[e]}</option>`).join('')}
                    </select>`)}
                    ${this.campo('invFechaEstado', 'Fecha del estado', `<input id="invFechaEstado" name="fecha_estado" type="date" class="form-input" max="${this.hoy()}" value="${this.hoy()}">`)}`}
                    ${this.campo('invNotas', 'Notas', `<textarea id="invNotas" name="notas" class="form-input" rows="2" maxlength="2000">${v('notas')}</textarea>`, { ancho: true })}
                </div>
                ${activo ? `<p class="form-hint">El estado se cambia con «Cambiar estado». Si cambia el área o la ubicación queda registrado como traslado en el historial.</p>` : ''}`
        });
        return form;
    },

    // Bloque "cargar al paciente": buscador de paciente y monto sugerido con el valor del bien
    bloqueCargo(montoSugerido) {
        return `
            <label class="inv-cargo-check">
                <input type="checkbox" name="cargar" data-cargar>
                <span><strong>Lo dañó un paciente: cargar a su cuenta</strong>
                <small>Se agrega como cargo a su estado de cuenta.</small></span>
            </label>
            <div class="inv-cargo" data-cargo hidden>
                <div class="inv-campos">
                    ${this.campo('invPaciente', 'Paciente', `<input id="invPaciente" class="form-input" list="invPacientesLista" autocomplete="off" placeholder="Escriba nombre o DPI">
                        <datalist id="invPacientesLista"></datalist>`, { requerido: true, ancho: true })}
                    ${this.campo('invMonto', 'Monto a cargar (Q)', `<input id="invMonto" name="monto" type="number" min="0.01" step="0.01" class="form-input" value="${montoSugerido > 0 ? montoSugerido.toFixed(2) : ''}">`, { requerido: true })}
                </div>
            </div>`;
    },

    async prepararCargo(form, mostrar) {
        const check = form.querySelector('[data-cargar]');
        const bloque = form.querySelector('[data-cargo]');
        const actualizar = async () => {
            const visible = check.checked && (mostrar ? mostrar() : true);
            bloque.hidden = !visible;
            if (!visible || this.state.pacientes) return;
            try {
                const response = await authManager.fetchWithAuth('/api/pacientes');
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'No se pudieron cargar los pacientes');
                this.state.pacientes = (data.pacientes || []).map(p => ({
                    id: String(p.id),
                    etiqueta: `${[p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(' ')}${p.dpi ? ` · DPI ${p.dpi}` : ''}`
                }));
            } catch (error) {
                this.state.pacientes = null;
                showNotification(error.message, 'error');
                return;
            }
            form.querySelector('#invPacientesLista').innerHTML = this.state.pacientes
                .map(p => `<option value="${escapeHtml(p.etiqueta)}"></option>`).join('');
        };
        check.addEventListener('change', actualizar);
        return actualizar;
    },

    // Lee el cargo del formulario: null si no se carga; error si falta algo
    leerCargo(form) {
        const bloque = form.querySelector('[data-cargo]');
        if (!bloque || bloque.hidden) return null;
        const texto = form.querySelector('#invPaciente').value.trim();
        const paciente = (this.state.pacientes || []).find(p => p.etiqueta === texto);
        if (!paciente) throw new Error('Elija el paciente de la lista.');
        const monto = Number(form.querySelector('#invMonto').value);
        if (!(monto > 0)) throw new Error('Indique el monto a cargar al paciente.');
        return { paciente_id: paciente.id, monto, etiqueta: paciente.etiqueta };
    },

    confirmarCargo(cargo) {
        return !cargo || confirm(`Se cargará ${formatQ(cargo.monto)} a la cuenta de ${cargo.etiqueta}. ¿Continuar?`);
    },

    abrirEstado(activo) {
        const { form } = this.dialogo({
            titulo: `Cambiar estado · ${escapeHtml(activo.nombre)}`,
            accion: {
                texto: 'Guardar estado',
                enviar: async (f) => {
                    const estado = f.estado.value;
                    const detalle = f.detalle.value.trim();
                    if (['malo', 'en_reparacion'].includes(estado) && !detalle) throw new Error('Explique qué le pasó al bien.');
                    const cargo = this.leerCargo(f);
                    if (!this.confirmarCargo(cargo)) return false;
                    const data = await this.api(`/${activo.id}/estado`, {
                        method: 'POST',
                        body: JSON.stringify({ estado, fecha: f.fecha.value, detalle, cargo: cargo && { paciente_id: cargo.paciente_id, monto: cargo.monto } })
                    });
                    this.actualizarLocal({ ...data.data, cargos_paciente: (activo.cargos_paciente || 0) + (cargo ? 1 : 0) });
                    showNotification(data.message, 'success');
                }
            },
            cuerpo: `
                <p class="inv-actual">Estado actual: ${this.estadoHTML(activo)}</p>
                <div class="inv-campos">
                    ${this.campo('invNuevoEstado', 'Nuevo estado', `<select id="invNuevoEstado" name="estado" class="form-input">
                        ${['bueno', 'regular', 'malo', 'en_reparacion'].map(e => `<option value="${e}" ${e === activo.estado ? 'disabled' : ''}>${this.ESTADOS[e]}${e === activo.estado ? ' (actual)' : ''}</option>`).join('')}
                    </select>`, { requerido: true })}
                    ${this.campo('invFechaCambio', 'Fecha', `<input id="invFechaCambio" name="fecha" type="date" class="form-input" max="${this.hoy()}" value="${this.hoy()}" required>`, { requerido: true })}
                    ${this.campo('invDetalleEstado', 'Comentario', `<textarea id="invDetalleEstado" name="detalle" class="form-input" rows="2" maxlength="2000" placeholder="Qué pasó, quién lo reportó…"></textarea>`, { ancho: true, ayuda: 'Obligatorio si queda dañado o en reparación.' })}
                </div>
                <div data-zona-cargo hidden>${this.bloqueCargo(Number(activo.valor_unitario))}</div>`
        });
        const select = form.querySelector('#invNuevoEstado');
        if (select.selectedOptions[0]?.disabled) select.value = [...select.options].find(o => !o.disabled).value;
        const zona = form.querySelector('[data-zona-cargo]');
        const danado = () => ['malo', 'en_reparacion'].includes(select.value);
        this.prepararCargo(form, danado).then(actualizar => {
            const alCambiar = () => {
                zona.hidden = !danado();
                actualizar();
            };
            select.addEventListener('change', alCambiar);
            alCambiar();
        });
    },

    abrirBaja(activo) {
        const { form } = this.dialogo({
            titulo: `Dar de baja · ${escapeHtml(activo.nombre)}`,
            clase: 'inv-dialogo-baja',
            accion: {
                texto: '<i class="fas fa-ban" aria-hidden="true"></i> Dar de baja',
                clase: 'btn-danger',
                enviar: async (f) => {
                    const cantidad = Number(f.cantidad?.value || activo.cantidad);
                    if (!f.motivo.value) throw new Error('Elija el motivo de la baja.');
                    if (f.detalle.value.trim().length < 5) throw new Error('Explique por qué se da de baja.');
                    const cargo = this.leerCargo(f);
                    const resumen = cantidad < activo.cantidad
                        ? `${cantidad} de ${activo.cantidad} unidades de "${activo.nombre}"`
                        : `"${activo.nombre}" (${activo.codigo})`;
                    if (!confirm(`¿Dar de baja ${resumen}? Esta acción no se puede deshacer.`)) return false;
                    if (!this.confirmarCargo(cargo)) return false;
                    const data = await this.api(`/${activo.id}/baja`, {
                        method: 'POST',
                        body: JSON.stringify({
                            fecha: f.fecha.value, cantidad, motivo: f.motivo.value, detalle: f.detalle.value.trim(),
                            cargo: cargo && { paciente_id: cargo.paciente_id, monto: cargo.monto }
                        })
                    });
                    this.actualizarLocal({ ...data.data, cargos_paciente: (activo.cargos_paciente || 0) + (cargo ? 1 : 0) });
                    showNotification(data.message, 'success');
                }
            },
            cuerpo: `
                <p class="inv-actual">${escapeHtml(activo.codigo)} · ${escapeHtml(activo.area)}${activo.ubicacion ? ` · ${escapeHtml(activo.ubicacion)}` : ''} · ${this.estadoHTML(activo)}</p>
                <div class="inv-campos">
                    ${this.campo('invFechaBaja', 'Fecha de baja', `<input id="invFechaBaja" name="fecha" type="date" class="form-input" max="${this.hoy()}" value="${this.hoy()}" required>`, { requerido: true })}
                    ${activo.cantidad > 1 ? this.campo('invCantidadBaja', `Cantidad (de ${activo.cantidad})`, `<input id="invCantidadBaja" name="cantidad" type="number" min="1" max="${activo.cantidad}" step="1" class="form-input" value="${activo.cantidad}" required>`, { requerido: true }) : ''}
                    ${this.campo('invMotivoBaja', 'Motivo', `<select id="invMotivoBaja" name="motivo" class="form-input" required>
                        <option value="">-- Selecciona --</option>
                        ${Object.entries(this.MOTIVOS_BAJA).map(([clave, texto]) => `<option value="${clave}">${texto}</option>`).join('')}
                    </select>`, { requerido: true })}
                    ${this.campo('invDetalleBaja', '¿Por qué se da de baja?', `<textarea id="invDetalleBaja" name="detalle" class="form-input" rows="3" maxlength="2000" required></textarea>`, { requerido: true, ancho: true })}
                </div>
                <div data-zona-cargo hidden>${this.bloqueCargo(Number(activo.valor_unitario) * activo.cantidad)}</div>`
        });
        const motivo = form.querySelector('#invMotivoBaja');
        const cantidad = form.querySelector('#invCantidadBaja');
        const zona = form.querySelector('[data-zona-cargo]');
        const monto = form.querySelector('#invMonto');
        this.prepararCargo(form, () => motivo.value === 'danado').then(actualizar => {
            motivo.addEventListener('change', () => {
                zona.hidden = motivo.value !== 'danado';
                actualizar();
            });
            // El monto sugerido sigue a la cantidad dada de baja
            cantidad?.addEventListener('input', () => {
                const sugerido = Number(activo.valor_unitario) * (Number(cantidad.value) || 0);
                if (sugerido > 0) monto.value = sugerido.toFixed(2);
            });
        });
    },

    async abrirHistorial(activo) {
        const { overlay } = this.dialogo({
            titulo: `Historial · ${escapeHtml(activo.nombre)}`,
            clase: 'inv-dialogo-historial',
            cuerpo: '<div class="inv-historial"><p class="form-hint">Cargando historial…</p></div>'
        });
        const contenedor = overlay.querySelector('.inv-historial');
        try {
            const data = await this.api(`/${activo.id}/movimientos`);
            const estado = e => this.ESTADOS[e] || e || '';
            const titulo = m => ({
                alta: `Alta · ${estado(m.estado_nuevo)}${m.cantidad > 1 ? ` · ${m.cantidad} unidades` : ''}`,
                cambio_estado: `${estado(m.estado_anterior)} → ${estado(m.estado_nuevo)}`,
                baja: `Baja${m.cantidad ? ` de ${m.cantidad} unidad${m.cantidad === 1 ? '' : 'es'}` : ''} · ${this.MOTIVOS_BAJA[m.motivo] || m.motivo || ''}`,
                traslado: `Traslado: ${m.area_anterior || '—'} → ${m.area_nueva || '—'}`
            }[m.tipo] || m.tipo);
            contenedor.innerHTML = data.data.length ? `<ol>${data.data.map(m => `
                <li class="inv-mov inv-mov-${m.tipo}">
                    <div class="inv-mov-encabezado"><strong>${escapeHtml(titulo(m))}</strong><span>${formatFecha(m.fecha)}</span></div>
                    ${m.detalle ? `<p>${escapeHtml(m.detalle)}</p>` : ''}
                    ${m.paciente_nombre ? `<p class="inv-mov-cargo"><i class="fas fa-user-injured" aria-hidden="true"></i> Cargado a ${escapeHtml(m.paciente_nombre)}: ${formatQ(m.monto_cargado)}${m.numero_factura ? ` · factura ${escapeHtml(m.numero_factura)}` : ''}</p>` : ''}
                    <small>${escapeHtml(m.usuario_nombre || '')} · registrado ${formatFechaHora(m.created_at)}</small>
                </li>`).join('')}</ol>` : '<p class="form-hint">Sin movimientos.</p>';
        } catch (error) {
            contenedor.innerHTML = `<p class="inv-error">${escapeHtml(error.message)}</p>`;
        }
    },

    async eliminar(activo) {
        if (!confirm(`¿Eliminar el registro de "${activo.nombre}" (${activo.codigo}) y su historial?\n\nÚselo solo para corregir un registro equivocado. Para retirar un bien del inventario use «Dar de baja».`)) return;
        try {
            const data = await this.api(`/${activo.id}`, { method: 'DELETE' });
            this.state.activos = this.state.activos.filter(a => a !== activo);
            this.llenarFiltros();
            this.render();
            showNotification(data.message, 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
};

window.InventarioActivos = InventarioActivos;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof Permisos === 'undefined' || Permisos.puedeVerPagina('inventory')) InventarioActivos.init();
});
