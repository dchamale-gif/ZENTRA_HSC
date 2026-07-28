// ============================================
// CONTROLADOR DE DOCTORES Y ESPECIALIDADES
// ============================================

const db = require('../db/connection');

class DoctorsController {
    /**
     * Obtener lista de doctores
     */
    async getDoctors(req, res) {
        try {
            const query = `
                SELECT 
                    id,
                    nombre,
                    email,
                    telefono,
                    especialidad,
                    numero_colegiado,
                    activo,
                    created_at
                FROM users
                WHERE activo = true
                ORDER BY nombre ASC
            `;

            const result = await db.query(query);
            
            res.json({
                success: true,
                data: result.rows.map(doctor => ({
                    id: doctor.id,
                    nombre: doctor.nombre,
                    email: doctor.email,
                    telefono: doctor.telefono,
                    especialidad: doctor.especialidad || 'General',
                    numeroColegiaado: doctor.numero_colegiado,
                    activo: doctor.activo
                }))
            });
        } catch (error) {
            console.error('Error en getDoctors:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener doctores',
                error: error.message
            });
        }
    }

    /**
     * Obtener especialidades disponibles
     */
    async getSpecialties(req, res) {
        try {
            const query = `
                SELECT DISTINCT 
                    especialidad,
                    COUNT(*) as cantidad_doctores
                FROM users
                WHERE activo = true AND especialidad IS NOT NULL
                GROUP BY especialidad
                ORDER BY especialidad ASC
            `;

            const result = await db.query(query);
            
            const specialties = result.rows.map(row => ({
                nombre: row.especialidad,
                cantidadDoctores: parseInt(row.cantidad_doctores)
            }));

            res.json({
                success: true,
                data: specialties
            });
        } catch (error) {
            console.error('Error en getSpecialties:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener especialidades',
                error: error.message
            });
        }
    }

    /**
     * Obtener doctores por especialidad
     */
    async getDoctorsBySpecialty(req, res) {
        try {
            const { specialty } = req.params;

            const query = `
                SELECT 
                    id,
                    nombre,
                    email,
                    telefono,
                    especialidad,
                    numero_colegiado
                FROM users
                WHERE activo = true AND especialidad = $1
                ORDER BY nombre ASC
            `;

            const result = await db.query(query, [specialty]);
            
            res.json({
                success: true,
                data: result.rows.map(doctor => ({
                    id: doctor.id,
                    nombre: doctor.nombre,
                    email: doctor.email,
                    telefono: doctor.telefono,
                    especialidad: doctor.especialidad,
                    numeroColegiaado: doctor.numero_colegiado
                }))
            });
        } catch (error) {
            console.error('Error en getDoctorsBySpecialty:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener doctores por especialidad',
                error: error.message
            });
        }
    }
}

module.exports = new DoctorsController();
