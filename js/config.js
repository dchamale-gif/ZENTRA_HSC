// ============================================
// CONFIGURACIÓN CENTRAL DE ZENTRA MED
// Única fuente de verdad para región, moneda, impuestos y datos de la clínica.
// ============================================

const CONFIG = {
    // ============================================
    // INFORMACIÓN DE LA APLICACIÓN
    // ============================================
    APP: {
        name: 'Zentra MED',
        version: '1.1.0',
        description: 'Zentra MED - Sistema Médico Integral',
        author: 'Zentra MED',
        releaseDate: '2026-03-23'
    },

    // ============================================
    // REGIÓN: GUATEMALA
    // ============================================
    REGION: {
        pais: 'Guatemala',
        codigoPais: 'GT',
        locale: 'es-GT',
        timeZone: 'America/Guatemala',
        prefijoTelefono: '+502',
        moneda: {
            code: 'GTQ',
            nombre: 'Quetzal',
            nombrePlural: 'Quetzales',
            symbol: 'Q'
        },
        // IVA general de Guatemala (Decreto 27-92)
        iva: 12,
        documentoIdentidad: 'DPI',
        documentoTributario: 'NIT'
    },

    // ============================================
    // DATOS DE LA CLÍNICA (editables en Configuración)
    // ============================================
    CLINICA: {
        nombre: 'Zentra MED',
        razonSocial: '',
        nit: 'CF',
        telefono: '+502 ',
        email: '',
        direccion: '',
        municipio: 'Guatemala',
        departamento: 'Guatemala'
    },

    // ============================================
    // EMPRESAS QUE FACTURAN (editables en Configuración)
    // Cada estado de cuenta elige con cuál se factura.
    // ============================================
    EMPRESAS_FACTURACION: [
        { id: 'A', nombre: 'Empresa A', eslogan: '', razonSocial: '', nit: 'CF', direccion: '', telefono: '' },
        { id: 'B', nombre: 'Empresa B', eslogan: '', razonSocial: '', nit: 'CF', direccion: '', telefono: '' }
    ],

    // Opciones de IVA para los estados de cuenta (porcentaje; 0 = sin IVA)
    IVA_OPCIONES: [12, 5, 0],

    // ============================================
    // CONFIGURACIÓN DEL SERVIDOR/API (FUTURO)
    // ============================================
    API: {
        // Cambiar a true cuando se implemente el backend
        useAPI: true,
        
        // URL base del servidor (ajustar cuando tengas backend)
        baseURL: 'http://178.128.72.110:3011/api',
        
        // Endpoints de la API
        endpoints: {
            products: '/products',
            transactions: '/transactions',
            reports: '/reports',
            users: '/users',
            auth: '/auth',
            inventory: '/inventory',
            analytics: '/analytics'
        },
        
        // Timeout en milisegundos
        timeout: 10000,
        
        // Headers por defecto
        defaultHeaders: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    },

    // ============================================
    // CONFIGURACIÓN DE TEMA
    // ============================================
    THEME: {
        // Modo oscuro habilitado por defecto
        darkMode: false,
        
        // Colores principales
        colors: {
            primary: '#1e3a8a',
            secondary: '#0891b2',
            accent: '#f97316',
            danger: '#ef4444',
            success: '#22c55e',
            warning: '#eab308',
            light: '#f8fafc',
            dark: '#0f172a'
        },
        
        // Animaciones
        animations: {
            enabled: true,
            duration: 300  // ms
        }
    },

    // ============================================
    // CONFIGURACIÓN DE TRANSACCIONES
    // ============================================
    TRANSACTIONS: {
        types: ['Venta', 'Compra', 'Devolución', 'Ajuste'],
        statuses: ['Completada', 'Pendiente', 'Cancelada', 'En Proceso'],
        
        // Campos requeridos
        requiredFields: ['type', 'description', 'amount', 'date'],
        
        // Validaciones
        validation: {
            minAmount: 0.01,
            maxAmount: 999999.99,
            maxDescriptionLength: 255
        }
    },

    // ============================================
    // CONFIGURACIÓN DE PRODUCTOS
    // ============================================
    PRODUCTS: {
        categories: ['Electrónica', 'Ropa', 'Alimentos', 'Herramientas', 'Otros'],
        
        // Campos requeridos
        requiredFields: ['name', 'category', 'price', 'stock'],
        
        // Validaciones
        validation: {
            minPrice: 0.01,
            maxPrice: 999999.99,
            minStock: 0,
            maxNameLength: 100,
            minNameLength: 3
        },
        
        // Stock mínimo por defecto
        defaultMinStock: 10
    },

    // ============================================
    // CONFIGURACIÓN DE REPORTES
    // ============================================
    REPORTS: {
        types: ['Ventas', 'Inventario', 'Balance', 'Márgenes', 'Análisis'],
        
        // Formatos de exportación (para futuro)
        formats: ['PDF', 'Excel', 'CSV', 'JSON'],
        
        // Período predeterminado
        defaultPeriod: 'month'  // 'week', 'month', 'quarter', 'year'
    },

    // ============================================
    // CONFIGURACIÓN DE USUARIO
    // ============================================
    USER: {
        // Roles disponibles (para futuro sistema de permisos)
        roles: ['Admin', 'Manager', 'Vendedor', 'Viewer'],
        
        // Permisos por rol
        permissions: {
            'Admin': ['create', 'read', 'update', 'delete', 'export'],
            'Manager': ['read', 'update', 'export'],
            'Vendedor': ['create', 'read'],
            'Viewer': ['read']
        }
    },

    // ============================================
    // CONFIGURACIÓN DE FORMATO
    // ============================================
    FORMAT: {
        // Formato de moneda
        currency: {
            code: 'GTQ',
            symbol: 'Q',
            locale: 'es-GT'
        },
        
        // Formato de fecha
        date: {
            locale: 'es-GT',
            format: 'DD/MM/YYYY'
        },
        
        // Formato de números
        number: {
            locale: 'es-GT',
            decimals: 2,
            separator: ','
        },
        
        // Formato de hora
        time: {
            locale: 'es-GT',
            format: '24h'  // '12h' o '24h'
        }
    },

    // ============================================
    // CONFIGURACIÓN DE ALMACENAMIENTO
    // ============================================
    STORAGE: {
        // Usar localStorage para cache local
        enabled: true,
        
        // Clave de prefijo para localStorage
        prefix: 'ZentraMED_',
        
        // Tiempo de expiración en minutos
        cacheExpiration: 60,
        
        // Items a cachear
        cachedItems: ['products', 'categories', 'userPreferences']
    },

    // ============================================
    // CONFIGURACIÓN DE VALIDACIONES
    // ============================================
    VALIDATION: {
        // Email
        email: {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            minLength: 5,
            maxLength: 255
        },
        
        // Teléfono
        // Teléfono de Guatemala: 8 dígitos, opcionalmente con +502
        phone: {
            pattern: /^(\+?502[\s-]?)?\d{4}[\s-]?\d{4}$/,
            minLength: 8
        },
        
        // Contraseña (para futura autenticación)
        password: {
            minLength: 8,
            requireUppercase: true,
            requireNumbers: true,
            requireSpecialChars: true
        },
        
        // Campos de texto
        text: {
            maxLength: 255,
            allowSpecialChars: true
        }
    },

    // ============================================
    // CONFIGURACIÓN DE PAGINACIÓN
    // ============================================
    PAGINATION: {
        defaultPageSize: 50,
        maxPageSize: 500,
        pageSizeOptions: [25, 50, 100, 500]
    },

    // ============================================
    // CONFIGURACIÓN DE LOGS
    // ============================================
    LOGGING: {
        // Habilitar logs en consola
        enabled: true,
        
        // Nivel de log
        level: 'info',  // 'debug', 'info', 'warn', 'error'
        
        // Logs a guardar (para futuro)
        trackEvents: ['login', 'create', 'update', 'delete', 'export', 'error']
    },

    // ============================================
    // CONFIGURACIÓN DE NOTIFICACIONES
    // ============================================
    NOTIFICATIONS: {
        // Duración en ms
        displayDuration: 3000,
        
        // Máximo de notificaciones simultáneas
        maxNotifications: 3,
        
        // Tipos habilitados
        types: {
            success: true,
            error: true,
            warning: true,
            info: true
        }
    }
};

