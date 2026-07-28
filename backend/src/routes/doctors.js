const express = require('express');
const doctorsController = require('../controllers/doctorsController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Obtener lista de doctores
router.get('/', (req, res) => {
    doctorsController.getDoctors(req, res);
});

// Obtener especialidades disponibles
router.get('/specialties/list', (req, res) => {
    doctorsController.getSpecialties(req, res);
});

// Obtener doctores por especialidad
router.get('/specialty/:specialty', (req, res) => {
    doctorsController.getDoctorsBySpecialty(req, res);
});

module.exports = router;
