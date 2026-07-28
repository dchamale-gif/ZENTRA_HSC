const express = require('express');
const appointmentsController = require('../controllers/appointmentsController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Citas del día
router.get('/today', (req, res) => {
    appointmentsController.getTodayAppointments(req, res);
});

// Mis citas (del doctor actual)
router.get('/my-appointments', (req, res) => {
    appointmentsController.getMyAppointments(req, res);
});

// Citas del paciente
router.get('/patient/:paciente_id', (req, res) => {
    appointmentsController.getPatientAppointments(req, res);
});

// Crear cita
router.post('/', (req, res) => {
    appointmentsController.createAppointment(req, res);
});

// Actualizar cita
router.put('/:id', (req, res) => {
    appointmentsController.updateAppointment(req, res);
});

module.exports = router;
