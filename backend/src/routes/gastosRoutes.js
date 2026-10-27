const express = require('express');
const gastosController = require('../controllers/gastosController');
const { recibirArchivo } = require('../services/archivos');

const router = express.Router();

// Voucher del pago (antes de /:id para que no se confundan)
router.get('/vouchers/:voucherId', gastosController.verVoucher);
router.post('/:id/vouchers', recibirArchivo(express), gastosController.subirVoucher);

router.get('/', gastosController.listar);
router.post('/', gastosController.crear);
router.put('/:id', gastosController.actualizar);
// Cargar (espera pago del dueño), pagar, anular o volver a pendiente
router.put('/:id/estado', gastosController.cambiarEstado);
router.delete('/:id', gastosController.eliminar);

// Voucher de más de 10 MB: mensaje en español en lugar del error genérico
router.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'El voucher puede pesar hasta 10 MB' });
  next(err);
});

module.exports = router;
