// ============================================
// PERMISOS - Menú, navegación y administración de usuarios y roles
// Los permisos vienen del backend como "<modulo>_view" / "<modulo>_edit".
// ============================================

const Permisos = {
    // Opciones del menú de acciones del paciente -> módulo
    ACCIONES_PACIENTE: {
        historia: 'historia_clinica',
        evolucion: 'evolucion',
        medicamentos: 'control_medicamentos',
        laboratorios: 'laboratorios',
        cotizacion: 'cotizacion_paciente'
    },

    // Página del menú -> módulo(s) que permiten verla (null = todos)
    PAGINAS: {
        'dashboard': null,
        // La lista de pacientes también da acceso a su menú de acciones
        'pacientes': ['caratula', 'historia_clinica', 'evolucion', 'control_medicamentos', 'laboratorios', 'cotizacion_paciente'],
        'medicinas': 'medicinas',
        'historia-clinica': 'historia_clinica',
        'saldo-paciente': 'saldo_paciente',
        'hospitalizaciones': 'hospitalizaciones',
        'ordenes-medicas': 'ordenes_medicas',
        'ordenes-enfermeria': 'ordenes_enfermeria',
        'personal': 'personal',
        'personal-general': 'personal_general',
        'codigos-articulos': 'codigos_articulos',
        'compras': 'compras',
        'requerimientos': ['requerimientos', 'compras'],
        'ventas': 'ventas',
        'cotizaciones': 'cotizaciones',
        'caja': 'caja',
        'cuentas-por-cobrar': 'cxc',
        'dashboard-financiero': 'dashboard_ejecutivo',
        'gastos-servicios': 'gastos',
        'inventory': 'inventario',
        'transactions': 'transacciones',
        'reports': 'reportes',
        'agenda': 'agenda',
        'reservas-web': 'agenda',
        'confirmaciones': 'agenda',
        'google-calendar': 'agenda',
        'alertas': 'alertas',
        'settings': 'usuarios'
    },

    // Módulos que el admin puede asignar a un rol, agrupados como el menú.
    // `pendiente`: la pantalla aún no existe; el permiso queda listo para cuando se construya.
    CATALOGO: [
        { seccion: 'Módulo médico', modulos: [
            { clave: 'caratula', texto: 'Carátula (gestión de pacientes)' },
            { clave: 'historia_clinica', texto: 'Historia clínica' },
            { clave: 'historia_clinica_cierre', texto: 'Abrir y cerrar historias clínicas (médico)' },
            { clave: 'ordenes_medicas', texto: 'Órdenes médicas' },
            { clave: 'ordenes_enfermeria', texto: 'Órdenes de enfermería' },
            { clave: 'evolucion', texto: 'Evolución' },
            { clave: 'control_medicamentos', texto: 'Control de medicamentos' },
            { clave: 'extras', texto: 'Extras (dentro del hospital)', pendiente: true },
            { clave: 'control_signos', texto: 'Control de signos', pendiente: true },
            { clave: 'notas_enfermeria', texto: 'Notas de enfermería' },
            { clave: 'laboratorios', texto: 'Laboratorios' },
            { clave: 'recepcion_articulos', texto: 'Recepción de artículos', pendiente: true },
            { clave: 'cotizacion_paciente', texto: 'Cotización del paciente' },
            { clave: 'contrato_ingreso', texto: 'Contrato de ingreso', pendiente: true },
            { clave: 'hospitalizaciones', texto: 'Hospitalizaciones' },
            { clave: 'saldo_paciente', texto: 'Saldo paciente' },
            { clave: 'medicinas', texto: 'Medicinas (catálogo)' },
            { clave: 'personal', texto: 'Personal médico' }
        ] },
        { seccion: 'Módulo contable', modulos: [
            { clave: 'codigos_articulos', texto: 'Códigos de artículos' },
            { clave: 'compras', texto: 'Compras y proveedores (confirma requerimientos)' },
            { clave: 'requerimientos', texto: 'Requerimientos de compra (farmacia, cocina…)' },
            { clave: 'ventas', texto: 'Ventas' },
            { clave: 'cotizaciones', texto: 'Cotizaciones' },
            { clave: 'caja', texto: 'Caja' },
            { clave: 'cxc', texto: 'Cuentas por cobrar' },
            { clave: 'gastos', texto: 'Gastos y servicios' },
            { clave: 'dashboard_ejecutivo', texto: 'Dashboard ejecutivo' }
        ] },
        { seccion: 'Módulo administrativo', modulos: [
            { clave: 'personal_general', texto: 'Personal (administrativo y de apoyo)' },
            { clave: 'inventario', texto: 'Inventario' }
        ] },
        { seccion: 'Finanzas', modulos: [
            { clave: 'transacciones', texto: 'Transacciones' },
            { clave: 'reportes', texto: 'Reportes' }
        ] },
        { seccion: 'Agenda médica', modulos: [
            { clave: 'agenda', texto: 'Agenda, reservaciones web, confirmaciones y Google Calendar' }
        ] },
        { seccion: 'Sistema', modulos: [
            { clave: 'alertas', texto: 'Alertas' }
        ] }
    ],

    ROLES: {
        admin: 'Administrador',
        recepcionista: 'Recepción',
        doctor: 'Médico',
        enfermera: 'Enfermería',
        gerente_compras: 'Compras',
        contador: 'Contador',
        paciente: 'Paciente'
    },

    usuario() {
        return authManager.getUser() || {};
    },

    esAdmin() {
        return (this.usuario().roles || []).includes('admin');
    },

    puede(modulo, accion = 'view') {
        if (!modulo || this.esAdmin()) return true;
        return (this.usuario().permissions || []).includes(`${modulo}_${accion}`);
    },

    puedeVerPagina(pageId) {
        const modulos = [].concat(this.PAGINAS[pageId] ?? []);
        return modulos.length === 0 || modulos.some(m => this.puede(m));
    },

    // Deja en el menú de acciones del paciente solo las opciones permitidas
    filtrarAccionesPaciente() {
        if (typeof PacienteAccionesModule === 'undefined') return;
        PacienteAccionesModule._todasOpciones ??= PacienteAccionesModule.OPCIONES;
        PacienteAccionesModule.OPCIONES = PacienteAccionesModule._todasOpciones
            .filter(o => this.puede(this.ACCIONES_PACIENTE[o.clave]));
    },

    nombreRol(rol) {
        const guardado = UsuariosAdmin.roles.find(r => r.nombre === rol)?.descripcion;
        return guardado || this.ROLES[rol] || rol.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
    },

    // Oculta las opciones del menú sin permiso y los títulos de sección que quedan vacíos
    aplicarMenu() {
        this.filtrarAccionesPaciente();

        const menu = document.querySelector('.nav-menu');
        if (!menu) return;

        menu.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.hidden = !this.puedeVerPagina(item.dataset.page);
        });

        menu.querySelectorAll('.nav-section-title').forEach(titulo => {
            let visible = false;
            for (let el = titulo.nextElementSibling; el && !el.classList.contains('nav-section-title'); el = el.nextElementSibling) {
                if (el.classList.contains('nav-item') && !el.hidden) { visible = true; break; }
            }
            titulo.hidden = !visible;
        });

        document.querySelectorAll('[data-goto]').forEach(el => {
            el.hidden = !this.puedeVerPagina(el.dataset.goto);
        });

        const roles = this.usuario().roles || [];
        const etiqueta = roles.map(r => this.nombreRol(r)).join(', ');
        document.querySelectorAll('[data-user="rol"]').forEach(el => { el.textContent = etiqueta; });
    },

    // Envuelve navigateToPage para bloquear páginas sin permiso
    protegerNavegacion() {
        if (typeof window.navigateToPage !== 'function' || window.navigateToPage.__protegida) return;
        const original = window.navigateToPage;
        const protegida = (pageId, ...args) => {
            if (!this.puedeVerPagina(pageId)) {
                showNotification('No tiene permiso para acceder a este módulo', 'warning');
                return;
            }
            if (pageId === 'settings') UsuariosAdmin.cargar();
            return original(pageId, ...args);
        };
        protegida.__protegida = true;
        window.navigateToPage = protegida;
    },

    // Avisa cuando el backend rechaza una acción por permisos
    interceptar403() {
        const fetchOriginal = window.fetch.bind(window);
        let ultimoAviso = 0;
        window.fetch = async (...args) => {
            const response = await fetchOriginal(...args);
            if (response.status === 403 && Date.now() - ultimoAviso > 3000) {
                ultimoAviso = Date.now();
                response.clone().json()
                    .then(data => showNotification(data.message || 'No tiene permiso para realizar esta acción', 'warning'))
                    .catch(() => showNotification('No tiene permiso para realizar esta acción', 'warning'));
            }
            return response;
        };
    },

    async init() {
        this.interceptar403();
        this.protegerNavegacion();
        this.aplicarMenu();

        // Refrescar roles/permisos desde el servidor por si el admin los cambió
        const perfil = await authManager.getProfile();
        if (perfil.success) this.aplicarMenu();

        const activa = document.querySelector('.nav-item.active')?.dataset.page;
        if (activa && !this.puedeVerPagina(activa)) window.navigateToPage('dashboard');
    }
};

