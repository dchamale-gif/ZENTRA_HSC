const express = require('express');
const pacientesController = require('../controllers/pacientesController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET - Listar pacientes
router.get('/', pacientesController.getPacientes);

// GET - Obtener paciente específico
router.get('/:id', pacientesController.getPacienteById);

// POST - Crear paciente
router.post('/', pacientesController.createPaciente);

// PUT - Actualizar paciente
router.put('/:id', pacientesController.updatePaciente);

// DELETE - Eliminar paciente
router.delete('/:id', pacientesController.deletePaciente);

module.exports = router;
