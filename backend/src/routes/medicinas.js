const express = require('express');
const medicinasController = require('../controllers/medicinasController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET - Listar medicinas
router.get('/', medicinasController.getMedicinas);

// GET - Stock bajo
router.get('/stock/bajo', medicinasController.getMedicinasStockBajo);

// GET - Obtener medicina específica
router.get('/:id', medicinasController.getMedicinaById);

// POST - Crear medicina
router.post('/', medicinasController.createMedicina);

// PUT - Actualizar medicina
router.put('/:id', medicinasController.updateMedicina);

// PUT - Actualizar stock
router.put('/:id/stock', medicinasController.actualizarStock);

// DELETE - Eliminar medicina
router.delete('/:id', medicinasController.deleteMedicina);

module.exports = router;
