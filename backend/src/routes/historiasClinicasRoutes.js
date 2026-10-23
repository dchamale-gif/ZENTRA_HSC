const express = require('express');
const controller = require('../controllers/historiasClinicasController');

// Montado en server.js con authMiddleware + requireModule(PERMISOS.historiasClinicas).
// Abrir/cerrar (médico) y reabrir/eliminar (admin) se verifican en el controlador.
const router = express.Router();

router.get('/resumen', controller.resumen);
router.get('/paciente/:pacienteId', controller.listarPorPaciente);
router.get('/antecedentes/:pacienteId', controller.obtenerAntecedentes);
router.put('/antecedentes/:pacienteId', controller.guardarAntecedentes);

router.post('/', controller.crear);
router.get('/:id', controller.obtener);
router.put('/:id', controller.actualizar);
router.post('/:id/cerrar', controller.cerrar);
router.post('/:id/reabrir', controller.reabrir);
router.delete('/:id', controller.eliminar);

module.exports = router;
