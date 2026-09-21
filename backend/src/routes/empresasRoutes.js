const express = require('express');
const router = express.Router();
const empresasController = require('../controllers/empresasController');

router.get('/:pacienteId', empresasController.getByPaciente);
router.post('/', empresasController.save);

module.exports = router;
