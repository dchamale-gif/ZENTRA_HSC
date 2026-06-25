const express = require('express');
const billingController = require('../controllers/billingController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ============================================
// RUTAS DE FACTURAS
// ============================================

// Crear factura
router.post('/facturas', authMiddleware, (req, res) => {
    billingController.createFactura(req, res);
});

// Obtener factura por ID
router.get('/facturas/:id', authMiddleware, (req, res) => {
    billingController.getFactura(req, res);
});

// Listar facturas
router.get('/facturas', authMiddleware, (req, res) => {
    billingController.listFacturas(req, res);
});

// Actualizar factura
router.put('/facturas/:id', authMiddleware, (req, res) => {
    billingController.updateFactura(req, res);
});

// Eliminar factura
router.delete('/facturas/:id', authMiddleware, (req, res) => {
    billingController.deleteFactura(req, res);
});

// ============================================
// RUTAS DE DESCUENTOS
// ============================================

// Crear descuento predefinido
router.post('/descuentos', authMiddleware, (req, res) => {
    billingController.createDescuento(req, res);
});

// Listar descuentos disponibles
router.get('/descuentos', authMiddleware, (req, res) => {
    billingController.listDescuentos(req, res);
});

// Validar código promocional
router.post('/validar-codigo', (req, res) => {
    billingController.validarCodigoPromocional(req, res);
});

module.exports = router;
