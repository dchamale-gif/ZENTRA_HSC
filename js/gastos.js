// ============================================
// GASTOS: REQUISICIONES QUE ESPERAN EL PAGO DEL DUEÑO
// Luz, agua, internet, teléfono… Se registra la requisición (fecha de creación),
// se carga para que el dueño la pague (fecha de carga) y queda en espera hasta
// que el administrador la marca pagada con el número del banco y la autorización. El listado muestra cuántos días lleva cada gasto esperando.
// Se guarda en la base de datos (/api/gastos), a diferencia de las pestañas
// anteriores del módulo, que viven en el navegador.
// ============================================

const GastosRequisiciones = {
    state: {
        gastos: [],
        categorias: [],
        resumen: null,
        esAdmin: false,
        disponible: true,
        estado: '',
        busqueda: ''
    },

    ESTADOS: { pendiente: 'Pendiente', cargado: 'Esperando pago', pagado: 'Pagado', anulado: 'Anulado' },
    FORMAS_PAGO: { efectivo: 'Efectivo', tarjeta: 'Tarjeta de crédito', transferencia: 'Transferencia', cheque: 'Cheque' },
    CATEGORIAS: ['Luz', 'Agua', 'Internet', 'Teléfono', 'Alquiler', 'Mantenimiento', 'Seguridad', 'Otro'],

    init() {
        if (this._iniciado) return;
        this._iniciado = true;
        document.getElementById('gastoNuevoBtn')?.addEventListener('click', () => this.formulario());
        document.getElementById('gastosBusqueda')?.addEventListener('input', (e) => {
            this.state.busqueda = e.target.value;
            clearTimeout(this._timer);
            this._timer = setTimeout(() => this.cargar(), 250);
        });
        document.getElementById('gastosFiltroEstado')?.addEventListener('change', (e) => {
            this.state.estado = e.target.value;
            this.cargar();
        });
        const lista = document.getElementById('gastosLista');
        lista?.addEventListener('change', (e) => {
            const select = e.target.closest('select[data-gasto-estado]');
            if (select) this.cambiarEstado(select);
        });
        lista?.addEventListener('click', (e) => {
            const voucher = e.target.closest('[data-gasto-voucher]');
            if (voucher) {
                this.verVoucher(voucher.dataset.gastoVoucher, voucher.dataset.nombre);
                return;
            }
            const boton = e.target.closest('[data-gasto-accion]');
            const gasto = boton && this.state.gastos.find(g => String(g.id) === boton.dataset.id);
            if (!gasto) return;
            if (boton.dataset.gastoAccion === 'editar') this.formulario(gasto);
            if (boton.dataset.gastoAccion === 'eliminar') this.eliminar(gasto);
        });
    },

    e(valor) {
        return escapeHtml(valor ?? '');
    },

    notificar(mensaje, tipo = 'info') {
        if (typeof showNotification === 'function') showNotification(mensaje, tipo);
        else alert(mensaje);
    },

    puedeEditar() {
        return typeof Permisos === 'undefined' || Permisos.puede('gastos', 'edit');
    },

    hoy() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.REGION.timeZone }).format(new Date());
    },

    async api(path = '', options = {}) {
        const response = await authManager.fetchWithAuth(`/api/gastos${path}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || data.message || `Error ${response.status}`);
        return data;
    },

    async cargar() {
        this.init();
        const contenedor = document.getElementById('gastosLista');
        if (!contenedor) return;
        document.getElementById('gastoNuevoBtn').hidden = !this.puedeEditar();
        try {
            const params = new URLSearchParams();
            if (this.state.estado) params.set('estado', this.state.estado);
            if (this.state.busqueda.trim()) params.set('q', this.state.busqueda.trim());
            const data = await this.api(`?${params}`);
            Object.assign(this.state, {
                gastos: data.gastos || [],
                categorias: data.categorias || [],
                resumen: data.resumen || null,
                esAdmin: Boolean(data.esAdmin),
                disponible: data.disponible !== false
            });
            this.render();
        } catch (error) {
            contenedor.innerHTML = `<div class="cot-vacio"><p>No se pudieron cargar los gastos.</p><small>${this.e(error.message)}</small></div>`;
        }
    },

    textoDias(n) {
        return `${n} día${Number(n) === 1 ? '' : 's'}`;
    },

    renderResumen() {
        const r = this.state.resumen;
        const caja = document.getElementById('gastosResumen');
        if (!caja) return;
        caja.innerHTML = r && r.cantidad
            ? `<strong>${r.cantidad} gasto${r.cantidad === 1 ? '' : 's'} esperando pago · ${formatQ(r.total)}</strong>
               <span>El más antiguo lleva ${this.textoDias(r.dias_mas_antiguo)}.</span>`
            : '<span>No hay gastos esperando pago.</span>';
    },

    // Días en espera: desde la carga hasta hoy (esperando) o hasta el pago (pagado)
    celdaDias(g) {
        if (g.estado === 'cargado') {
            const clase = g.dias_espera > 30 ? 'vencida' : g.dias_espera > 15 ? 'pendiente' : 'credito';
            return `<span class="compra-pago-estado ${clase}">${this.textoDias(g.dias_espera)}</span>`;
        }
        if (g.estado === 'pagado') return `<small class="cot-sub">Pagado en ${this.textoDias(g.dias_espera)}</small>`;
        return '<small class="cot-sub">—</small>';
    },

    // Marcar pagado (y cambiar uno ya pagado) es del administrador
    selectorEstado(g) {
        const fijo = !this.puedeEditar() || (g.estado === 'pagado' && !this.state.esAdmin);
        if (fijo) return `<span class="gasto-estado gasto-estado-${g.estado}">${this.ESTADOS[g.estado]}</span>`;
        return `<select class="cuenta-select compras-select gasto-select-${g.estado}" data-gasto-estado data-id="${g.id}"
                    aria-label="Estado del gasto ${this.e(g.numero)}">
                ${Object.entries(this.ESTADOS).map(([v, t]) => `<option value="${v}" ${v === g.estado ? 'selected' : ''}
                    ${v === 'pagado' && !this.state.esAdmin ? 'disabled' : ''}>${v === 'pagado' && !this.state.esAdmin ? `${t} (administrador)` : t}</option>`).join('')}
            </select>`;
    },

    detallePago(g) {
        const partes = [formatFecha(g.fecha_pago), this.FORMAS_PAGO[g.forma_pago] || ''];
        if (g.numero_pago_banco) partes.push(`Banco ${this.e(g.numero_pago_banco)}`);
        if (g.numero_autorizacion) partes.push(`Aut. ${this.e(g.numero_autorizacion)}`);
        if (!g.numero_pago_banco && g.referencia_pago) partes.push(this.e(g.referencia_pago));
        const vouchers = (g.vouchers || []).map(v => `
            <button type="button" class="btn-link gasto-voucher" data-gasto-voucher="${v.id}" data-nombre="${this.e(v.nombre)}"
                    title="Ver ${this.e(v.nombre)}"><i class="fas fa-paperclip" aria-hidden="true"></i> ${this.e(v.nombre)}</button>`).join('');
        return `<small class="cot-sub">${partes.filter(Boolean).join(' · ')}</small>
            ${g.pagado_por_nombre ? `<small class="cot-sub">Por ${this.e(g.pagado_por_nombre)}</small>` : ''}${vouchers}`;
    },

    // Abre el voucher en una pestaña nueva (se pide con el token, por eso no es un enlace directo)
    async verVoucher(id, nombre) {
        const ventana = window.open('', '_blank');
        try {
            const response = await authManager.fetchWithAuth(`/api/gastos/vouchers/${encodeURIComponent(id)}`);
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
                enlace.download = nombre || 'voucher';
                enlace.click();
            }
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {
            ventana?.close();
            this.notificar(`No se pudo abrir el voucher: ${error.message}`, 'error');
        }
    },

    // Sube los vouchers del pago; devuelve los nombres de los que no se pudieron subir
    async subirVouchers(gasto, archivos) {
        const fallidos = [];
        for (const archivo of archivos) {
            try {
                const response = await authManager.fetchWithAuth(`/api/gastos/${gasto.id}/vouchers?nombre=${encodeURIComponent(archivo.name)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': archivo.type },
                    body: archivo
                });
                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.error || `Error ${response.status}`);
                }
            } catch (error) {
                fallidos.push(`${archivo.name} (${error.message})`);
            }
        }
        return fallidos;
    },

    render() {
        this.renderResumen();
        const contenedor = document.getElementById('gastosLista');
        if (!this.state.disponible) {
            contenedor.innerHTML = '<div class="cot-vacio"><p>Falta preparar la base de datos para los gastos.</p><small>En el servidor: cd backend && npm run migrate:gastos</small></div>';
            return;
        }
        const lista = this.state.gastos;
        if (!lista.length) {
            const filtrado = this.state.estado || this.state.busqueda.trim();
            contenedor.innerHTML = `<div class="cot-vacio"><p>${filtrado ? 'Ningún gasto coincide con los filtros.' : 'Aún no hay gastos registrados.'}</p>
                ${filtrado || !this.puedeEditar() ? '' : '<button type="button" class="btn btn-primary" onclick="GastosRequisiciones.formulario()"><i class="fas fa-plus" aria-hidden="true"></i> Nuevo gasto</button>'}</div>`;
            return;
        }
        contenedor.innerHTML = `
            <table class="data-table gastos-tabla">
                <thead><tr>
                    <th>Número</th><th>Creado</th><th>Gasto</th><th>Factura</th><th class="text-right">Monto</th>
                    <th>Cargado</th><th>Días en espera</th><th>Estado</th><th class="text-center">Acciones</th>
                </tr></thead>
                <tbody>${lista.map(g => `
                    <tr>
                        <td><strong>${this.e(g.numero)}</strong></td>
                        <td>${formatFecha(g.created_at)}<small class="cot-sub">${this.e(g.registrado_por_nombre || '')}</small></td>
                        <td><strong>${this.e(g.categoria)}</strong>${g.proveedor ? `<small class="cot-sub">${this.e(g.proveedor)}</small>` : ''}
                            ${g.descripcion ? `<small class="cot-sub" title="${this.e(g.descripcion)}">${this.e(g.descripcion)}</small>` : ''}</td>
                        <td>${g.numero_factura ? this.e(g.numero_factura) : '<small class="cot-sub">—</small>'}
                            ${g.fecha_factura ? `<small class="cot-sub">${formatFecha(g.fecha_factura)}</small>` : ''}</td>
                        <td class="text-right"><strong>${formatQ(g.monto)}</strong></td>
                        <td>${g.fecha_cargo ? formatFecha(g.fecha_cargo) : '<small class="cot-sub">—</small>'}</td>
                        <td>${this.celdaDias(g)}</td>
                        <td>${this.selectorEstado(g)}
                            ${g.estado === 'pagado' ? this.detallePago(g) : ''}
                            ${g.estado === 'anulado' && g.motivo_anulacion ? `<small class="cot-sub" title="${this.e(g.motivo_anulacion)}">${this.e(g.motivo_anulacion)}</small>` : ''}</td>
                        <td><div class="acciones-saldo">
                            ${this.puedeEditar() && ['pendiente', 'cargado'].includes(g.estado) ? `<button type="button" class="btn-accion btn-accion-icono" data-gasto-accion="editar" data-id="${g.id}" title="Editar" aria-label="Editar gasto ${this.e(g.numero)}"><i class="fas fa-pen" aria-hidden="true"></i></button>` : ''}
                            ${this.puedeEditar() && g.estado === 'pendiente' ? `<button type="button" class="btn-accion btn-accion-icono btn-accion-peligro" data-gasto-accion="eliminar" data-id="${g.id}" title="Eliminar" aria-label="Eliminar gasto ${this.e(g.numero)}"><i class="fas fa-trash" aria-hidden="true"></i></button>` : ''}
                        </div></td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
    },

    // Diálogo genérico con formulario; `enviar` devuelve una promesa o lanza el error a mostrar
    dialogo(titulo, cuerpo, textoBoton, enviar, alCerrar = () => {}) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-dialog inv-dialogo" role="dialog" aria-modal="true" aria-labelledby="gastoDialogoTitulo">
                <div class="modal-header">
                    <h2 id="gastoDialogoTitulo">${titulo}</h2>
                    <button type="button" class="close-btn" aria-label="Cerrar">&times;</button>
                </div>
                <form class="modal-body" novalidate>
                    ${cuerpo}
                    <p class="inv-error" role="alert" hidden></p>
                    <div class="inv-dialogo-acciones">
                        <button type="button" class="btn btn-secondary" data-cerrar>Cancelar</button>
                        <button type="submit" class="btn btn-primary">${textoBoton}</button>
                    </div>
                </form>
            </div>`;
        document.body.appendChild(overlay);
        const error = overlay.querySelector('.inv-error');
        const cerrar = (guardado = false) => {
            overlay.remove();
            document.removeEventListener('keydown', alTeclear);
            if (!guardado) alCerrar();
        };
        const alTeclear = (e) => { if (e.key === 'Escape') cerrar(); };
        document.addEventListener('keydown', alTeclear);
        overlay.querySelector('.close-btn').addEventListener('click', () => cerrar());
        overlay.querySelector('[data-cerrar]').addEventListener('click', () => cerrar());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
        const form = overlay.querySelector('form');
        form.addEventListener('input', () => { error.hidden = true; });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const boton = form.querySelector('button[type="submit"]');
            boton.disabled = true;
            try {
                await enviar(form);
                cerrar(true);
            } catch (err) {
                error.textContent = err.message;
                error.hidden = false;
            } finally {
                boton.disabled = false;
            }
        });
        setTimeout(() => form.querySelector('input, select, textarea')?.focus(), 0);
        return form;
    },

    formulario(gasto = null) {
        const v = (clave) => this.e(gasto?.[clave] ?? '');
        const categorias = [...new Set([...this.CATEGORIAS, ...this.state.categorias])];
        this.dialogo(
            gasto ? `Editar gasto ${this.e(gasto.numero)}` : 'Nuevo gasto',
            `<datalist id="gastoCategorias">${categorias.map(c => `<option value="${this.e(c)}"></option>`).join('')}</datalist>
            <div class="inv-campos">
                <div class="form-group">
                    <label for="gastoCategoria">Gasto <span class="required">*</span></label>
                    <input id="gastoCategoria" name="categoria" class="form-input" list="gastoCategorias" maxlength="60" required value="${v('categoria')}" placeholder="Luz, internet, teléfono…" autocomplete="off">
                </div>
                <div class="form-group">
                    <label for="gastoProveedor">Proveedor</label>
                    <input id="gastoProveedor" name="proveedor" class="form-input" maxlength="150" value="${v('proveedor')}" placeholder="EEGSA, Claro, Tigo…">
                </div>
                <div class="form-group">
                    <label for="gastoFactura">No. de factura</label>
                    <input id="gastoFactura" name="numero_factura" class="form-input" maxlength="60" value="${v('numero_factura')}" autocomplete="off">
                </div>
                <div class="form-group">
                    <label for="gastoFechaFactura">Fecha de la factura</label>
                    <input id="gastoFechaFactura" name="fecha_factura" type="date" class="form-input" value="${v('fecha_factura')}">
                </div>
                <div class="form-group">
                    <label for="gastoMonto">Monto (Q) <span class="required">*</span></label>
                    <input id="gastoMonto" name="monto" type="number" min="0.01" step="0.01" class="form-input" required value="${gasto ? Number(gasto.monto) : ''}">
                </div>
                <div class="form-group inv-ancho">
                    <label for="gastoDescripcion">Descripción</label>
                    <textarea id="gastoDescripcion" name="descripcion" class="form-input" rows="2" maxlength="2000" placeholder="Ej.: consumo de octubre">${v('descripcion')}</textarea>
                </div>
            </div>
            ${gasto ? '' : '<p class="form-hint">Queda pendiente. Cuando se cargue para que el dueño lo pague, cámbielo a «Esperando pago» en el listado.</p>'}`,
            `<i class="fas fa-save" aria-hidden="true"></i> ${gasto ? 'Guardar' : 'Registrar gasto'}`,
            async (form) => {
                const datos = Object.fromEntries(new FormData(form));
                if (!datos.categoria.trim()) throw new Error('Indique qué gasto es (luz, internet, teléfono…).');
                if (!(Number(datos.monto) > 0)) throw new Error('El monto debe ser mayor a cero.');
                const data = await this.api(gasto ? `/${gasto.id}` : '', {
                    method: gasto ? 'PUT' : 'POST',
                    body: JSON.stringify({ ...datos, monto: Number(datos.monto) })
                });
                this.notificar(data.message, 'success');
                await this.cargar();
            }
        );
    },

    async enviarEstado(gasto, cuerpo) {
        const data = await this.api(`/${gasto.id}/estado`, { method: 'PUT', body: JSON.stringify(cuerpo) });
        this.notificar(data.message, 'success');
        await this.cargar();
    },

    cambiarEstado(select) {
        const gasto = this.state.gastos.find(g => String(g.id) === select.dataset.id);
        if (!gasto) return;
        const estado = select.value;
        const deshacer = () => { select.value = gasto.estado; };
        if (estado === 'cargado') {
            this.dialogo(`Cargar ${this.e(gasto.numero)} · ${formatQ(gasto.monto)}`,
                `<div class="form-group">
                    <label for="gastoFechaCargo">Fecha en que se cargó <span class="required">*</span></label>
                    <input id="gastoFechaCargo" type="date" class="form-input" required max="${this.hoy()}" value="${gasto.fecha_cargo || this.hoy()}">
                </div>
                <p class="form-hint">Desde esta fecha se cuentan los días que lleva esperando el pago del dueño.</p>`,
                '<i class="fas fa-check" aria-hidden="true"></i> Cargar',
                (form) => this.enviarEstado(gasto, { estado, fecha: form.querySelector('#gastoFechaCargo').value }),
                deshacer);
        } else if (estado === 'pagado') {
            this.dialogo(`Pago de ${this.e(gasto.numero)} · ${formatQ(gasto.monto)}`,
                `<div class="form-group">
                    <label for="gastoFechaPago">Fecha del pago <span class="required">*</span></label>
                    <input id="gastoFechaPago" type="date" class="form-input" required max="${this.hoy()}" value="${this.hoy()}">
                </div>
                <div class="form-group">
                    <label for="gastoFormaPago">Forma de pago <span class="required">*</span></label>
                    <select id="gastoFormaPago" class="form-input">
                        ${Object.entries(this.FORMAS_PAGO).map(([v, t]) => `<option value="${v}" ${v === 'transferencia' ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="gastoNumeroBanco">No. de pago que da el banco <span class="required" data-gasto-banco>*</span></label>
                    <input id="gastoNumeroBanco" class="form-input" maxlength="60" autocomplete="off" inputmode="numeric">
                </div>
                <div class="form-group">
                    <label for="gastoAutorizacion">No. de autorización <span class="required" data-gasto-banco>*</span></label>
                    <input id="gastoAutorizacion" class="form-input" maxlength="60" autocomplete="off" inputmode="numeric">
                </div>
                <p class="form-hint" id="gastoBancoAyuda" hidden>En efectivo no hay número del banco ni de autorización.</p>
                <div class="form-group">
                    <div class="compra-pago-subtitulo">Voucher de pago (opcional)</div>
                    <ul class="compra-vouchers" id="gastoVoucherLista"></ul>
                    <label class="btn btn-secondary btn-small" for="gastoVoucher">
                        <i class="fas fa-paperclip" aria-hidden="true"></i> Adjuntar voucher
                    </label>
                    <input type="file" id="gastoVoucher" accept="application/pdf,image/jpeg,image/png,image/webp" multiple hidden>
                    <small class="form-hint">PDF, JPG, PNG o WEBP de hasta 10 MB.</small>
                </div>`,
                '<i class="fas fa-check" aria-hidden="true"></i> Marcar como pagado',
                async (form) => {
                    const forma = form.querySelector('#gastoFormaPago').value;
                    const numeroBanco = form.querySelector('#gastoNumeroBanco').value.trim();
                    const autorizacion = form.querySelector('#gastoAutorizacion').value.trim();
                    if (forma !== 'efectivo' && (!numeroBanco || !autorizacion)) {
                        throw new Error('Registre el número de pago que da el banco y el número de autorización.');
                    }
                    const data = await this.api(`/${gasto.id}/estado`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            estado,
                            fecha: form.querySelector('#gastoFechaPago').value,
                            forma_pago: forma,
                            numero_pago_banco: numeroBanco,
                            numero_autorizacion: autorizacion
                        })
                    });
                    // El pago ya quedó guardado: si un voucher falla solo se avisa
                    const fallidos = archivos.length ? await this.subirVouchers(gasto, archivos) : [];
                    this.notificar(data.message, 'success');
                    if (fallidos.length) this.notificar(`No se subieron estos vouchers: ${fallidos.join(', ')}`, 'warning');
                    await this.cargar();
                },
                deshacer);
            const archivos = [];
            const lista = document.getElementById('gastoVoucherLista');
            const renderArchivos = () => {
                lista.innerHTML = archivos.map((archivo, i) => `
                    <li>
                        <span>${this.e(archivo.name)}</span>
                        <small>${Math.max(1, Math.round(archivo.size / 1024))} KB</small>
                        <button type="button" class="btn-icon btn-delete" data-quitar="${i}" title="Quitar" aria-label="Quitar ${this.e(archivo.name)}"><i class="fas fa-times"></i></button>
                    </li>`).join('');
            };
            document.getElementById('gastoVoucher').addEventListener('change', (e) => {
                for (const archivo of e.target.files) {
                    if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(archivo.type)) {
                        this.notificar(`"${archivo.name}" no es PDF, JPG, PNG o WEBP.`, 'warning');
                    } else if (archivo.size > 10 * 1024 * 1024) {
                        this.notificar(`"${archivo.name}" pesa más de 10 MB.`, 'warning');
                    } else {
                        archivos.push(archivo);
                    }
                }
                e.target.value = '';
                renderArchivos();
            });
            lista.addEventListener('click', (e) => {
                const quitar = e.target.closest('[data-quitar]');
                if (!quitar) return;
                archivos.splice(Number(quitar.dataset.quitar), 1);
                renderArchivos();
            });
            // En efectivo los números del banco no aplican
            const forma = document.getElementById('gastoFormaPago');
            const actualizar = () => {
                const efectivo = forma.value === 'efectivo';
                document.querySelectorAll('[data-gasto-banco]').forEach(el => { el.hidden = efectivo; });
                document.getElementById('gastoBancoAyuda').hidden = !efectivo;
            };
            forma.addEventListener('change', actualizar);
            actualizar();
        } else if (estado === 'anulado') {
            this.dialogo(`Anular ${this.e(gasto.numero)}`,
                `<div class="form-group">
                    <label for="gastoMotivo">Motivo de la anulación <span class="required">*</span></label>
                    <textarea id="gastoMotivo" class="form-input" rows="2" maxlength="500" required></textarea>
                </div>`,
                'Anular gasto',
                (form) => this.enviarEstado(gasto, { estado, motivo: form.querySelector('#gastoMotivo').value }),
                deshacer);
        } else {
            if (!confirm(`¿Regresar ${gasto.numero} a pendiente? Se borran sus fechas de carga y de pago.`)) {
                deshacer();
                return;
            }
            this.enviarEstado(gasto, { estado }).catch(error => {
                deshacer();
                this.notificar(error.message, 'error');
            });
        }
    },

    async eliminar(gasto) {
        if (!confirm(`¿Eliminar el gasto ${gasto.numero}? No se puede deshacer.`)) return;
        try {
            const data = await this.api(`/${gasto.id}`, { method: 'DELETE' });
            this.notificar(data.message, 'success');
            await this.cargar();
        } catch (error) {
            this.notificar(error.message, 'error');
        }
    }
};

window.GastosRequisiciones = GastosRequisiciones;
