// ============================================
// MÓDULO DE FACTURACIÓN ROBUSTA
// Descuentos por Porcentaje y Cantidad Fija
// ============================================

const BillingModule = {
    state: {
        facturas: [],
        items_actuales: [],
        descuentos_disponibles: [],
        descuentos_aplicados: [],
        config: {
            impuesto_predeterminado: 12, // IVA 12%
            moneda: 'GTQ'
        },
        totales: {
            subtotal: 0,
            total_descuentos: 0,
            total_impuestos: 0,
            total: 0
        }
    },

    // Inicializar módulo
    init() {
        this.setupEventListeners();
        this.setupUI();
        console.log('Módulo de Facturación inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        const btnNuevaFactura = document.getElementById('btnNuevaFactura');
        if (btnNuevaFactura) {
            btnNuevaFactura.addEventListener('click', () => this.openNewBillingModal());
        }

        const btnAgregarItem = document.getElementById('btnAgregarItem');
        if (btnAgregarItem) {
            btnAgregarItem.addEventListener('click', () => this.openAddItemModal());
        }

        const btnGuardarFactura = document.getElementById('btnGuardarFactura');
        if (btnGuardarFactura) {
            btnGuardarFactura.addEventListener('click', () => this.guardarFactura());
        }

        const btnAgregarDescuento = document.getElementById('btnAgregarDescuento');
        if (btnAgregarDescuento) {
            btnAgregarDescuento.addEventListener('click', () => this.openAddDiscountModal());
        }

        // Event delegation para eliminar items
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-eliminar-item')) {
                const itemId = e.target.dataset.itemId;
                this.eliminarItem(itemId);
            }
            if (e.target.classList.contains('btn-eliminar-descuento')) {
                const descId = e.target.dataset.descId;
                this.eliminarDescuento(descId);
            }
        });
    },

    // Configurar UI
    setupUI() {
        const container = document.getElementById('billingContainer');
        if (!container) {
            const div = document.createElement('div');
            div.id = 'billingContainer';
            div.innerHTML = this.getTemplate();
            document.body.appendChild(div);
        }
    },

    // ============================================
    // GESTIÓN DE FACTURAS
    // ============================================

    /**
     * Abrir modal de nueva factura
     */
    openNewBillingModal() {
        this.state.items_actuales = [];
        this.state.descuentos_aplicados = [];
        this.actualizarTotales();
        
        const modal = document.getElementById('billingModal');
        if (modal) {
            modal.style.display = 'block';
            this.cargarClientesPredeterminados();
        }
    },

    /**
     * Guardar factura
     */
    async guardarFactura() {
        try {
            if (this.state.items_actuales.length === 0) {
                alert('Debe agregar al menos un item a la factura');
                return;
            }

            const cliente_id = document.getElementById('clienteSelect')?.value || null;
            const metodo_pago = document.getElementById('metodoPago')?.value || 'efectivo';
            const observaciones = document.getElementById('observaciones')?.value || '';

            const datos = {
                numero_factura: this.generarNumeroFactura(),
                cliente_id: cliente_id,
                items: this.state.items_actuales,
                descuentos: this.state.descuentos_aplicados,
                metodo_pago: metodo_pago,
                observaciones: observaciones
            };

            const response = await fetch('http://localhost:3011/api/billing/facturas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(datos)
            });

            const result = await response.json();

            if (result.success) {
                alert('Factura creada exitosamente: ' + result.data.numero_factura);
                this.cerrarModal('billingModal');
                this.cargarFacturas();
                this.imprimirFactura(result.data);
            } else {
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error('Error al guardar factura:', error);
            alert('Error al guardar la factura');
        }
    },

    /**
     * Cargar lista de facturas
     */
    async cargarFacturas() {
        try {
            const response = await fetch('http://localhost:3011/api/billing/facturas?limit=50', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();
            if (result.success) {
                this.state.facturas = result.data;
                this.renderFacturas();
            }
        } catch (error) {
            console.error('Error al cargar facturas:', error);
        }
    },

    /**
     * Obtener detalles de una factura
     */
    async obtenerDetallesFactura(factura_id) {
        try {
            const response = await fetch(`http://localhost:3011/api/billing/facturas/${factura_id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();
            if (result.success) {
                return result.data;
            }
        } catch (error) {
            console.error('Error al obtener detalles de factura:', error);
        }
    },

    // ============================================
    // GESTIÓN DE ITEMS
    // ============================================

    /**
     * Abrir modal para agregar item
     */
    openAddItemModal() {
        const modal = document.getElementById('itemModal');
        if (modal) {
            modal.style.display = 'block';
            document.getElementById('itemForm').reset();
        }
    },

    /**
     * Agregar item a la factura
     */
    agregarItem() {
        try {
            const cantidad = parseInt(document.getElementById('cantidad').value);
            const precio = parseFloat(document.getElementById('precio').value);
            const descripcion = document.getElementById('descripcion').value;
            const tipo_item = document.getElementById('tipoItem').value;

            if (!cantidad || !precio || !descripcion) {
                alert('Complete todos los campos');
                return;
            }

            const item = {
                id: 'ITEM-' + Date.now(),
                descripcion: descripcion,
                tipo: tipo_item,
                cantidad: cantidad,
                precio_unitario: precio,
                descuentos: [],
                subtotal: cantidad * precio
            };

            this.state.items_actuales.push(item);
            this.renderItems();
            this.actualizarTotales();
            this.cerrarModal('itemModal');

        } catch (error) {
            console.error('Error al agregar item:', error);
            alert('Error al agregar el item');
        }
    },

    /**
     * Eliminar item de la factura
     */
    eliminarItem(itemId) {
        this.state.items_actuales = this.state.items_actuales.filter(item => item.id !== itemId);
        this.renderItems();
        this.actualizarTotales();
    },

    /**
     * Renderizar items en la tabla
     */
    renderItems() {
        const tbody = document.getElementById('itemsTableBody');
        if (!tbody) return;

        tbody.innerHTML = this.state.items_actuales.map(item => `
            <tr>
                <td>${item.descripcion}</td>
                <td>${item.cantidad}</td>
                <td>${this.formatearMoneda(item.precio_unitario)}</td>
                <td>${this.formatearMoneda(item.subtotal)}</td>
                <td>
                    ${item.descuentos.length > 0 ? `
                        <span class="badge badge-info">${item.descuentos.length}</span>
                    ` : '-'}
                </td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="BillingModule.agregarDescuentoItem('${item.id}')">Desc</button>
                    <button class="btn btn-sm btn-danger btn-eliminar-item" data-item-id="${item.id}">Eliminar</button>
                </td>
            </tr>
        `).join('');
    },

    /**
     * Agregar descuento a un item específico
     */
    agregarDescuentoItem(itemId) {
        const tipoDescuento = prompt('Tipo de descuento:\n1. Porcentaje\n2. Cantidad Fija\n\nIngrese 1 o 2:');
        
        if (!tipoDescuento) return;

        const tipo = tipoDescuento === '1' ? 'porcentaje' : 'fijo';
        const valor = parseFloat(prompt(`Ingrese el valor del descuento (${tipo}):`));

        if (isNaN(valor)) {
            alert('Valor inválido');
            return;
        }

        const item = this.state.items_actuales.find(i => i.id === itemId);
        if (!item) return;

        const descuento = {
            id: 'DESC-' + Date.now(),
            tipo: tipo,
            valor: valor,
            monto: this.calcularDescuento(item.subtotal, tipo, valor),
            motivo: prompt('Motivo del descuento (opcional):')
        };

        item.descuentos.push(descuento);
        this.actualizarTotales();
        this.renderItems();
    },

    // ============================================
    // GESTIÓN DE DESCUENTOS
    // ============================================

    /**
     * Abrir modal para agregar descuento a la factura
     */
    async openAddDiscountModal() {
        await this.cargarDescuentosPredefinidos();
        const modal = document.getElementById('discountModal');
        if (modal) {
            modal.style.display = 'block';
        }
    },

    /**
     * Cargar descuentos predefinidos disponibles
     */
    async cargarDescuentosPredefinidos() {
        try {
            const response = await fetch('http://localhost:3011/api/billing/descuentos', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();
            if (result.success) {
                this.state.descuentos_disponibles = result.data;
                this.renderDescuentosDisponibles();
            }
        } catch (error) {
            console.error('Error al cargar descuentos:', error);
        }
    },

    /**
     * Renderizar descuentos disponibles
     */
    renderDescuentosDisponibles() {
        const select = document.getElementById('descuentoSelect');
        if (!select) return;

        select.innerHTML = '<option value="">-- Seleccionar descuento --</option>' +
            this.state.descuentos_disponibles.map(desc => `
                <option value="${desc.id}" data-tipo="${desc.tipo_descuento}" data-valor="${desc.valor}">
                    ${desc.nombre} (${desc.tipo_descuento === 'porcentaje' ? desc.valor + '%' : this.formatearMoneda(desc.valor)})
                </option>
            `).join('');
    },

    /**
     * Aplicar descuento a la factura
     */
    aplicarDescuento() {
        try {
            const tipoAplicacion = document.getElementById('tipoAplicacion').value;
            
            if (tipoAplicacion === 'predefinido') {
                this.aplicarDescuentoPredefinido();
            } else {
                this.aplicarDescuentoPersonalizado();
            }
        } catch (error) {
            console.error('Error al aplicar descuento:', error);
            alert('Error al aplicar el descuento');
        }
    },

    /**
     * Aplicar descuento predefinido
     */
    aplicarDescuentoPredefinido() {
        const selectElement = document.getElementById('descuentoSelect');
        const descuentoId = selectElement.value;
        
        if (!descuentoId) {
            alert('Seleccione un descuento');
            return;
        }

        const descuento = this.state.descuentos_disponibles.find(d => d.id === descuentoId);
        if (!descuento) return;

        const monto = this.calcularDescuento(this.state.totales.subtotal, descuento.tipo_descuento, descuento.valor);

        const descuentoAplicado = {
            id: 'VDESC-' + Date.now(),
            descuento_id: descuento.id,
            nombre: descuento.nombre,
            tipo: descuento.tipo_descuento,
            valor: descuento.valor,
            monto: monto,
            codigo: descuento.codigo_promocion
        };

        this.state.descuentos_aplicados.push(descuentoAplicado);
        this.actualizarTotales();
        this.renderDescuentosAplicados();
        this.cerrarModal('discountModal');
    },

    /**
     * Aplicar descuento personalizado
     */
    aplicarDescuentoPersonalizado() {
        const tipo = document.getElementById('tipoDescuentoPersonalizado').value;
        const valor = parseFloat(document.getElementById('valorDescuentoPersonalizado').value);
        const motivo = document.getElementById('motivoDescuento').value;

        if (!tipo || isNaN(valor)) {
            alert('Complete los campos requeridos');
            return;
        }

        const monto = this.calcularDescuento(this.state.totales.subtotal, tipo, valor);

        const descuentoAplicado = {
            id: 'VDESC-' + Date.now(),
            nombre: `Descuento ${tipo === 'porcentaje' ? valor + '%' : this.formatearMoneda(valor)}`,
            tipo: tipo,
            valor: valor,
            monto: monto,
            motivo: motivo
        };

        this.state.descuentos_aplicados.push(descuentoAplicado);
        this.actualizarTotales();
        this.renderDescuentosAplicados();
        this.cerrarModal('discountModal');
    },

    /**
     * Eliminar descuento aplicado
     */
    eliminarDescuento(descId) {
        this.state.descuentos_aplicados = this.state.descuentos_aplicados.filter(d => d.id !== descId);
        this.actualizarTotales();
        this.renderDescuentosAplicados();
    },

    /**
     * Renderizar descuentos aplicados
     */
    renderDescuentosAplicados() {
        const tbody = document.getElementById('descuentosTableBody');
        if (!tbody) return;

        tbody.innerHTML = this.state.descuentos_aplicados.map(desc => `
            <tr>
                <td>${desc.nombre}</td>
                <td>${desc.tipo === 'porcentaje' ? desc.valor + '%' : this.formatearMoneda(desc.valor)}</td>
                <td>-${this.formatearMoneda(desc.monto)}</td>
                <td>${desc.motivo || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-danger btn-eliminar-descuento" data-desc-id="${desc.id}">Eliminar</button>
                </td>
            </tr>
        `).join('');
    },

    // ============================================
    // CÁLCULOS Y TOTALES
    // ============================================

    /**
     * Calcular monto de descuento
     */
    calcularDescuento(base, tipo, valor) {
        if (tipo === 'porcentaje') {
            return (base * valor) / 100;
        } else if (tipo === 'fijo') {
            return Math.min(valor, base);
        }
        return 0;
    },

    /**
     * Actualizar totales
     */
    actualizarTotales() {
        // Calcular subtotal
        let subtotal = this.state.items_actuales.reduce((sum, item) => sum + item.subtotal, 0);

        // Calcular descuentos de items
        let descuentos_items = 0;
        for (const item of this.state.items_actuales) {
            descuentos_items += item.descuentos.reduce((sum, d) => sum + d.monto, 0);
        }

        // Calcular descuentos de factura
        let descuentos_factura = this.state.descuentos_aplicados.reduce((sum, d) => sum + d.monto, 0);

        const total_descuentos = descuentos_items + descuentos_factura;
        const subtotal_con_descuentos = subtotal - total_descuentos;
        const total_impuestos = subtotal_con_descuentos * (this.state.config.impuesto_predeterminado / 100);
        const total = subtotal_con_descuentos + total_impuestos;

        this.state.totales = {
            subtotal,
            total_descuentos,
            total_impuestos,
            total
        };

        this.renderTotales();
    },

    /**
     * Renderizar totales
     */
    renderTotales() {
        const container = document.getElementById('totalesContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong>Subtotal:</strong> ${this.formatearMoneda(this.state.totales.subtotal)}</p>
                    <p><strong>Descuentos:</strong> -${this.formatearMoneda(this.state.totales.total_descuentos)}</p>
                </div>
                <div class="col-md-6">
                    <p><strong>Impuesto (${this.state.config.impuesto_predeterminado}%):</strong> ${this.formatearMoneda(this.state.totales.total_impuestos)}</p>
                    <h4><strong>TOTAL:</strong> ${this.formatearMoneda(this.state.totales.total)}</h4>
                </div>
            </div>
        `;
    },

    // ============================================
    // UTILIDADES
    // ============================================

    /**
     * Formatear moneda
     */
    formatearMoneda(valor) {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: this.state.config.moneda,
            minimumFractionDigits: 2
        }).format(valor);
    },

    /**
     * Generar número de factura
     */
    generarNumeroFactura() {
        const date = new Date();
        const random = Math.floor(Math.random() * 10000);
        return `FAC-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${random}`;
    },

    /**
     * Imprimir factura
     */
    imprimirFactura(factura) {
        // Implementar lógica de impresión
        console.log('Factura a imprimir:', factura);
        window.print();
    },

    /**
     * Renderizar lista de facturas
     */
    renderFacturas() {
        const container = document.getElementById('facturasListContainer');
        if (!container) return;

        container.innerHTML = this.state.facturas.map(factura => `
            <div class="card mb-3">
                <div class="card-body">
                    <h5>${factura.numero_factura}</h5>
                    <p>Total: ${this.formatearMoneda(factura.total)}</p>
                    <p>Estado: ${factura.estado}</p>
                    <button class="btn btn-sm btn-info" onclick="BillingModule.verDetallesFactura('${factura.id}')">Ver</button>
                    <button class="btn btn-sm btn-warning" onclick="BillingModule.editarFactura('${factura.id}')">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="BillingModule.eliminarFactura('${factura.id}')">Eliminar</button>
                </div>
            </div>
        `).join('');
    },

    /**
     * Ver detalles de factura
     */
    async verDetallesFactura(facturaId) {
        const detalles = await this.obtenerDetallesFactura(facturaId);
        if (detalles) {
            alert(JSON.stringify(detalles, null, 2));
        }
    },

    /**
     * Editar factura
     */
    editarFactura(facturaId) {
        alert('Funcionalidad de edición en desarrollo');
    },

    /**
     * Eliminar factura
     */
    async eliminarFactura(facturaId) {
        if (confirm('¿Está seguro de eliminar esta factura?')) {
            try {
                const response = await fetch(`http://localhost:3011/api/billing/facturas/${facturaId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                const result = await response.json();
                if (result.success) {
                    alert('Factura eliminada exitosamente');
                    this.cargarFacturas();
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (error) {
                console.error('Error al eliminar factura:', error);
            }
        }
    },

    /**
     * Cargar clientes para el select
     */
    async cargarClientesPredeterminados() {
        try {
            const response = await fetch('http://localhost:3011/api/pacientes?limit=100', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();
            if (result.success) {
                const select = document.getElementById('clienteSelect');
                if (select) {
                    select.innerHTML = '<option value="">-- Sin cliente --</option>' +
                        result.data.map(cliente => `
                            <option value="${cliente.id}">${cliente.nombre}</option>
                        `).join('');
                }
            }
        } catch (error) {
            console.error('Error al cargar clientes:', error);
        }
    },

    /**
     * Cerrar modal
     */
    cerrarModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    },

    /**
     * Obtener template HTML
     */
    getTemplate() {
        return `
            <!-- Modales y Contenedores -->
            <div id="billingModal" class="modal">
                <div class="modal-content" style="width: 95%; max-height: 95vh; overflow-y: auto;">
                    <span class="close" onclick="BillingModule.cerrarModal('billingModal')">&times;</span>
                    <h2>Nueva Factura</h2>
                    
                    <form id="billingForm">
                        <div class="form-group">
                            <label>Cliente:</label>
                            <select id="clienteSelect" class="form-control"></select>
                        </div>
                        
                        <div class="form-group">
                            <label>Método de Pago:</label>
                            <select id="metodoPago" class="form-control">
                                <option value="efectivo">Efectivo</option>
                                <option value="tarjeta">Tarjeta</option>
                                <option value="cheque">Cheque</option>
                                <option value="transferencia">Transferencia</option>
                            </select>
                        </div>

                        <h4>Items</h4>
                        <button type="button" class="btn btn-primary" id="btnAgregarItem">+ Agregar Item</button>
                        <table class="table mt-3">
                            <thead>
                                <tr>
                                    <th>Descripción</th>
                                    <th>Cantidad</th>
                                    <th>Precio</th>
                                    <th>Subtotal</th>
                                    <th>Descuentos</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="itemsTableBody"></tbody>
                        </table>

                        <h4>Descuentos</h4>
                        <button type="button" class="btn btn-success" id="btnAgregarDescuento">+ Agregar Descuento</button>
                        <table class="table mt-3">
                            <thead>
                                <tr>
                                    <th>Descripción</th>
                                    <th>Tipo</th>
                                    <th>Monto</th>
                                    <th>Motivo</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="descuentosTableBody"></tbody>
                        </table>

                        <h4>Totales</h4>
                        <div id="totalesContainer"></div>

                        <div class="form-group mt-3">
                            <label>Observaciones:</label>
                            <textarea id="observaciones" class="form-control"></textarea>
                        </div>

                        <button type="button" class="btn btn-success btn-lg mt-3" id="btnGuardarFactura">
                            Guardar Factura
                        </button>
                    </form>
                </div>
            </div>

            <!-- Modal de Items -->
            <div id="itemModal" class="modal">
                <div class="modal-content">
                    <span class="close" onclick="BillingModule.cerrarModal('itemModal')">&times;</span>
                    <h2>Agregar Item</h2>
                    
                    <form id="itemForm">
                        <div class="form-group">
                            <label>Descripción:</label>
                            <input type="text" id="descripcion" class="form-control" required>
                        </div>

                        <div class="form-group">
                            <label>Tipo:</label>
                            <select id="tipoItem" class="form-control">
                                <option value="medicamento">Medicamento</option>
                                <option value="servicio">Servicio</option>
                                <option value="articulo">Artículo</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Cantidad:</label>
                            <input type="number" id="cantidad" class="form-control" min="1" required>
                        </div>

                        <div class="form-group">
                            <label>Precio Unitario:</label>
                            <input type="number" id="precio" class="form-control" step="0.01" required>
                        </div>

                        <button type="button" class="btn btn-primary" onclick="BillingModule.agregarItem()">
                            Agregar
                        </button>
                    </form>
                </div>
            </div>

            <!-- Modal de Descuentos -->
            <div id="discountModal" class="modal">
                <div class="modal-content">
                    <span class="close" onclick="BillingModule.cerrarModal('discountModal')">&times;</span>
                    <h2>Agregar Descuento</h2>
                    
                    <form id="discountForm">
                        <div class="form-group">
                            <label>
                                <input type="radio" name="tipoAplicacion" id="tipoAplicacion" value="predefinido" checked>
                                Usar Descuento Predefinido
                            </label>
                        </div>

                        <div class="form-group" id="predefinidoGroup">
                            <label>Seleccionar Descuento:</label>
                            <select id="descuentoSelect" class="form-control"></select>
                        </div>

                        <hr>

                        <div class="form-group">
                            <label>
                                <input type="radio" name="tipoAplicacion" value="personalizado">
                                Descuento Personalizado
                            </label>
                        </div>

                        <div class="form-group" id="personalizadoGroup" style="display: none;">
                            <label>Tipo:</label>
                            <select id="tipoDescuentoPersonalizado" class="form-control">
                                <option value="porcentaje">Porcentaje (%)</option>
                                <option value="fijo">Cantidad Fija</option>
                            </select>

                            <label class="mt-3">Valor:</label>
                            <input type="number" id="valorDescuentoPersonalizado" class="form-control" step="0.01">

                            <label class="mt-3">Motivo:</label>
                            <input type="text" id="motivoDescuento" class="form-control">
                        </div>

                        <button type="button" class="btn btn-primary mt-3" onclick="BillingModule.aplicarDescuento()">
                            Aplicar Descuento
                        </button>
                    </form>
                </div>
            </div>

            <style>
                .modal {
                    display: none;
                    position: fixed;
                    z-index: 1;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    overflow: auto;
                    background-color: rgba(0,0,0,0.4);
                }

                .modal-content {
                    background-color: #fefefe;
                    margin: 5% auto;
                    padding: 20px;
                    border: 1px solid #888;
                    width: 80%;
                    max-height: 80vh;
                    overflow-y: auto;
                }

                .close {
                    color: #aaa;
                    float: right;
                    font-size: 28px;
                    font-weight: bold;
                    cursor: pointer;
                }

                .close:hover, .close:focus {
                    color: black;
                }

                .badge {
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 12px;
                }

                .badge-info {
                    background-color: #17a2b8;
                    color: white;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                }

                table th, table td {
                    padding: 10px;
                    text-align: left;
                    border-bottom: 1px solid #ddd;
                }

                table th {
                    background-color: #f2f2f2;
                }
            </style>
        `;
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => BillingModule.init());
    } else {
        BillingModule.init();
    }
});
