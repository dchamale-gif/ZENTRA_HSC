const express = require('express');
const controller = require('../controllers/signosVitalesController');

// Montado en server.js con authMiddleware + requireModule(PERMISOS.signosVitales).
// Corregir y borrar (autor o admin) se verifican en el controlador.
const router = express.Router();

router.get('/', controller.listar);
router.post('/', controller.crear);
router.put('/:id', controller.actualizar);
router.delete('/:id', controller.eliminar);

module.exports = router;
