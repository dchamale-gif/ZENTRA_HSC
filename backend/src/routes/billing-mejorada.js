// ============================================
// RUTAS DE FACTURACIÓN MEJORADA
// ============================================

const express = require('express');
const router = express.Router();
const billingMejoradoController = require('../controllers/billingMejoradoController');
const { verifyToken } = require('../middleware/auth');

// Proteger todas las rutas
router.use(verifyToken);

/**
 * POST /api/billing/facturas-mejorada
 * Crear nueva factura mejorada
 */
router.post('/facturas-mejorada', (req, res) => {
    billingMejoradoController.createFacturaMejorada(req, res);
});

/**
 * GET /api/billing/facturas
 * Listar facturas
 */
router.get('/facturas', (req, res) => {
    billingMejoradoController.listFacturas(req, res);
});

/**
 * GET /api/billing/estado-cuenta/:paciente_id
 * Obtener estado de cuenta detallado
 */
router.get('/estado-cuenta/:paciente_id', (req, res) => {
    billingMejoradoController.getEstadoCuenta(req, res);
});

/**
 * GET /api/billing/estado-cuenta-detallado/:paciente_id
 * Obtener estado de cuenta detallado con items agrupados por categoría
 */
router.get('/estado-cuenta-detallado/:paciente_id', (req, res) => {
    billingMejoradoController.getEstadoCuentaDetallado(req, res);
});

/**
 * GET /api/saldo-paciente/:paciente_id
 * Obtener saldo del paciente
 */
router.get('/saldo-paciente/:paciente_id', (req, res) => {
    billingMejoradoController.getSaldoPaciente(req, res);
});

/**
 * POST /api/billing/pagos
 * Registrar pago/abono
 */
router.post('/pagos', (req, res) => {
    billingMejoradoController.registrarPago(req, res);
});

module.exports = router;
