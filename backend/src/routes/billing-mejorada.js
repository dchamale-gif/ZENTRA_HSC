// ============================================
// RUTAS DE FACTURACIÓN MEJORADA
// ============================================

const express = require('express');
const router = express.Router();
const billingMejoradoController = require('../controllers/billingMejoradoController');
const { authMiddleware } = require('../middleware/auth');

// Proteger todas las rutas
router.use(authMiddleware);

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
 * GET /api/billing/saldos-pacientes
 * Listar saldos actuales de pacientes
 */
router.get('/saldos-pacientes', (req, res) => {
    billingMejoradoController.listSaldosPacientes(req, res);
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
 * POST /api/billing/cargos/:item_id/anular
 * Anular un concepto existente y ajustar el saldo de forma auditable
 */
router.post('/cargos/:item_id/anular', (req, res) => {
    billingMejoradoController.anularCargo(req, res);
});

/**
 * PUT /api/billing/cargos/:item_id
 * Modificar cantidad y precio de un cargo y ajustar el saldo
 */
router.put('/cargos/:item_id', (req, res) => {
    billingMejoradoController.actualizarCargo(req, res);
});

/**
 * GET /api/saldo-paciente/:paciente_id
 * Obtener saldo del paciente
 */
router.get('/saldo-paciente/:paciente_id', (req, res) => {
    billingMejoradoController.getSaldoPaciente(req, res);
});

/**
 * GET /api/billing/pagos
 * Listar pagos/abonos registrados
 */
router.get('/pagos', (req, res) => {
    billingMejoradoController.listPagos(req, res);
});

/**
 * POST /api/billing/pagos
 * Registrar pago/abono
 */
router.post('/pagos', (req, res) => {
    billingMejoradoController.registrarPago(req, res);
});

module.exports = router;
