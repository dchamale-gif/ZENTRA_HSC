const express = require('express');
const pacientesController = require('../controllers/pacientesController');
const { authMiddleware, rolePermissionMiddleware } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET - Listar pacientes (requiere permiso pacientes_view)
router.get('/', rolePermissionMiddleware(['pacientes_view']), pacientesController.getPacientes);

// GET - Obtener paciente específico
router.get('/:id', rolePermissionMiddleware(['pacientes_view']), pacientesController.getPacienteById);

// POST - Crear paciente (requiere permiso pacientes_create)
router.post('/', rolePermissionMiddleware(['pacientes_create']), pacientesController.createPaciente);

// PUT - Actualizar paciente (requiere permiso pacientes_edit)
router.put('/:id', rolePermissionMiddleware(['pacientes_edit']), pacientesController.updatePaciente);

// DELETE - Eliminar paciente (requiere permiso pacientes_delete)
router.delete('/:id', rolePermissionMiddleware(['pacientes_delete']), pacientesController.deletePaciente);

module.exports = router;
