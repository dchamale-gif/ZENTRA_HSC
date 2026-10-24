const express = require('express');
const comprasController = require('../controllers/comprasController');
const { authMiddleware } = require('../middleware/auth');
const { recibirArchivo } = require('../services/archivos');

const router = express.Router();

router.use(authMiddleware);
// Vouchers del pago (antes de /:id para que no se confundan)
router.get('/vouchers/:voucherId', comprasController.verVoucher);
router.delete('/vouchers/:voucherId', comprasController.eliminarVoucher);
router.post('/:id/vouchers', recibirArchivo(express), comprasController.subirVoucher);

router.get('/', comprasController.getCompras);
router.get('/:id', comprasController.getCompraById);
router.post('/', comprasController.createCompra);
router.put('/:id', comprasController.updateCompra);
router.delete('/:id', comprasController.deleteCompra);

// Voucher de más de 10 MB: mensaje en español en lugar del error genérico
router.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'El voucher puede pesar hasta 10 MB' });
  next(err);
});

module.exports = router;