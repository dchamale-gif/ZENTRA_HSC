// ============================================
// RUTAS DE COTIZACIONES
// ============================================

const express = require('express');
const router = express.Router();
const cotizacionesController = require('../controllers/cotizacionesController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Plantillas (antes de /:id para que no se confundan con una cotización)
router.get('/plantillas', cotizacionesController.listarPlantillas);
router.post('/plantillas', cotizacionesController.guardarPlantilla);
router.put('/plantillas/:id', cotizacionesController.guardarPlantilla);
router.delete('/plantillas/:id', cotizacionesController.eliminarPlantilla);

// Cotizaciones
router.get('/', cotizacionesController.listar);
router.post('/', cotizacionesController.crear);
router.get('/:id', cotizacionesController.obtener);
router.put('/:id', cotizacionesController.actualizar);
router.post('/:id/ingresar', cotizacionesController.ingresar);
router.post('/:id/anular', cotizacionesController.anular);

module.exports = router;
