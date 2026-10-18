// ============================================
// PERMISOS - Menú, navegación y administración de usuarios
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
        'personal': 'personal',
        'codigos-articulos': 'codigos_articulos',
        'compras': 'compras',
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
        return this.ROLES[rol] || rol;
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

        const rol = document.getElementById('userRole');
        const roles = this.usuario().roles || [];
        if (rol && roles.length) rol.textContent = roles.map(r => this.nombreRol(r)).join(', ');
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
        if (!Permisos.puede('usuarios')) return;
        const tbody = document.getElementById('usuariosTbody');
        if (!tbody) return;

        try {
            [this.usuarios, this.roles] = await Promise.all([this.api(''), this.api('/roles')]);
            this.render();
        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="5">No se pudieron cargar los usuarios. ${escapeHtml(error.message)}</td></tr>`;
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
                <td data-label="Nombre"><strong>${escapeHtml(`${u.nombre} ${u.apellido || ''}`.trim())}</strong></td>
                <td data-label="Email">${escapeHtml(u.email)}</td>
                <td data-label="Roles">${(u.roles || []).map(r => `<span class="badge badge-info">${escapeHtml(Permisos.nombreRol(r))}</span>`).join(' ') || '—'}</td>
                <td data-label="Estado"><span class="badge ${u.activo ? 'badge-active' : 'badge-inactive'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td data-label="Acciones" class="actions">
                    <button type="button" class="btn btn-secondary btn-sm" data-editar-usuario="${u.id}">Editar</button>
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
                    <span><strong>${escapeHtml(Permisos.nombreRol(r.nombre))}</strong><small>${escapeHtml(r.descripcion || '')}</small></span>
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

    init() {
        document.getElementById('usuarioNuevoBtn')?.addEventListener('click', () => this.abrirFormulario());
        document.getElementById('usuarioForm')?.addEventListener('submit', e => this.guardar(e));
        document.querySelectorAll('[data-cerrar-usuario]').forEach(b => b.addEventListener('click', () => this.cerrarFormulario()));
        document.getElementById('usuariosTbody')?.addEventListener('click', e => {
            const id = e.target.closest('[data-editar-usuario]')?.dataset.editarUsuario;
            if (id) this.abrirFormulario(this.usuarios.find(u => String(u.id) === id));
        });
    }
};

function escapeHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof authManager === 'undefined' || !authManager.isAuthenticated()) return;
    UsuariosAdmin.init();
    Permisos.init();
});
