const express = require('express');
const regulacionesController = require('../controllers/regulacionesController');

// Regulaciones de inventario (solo administrador; el permiso se revisa al montar la ruta)
const router = express.Router();

router.get('/', regulacionesController.listar);
router.get('/:id', regulacionesController.obtener);
router.post('/', regulacionesController.crear);
router.put('/:id/anular', regulacionesController.anular);

module.exports = router;
