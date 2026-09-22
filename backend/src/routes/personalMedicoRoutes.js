const express = require('express');
const personalMedicoController = require('../controllers/personalMedicoController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);
router.get('/especialidades', personalMedicoController.getEspecialidades);
router.get('/', personalMedicoController.getAll);
router.post('/', personalMedicoController.create);
router.put('/:id', personalMedicoController.update);
router.delete('/:id', personalMedicoController.delete);

module.exports = router;