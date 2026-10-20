const express = require('express');
const ordenesEnfermeriaController = require('../controllers/ordenesEnfermeriaController');

// Montado en server.js con authMiddleware + requireModule(PERMISOS.ordenesEnfermeria)
const router = express.Router();

router.get('/', ordenesEnfermeriaController.listar);
router.put('/:ordenMedicaId', ordenesEnfermeriaController.guardar);
router.delete('/:ordenMedicaId', ordenesEnfermeriaController.eliminar);

module.exports = router;
