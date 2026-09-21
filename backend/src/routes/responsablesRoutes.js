const express = require('express');
const router = express.Router();
const responsablesController = require('../controllers/responsablesController');
const { authMiddleware } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/:pacienteId', responsablesController.getByPaciente);
router.post('/', responsablesController.save);

module.exports = router;
