const db = require('../db/connection');
const { generateId } = require('../utils/helpers');

function mapHospitalizacion(row) {
    return {
        id: row.id,
        pacienteId: row.paciente_id,
        paciente: row.paciente_nombre
            ? `${row.paciente_nombre} ${row.apellido_paterno || ''}`.trim()
            : null,
        habitacion: row.habitacion_id,
        cama: row.cama_id,
        fechaIngreso: row.fecha_entrada,
        horaIngreso: row.hora_entrada,
        fechaAlta: row.fecha_salida,
        horaAlta: row.hora_salida,
        diagnostico: row.diagnostico || '',
        observaciones: row.observaciones || '',
        estado: row.estado,
        medico: row.doctor_nombre || 'Sin asignar',
        traslados: row.traslados || []
    };
}

class HospitalizacionesController {
    async getHabitaciones(req, res) {
        try {
            const result = await db.query(`
                SELECT h.id, h.numero, h.piso, h.tipo, h.activo,
                    COALESCE(json_agg(json_build_object(
                        'id', c.id, 'numero', c.numero_cama, 'estado', c.estado
                    ) ORDER BY c.numero_cama) FILTER (WHERE c.id IS NOT NULL), '[]') AS camas
                FROM habitaciones h
                LEFT JOIN camas c ON c.habitacion_id = h.id
                WHERE h.activo = true
                GROUP BY h.id
                ORDER BY h.orden, h.id
            `);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            console.error('Error obteniendo habitaciones:', error);
            res.status(500).json({ success: false, message: 'Error al obtener habitaciones', error: error.message });
        }
    }

    async getIngresos(req, res) {
        try {
            const values = [];
            const conditions = [];
            if (req.query.estado) {
                values.push(req.query.estado);
                conditions.push(`h.estado = $${values.length}`);
            }
            const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            const result = await db.query(`
                SELECT h.*, c.habitacion_id, p.nombre AS paciente_nombre, p.apellido_paterno,
                    u.nombre AS doctor_nombre,
                    COALESCE((
                        SELECT json_agg(json_build_object(
                            'fecha', t.fecha_traslado, 'hora', t.hora_traslado,
                            'desde', t.cama_origen_id, 'hacia', t.cama_destino_id,
                            'razon', t.razon
                        ) ORDER BY t.created_at)
                        FROM traslados_camas t WHERE t.hospitalizacion_id = h.id
                    ), '[]') AS traslados
                FROM hospitalizaciones h
                LEFT JOIN camas c ON c.id = h.cama_id
                JOIN pacientes p ON p.id = h.paciente_id
                LEFT JOIN users u ON u.id = h.doctor_id
                ${where}
                ORDER BY h.fecha_entrada DESC, h.hora_entrada DESC
                LIMIT 500
            `, values);
            res.json({ success: true, data: result.rows.map(mapHospitalizacion) });
        } catch (error) {
            console.error('Error obteniendo hospitalizaciones:', error);
            res.status(500).json({ success: false, message: 'Error al obtener hospitalizaciones', error: error.message });
        }
    }

    async createIngreso(req, res) {
        const client = await db.connect();
        try {
            const { pacienteId, paciente_id, cama, cama_id, diagnostico, observaciones } = req.body;
            const patientId = pacienteId || paciente_id;
            const bedId = cama || cama_id;
            const diagnosticoTexto = String(diagnostico || '').trim();
            if (!patientId || !bedId) {
                return res.status(400).json({ success: false, message: 'Paciente y cama son obligatorios' });
            }

            await client.query('BEGIN');
            const bed = await client.query('SELECT * FROM camas WHERE id = $1 FOR UPDATE', [bedId]);
            if (bed.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Cama no encontrada' });
            }
            if (bed.rows[0].estado !== 'libre') {
                await client.query('ROLLBACK');
                return res.status(409).json({ success: false, message: 'La cama seleccionada ya no está disponible' });
            }

            const active = await client.query("SELECT id FROM hospitalizaciones WHERE paciente_id = $1 AND estado = 'activa' LIMIT 1", [patientId]);
            if (active.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ success: false, message: 'El paciente ya tiene una hospitalización activa' });
            }

