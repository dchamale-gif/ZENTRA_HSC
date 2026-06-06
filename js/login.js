// ============================================
// LOGIN.JS - MANEJO DEL FORMULARIO DE LOGIN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    initializeLoginForm();
});

function initializeLoginForm() {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Si ya hay sesión activa, redirigir al dashboard
    if (authManager.isAuthenticated() && !authManager.isTokenExpired()) {
        redirectToDashboard();
    }
}

/**
 * Manejar envío del formulario de login
 */
async function handleLogin(event) {
    event.preventDefault();

    const form = event.target;
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.querySelector('input[name="rememberMe"]').checked;
    const submitBtn = form.querySelector('button[type="submit"]');

    // Validaciones
    if (!email) {
        showAlert('Por favor ingresa tu email', 'error');
        document.getElementById('email').focus();
        return;
    }

    if (!isValidEmail(email)) {
        showAlert('Por favor ingresa un email válido', 'error');
        document.getElementById('email').focus();
        return;
    }

    if (!password) {
        showAlert('Por favor ingresa tu contraseña', 'error');
        document.getElementById('password').focus();
        return;
    }

    if (password.length < 6) {
        showAlert('La contraseña debe tener al menos 6 caracteres', 'error');
        document.getElementById('password').focus();
        return;
    }

    // Mostrar estado de carga
    setButtonLoading(submitBtn, true);

    try {
        // Intentar login
        const result = await authManager.login(email, password);

        if (result.success) {
            showAlert('✓ Bienvenido ' + result.user.nombre, 'success', 2000);

            // Guardar preferencia de "recuérdame"
            if (rememberMe) {
                localStorage.setItem('rememberEmail', email);
            } else {
                localStorage.removeItem('rememberEmail');
            }

            // Redirigir al dashboard después de 2 segundos
            setTimeout(() => {
                redirectToDashboard();
            }, 2000);
        } else {
            showAlert('❌ ' + result.error, 'error');
            setButtonLoading(submitBtn, false);

            // Limpiar contraseña
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    } catch (error) {
        console.error('Error inesperado:', error);
        showAlert('Error inesperado: ' + error.message, 'error');
        setButtonLoading(submitBtn, false);
    }
}

/**
 * Mostrar formulario de registro
 */
function showRegister() {
    // Para ahora, mostrar alert
    showAlert('La funcionalidad de registro aún se está desarrollando', 'info');
    
    // En el futuro, esto podría abrir un modal con formulario de registro
}

/**
 * Mostrar formulario de olvido de contraseña
 */
function showForgotPassword(event) {
    event.preventDefault();
    showAlert('La funcionalidad de recuperación de contraseña aún se está desarrollando', 'info');
    
    // En el futuro, esto podría abrir un modal para recuperar contraseña
}

/**
 * Recordar email si está guardado
 */
function rememberEmail() {
    const savedEmail = localStorage.getItem('rememberEmail');
    if (savedEmail) {
        document.getElementById('email').value = savedEmail;
        document.querySelector('input[name="rememberMe"]').checked = true;
        document.getElementById('password').focus();
    }
}

// Ejecutar al cargar
rememberEmail();
