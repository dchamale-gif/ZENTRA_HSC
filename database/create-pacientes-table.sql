-- ============================================
-- CREAR TABLA PACIENTES (Simplificada para API)
-- ============================================
-- Ejecutar este script en la BD de DigitalOcean

DROP TABLE IF EXISTS pacientes CASCADE;

CREATE TABLE pacientes (
    id SERIAL PRIMARY KEY,
    cedula VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    edad INTEGER,
    genero VARCHAR(20),
    tipo_sangre VARCHAR(10),
    telefono VARCHAR(20),
    email VARCHAR(100),
    direccion VARCHAR(255),
    ciudad VARCHAR(100),
    alergias TEXT,
    enfermedades_cronicas TEXT,
    contacto_emergencia VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para búsquedas rápidas
CREATE INDEX idx_pacientes_cedula ON pacientes(cedula);
CREATE INDEX idx_pacientes_nombre ON pacientes(nombre);
CREATE INDEX idx_pacientes_activo ON pacientes(activo);

-- Insertar datos de prueba (opcional)
INSERT INTO pacientes (cedula, nombre, apellido, edad, genero, telefono, email, activo) VALUES
('12345678', 'Juan', 'Pérez', 45, 'M', '5551234567', 'juan@example.com', true),
('87654321', 'María', 'García', 35, 'F', '5559876543', 'maria@example.com', true),
('11111111', 'Carlos', 'López', 50, 'M', '5555555555', 'carlos@example.com', true);
