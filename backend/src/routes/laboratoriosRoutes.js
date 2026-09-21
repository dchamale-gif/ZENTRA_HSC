const express = require('express');
const router = express.Router();
const laboratoriosController = require('../controllers/laboratoriosController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/:pacienteId', laboratoriosController.getByPaciente);
router.post('/', laboratoriosController.create);
router.delete('/:id', laboratoriosController.delete);

module.exports = router;
