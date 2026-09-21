const express = require('express');
const router = express.Router();
const empresasController = require('../controllers/empresasController');

// GET empresa por paciente_id
router.get('/:pacienteId', empresasController.getEmpresaByPacienteId);

// POST crear o actualizar empresa
router.post('/', empresasController.createEmpresa);

// PUT actualizar empresa
router.put('/:pacienteId', empresasController.updateEmpresa);

// DELETE eliminar empresa
router.delete('/:pacienteId', empresasController.deleteEmpresa);

module.exports = router;
