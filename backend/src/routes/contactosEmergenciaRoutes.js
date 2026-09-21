const express = require('express');
const router = express.Router();
const contactosEmergenciaController = require('../controllers/contactosEmergenciaController');
const { authMiddleware } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/:pacienteId', contactosEmergenciaController.getByPaciente);
router.post('/', contactosEmergenciaController.save);

module.exports = router;
