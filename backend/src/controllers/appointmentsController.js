// ============================================
// CONTROLADOR DE CITAS Y AGENDA
// ============================================

const db = require('../db/connection');
const { generateId } = require('../utils/helpers');

class AppointmentsController {
    /**
     * Obtener agenda con filtros opcionales
     */
    async getAllAppointments(req, res) {
        try {
            const { desde, hasta, doctor_id, estado } = req.query;
            const values = [];
            const conditions = ["hc.estado <> 'eliminada'"];

            const addCondition = (condition, value) => {
                values.push(value);
                conditions.push(condition.replace('?', `$${values.length}`));
            };

            if (desde) addCondition('hc.fecha >= ?', desde);
            if (hasta) addCondition('hc.fecha <= ?', hasta);
            if (doctor_id) addCondition('hc.doctor_id = ?', doctor_id);
            if (estado) addCondition('LOWER(hc.estado) = LOWER(?)', estado);

            const result = await db.query(`
                SELECT hc.id, hc.paciente_id, hc.doctor_id, hc.fecha, hc.hora,
                    hc.diagnostico, hc.tratamiento, hc.observaciones, hc.estado,
                    p.nombre AS paciente_nombre, p.apellido_paterno,
                    p.telefono, p.email, u.nombre AS doctor_nombre,
                    NULL::text AS especialidad
                FROM historia_clinica hc
                JOIN pacientes p ON hc.paciente_id = p.id
                LEFT JOIN users u ON hc.doctor_id = u.id
                WHERE ${conditions.join(' AND ')}
                ORDER BY hc.fecha ASC, hc.hora ASC
                LIMIT 500
            `, values);

            res.json({ success: true, data: result.rows });
        } catch (error) {
            console.error('Error en getAllAppointments:', error);
            res.status(500).json({ success: false, message: 'Error al obtener la agenda', error: error.message });
        }
    }

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
                    NULL::text AS especialidad,
                    hc.fecha,
                    hc.hora,
                    hc.diagnostico,
                    hc.observaciones,
                    hc.estado
                FROM historia_clinica hc
                JOIN pacientes p ON hc.paciente_id = p.id
                LEFT JOIN users u ON hc.doctor_id = u.id
                WHERE DATE(hc.fecha) = CURRENT_DATE
                    AND LOWER(hc.estado) NOT IN ('cancelada', 'eliminada')
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
                    AND LOWER(hc.estado) NOT IN ('cancelada', 'eliminada')
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

            if (!paciente_id || !doctor_id || !fecha || !hora) {
                return res.status(400).json({
                    success: false,
                    message: 'Paciente, doctor, fecha y hora son obligatorios'
                });
            }

            const conflict = await db.query(`
                SELECT id FROM historia_clinica
                WHERE doctor_id = $1 AND fecha = $2 AND hora = $3
                    AND LOWER(estado) NOT IN ('cancelada', 'eliminada')
                LIMIT 1
            `, [doctor_id, fecha, hora]);

            if (conflict.rows.length > 0) {
                return res.status(409).json({ success: false, message: 'El horario ya está reservado para este doctor' });
            }

            const cita_id = generateId('CIT');
            
            const query = `
                INSERT INTO historia_clinica (
                    id, paciente_id, doctor_id, fecha, hora, 
                    diagnostico, tratamiento, observaciones, estado
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente')
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
            const { paciente_id, doctor_id, fecha, hora, diagnostico, tratamiento, observaciones, estado } = req.body;

            const currentResult = await db.query('SELECT * FROM historia_clinica WHERE id = $1', [id]);
            if (currentResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Cita no encontrada' });
            }

            const current = currentResult.rows[0];
            const nextDoctor = doctor_id || current.doctor_id;
            const nextDate = fecha || current.fecha;
            const nextTime = hora || current.hora;
            const conflict = await db.query(`
                SELECT id FROM historia_clinica
                WHERE doctor_id = $1 AND fecha = $2 AND hora = $3 AND id <> $4
                    AND LOWER(estado) NOT IN ('cancelada', 'eliminada')
                LIMIT 1
            `, [nextDoctor, nextDate, nextTime, id]);

            if (conflict.rows.length > 0) {
                return res.status(409).json({ success: false, message: 'El horario ya está reservado para este doctor' });
            }

            const query = `
                UPDATE historia_clinica
                SET paciente_id = COALESCE($1, paciente_id),
                    doctor_id = COALESCE($2, doctor_id),
                    fecha = COALESCE($3, fecha),
                    hora = COALESCE($4, hora),
                    diagnostico = COALESCE($5, diagnostico),
                    tratamiento = COALESCE($6, tratamiento),
                    observaciones = COALESCE($7, observaciones),
                    estado = COALESCE($8, estado),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $9
                RETURNING *
            `;

            const result = await db.query(query, [
                paciente_id, doctor_id, fecha, hora,
                diagnostico, tratamiento, observaciones, estado, id
            ]);

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

    /**
     * Eliminar una cita sin borrar su trazabilidad
     */
    async deleteAppointment(req, res) {
        try {
            const result = await db.query(`
                UPDATE historia_clinica
                SET estado = 'eliminada', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND estado <> 'eliminada'
                RETURNING id
            `, [req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Cita no encontrada' });
            }

            res.json({ success: true, message: 'Cita eliminada exitosamente' });
        } catch (error) {
            console.error('Error en deleteAppointment:', error);
            res.status(500).json({ success: false, message: 'Error al eliminar cita', error: error.message });
        }
    }
}

module.exports = new AppointmentsController();
