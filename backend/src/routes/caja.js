const express = require('express');
const cajaController = require('../controllers/cajaController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => cajaController.getMovimientos(req, res));
router.get('/summary', (req, res) => cajaController.getResumen(req, res));
router.post('/', (req, res) => cajaController.createMovimiento(req, res));
router.put('/:id', (req, res) => cajaController.updateMovimiento(req, res));

module.exports = router;