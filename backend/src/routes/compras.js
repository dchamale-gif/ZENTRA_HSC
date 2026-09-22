const express = require('express');
const comprasController = require('../controllers/comprasController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);
router.get('/', comprasController.getCompras);
router.get('/:id', comprasController.getCompraById);
router.post('/', comprasController.createCompra);
router.put('/:id', comprasController.updateCompra);
router.delete('/:id', comprasController.deleteCompra);

module.exports = router;