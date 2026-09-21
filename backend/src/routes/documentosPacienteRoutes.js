const express = require('express');
const router = express.Router();
const documentosPacienteController = require('../controllers/documentosPacienteController');
const { authMiddleware } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Obtener todos los documentos de un paciente
router.get('/:pacienteId', documentosPacienteController.getByPaciente);

// Obtener documento específico por categoría
router.get('/:pacienteId/categoria/:categoria', documentosPacienteController.getByCategoria);

// Crear/actualizar documento
router.post('/', documentosPacienteController.save);

// Eliminar documento
router.delete('/:id', documentosPacienteController.delete);

module.exports = router;
