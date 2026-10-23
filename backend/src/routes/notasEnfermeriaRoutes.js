const express = require('express');
const controller = require('../controllers/notasEnfermeriaController');

// Montado en server.js con authMiddleware + requireModule(PERMISOS.notasEnfermeria)
const router = express.Router();

router.get('/', controller.listar);
router.post('/', controller.crear);
router.put('/:id', controller.actualizar);
router.delete('/:id', controller.eliminar);

module.exports = router;