// ============================================
// FUNCIONES DE CONFIGURACIÓN
// ============================================

/**
 * Obtener valor de configuración
 * @param {string} path - Ruta de la propiedad (ej: 'API.baseURL')
 * @param {*} defaultValue - Valor por defecto si la ruta no existe
 */
function getConfig(path, defaultValue = null) {
    const keys = path.split('.');
    let value = CONFIG;
    
    for (let key of keys) {
        value = value?.[key];
        if (value === undefined) return defaultValue;
    }
    
    return value;
}

/**
 * Establecer valor de configuración
 * @param {string} path - Ruta de la propiedad
 * @param {*} value - Nuevo valor
 */
function setConfig(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let obj = CONFIG;
    
    for (let key of keys) {
        if (!obj[key]) obj[key] = {};
        obj = obj[key];
    }
    
    obj[lastKey] = value;
}

/**
 * Validar configuración de API
 */
function validateAPIConfig() {
    const apiConfig = getConfig('API');
    if (!apiConfig.baseURL) {
        console.warn('⚠️ API baseURL no configurada');
        return false;
    }
    return true;
}

/**
 * Obtener todas las categorías de productos
 */
function getProductCategories() {
    return getConfig('PRODUCTS.categories', []);
}

/**
 * Obtener todos los tipos de transacción
 */
