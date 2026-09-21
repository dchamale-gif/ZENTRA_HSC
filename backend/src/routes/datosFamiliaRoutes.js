const express = require('express');
const router = express.Router();
const datosFamiliaController = require('../controllers/datosFamiliaController');
const { authMiddleware } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/:pacienteId', datosFamiliaController.getByPaciente);
router.post('/', datosFamiliaController.save);

module.exports = router;
