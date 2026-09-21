const express = require('express');
const router = express.Router();
const responsablesController = require('../controllers/responsablesController');

// GET responsable por paciente_id
router.get('/:pacienteId', responsablesController.getResponsableByPacienteId);

// POST crear o actualizar responsable
router.post('/', responsablesController.createResponsable);

// PUT actualizar responsable
router.put('/:pacienteId', responsablesController.updateResponsable);

// DELETE eliminar responsable
router.delete('/:pacienteId', responsablesController.deleteResponsable);

module.exports = router;
