const express = require('express');
const router = express.Router();
const empresasController = require('../controllers/empresasController');
const { authMiddleware } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/:pacienteId', empresasController.getByPaciente);
router.post('/', empresasController.save);

module.exports = router;
