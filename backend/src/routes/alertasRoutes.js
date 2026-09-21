const express = require('express');
const router = express.Router();
const alertasController = require('../controllers/alertasController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/:pacienteId', alertasController.getByPaciente);
router.post('/', alertasController.create);
router.delete('/:id', alertasController.delete);

module.exports = router;
