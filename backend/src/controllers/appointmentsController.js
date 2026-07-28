// ============================================
// CONTROLADOR DE CITAS Y AGENDA
// ============================================

const db = require('../db/connection');
const { generateId } = require('../utils/helpers');

class AppointmentsController {
    /**
     * Obtener citas del día
     */
    async getTodayAppointments(req, res) {
        try {
            const query = `
                SELECT 
                    hc.id,
                    hc.paciente_id,
                    p.nombre as paciente_nombre,
                    p.apellido_paterno,
                    hc.doctor_id,
                    u.nombre as doctor_nombre,
                    u.especialidad,
                    hc.fecha,
                    hc.hora,
                    hc.diagnostico,
                    hc.observaciones,
                    hc.estado
                FROM historia_clinica hc
                JOIN pacientes p ON hc.paciente_id = p.id
                LEFT JOIN users u ON hc.doctor_id = u.id
                WHERE DATE(hc.fecha) = CURRENT_DATE
                ORDER BY hc.hora ASC
            `;

            const result = await db.query(query);
            
            res.json({
                success: true,
                data: result.rows.map(cita => ({
                    id: cita.id,
                    pacienteId: cita.paciente_id,
                    pacienteNombre: `${cita.paciente_nombre} ${cita.apellido_paterno}`,
                    doctorId: cita.doctor_id,
                    doctorNombre: cita.doctor_nombre,
                    especialidad: cita.especialidad,
                    fecha: cita.fecha,
                    hora: cita.hora,
                    diagnostico: cita.diagnostico,
                    observaciones: cita.observaciones,
                    estado: cita.estado
                }))
            });
        } catch (error) {
            console.error('Error en getTodayAppointments:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener citas',
                error: error.message
            });
        }
    }

    /**
     * Obtener citas del doctor actual
     */
    async getMyAppointments(req, res) {
        try {
            const doctor_id = req.user.id;
            
            const query = `
                SELECT 
                    hc.id,
                    hc.paciente_id,
                    p.nombre as paciente_nombre,
                    p.apellido_paterno,
                    p.telefono,
                    hc.fecha,
                    hc.hora,
                    hc.diagnostico,
                    hc.observaciones,
                    hc.estado
                FROM historia_clinica hc
                JOIN pacientes p ON hc.paciente_id = p.id
                WHERE hc.doctor_id = $1
                    AND hc.fecha >= CURRENT_DATE
                ORDER BY hc.fecha ASC, hc.hora ASC
                LIMIT 50
            `;

            const result = await db.query(query, [doctor_id]);
            
            res.json({
                success: true,
                data: result.rows.map(cita => ({
                    id: cita.id,
                    pacienteId: cita.paciente_id,
                    pacienteNombre: `${cita.paciente_nombre} ${cita.apellido_paterno}`,
                    telefonoPaciente: cita.telefono,
                    fecha: cita.fecha,
                    hora: cita.hora,
                    diagnostico: cita.diagnostico,
                    observaciones: cita.observaciones,
                    estado: cita.estado
                }))
            });
        } catch (error) {
            console.error('Error en getMyAppointments:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener mis citas',
                error: error.message
            });
        }
    }

    /**
     * Obtener citas del paciente
     */
    async getPatientAppointments(req, res) {
        try {
            const { paciente_id } = req.params;
            
            const query = `
                SELECT 
                    id,
                    paciente_id,
                    doctor_id,
                    (SELECT nombre FROM users WHERE id = doctor_id) as doctor_nombre,
                    fecha,
                    hora,
                    diagnostico,
                    tratamiento,
                    observaciones,
                    estado
                FROM historia_clinica
                WHERE paciente_id = $1
                ORDER BY fecha DESC
                LIMIT 100
            `;

            const result = await db.query(query, [paciente_id]);
            
            res.json({
                success: true,
                data: result.rows.map(cita => ({
                    id: cita.id,
                    doctorId: cita.doctor_id,
                    doctorNombre: cita.doctor_nombre,
                    fecha: cita.fecha,
                    hora: cita.hora,
                    diagnostico: cita.diagnostico,
                    tratamiento: cita.tratamiento,
                    observaciones: cita.observaciones,
                    estado: cita.estado
                }))
            });
        } catch (error) {
            console.error('Error en getPatientAppointments:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener citas del paciente',
                error: error.message
            });
        }
    }

    /**
     * Crear nueva cita
     */
    async createAppointment(req, res) {
        try {
            const { paciente_id, doctor_id, fecha, hora, diagnostico, tratamiento, observaciones } = req.body;
            
            const cita_id = generateId('CIT');
            
            const query = `
                INSERT INTO historia_clinica (
                    id, paciente_id, doctor_id, fecha, hora, 
                    diagnostico, tratamiento, observaciones, estado
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activo')
                RETURNING *
            `;

            const result = await db.query(query, [
                cita_id, paciente_id, doctor_id, fecha, hora,
                diagnostico, tratamiento, observaciones
            ]);

            res.status(201).json({
                success: true,
                message: 'Cita creada exitosamente',
                data: result.rows[0]
            });
        } catch (error) {
            console.error('Error en createAppointment:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear cita',
                error: error.message
            });
        }
    }

    /**
     * Actualizar cita
     */
    async updateAppointment(req, res) {
        try {
            const { id } = req.params;
            const { diagnostico, tratamiento, observaciones, estado } = req.body;
            
            const query = `
                UPDATE historia_clinica
                SET 
                    diagnostico = COALESCE($1, diagnostico),
                    tratamiento = COALESCE($2, tratamiento),
                    observaciones = COALESCE($3, observaciones),
                    estado = COALESCE($4, estado),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $5
                RETURNING *
            `;

            const result = await db.query(query, [
                diagnostico, tratamiento, observaciones, estado, id
            ]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cita no encontrada'
                });
            }

            res.json({
                success: true,
                message: 'Cita actualizada exitosamente',
                data: result.rows[0]
            });
        } catch (error) {
            console.error('Error en updateAppointment:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar cita',
                error: error.message
            });
        }
    }
}

module.exports = new AppointmentsController();
