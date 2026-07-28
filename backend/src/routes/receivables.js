const express = require('express');
const receivablesController = require('../controllers/receivablesController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Obtener cuentas por cobrar
router.get('/', (req, res) => {
    receivablesController.getReceivables(req, res);
});

// Resumen de cuentas por cobrar
router.get('/summary', (req, res) => {
    receivablesController.getReceivablesSummary(req, res);
});

// Movimientos de una cuenta
router.get('/:venta_id/movements', (req, res) => {
    receivablesController.getReceivableMovements(req, res);
});

// Registrar pago
router.post('/:venta_id/payment', (req, res) => {
    receivablesController.recordPayment(req, res);
});

module.exports = router;
