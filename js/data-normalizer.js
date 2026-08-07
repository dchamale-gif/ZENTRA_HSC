// ============================================
// DATA NORMALIZER - Convierte snake_case a camelCase
// ============================================

const DataNormalizer = {
    // Convertir snake_case a camelCase
    snakeToCamel(str) {
        return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    },

    // Convertir objeto con claves snake_case a camelCase
    normalizePaciente(paciente) {
        if (!paciente) return null;
        
        const normalized = {
            id: paciente.id,
            nombre: paciente.nombre,
            apellidoPaterno: paciente.apellido_paterno,
            apellidoMaterno: paciente.apellido_materno,
            edad: paciente.edad,
            fechaNacimiento: paciente.fecha_nacimiento,
            genero: paciente.genero,
            dpi: paciente.dpi,
            pasaporte: paciente.pasaporte,
            cedula: paciente.dpi, // Alias para búsqueda
            telefono: paciente.telefono,
            email: paciente.email,
            direccion: paciente.direccion,
            colonia: paciente.colonia,
            zona: paciente.zona,
            municipio: paciente.municipio,
            departamento: paciente.departamento,
            estadoCivil: paciente.estado_civil,
            profesion: paciente.profesion,
            ocupacion: paciente.ocupacion,
            estado: paciente.estado,
            isCliente: paciente.is_cliente || false,
            tipoServicio: paciente.tipo_servicio,
            foto: paciente.foto,
            fechaRegistro: paciente.created_at || new Date().toISOString().split('T')[0],
            createdAt: paciente.created_at,
            updatedAt: paciente.updated_at,
            // Alias para compatibilidad
            apellido: paciente.apellido_paterno
        };
        
        return normalized;
    },

    // Normalizar array de pacientes
    normalizePacientes(pacientes) {
        if (!Array.isArray(pacientes)) return [];
        return pacientes.map(p => this.normalizePaciente(p));
    },

    // Convertir camelCase a snake_case para enviar al backend
    camelToSnake(str) {
        return str.replace(/([A-Z])/g, '_$1').toLowerCase();
    },

    // Convertir objeto camelCase a snake_case para el backend
    denormalizePaciente(paciente) {
        if (!paciente) return null;
        
        return {
            id: paciente.id,
            nombre: paciente.nombre,
            apellido_paterno: paciente.apellidoPaterno,
            apellido_materno: paciente.apellidoMaterno,
            edad: paciente.edad,
            fecha_nacimiento: paciente.fechaNacimiento,
            genero: paciente.genero,
            dpi: paciente.dpi,
            telefono: paciente.telefono,
            email: paciente.email,
            direccion: paciente.direccion,
            colonia: paciente.colonia,
            zona: paciente.zona,
            municipio: paciente.municipio,
            departamento: paciente.departamento,
            estado_civil: paciente.estadoCivil,
            profesion: paciente.profesion,
            ocupacion: paciente.ocupacion,
            estado: paciente.estado,
            is_cliente: paciente.isCliente,
            tipo_servicio: paciente.tipoServicio,
            foto: paciente.foto
        };
    }
};

// Hacer disponible globalmente
if (typeof window !== 'undefined') {
    window.DataNormalizer = DataNormalizer;
}