function getTransactionTypes() {
    return getConfig('TRANSACTIONS.types', []);
}

/**
 * Obtener permisos para un rol
 */
function getRolePermissions(role) {
    return getConfig(`USER.permissions.${role}`, []);
}

// ============================================
// DATOS DE CLÍNICA PERSISTIDOS
// ============================================

const CLINICA_STORAGE_KEY = 'ZentraMED_clinica';

function cargarDatosClinica() {
    try {
        const guardado = JSON.parse(localStorage.getItem(CLINICA_STORAGE_KEY) || 'null');
        if (guardado && typeof guardado === 'object') {
            Object.assign(CONFIG.CLINICA, guardado);
        }
    } catch (error) {
        console.warn('No se pudieron leer los datos de la clínica guardados', error);
    }
    return CONFIG.CLINICA;
}

function guardarDatosClinica(datos) {
    Object.assign(CONFIG.CLINICA, datos);
    try {
        localStorage.setItem(CLINICA_STORAGE_KEY, JSON.stringify(CONFIG.CLINICA));
    } catch (error) {
        console.warn('No se pudieron guardar los datos de la clínica', error);
    }
    document.dispatchEvent(new CustomEvent('zentra:clinica-actualizada', { detail: CONFIG.CLINICA }));
    return CONFIG.CLINICA;
}

const EMPRESAS_STORAGE_KEY = 'ZentraMED_empresasFacturacion';

function cargarEmpresasFacturacion() {
    try {
        const guardado = JSON.parse(localStorage.getItem(EMPRESAS_STORAGE_KEY) || 'null');
        if (Array.isArray(guardado)) {
            CONFIG.EMPRESAS_FACTURACION.forEach(empresa => {
                Object.assign(empresa, guardado.find(g => g.id === empresa.id) || {});
            });
        }
    } catch (error) {
        console.warn('No se pudieron leer las empresas de facturación guardadas', error);
    }
    return CONFIG.EMPRESAS_FACTURACION;
}

