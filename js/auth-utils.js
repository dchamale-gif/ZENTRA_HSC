// ============================================
// AUTH UTILS - UTILIDADES DE AUTENTICACIÓN
// ============================================

class AuthManager {
    constructor() {
        this.tokenKey = 'zentra_token';
        this.userKey = 'zentra_user';
        this.apiBaseUrl = this.getApiBaseUrl();
    }

    /**
     * Obtener la URL base de la API
     */
    getApiBaseUrl() {
        // Si estamos en desarrollo local
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000';
        }
        // Si estamos en producción (HTTPS)
        if (window.location.protocol === 'https:') {
            return `${window.location.protocol}//${window.location.hostname}:3011`;
        }
        // Si estamos en producción (HTTP)
        return `http://${window.location.hostname}:3011`;
    }

    /**
     * Hacer login con email y password
     */
    async login(email, password) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error en login');
            }

            // Guardar token y datos del usuario
            this.saveToken(data.token);
            this.saveUser(data.user);

            return {
                success: true,
                user: data.user,
                token: data.token
            };
        } catch (error) {
            console.error('Error en login:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Hacer logout
     */
    async logout() {
        try {
            const token = this.getToken();
            
            if (token) {
                await fetch(`${this.apiBaseUrl}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            }

            // Limpiar datos
            this.clearToken();
            this.clearUser();
            
            return { success: true };
        } catch (error) {
            console.error('Error en logout:', error);
            // Limpiar de todas formas
            this.clearToken();
            this.clearUser();
            return { success: true };
        }
    }

    /**
     * Registrar nuevo usuario
     */
    async register(userData) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error en registro');
            }

            return {
                success: true,
                user: data.user,
                message: data.message
            };
        } catch (error) {
            console.error('Error en registro:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener perfil del usuario autenticado
     */
    async getProfile() {
        try {
            const token = this.getToken();
            
            if (!token) {
                return { success: false, error: 'No hay token' };
            }

            const response = await fetch(`${this.apiBaseUrl}/auth/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error obteniendo perfil');
            }

            this.saveUser(data.user);
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Error obteniendo perfil:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Guardar token en localStorage
     */
    saveToken(token) {
        localStorage.setItem(this.tokenKey, token);
    }

    /**
     * Obtener token de localStorage
     */
    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    /**
     * Limpiar token
     */
    clearToken() {
        localStorage.removeItem(this.tokenKey);
    }

    /**
     * Guardar datos del usuario
     */
    saveUser(user) {
        localStorage.setItem(this.userKey, JSON.stringify(user));
    }

    /**
     * Obtener datos del usuario
     */
    getUser() {
        const user = localStorage.getItem(this.userKey);
        return user ? JSON.parse(user) : null;
    }

    /**
     * Limpiar datos del usuario
     */
    clearUser() {
        localStorage.removeItem(this.userKey);
    }

    /**
     * Verificar si hay token
     */
    isAuthenticated() {
        return !!this.getToken();
    }

    /**
     * Verificar si el token está expirado (decodificando)
     */
    isTokenExpired() {
        const token = this.getToken();
        if (!token) return true;

        try {
            // Decodificar JWT (sin verificar firma)
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expTime = payload.exp * 1000; // Convertir a milisegundos
            return Date.now() >= expTime;
        } catch (error) {
            return true;
        }
    }

    /**
     * Verificar si el usuario tiene un rol específico
     */
    hasRole(role) {
        const user = this.getUser();
        return user && user.roles && user.roles.includes(role);
    }

    /**
     * Verificar si el usuario tiene un permiso específico
     */
    hasPermission(permission) {
        const user = this.getUser();
        return user && user.permissions && user.permissions.includes(permission);
    }

    /**
     * Hacer request autenticado
     */
    async fetchWithAuth(url, options = {}) {
        const token = this.getToken();

        if (!token) {
            throw new Error('No hay token de autenticación');
        }

        // Si es URL relativa, agregar la URL base
        const fullUrl = url.startsWith('http') ? url : `${this.apiBaseUrl}${url}`;

        // Agregar header de autorización
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(fullUrl, {
            ...options,
            headers
        });

        // Si el token expiró, hacer logout
        if (response.status === 401) {
            this.clearToken();
            this.clearUser();
            window.location.href = '/login.html';
            return;
        }

        return response;
    }
}

// Crear instancia global
const authManager = new AuthManager();

// ============================================
// UTILIDADES DE UI
// ============================================

/**
 * Mostrar alerta
 */
function showAlert(message, type = 'info', duration = 5000) {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;

    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    
    let icon = 'fas fa-info-circle';
    if (type === 'error') icon = 'fas fa-exclamation-circle';
    if (type === 'success') icon = 'fas fa-check-circle';
    if (type === 'warning') icon = 'fas fa-exclamation-triangle';

    alert.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;

    alertContainer.appendChild(alert);

    if (duration > 0) {
        setTimeout(() => {
            alert.style.animation = 'slideDown 0.3s ease-out reverse';
            setTimeout(() => alert.remove(), 300);
        }, duration);
    }

    return alert;
}

/**
 * Deshabilitar botón de forma
 */
function setButtonLoading(button, isLoading) {
    if (!button) return;

    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
    } else {
        button.disabled = false;
        button.classList.remove('loading');
    }
}

/**
 * Validar email
 */
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Redirigir al dashboard después del login
 */
function redirectToDashboard() {
    // Intentar ir a index.html, si no existe, ir a donde corresponda
    window.location.href = '/index.html';
}

/**
 * Redirigir al login si no está autenticado
 */
function requireAuth() {
    if (!authManager.isAuthenticated() || authManager.isTokenExpired()) {
        authManager.clearToken();
        authManager.clearUser();
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// ============================================
// PROTECCIÓN AUTOMÁTICA DE RUTAS
// ============================================

// Proteger index.html y otras páginas
document.addEventListener('DOMContentLoaded', function() {
    // Solo ejecutar si no estamos en login.html
    if (!window.location.pathname.includes('login.html')) {
        if (!authManager.isAuthenticated()) {
            window.location.href = '/login.html';
        }
    }
});