            const id = generateId('HOSP');
            const doctorId = Number.isInteger(Number(req.user?.id)) ? Number(req.user.id) : null;
            const result = await client.query(`
                INSERT INTO hospitalizaciones (
                    id, paciente_id, doctor_id, cama_id, fecha_entrada, hora_entrada,
                    motivo, diagnostico, estado, observaciones
                ) VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_TIME, $5, $6, 'activa', $7)
                RETURNING *
            `, [id, patientId, doctorId, bedId, 'Ingreso hospitalario', diagnosticoTexto || null, observaciones?.trim() || null]);
            await client.query("UPDATE camas SET estado = 'ocupada', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [bedId]);
            await client.query('COMMIT');

            result.rows[0].habitacion_id = bed.rows[0].habitacion_id;
            res.status(201).json({ success: true, message: 'Ingreso registrado', data: mapHospitalizacion(result.rows[0]) });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error registrando ingreso:', error);
            res.status(500).json({ success: false, message: 'Error al registrar el ingreso', error: error.message });
        } finally {
            client.release();
        }
    }

    async transferir(req, res) {
        const client = await db.connect();
        try {
            const { hospitalizacionId, hospitalizacion_id, camaDestino, cama_destino_id, razon } = req.body;
            const admissionId = hospitalizacionId || hospitalizacion_id;
            const destinationId = camaDestino || cama_destino_id;
            if (!admissionId || !destinationId) {
                return res.status(400).json({ success: false, message: 'Hospitalización y cama destino son obligatorias' });
            }

            await client.query('BEGIN');
            const admission = await client.query("SELECT * FROM hospitalizaciones WHERE id = $1 AND estado = 'activa' FOR UPDATE", [admissionId]);
            if (admission.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Hospitalización activa no encontrada' });
            }
            const currentBedId = admission.rows[0].cama_id;
            const beds = await client.query('SELECT * FROM camas WHERE id = ANY($1::varchar[]) ORDER BY id FOR UPDATE', [[currentBedId, destinationId]]);
            const destination = beds.rows.find(item => item.id === destinationId);
            if (!destination) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Cama destino no encontrada' });
            }
            if (destination.estado !== 'libre') {
                await client.query('ROLLBACK');
                return res.status(409).json({ success: false, message: 'La cama destino ya no está disponible' });
            }

            await client.query("UPDATE camas SET estado = 'libre', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [currentBedId]);
            await client.query("UPDATE camas SET estado = 'ocupada', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [destinationId]);
            await client.query('UPDATE hospitalizaciones SET cama_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [destinationId, admissionId]);
            await client.query(`
                INSERT INTO traslados_camas (
                    id, hospitalizacion_id, cama_origen_id, cama_destino_id,
                    fecha_traslado, hora_traslado, razon
                ) VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_TIME, $5)
            `, [generateId('TRAS'), admissionId, currentBedId, destinationId, razon || null]);
            await client.query('COMMIT');

            res.json({ success: true, message: 'Traslado registrado' });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error registrando traslado:', error);
            res.status(500).json({ success: false, message: 'Error al registrar el traslado', error: error.message });
        } finally {
            client.release();
        }
    }

    async egresar(req, res) {
        const client = await db.connect();
        try {
            const admissionId = req.body.hospitalizacionId || req.body.hospitalizacion_id;
            if (!admissionId) {
                return res.status(400).json({ success: false, message: 'La hospitalización es obligatoria' });
            }

            await client.query('BEGIN');
            const admission = await client.query("SELECT * FROM hospitalizaciones WHERE id = $1 AND estado = 'activa' FOR UPDATE", [admissionId]);
            if (admission.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Hospitalización activa no encontrada' });
            }
            await client.query(`
                UPDATE hospitalizaciones
                SET estado = 'alta', fecha_salida = COALESCE($1::date, CURRENT_DATE),
                    hora_salida = CURRENT_TIME,
                    observaciones = CONCAT_WS(E'\n', observaciones, NULLIF($2, '')),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
            `, [req.body.fechaAlta || null, req.body.notasAlta || '', admissionId]);
            await client.query("UPDATE camas SET estado = 'libre', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [admission.rows[0].cama_id]);
            await client.query('COMMIT');
            res.json({ success: true, message: 'Alta registrada' });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error registrando alta:', error);
            res.status(500).json({ success: false, message: 'Error al registrar el alta', error: error.message });
        } finally {
            client.release();
        }
    }
}

module.exports = new HospitalizacionesController();