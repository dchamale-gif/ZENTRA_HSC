// ============================================
// ABONOS: PAGOS EN PARTES
// Recuadro común a requisiciones, gastos y compras sueltas: muestra lo abonado y el saldo,
// y registra un abono más (fecha, monto, forma de pago, números del banco o referencia y voucher).
// Cada módulo le pasa cómo registrar, quitar y subir vouchers en su propia API.
// ============================================

const Abonos = {
    FORMAS_PAGO: { efectivo: 'Efectivo', tarjeta: 'Tarjeta de crédito', transferencia: 'Transferencia', cheque: 'Cheque' },

    e(valor) {
        return escapeHtml(valor ?? '');
    },

    notificar(mensaje, tipo = 'info') {
        if (typeof showNotification === 'function') showNotification(mensaje, tipo);
        else alert(mensaje);
    },

    hoy() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.REGION.timeZone }).format(new Date());
    },

    pagado(abonos) {
        return (abonos || []).reduce((s, a) => s + Number(a.monto || 0), 0);
    },

    saldo(total, abonos) {
        return Math.max(0, Number((Number(total || 0) - this.pagado(abonos)).toFixed(2)));
    },

    // "Abonado Q 15.00 de Q 40.00 · saldo Q 25.00" para los listados
    resumenTexto(total, abonos) {
        return `Abonado ${formatQ(this.pagado(abonos))} de ${formatQ(total)} · saldo ${formatQ(this.saldo(total, abonos))}`;
    },

    detalle(a) {
        const partes = [];
        if (a.numero_pago_banco) partes.push(`Banco ${this.e(a.numero_pago_banco)}`);
        if (a.numero_autorizacion) partes.push(`Aut. ${this.e(a.numero_autorizacion)}`);
        if (a.referencia) partes.push(`Ref. ${this.e(a.referencia)}`);
        if (a.registrado_por) partes.push(`Por ${this.e(a.registrado_por)}`);
        return partes.join(' · ');
    },

    /**
     * opciones: titulo, subtitulo, total, abonos, puedeEditar,
     *   exigirBanco (requisiciones y gastos piden los números del banco; las compras, una referencia),
     *   registrar(datos) -> { message, abono_id }, eliminar(abono) -> { message },
     *   subirVoucher(abonoId, archivo), verVoucher(id, nombre), alTerminar()
     */
    dialogo(op) {
        const saldo = this.saldo(op.total, op.abonos);
        const pagado = this.pagado(op.abonos);
        const puedeAbonar = op.puedeEditar && saldo > 0;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-dialog req-detalle abonos-dialogo" role="dialog" aria-modal="true" aria-labelledby="abonosTitulo">
                <div class="modal-header">
                    <h2 id="abonosTitulo">${op.titulo}</h2>
                    <button type="button" class="close-btn" aria-label="Cerrar">&times;</button>
                </div>
                <form class="modal-body" novalidate>
                    ${op.subtitulo ? `<p class="form-hint">${op.subtitulo}</p>` : ''}
                    <dl class="abonos-resumen">
                        <div><dt>Total</dt><dd>${formatQ(op.total)}</dd></div>
                        <div><dt>Abonado</dt><dd>${formatQ(pagado)}</dd></div>
                        <div class="${saldo > 0 ? 'abonos-saldo' : 'abonos-saldado'}"><dt>Saldo</dt><dd>${formatQ(saldo)}</dd></div>
                    </dl>
                    ${(op.abonos || []).length ? `
                    <div class="table-responsive">
                        <table class="data-table abonos-tabla">
                            <thead><tr><th>Fecha</th><th>Forma de pago</th><th>Detalle</th><th class="text-right">Monto</th>${op.puedeEditar ? '<th></th>' : ''}</tr></thead>
                            <tbody>${op.abonos.map(a => `<tr>
                                <td>${formatFecha(a.fecha)}</td>
                                <td>${this.FORMAS_PAGO[a.forma_pago] || this.e(a.forma_pago)}</td>
                                <td><small class="cot-sub">${this.detalle(a) || '—'}</small>
                                    ${(a.vouchers || []).map(v => `<button type="button" class="btn-link gasto-voucher" data-abono-voucher="${v.id}" data-nombre="${this.e(v.nombre)}"><i class="fas fa-paperclip" aria-hidden="true"></i> ${this.e(v.nombre)}</button>`).join('')}</td>
                                <td class="text-right"><strong>${formatQ(a.monto)}</strong></td>
                                ${op.puedeEditar ? `<td><button type="button" class="btn-icon btn-delete" data-quitar-abono="${a.id}" title="Quitar este abono" aria-label="Quitar el abono de ${formatQ(a.monto)}"><i class="fas fa-trash"></i></button></td>` : ''}
                            </tr>`).join('')}</tbody>
                        </table>
                    </div>` : '<p class="cot-sub">Aún no hay abonos.</p>'}
                    ${puedeAbonar ? `
                    <div class="compra-pago-subtitulo">Nuevo abono</div>
                    <div class="inv-campos">
                        <div class="form-group">
                            <label for="abonoMonto">Monto (Q) <span class="required">*</span></label>
                            <input id="abonoMonto" type="number" class="form-input" min="0.01" max="${saldo}" step="0.01" value="${saldo.toFixed(2)}" required>
                            <small class="form-hint">Puede pagar todo el saldo o solo una parte.</small>
                        </div>
                        <div class="form-group">
                            <label for="abonoFecha">Fecha del pago <span class="required">*</span></label>
                            <input id="abonoFecha" type="date" class="form-input" required max="${this.hoy()}" value="${this.hoy()}">
                        </div>
                        <div class="form-group">
                            <label for="abonoForma">Forma de pago <span class="required">*</span></label>
                            <select id="abonoForma" class="form-input">
                                ${Object.entries(this.FORMAS_PAGO).map(([v, t]) => `<option value="${v}" ${v === 'transferencia' ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>
                        ${op.exigirBanco ? `
                        <div class="form-group" data-abono-banco>
                            <label for="abonoBanco">No. de pago que da el banco <span class="required">*</span></label>
                            <input id="abonoBanco" class="form-input" maxlength="60" autocomplete="off" inputmode="numeric">
                        </div>
                        <div class="form-group" data-abono-banco>
                            <label for="abonoAutorizacion">No. de autorización <span class="required">*</span></label>
                            <input id="abonoAutorizacion" class="form-input" maxlength="60" autocomplete="off" inputmode="numeric">
                        </div>` : `
                        <div class="form-group">
                            <label for="abonoReferencia">Referencia</label>
                            <input id="abonoReferencia" class="form-input" maxlength="60" autocomplete="off" placeholder="No. de transferencia, cheque, recibo…">
                        </div>`}
                    </div>
                    ${op.exigirBanco ? '<p class="form-hint" id="abonoBancoAyuda" hidden>En efectivo no hay número del banco ni de autorización.</p>' : ''}
                    <div class="form-group">
                        <div class="compra-pago-subtitulo">Voucher de este abono (opcional)</div>
                        <ul class="compra-vouchers" id="abonoVoucherLista"></ul>
                        <label class="btn btn-secondary btn-small" for="abonoVoucher">
                            <i class="fas fa-paperclip" aria-hidden="true"></i> Adjuntar voucher
                        </label>
                        <input type="file" id="abonoVoucher" accept="application/pdf,image/jpeg,image/png,image/webp" multiple hidden>
                        <small class="form-hint">PDF, JPG, PNG o WEBP de hasta 10 MB.</small>
                    </div>` : ''}
                    <p class="inv-error" role="alert" hidden></p>
                    <div class="inv-dialogo-acciones">
                        <button type="button" class="btn btn-secondary" data-cerrar>${puedeAbonar ? 'Cancelar' : 'Cerrar'}</button>
                        ${puedeAbonar ? '<button type="submit" class="btn btn-primary"><i class="fas fa-check" aria-hidden="true"></i> Registrar abono</button>' : ''}
                    </div>
                </form>
            </div>`;
        document.body.appendChild(overlay);
        const form = overlay.querySelector('form');
        const error = overlay.querySelector('.inv-error');
        const archivos = [];
        const cerrar = () => {
            overlay.remove();
            document.removeEventListener('keydown', alTeclear);
        };
        const alTeclear = (e) => { if (e.key === 'Escape') cerrar(); };
        document.addEventListener('keydown', alTeclear);
        overlay.querySelector('.close-btn').addEventListener('click', cerrar);
        overlay.querySelector('[data-cerrar]').addEventListener('click', cerrar);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
        form.addEventListener('input', () => { error.hidden = true; });

        // Vouchers de abonos anteriores y quitar un abono
        overlay.addEventListener('click', async (e) => {
            const voucher = e.target.closest('[data-abono-voucher]');
            if (voucher) {
                op.verVoucher(voucher.dataset.abonoVoucher, voucher.dataset.nombre);
                return;
            }
            const quitar = e.target.closest('[data-quitar-abono]');
            if (!quitar) return;
            const abono = op.abonos.find(a => String(a.id) === quitar.dataset.quitarAbono);
            if (!abono || !confirm(`¿Quitar el abono de ${formatQ(abono.monto)} del ${formatFecha(abono.fecha)}?`)) return;
            quitar.disabled = true;
            try {
                const data = await op.eliminar(abono);
                this.notificar(data.message || 'Abono quitado', 'success');
                cerrar();
                await op.alTerminar();
            } catch (err) {
                quitar.disabled = false;
                this.notificar(err.message, 'error');
            }
        });
        if (!puedeAbonar) return;

        // En efectivo los números del banco no aplican
        const forma = form.querySelector('#abonoForma');
        if (op.exigirBanco) {
            const actualizar = () => {
                const efectivo = forma.value === 'efectivo';
                form.querySelectorAll('[data-abono-banco]').forEach(el => { el.hidden = efectivo; });
                form.querySelector('#abonoBancoAyuda').hidden = !efectivo;
            };
            forma.addEventListener('change', actualizar);
            actualizar();
        }
        const lista = form.querySelector('#abonoVoucherLista');
        const renderArchivos = () => {
            lista.innerHTML = archivos.map((archivo, i) => `
                <li>
                    <span>${this.e(archivo.name)}</span>
                    <small>${Math.max(1, Math.round(archivo.size / 1024))} KB</small>
                    <button type="button" class="btn-icon btn-delete" data-quitar="${i}" title="Quitar" aria-label="Quitar ${this.e(archivo.name)}"><i class="fas fa-times"></i></button>
                </li>`).join('');
        };
        form.querySelector('#abonoVoucher').addEventListener('change', (e) => {
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

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const boton = form.querySelector('button[type="submit"]');
            const monto = Number(form.querySelector('#abonoMonto').value);
            const datos = {
                monto,
                fecha: form.querySelector('#abonoFecha').value,
                forma_pago: forma.value,
                numero_pago_banco: form.querySelector('#abonoBanco')?.value.trim() || null,
                numero_autorizacion: form.querySelector('#abonoAutorizacion')?.value.trim() || null,
                referencia: form.querySelector('#abonoReferencia')?.value.trim() || null
            };
            const mostrar = (mensaje) => { error.textContent = mensaje; error.hidden = false; };
            if (!(monto > 0)) return mostrar('El monto debe ser mayor a cero.');
            if (monto > saldo + 0.005) return mostrar(`El abono no puede pasar del saldo (${formatQ(saldo)}).`);
            if (!datos.fecha) return mostrar('Indique la fecha del pago.');
            if (op.exigirBanco && datos.forma_pago !== 'efectivo' && (!datos.numero_pago_banco || !datos.numero_autorizacion)) {
                return mostrar('Registre el número de pago que da el banco y el número de autorización.');
            }
            boton.disabled = true;
            try {
                const data = await op.registrar(datos);
                // El abono ya quedó guardado: si un voucher falla solo se avisa
                const fallidos = [];
                for (const archivo of archivos) {
                    try {
                        await op.subirVoucher(data.abono_id, archivo);
                    } catch (err) {
                        fallidos.push(`${archivo.name} (${err.message})`);
                    }
                }
                this.notificar(data.message || 'Abono registrado', 'success');
                if (fallidos.length) this.notificar(`No se subieron estos vouchers: ${fallidos.join(', ')}`, 'warning');
                cerrar();
                await op.alTerminar();
            } catch (err) {
                mostrar(err.message);
                boton.disabled = false;
            }
        });
        setTimeout(() => form.querySelector('#abonoMonto')?.focus(), 0);
    },

    // Sube un voucher a la API del módulo, ligado al abono
    async subirVoucher(url, abonoId, archivo) {
        const response = await authManager.fetchWithAuth(`${url}?nombre=${encodeURIComponent(archivo.name)}&abono_id=${encodeURIComponent(abonoId || '')}`, {
            method: 'POST',
            headers: { 'Content-Type': archivo.type },
            body: archivo
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Error ${response.status}`);
        }
    }
};

window.Abonos = Abonos;
