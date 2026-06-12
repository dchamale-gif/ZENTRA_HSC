const express = require('express');
const codigosArticulosController = require('../controllers/codigosArticulosController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET - Stock bajo (PRIMERO - evitar conflicto con :id)
router.get('/stock/bajo', codigosArticulosController.getArticulosStockBajo);

// GET - Listar artículos
router.get('/', codigosArticulosController.getArticulos);

// GET - Obtener artículo específico
router.get('/:id', codigosArticulosController.getArticuloById);

// POST - Crear artículo
router.post('/', codigosArticulosController.createArticulo);

// PUT - Actualizar artículo
router.put('/:id', codigosArticulosController.updateArticulo);

// PUT - Actualizar cantidad
router.put('/:id/cantidad', codigosArticulosController.actualizarCantidad);

// DELETE - Eliminar artículo
router.delete('/:id', codigosArticulosController.deleteArticulo);

module.exports = router;
