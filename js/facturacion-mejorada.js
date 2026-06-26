// ============================================
// MÓDULO DE FACTURACIÓN MEJORADA
// Con descuentos robustos y integración con saldo
// ============================================

const FacturacionMejorada = {
    state: {
        facturas: [],
        items_actuales: [],
        descuentos_aplicados: [],
        paciente_seleccionado: null,
        config: {
            impuesto_iva: 12,
            moneda: 'GTQ',
            simbolo_moneda: 'Q'
        },
        totales: {
            subtotal: 0,
            total_descuentos: 0,
            total_impuestos: 0,
            total_neto: 0
        }
    },

    // Inicializar
    init() {
        this.setupEventListeners();
        this.loadFacturas();
        console.log('Módulo de Facturación Mejorada inicializado');
    },

    // ============================================
    // EVENT LISTENERS
    // ============================================

    setupEventListeners() {
        // Búsqueda de paciente
        const inputBusquedaPaciente = document.getElementById('busquedaPaciente');
        if (inputBusquedaPaciente) {
            inputBusquedaPaciente.addEventListener('input', (e) => this.buscarPaciente(e.target.value));
        }

        // Botones principales
        const btnNuevaFactura = document.getElementById('btnNuevaFacturaM');
        if (btnNuevaFactura) {
            btnNuevaFactura.addEventListener('click', () => this.abrirModalNuevaFactura());
        }

        const btnGuardar = document.getElementById('btnGuardarFacturaM');
        if (btnGuardar) {
            btnGuardar.addEventListener('click', () => this.guardarFactura());
        }

        const btnCancelar = document.getElementById('btnCancelarFacturaM');
        if (btnCancelar) {
            btnCancelar.addEventListener('click', () => this.cerrarModalFactura());
        }

        // Items
        const btnAgregarItem = document.getElementById('btnAgregarItemM');
        if (btnAgregarItem) {
            btnAgregarItem.addEventListener('click', () => this.agregarItem());
        }

        // Descuentos
        const btnAgregarDescuento = document.getElementById('btnAgregarDescuentoM');
        if (btnAgregarDescuento) {
            btnAgregarDescuento.addEventListener('click', () => this.abrirModalDescuento());
        }
    },

    // ============================================
    // GESTIÓN DE FACTURAS
    // ============================================

    abrirModalNuevaFactura() {
        this.state.items_actuales = [];
        this.state.descuentos_aplicados = [];
        this.state.paciente_seleccionado = null;
        this.actualizarTotales();

        const modal = document.getElementById('modalFacturaM');
        if (modal) {
            modal.style.display = 'block';
        }
    },

    cerrarModalFactura() {
        const modal = document.getElementById('modalFacturaM');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    buscarPaciente(termino) {
        if (!termino) {
            document.getElementById('resultadosBusquedaPaciente').innerHTML = '';
            return;
        }

        const pacientes = this.getPacientes(); // Obtener de localStorage o API
        const resultados = pacientes.filter(p => 
            p.nombre.toLowerCase().includes(termino.toLowerCase()) ||
            p.apellidoPaterno.toLowerCase().includes(termino.toLowerCase()) ||
            p.dpi.includes(termino)
        );

        const html = resultados.map(p => `
            <div class="resultado-paciente" onclick="FacturacionMejorada.seleccionarPaciente('${p.id}', '${p.nombre} ${p.apellidoPaterno}')">
                <strong>${p.nombre} ${p.apellidoPaterno}</strong> - DPI: ${p.dpi}
                <span class="saldo" id="saldo-${p.id}"></span>
            </div>
        `).join('');

        document.getElementById('resultadosBusquedaPaciente').innerHTML = html;
    },

    seleccionarPaciente(pacienteId, nombrePaciente) {
        this.state.paciente_seleccionado = { id: pacienteId, nombre: nombrePaciente };
        document.getElementById('busquedaPaciente').value = nombrePaciente;
        document.getElementById('resultadosBusquedaPaciente').innerHTML = '';
        document.getElementById('pacienteIdFactura').value = pacienteId;
        
        this.cargarSaldoPaciente(pacienteId);
    },

    async cargarSaldoPaciente(pacienteId) {
        try {
            const response = await fetch(`http://localhost:3011/api/saldo-paciente/${pacienteId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            const result = await response.json();
            if (result.success) {
                const elemento = document.getElementById('saldoActualPaciente');
                if (elemento) {
                    elemento.innerHTML = `
                        <strong>Saldo Actual:</strong> 
                        ${this.formatearMoneda(result.data.saldo_pendiente)} / 
                        Total Deuda: ${this.formatearMoneda(result.data.total_deuda)}
                    `;
                }
            }
        } catch (error) {
            console.error('Error al cargar saldo:', error);
        }
    },

    // ============================================
    // GESTIÓN DE ITEMS
    // ============================================

    agregarItem() {
        const descripcion = document.getElementById('descripcionItemM')?.value;
        const cantidad = parseFloat(document.getElementById('cantidadItemM')?.value);
        const precio = parseFloat(document.getElementById('precioItemM')?.value);

        if (!descripcion || !cantidad || !precio || cantidad <= 0 || precio <= 0) {
            alert('Complete todos los campos correctamente');
            return;
        }

        const item = {
            id: this.generarIdItem(),
            descripcion: descripcion,
            cantidad: cantidad,
            precio_unitario: precio,
            subtotal: cantidad * precio,
            descuentos: [],
            descuento_total: 0,
            total_item: cantidad * precio
        };

        this.state.items_actuales.push(item);
        this.limpiarFormItem();
        this.renderizarItems();
        this.actualizarTotales();
    },

    limpiarFormItem() {
        document.getElementById('descripcionItemM').value = '';
        document.getElementById('cantidadItemM').value = '';
        document.getElementById('precioItemM').value = '';
    },

    renderizarItems() {
        const tbody = document.getElementById('itemsTableBodyM');
        if (!tbody) return;

        tbody.innerHTML = this.state.items_actuales.map((item, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${item.descripcion}</td>
                <td class="text-center">${item.cantidad}</td>
                <td class="text-right">${this.formatearMoneda(item.precio_unitario)}</td>
                <td class="text-right">${this.formatearMoneda(item.subtotal)}</td>
                <td class="text-right">
                    ${item.descuento_total > 0 ? `
                        <span class="badge badge-warning">${this.formatearMoneda(item.descuento_total)}</span>
                    ` : '-'}
                </td>
                <td class="text-right font-weight-bold">${this.formatearMoneda(item.total_item)}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-info" onclick="FacturacionMejorada.abrirDescuentoItem('${item.id}')">Desc</button>
                    <button class="btn btn-sm btn-danger" onclick="FacturacionMejorada.eliminarItem('${item.id}')">Elim</button>
                </td>
            </tr>
        `).join('');
    },

    eliminarItem(itemId) {
        this.state.items_actuales = this.state.items_actuales.filter(i => i.id !== itemId);
        this.renderizarItems();
        this.actualizarTotales();
    },

    // ============================================
    // GESTIÓN DE DESCUENTOS
    // ============================================

    abrirModalDescuento() {
        const modal = document.getElementById('modalDescuentoM');
        if (modal) {
            modal.style.display = 'block';
        }
    },

    cerrarModalDescuento() {
        const modal = document.getElementById('modalDescuentoM');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    agregarDescuentoFactura() {
        const tipo = document.getElementById('tipoDescuentoM')?.value;
        const valor = parseFloat(document.getElementById('valorDescuentoM')?.value);
        const motivo = document.getElementById('motivoDescuentoM')?.value;

        if (!tipo || !valor || valor <= 0) {
            alert('Ingrese un descuento válido');
            return;
        }

        // Validar según tipo
        if (tipo === 'porcentaje' && (valor < 0 || valor > 100)) {
            alert('El porcentaje debe estar entre 0 y 100');
            return;
        }

        const descuento = {
            id: this.generarIdDescuento(),
            tipo: tipo,
            valor: valor,
            motivo: motivo || 'No especificado',
            monto_aplicado: 0
        };

        this.state.descuentos_aplicados.push(descuento);
        this.limpiarFormDescuento();
        this.cerrarModalDescuento();
        this.actualizarTotales();
        this.renderizarDescuentos();
    },

    limpiarFormDescuento() {
        document.getElementById('tipoDescuentoM').value = 'porcentaje';
        document.getElementById('valorDescuentoM').value = '';
        document.getElementById('motivoDescuentoM').value = '';
    },

    renderizarDescuentos() {
        const tbody = document.getElementById('descuentosTableBodyM');
        if (!tbody) return;

        tbody.innerHTML = this.state.descuentos_aplicados.map((desc, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td><strong>${desc.tipo === 'porcentaje' ? desc.valor + '%' : this.formatearMoneda(desc.valor)}</strong></td>
                <td>${desc.tipo}</td>
                <td>${desc.motivo}</td>
                <td class="text-right font-weight-bold">${this.formatearMoneda(desc.monto_aplicado)}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-danger" onclick="FacturacionMejorada.eliminarDescuento('${desc.id}')">Eliminar</button>
                </td>
            </tr>
        `).join('');
    },

    eliminarDescuento(descId) {
        this.state.descuentos_aplicados = this.state.descuentos_aplicados.filter(d => d.id !== descId);
        this.renderizarDescuentos();
        this.actualizarTotales();
    },

    abrirDescuentoItem(itemId) {
        const item = this.state.items_actuales.find(i => i.id === itemId);
        if (!item) return;

        const tipo = prompt('Tipo de descuento:\n1. Porcentaje\n2. Cantidad Fija\n\nSeleccione 1 o 2:');
        if (!tipo) return;

        const tipoDesc = tipo === '1' ? 'porcentaje' : 'fijo';
        const valor = parseFloat(prompt(`Ingrese el valor (${tipoDesc}):`));

        if (isNaN(valor) || valor <= 0) {
            alert('Valor inválido');
            return;
        }

        if (tipoDesc === 'porcentaje' && (valor < 0 || valor > 100)) {
            alert('El porcentaje debe estar entre 0 y 100');
            return;
        }

        const motivo = prompt('Motivo del descuento (opcional):');

        const descuento = {
            id: this.generarIdDescuento(),
            tipo: tipoDesc,
            valor: valor,
            motivo: motivo || 'No especificado',
            monto: this.calcularDescuento(item.subtotal, tipoDesc, valor)
        };

        item.descuentos.push(descuento);
        item.descuento_total = item.descuentos.reduce((sum, d) => sum + d.monto, 0);
        item.descuento_total = Math.min(item.descuento_total, item.subtotal);
        item.total_item = item.subtotal - item.descuento_total;

        this.renderizarItems();
        this.actualizarTotales();
    },

    // ============================================
    // CÁLCULOS
    // ============================================

    calcularDescuento(base, tipo, valor) {
        if (tipo === 'porcentaje') {
            return (base * valor) / 100;
        } else if (tipo === 'fijo') {
            return Math.min(valor, base);
        }
        return 0;
    },

    actualizarTotales() {
        // Calcular subtotal
        let subtotal = this.state.items_actuales.reduce((sum, item) => sum + item.subtotal, 0);

        // Calcular descuentos
        let totalDescuentos = 0;

        // Descuentos de items
        this.state.items_actuales.forEach(item => {
            totalDescuentos += item.descuento_total || 0;
        });

        // Descuentos de factura
        this.state.descuentos_aplicados.forEach(desc => {
            const monto = desc.tipo === 'porcentaje' 
                ? (subtotal * desc.valor) / 100 
                : desc.valor;
            desc.monto_aplicado = monto;
            totalDescuentos += monto;
        });

        totalDescuentos = Math.min(totalDescuentos, subtotal);

        const baseImpuesto = subtotal - totalDescuentos;
        const impuestos = (baseImpuesto * this.state.config.impuesto_iva) / 100;
        const total = baseImpuesto + impuestos;

        this.state.totales = {
            subtotal: subtotal,
            total_descuentos: totalDescuentos,
            base_impuesto: baseImpuesto,
            total_impuestos: impuestos,
            total_neto: total
        };

        this.renderizarTotales();
    },

    renderizarTotales() {
        const elem = document.getElementById('totalesFacturaM');
        if (!elem) return;

        elem.innerHTML = `
            <div class="totales-factura">
                <div class="total-row">
                    <span>Subtotal:</span>
                    <strong>${this.formatearMoneda(this.state.totales.subtotal)}</strong>
                </div>
                ${this.state.totales.total_descuentos > 0 ? `
                    <div class="total-row descuento">
                        <span>Descuentos:</span>
                        <strong>-${this.formatearMoneda(this.state.totales.total_descuentos)}</strong>
                    </div>
                ` : ''}
                <div class="total-row">
                    <span>Base Imponible:</span>
                    <strong>${this.formatearMoneda(this.state.totales.base_impuesto)}</strong>
                </div>
                <div class="total-row">
                    <span>IVA ${this.state.config.impuesto_iva}%:</span>
                    <strong>${this.formatearMoneda(this.state.totales.total_impuestos)}</strong>
                </div>
                <div class="total-row total-final">
                    <span>TOTAL A PAGAR:</span>
                    <strong>${this.formatearMoneda(this.state.totales.total_neto)}</strong>
                </div>
            </div>
        `;
    },

    // ============================================
    // GUARDAR FACTURA
    // ============================================

    async guardarFactura() {
        if (this.state.items_actuales.length === 0) {
            alert('Debe agregar al menos un item');
            return;
        }

        if (!this.state.paciente_seleccionado) {
            alert('Debe seleccionar un paciente');
            return;
        }

        const factura = {
            paciente_id: this.state.paciente_seleccionado.id,
            items: this.state.items_actuales,
            descuentos: this.state.descuentos_aplicados,
            totales: this.state.totales,
            fecha: new Date().toISOString().split('T')[0],
            metodo_pago: document.getElementById('metodoPagoM')?.value || 'efectivo'
        };

        try {
            const response = await fetch('http://localhost:3011/api/billing/facturas-mejorada', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(factura)
            });

            const result = await response.json();

            if (result.success) {
                alert('Factura guardada exitosamente');
                this.cerrarModalFactura();
                this.imprimirRecibo(result.data);
                this.loadFacturas();
            } else {
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al guardar la factura');
        }
    },

    // ============================================
    // IMPRESIÓN
    // ============================================

    imprimirRecibo(factura) {
        const ventana = window.open('', '_blank', 'width=600,height=800');
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Recibo</title>
                <style>
                    body { font-family: Arial, sans-serif; width: 600px; margin: 0; padding: 20px; }
                    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .header p { margin: 5px 0; }
                    .info-row { display: flex; justify-content: space-between; margin: 10px 0; }
                    .label { font-weight: bold; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background-color: #f0f0f0; font-weight: bold; }
                    td.right { text-align: right; }
                    .totales { margin: 20px 0; border-top: 2px solid #000; padding-top: 10px; }
                    .total-row { display: flex; justify-content: space-between; margin: 5px 0; font-size: 14px; }
                    .total-final { font-size: 18px; font-weight: bold; border-top: 1px solid #000; padding-top: 10px; margin-top: 10px; }
                    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>RECIBO DE PAGO</h1>
                    <p>Factura #${factura.numero_factura || factura.id}</p>
                    <p>Fecha: ${new Date().toLocaleDateString('es-GT')}</p>
                </div>

                <div class="info-row">
                    <div><span class="label">Paciente:</span> ${factura.paciente_nombre}</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Descripción</th>
                            <th class="right">Cantidad</th>
                            <th class="right">Precio Unit.</th>
                            <th class="right">Subtotal</th>
                            <th class="right">Descuento</th>
                            <th class="right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${factura.items.map(item => `
                            <tr>
                                <td>${item.descripcion}</td>
                                <td class="right">${item.cantidad}</td>
                                <td class="right">Q${item.precio_unitario.toFixed(2)}</td>
                                <td class="right">Q${item.subtotal.toFixed(2)}</td>
                                <td class="right">Q${(item.descuento_total || 0).toFixed(2)}</td>
                                <td class="right">Q${(item.total_item || item.subtotal - (item.descuento_total || 0)).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="totales">
                    <div class="total-row">
                        <span>Subtotal:</span>
                        <strong>Q${factura.totales.subtotal.toFixed(2)}</strong>
                    </div>
                    ${factura.totales.total_descuentos > 0 ? `
                        <div class="total-row">
                            <span>Descuentos:</span>
                            <strong>-Q${factura.totales.total_descuentos.toFixed(2)}</strong>
                        </div>
                    ` : ''}
                    <div class="total-row">
                        <span>IVA 12%:</span>
                        <strong>Q${factura.totales.total_impuestos.toFixed(2)}</strong>
                    </div>
                    <div class="total-row total-final">
                        <span>TOTAL:</span>
                        <strong>Q${factura.totales.total_neto.toFixed(2)}</strong>
                    </div>
                </div>

                <div class="footer">
                    <p>Método de pago: ${factura.metodo_pago}</p>
                    <p>Gracias por su compra</p>
                </div>
            </body>
            </html>
        `;

        ventana.document.write(html);
        ventana.document.close();
        ventana.print();
    },

    // ============================================
    // ESTADO DE CUENTA
    // ============================================

    async imprimirEstadoCuenta(pacienteId) {
        try {
            const response = await fetch(`http://localhost:3011/api/billing/estado-cuenta/${pacienteId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            const result = await response.json();
            if (result.success) {
                this.generarEstadoCuentaPDF(result.data);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al generar estado de cuenta');
        }
    },

    generarEstadoCuentaPDF(data) {
        const ventana = window.open('', '_blank', 'width=800,height=900');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Estado de Cuenta</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
                    .container { max-width: 900px; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { margin: 0; font-size: 28px; }
                    .header h2 { margin: 10px 0 0 0; font-size: 18px; color: #666; }
                    .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
                    .info-box { }
                    .info-box label { display: block; font-weight: bold; margin-top: 10px; font-size: 12px; color: #666; }
                    .info-box p { margin: 3px 0; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { padding: 12px; text-align: left; border: 1px solid #ddd; }
                    th { background-color: #2c3e50; color: white; font-weight: bold; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .total-section { margin-top: 30px; border-top: 2px solid #000; padding-top: 20px; }
                    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
                    .total-row.grande { font-size: 18px; font-weight: bold; margin-top: 10px; }
                    .right { text-align: right; }
                    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>ESTADO DE CUENTA DETALLADO</h1>
                        <h2>Clínica / Centro Médico</h2>
                    </div>

                    <div class="info-section">
                        <div class="info-box">
                            <label>PACIENTE</label>
                            <p><strong>${data.paciente.nombre} ${data.paciente.apellidoPaterno} ${data.paciente.apellidoMaterno || ''}</strong></p>
                            <label style="margin-top: 15px;">DPI</label>
                            <p>${data.paciente.dpi}</p>
                            <label style="margin-top: 15px;">TELÉFONO</label>
                            <p>${data.paciente.telefono || 'N/A'}</p>
                        </div>
                        <div class="info-box">
                            <label>PERÍODO</label>
                            <p>Del ${new Date().toLocaleDateString('es-GT')} al ${new Date().toLocaleDateString('es-GT')}</p>
                            <label style="margin-top: 15px;">FECHA DE GENERACIÓN</label>
                            <p>${new Date().toLocaleString('es-GT')}</p>
                            <label style="margin-top: 15px;">MONEDA</label>
                            <p>Quetzales (Q)</p>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="width: 10%;">Fecha</th>
                                <th style="width: 25%;">Descripción</th>
                                <th style="width: 15%;">Concepto</th>
                                <th style="width: 15%; text-align: right;">Cargo</th>
                                <th style="width: 15%; text-align: right;">Abono</th>
                                <th style="width: 15%; text-align: right;">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.movimientos.map(mov => `
                                <tr>
                                    <td>${new Date(mov.fecha).toLocaleDateString('es-GT')}</td>
                                    <td>${mov.descripcion}</td>
                                    <td>${mov.tipo}</td>
                                    <td class="right">${mov.tipo === 'cargo' ? 'Q' + mov.monto.toFixed(2) : '-'}</td>
                                    <td class="right">${mov.tipo === 'abono' ? 'Q' + mov.monto.toFixed(2) : '-'}</td>
                                    <td class="right"><strong>Q${mov.saldo_acumulado.toFixed(2)}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="total-section">
                        <div class="total-row">
                            <span>Total de Cargos:</span>
                            <strong class="right">Q${data.totales.total_cargos.toFixed(2)}</strong>
                        </div>
                        <div class="total-row">
                            <span>Total de Abonos:</span>
                            <strong class="right">Q${data.totales.total_abonos.toFixed(2)}</strong>
                        </div>
                        <div class="total-row grande">
                            <span>SALDO ACTUAL:</span>
                            <strong class="right" style="color: ${data.totales.saldo_actual < 0 ? 'green' : 'red'};">Q${data.totales.saldo_actual.toFixed(2)}</strong>
                        </div>
                    </div>

                    <div class="footer">
                        <p>Este es un estado de cuenta oficial. Para consultas o aclaraciones, contáctenos.</p>
                        <p style="margin-top: 20px;">Impreso el: ${new Date().toLocaleString('es-GT')}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        ventana.document.write(html);
        ventana.document.close();
        ventana.print();
    },

    // ============================================
    // HELPERS
    // ============================================

    async loadFacturas() {
        try {
            const response = await fetch('http://localhost:3011/api/billing/facturas?limit=50', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            const result = await response.json();
            if (result.success) {
                this.state.facturas = result.data;
            }
        } catch (error) {
            console.error('Error al cargar facturas:', error);
        }
    },

    getPacientes() {
        return JSON.parse(localStorage.getItem('pacientes')) || [];
    },

    generarIdItem() {
        return 'ITEM-' + Date.now() + Math.random().toString(36).substr(2, 5);
    },

    generarIdDescuento() {
        return 'DESC-' + Date.now() + Math.random().toString(36).substr(2, 5);
    },

    formatearMoneda(valor) {
        return 'Q' + valor.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
};

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        FacturacionMejorada.init();
    });
} else {
    FacturacionMejorada.init();
}
