const express = require('express');
const router = express.Router();
const ordenesController = require('../controllers/ordenesController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/:pacienteId', ordenesController.getByPaciente);
router.post('/', ordenesController.create);
router.put('/:id/estado', ordenesController.updateEstado);
router.delete('/:id', ordenesController.delete);

module.exports = router;
