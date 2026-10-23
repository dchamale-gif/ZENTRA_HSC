const express = require('express');
const controller = require('../controllers/evolucionesController');

// Montado en server.js con authMiddleware + requireModule(PERMISOS.evoluciones).
// Modificar y eliminar (solo admin, con motivo) se verifican en el controlador.
const router = express.Router();

router.get('/medicos', controller.medicos);
router.get('/', controller.listar);
router.post('/', controller.crear);
router.put('/:id', controller.actualizar);
router.delete('/:id', controller.eliminar);

module.exports = router;