function guardarEmpresaFacturacion(id, datos) {
    const empresa = CONFIG.EMPRESAS_FACTURACION.find(e => e.id === id);
    if (!empresa) return null;
    Object.assign(empresa, datos, { id });
    try {
        localStorage.setItem(EMPRESAS_STORAGE_KEY, JSON.stringify(CONFIG.EMPRESAS_FACTURACION));
    } catch (error) {
        console.warn('No se pudieron guardar las empresas de facturación', error);
    }
    document.dispatchEvent(new CustomEvent('zentra:empresas-actualizadas', { detail: CONFIG.EMPRESAS_FACTURACION }));
    return empresa;
}

function getEmpresaFacturacion(id) {
    return CONFIG.EMPRESAS_FACTURACION.find(e => e.id === id) || CONFIG.EMPRESAS_FACTURACION[0];
}

// ============================================
// FORMATEADORES REGIONALES (GUATEMALA)
// ============================================

const quetzalFormatter = new Intl.NumberFormat(CONFIG.REGION.locale, {
    style: 'currency',
    currency: CONFIG.REGION.moneda.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const numeroFormatter = new Intl.NumberFormat(CONFIG.REGION.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

function aNumero(valor) {
    const numero = typeof valor === 'string' ? parseFloat(valor.replace(/[^\d.-]/g, '')) : Number(valor);
    return Number.isFinite(numero) ? numero : 0;
}

/**
 * Formatea un monto en quetzales: 1234.5 → "Q1,234.50"
 */
function formatQ(valor) {
    return quetzalFormatter.format(aNumero(valor));
}

/**
 * Formatea un número con 2 decimales y separador de miles: 1234.5 → "1,234.50"
 */
function formatNumero(valor) {
    return numeroFormatter.format(aNumero(valor));
}

function aFecha(valor) {
    if (valor instanceof Date) return valor;
    // Fechas "YYYY-MM-DD" se interpretan como fecha local, no UTC
    if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        const [y, m, d] = valor.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    return new Date(valor);
}

/**
 * Fecha en formato guatemalteco: dd/mm/aaaa (o con opciones de Intl)
 */
function formatFecha(valor = new Date(), opciones = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
    const fecha = aFecha(valor);
    if (isNaN(fecha)) return '';
    return fecha.toLocaleDateString(CONFIG.REGION.locale, { timeZone: CONFIG.REGION.timeZone, ...opciones });
}

function formatFechaHora(valor = new Date()) {
    const fecha = aFecha(valor);
    if (isNaN(fecha)) return '';
    return fecha.toLocaleString(CONFIG.REGION.locale, {
        timeZone: CONFIG.REGION.timeZone,
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

/**
 * Desglosa un total con IVA incluido (precios en Guatemala se publican con IVA)
 */
function desglosarIVA(totalConIVA, porcentaje = CONFIG.REGION.iva) {
    const total = aNumero(totalConIVA);
    const base = Math.round((total / (1 + porcentaje / 100)) * 100) / 100;
    return { base, iva: Math.round((total - base) * 100) / 100, total, porcentaje };
}

// Compatibilidad con código existente
function formatWithConfig(value) {
    return formatQ(value);
}

cargarDatosClinica();
cargarEmpresasFacturacion();

// ============================================
// EXPORTAR CONFIGURACIÓN
// ============================================

// Hacer disponible globalmente
window.CONFIG = CONFIG;
window.getConfig = getConfig;
window.setConfig = setConfig;
window.validateAPIConfig = validateAPIConfig;
window.getProductCategories = getProductCategories;
window.getTransactionTypes = getTransactionTypes;
window.getRolePermissions = getRolePermissions;
window.formatWithConfig = formatWithConfig;
window.formatQ = formatQ;
window.formatNumero = formatNumero;
window.formatFecha = formatFecha;
window.formatFechaHora = formatFechaHora;
window.desglosarIVA = desglosarIVA;
window.cargarDatosClinica = cargarDatosClinica;
window.guardarDatosClinica = guardarDatosClinica;

console.log('✅ Configuración de Zentra MED cargada (Guatemala · GTQ)');