// ============================================
// ADMINISTRACIÓN DE USUARIOS (Configuración, solo admin)
// ============================================

const UsuariosAdmin = {
    usuarios: [],
    roles: [],

    async api(path, options = {}) {
        const response = await authManager.fetchWithAuth(`/api/usuarios${path}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers }
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'No se pudo completar la operación');
        return data.data;
    },

    async cargar() {
        if (!Permisos.esAdmin()) return;
        const tbody = document.getElementById('usuariosTbody');
        if (!tbody) return;

        try {
            [this.usuarios, this.roles] = await Promise.all([this.api(''), this.api('/roles')]);
            this.render();
            RolesAdmin.render();
        } catch (error) {
            const mensaje = `<tr><td colspan="5">No se pudo cargar la información. ${escapeHtml(error.message)}</td></tr>`;
            tbody.innerHTML = mensaje;
            document.getElementById('rolesTbody').innerHTML = mensaje;
        }
    },

    render() {
        const tbody = document.getElementById('usuariosTbody');
        if (!this.usuarios.length) {
            tbody.innerHTML = '<tr><td colspan="5">Aún no hay usuarios. Cree el primero con "Nuevo usuario".</td></tr>';
            return;
        }

        tbody.innerHTML = this.usuarios.map(u => `
            <tr>
                <td data-label="Nombre">
                    <strong>${escapeHtml(`${u.nombre} ${u.apellido || ''}`.trim())}</strong>
                    ${u.personal ? `<small class="usuario-personal-vinculado"><i class="fas fa-id-badge" aria-hidden="true"></i> ${u.personal.modulo === 'personal_medico' ? 'Personal médico' : 'Personal'}: ${escapeHtml(u.personal.nombre)}</small>` : ''}
                </td>
                <td data-label="Email">${escapeHtml(u.email)}</td>
                <td data-label="Roles">${(u.roles || []).map(r => `<span class="badge badge-info">${escapeHtml(Permisos.nombreRol(r))}</span>`).join(' ') || '—'}</td>
                <td data-label="Estado"><span class="badge ${u.activo ? 'badge-active' : 'badge-inactive'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td data-label="Acciones" class="actions">
                    <button type="button" class="btn btn-secondary btn-small" data-editar-usuario="${u.id}">Editar</button>
                    ${String(u.id) === String(Permisos.usuario().id) ? '' : `<button type="button" class="btn btn-danger btn-small" data-eliminar-usuario="${u.id}">Eliminar</button>`}
                </td>
            </tr>
        `).join('');
    },

    abrirFormulario(usuario = null) {
        const form = document.getElementById('usuarioForm');
        form.reset();
        form.dataset.id = usuario?.id || '';

        document.getElementById('usuarioModalTitulo').textContent = usuario ? 'Editar usuario' : 'Nuevo usuario';
        document.getElementById('usuarioGuardarBtn').textContent = usuario ? 'Guardar cambios' : 'Crear usuario';
        document.getElementById('usuarioEmail').disabled = !!usuario;
        document.getElementById('usuarioPassword').required = !usuario;
        document.getElementById('usuarioPasswordHint').textContent = usuario
            ? 'Déjela vacía para mantener la contraseña actual.'
            : 'Mínimo 8 caracteres.';
        document.getElementById('usuarioActivoGrupo').hidden = !usuario;

        document.getElementById('usuarioRoles').innerHTML = this.roles
            .map(r => `
                <label class="usuario-rol">
                    <input type="checkbox" name="roles" value="${escapeHtml(r.nombre)}" ${usuario?.roles?.includes(r.nombre) ? 'checked' : ''}>
                    <span><strong>${escapeHtml(Permisos.nombreRol(r.nombre))}</strong><small>${r.nombre === 'admin' ? 'Acceso total al sistema' : `${RolesAdmin.contarModulos(r)} módulo(s)`}</small></span>
                </label>
            `).join('');

        if (usuario) {
            form.nombre.value = usuario.nombre || '';
            form.apellido.value = usuario.apellido || '';
            form.email.value = usuario.email;
            form.telefono.value = usuario.telefono || '';
            form.activo.checked = usuario.activo;
        }

        document.getElementById('usuarioModal').classList.add('active');
        form.nombre.focus();
    },

    cerrarFormulario() {
        document.getElementById('usuarioModal').classList.remove('active');
    },

    async guardar(event) {
        event.preventDefault();
        const form = event.target;
        const id = form.dataset.id;
        const roles = [...form.querySelectorAll('input[name="roles"]:checked')].map(i => i.value);

        if (!roles.length) {
            showNotification('Asigne al menos un rol al usuario', 'warning');
            return;
        }

        const datos = {
            nombre: form.nombre.value.trim(),
            apellido: form.apellido.value.trim(),
            telefono: form.telefono.value.trim(),
            roles
        };
        if (form.password.value) datos.password = form.password.value;

        const boton = document.getElementById('usuarioGuardarBtn');
        boton.disabled = true;
        try {
            if (id) {
                datos.activo = form.activo.checked;
                await this.api(`/${id}`, { method: 'PUT', body: JSON.stringify(datos) });
                showNotification('Usuario actualizado', 'success');
            } else {
                datos.email = form.email.value.trim();
                await this.api('', { method: 'POST', body: JSON.stringify(datos) });
                showNotification('Usuario creado', 'success');
            }
            this.cerrarFormulario();
            await this.cargar();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            boton.disabled = false;
        }
    },

    async eliminar(usuario) {
        if (!usuario) return;
        const nombre = `${usuario.nombre} ${usuario.apellido || ''}`.trim();
        if (!confirm(`¿Eliminar al usuario ${nombre} (${usuario.email})? No se puede deshacer.`)) return;
        try {
            await this.api(`/${usuario.id}`, { method: 'DELETE' });
            showNotification('Usuario eliminado', 'success');
            await this.cargar();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    init() {
        document.getElementById('usuarioNuevoBtn')?.addEventListener('click', () => this.abrirFormulario());
        document.getElementById('usuarioForm')?.addEventListener('submit', e => this.guardar(e));
        document.querySelectorAll('[data-cerrar-usuario]').forEach(b => b.addEventListener('click', () => this.cerrarFormulario()));
        document.getElementById('usuariosTbody')?.addEventListener('click', e => {
            const id = e.target.closest('[data-editar-usuario]')?.dataset.editarUsuario;
            if (id) this.abrirFormulario(this.usuarios.find(u => String(u.id) === id));
            const eliminarId = e.target.closest('[data-eliminar-usuario]')?.dataset.eliminarUsuario;
            if (eliminarId) this.eliminar(this.usuarios.find(u => String(u.id) === eliminarId));
        });
    }
};

// ============================================
// ADMINISTRACIÓN DE ROLES (Configuración, solo admin)
// ============================================

const RolesAdmin = {
    contarModulos(rol) {
        return (rol.permisos || []).filter(p => p.endsWith('_view') && p !== 'usuarios_view').length;
    },

    render() {
        const tbody = document.getElementById('rolesTbody');
        if (!tbody) return;

        tbody.innerHTML = UsuariosAdmin.roles.map(r => {
            const esAdmin = r.nombre === 'admin';
            return `
                <tr>
                    <td data-label="Rol"><strong>${escapeHtml(Permisos.nombreRol(r.nombre))}</strong></td>
                    <td data-label="Usuarios">${r.usuarios}</td>
                    <td data-label="Acceso">${esAdmin ? 'Acceso total' : `${this.contarModulos(r)} módulo(s)`}</td>
                    <td data-label="Acciones" class="actions">
                        ${esAdmin
                            ? '<span class="form-hint">No editable</span>'
                            : `<button type="button" class="btn btn-secondary btn-small" data-editar-rol="${r.id}">Editar permisos</button>
                               <button type="button" class="btn btn-danger btn-small" data-eliminar-rol="${r.id}">Eliminar</button>`}
                    </td>
                </tr>`;
        }).join('');
    },

    abrirFormulario(rol = null) {
        const form = document.getElementById('rolForm');
        form.reset();
        form.dataset.id = rol?.id || '';
        form.descripcion.value = rol ? Permisos.nombreRol(rol.nombre) : '';

        document.getElementById('rolModalTitulo').textContent = rol ? `Permisos de ${Permisos.nombreRol(rol.nombre)}` : 'Nuevo rol';
        document.getElementById('rolGuardarBtn').textContent = rol ? 'Guardar permisos' : 'Crear rol';

        const permisos = new Set(rol?.permisos || []);
        const marcado = (clave, accion) => permisos.has(`${clave}_${accion}`) ? 'checked' : '';

        document.getElementById('rolPermisosTbody').innerHTML = Permisos.CATALOGO.map(grupo => `
            <tr class="rol-permisos-seccion">
                <th scope="rowgroup" colspan="3">${escapeHtml(grupo.seccion)}</th>
            </tr>
            ${grupo.modulos.map(m => `
                <tr>
                    <th scope="row">
                        ${escapeHtml(m.texto)}
                        ${m.pendiente ? '<small class="rol-permisos-pendiente">Pantalla en desarrollo</small>' : ''}
                    </th>
                    <td><input type="checkbox" data-modulo="${m.clave}" data-accion="view" aria-label="Ver ${escapeHtml(m.texto)}" ${marcado(m.clave, 'view')}></td>
                    <td><input type="checkbox" data-modulo="${m.clave}" data-accion="edit" aria-label="Editar ${escapeHtml(m.texto)}" ${marcado(m.clave, 'edit')}></td>
                </tr>`).join('')}
        `).join('');

        document.getElementById('rolModal').classList.add('active');
        form.descripcion.focus();
    },

    cerrarFormulario() {
        document.getElementById('rolModal').classList.remove('active');
    },

    // Editar implica ver; quitar ver quita editar
    sincronizarCasillas(casilla) {
        const fila = casilla.closest('tr');
        const ver = fila.querySelector('[data-accion="view"]');
        const editar = fila.querySelector('[data-accion="edit"]');
        if (casilla === editar && editar.checked) ver.checked = true;
        if (casilla === ver && !ver.checked) editar.checked = false;
    },

    async guardar(event) {
        event.preventDefault();
        const form = event.target;
        const id = form.dataset.id;
        const descripcion = form.descripcion.value.trim();

        if (!descripcion) {
            showNotification('Escriba un nombre para el rol', 'warning');
            form.descripcion.focus();
            return;
        }

        const permisos = [...form.querySelectorAll('input[data-modulo]:checked')]
            .map(c => `${c.dataset.modulo}_${c.dataset.accion}`);

        const boton = document.getElementById('rolGuardarBtn');
        boton.disabled = true;
        try {
            const body = JSON.stringify({ descripcion, permisos });
            if (id) {
                await UsuariosAdmin.api(`/roles/${id}`, { method: 'PUT', body });
                showNotification('Permisos del rol actualizados. Los usuarios los verán al recargar la página.', 'success');
            } else {
                await UsuariosAdmin.api('/roles', { method: 'POST', body });
                showNotification('Rol creado', 'success');
            }
            this.cerrarFormulario();
            await UsuariosAdmin.cargar();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            boton.disabled = false;
        }
    },

    async eliminar(rol) {
        const nombre = Permisos.nombreRol(rol.nombre);
        if (rol.usuarios > 0) {
            showNotification(`El rol "${nombre}" tiene ${rol.usuarios} usuario(s). Asígneles otro rol antes de eliminarlo.`, 'warning');
            return;
        }
        if (!confirm(`¿Eliminar el rol "${nombre}"? Esta acción no se puede deshacer.`)) return;

        try {
            await UsuariosAdmin.api(`/roles/${rol.id}`, { method: 'DELETE' });
            showNotification(`Rol "${nombre}" eliminado`, 'success');
            await UsuariosAdmin.cargar();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    init() {
        document.getElementById('rolNuevoBtn')?.addEventListener('click', () => this.abrirFormulario());
        document.getElementById('rolForm')?.addEventListener('submit', e => this.guardar(e));
        document.getElementById('rolPermisosTbody')?.addEventListener('change', e => {
            if (e.target.matches('input[data-modulo]')) this.sincronizarCasillas(e.target);
        });
        document.querySelectorAll('[data-cerrar-rol]').forEach(b => b.addEventListener('click', () => this.cerrarFormulario()));
        document.getElementById('rolesTbody')?.addEventListener('click', e => {
            const editar = e.target.closest('[data-editar-rol]')?.dataset.editarRol;
            const eliminar = e.target.closest('[data-eliminar-rol]')?.dataset.eliminarRol;
            const buscar = id => UsuariosAdmin.roles.find(r => String(r.id) === id);
            if (editar) this.abrirFormulario(buscar(editar));
            if (eliminar) this.eliminar(buscar(eliminar));
        });
    }
};

function escapeHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof authManager === 'undefined' || !authManager.isAuthenticated()) return;
    UsuariosAdmin.init();
    RolesAdmin.init();
    Permisos.init();
});
