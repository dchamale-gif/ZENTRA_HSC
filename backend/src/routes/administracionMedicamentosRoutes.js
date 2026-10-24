const express = require('express');
const controller = require('../controllers/administracionMedicamentosController');

// Montado en server.js con authMiddleware + requireModule(PERMISOS.controlMedicamentos)
const router = express.Router();

router.get('/', controller.listar);
router.put('/dosis', controller.marcarDosis);
router.post('/suspension', controller.suspender);
router.delete('/suspension', controller.reanudar);

module.exports = router;
