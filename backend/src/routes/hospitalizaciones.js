const express = require('express');
const controller = require('../controllers/hospitalizacionesController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/habitaciones', (req, res) => controller.getHabitaciones(req, res));
router.get('/ingresos', (req, res) => controller.getIngresos(req, res));
router.post('/ingresos', (req, res) => controller.createIngreso(req, res));
router.post('/traslados', (req, res) => controller.transferir(req, res));
router.post('/egresos', (req, res) => controller.egresar(req, res));

module.exports = router;