const express = require('express');
const requisicionesController = require('../controllers/requisicionesController');
const { recibirArchivo } = require('../services/archivos');

const router = express.Router();

// Antes de /:id para que no se confundan
router.get('/facturas', requisicionesController.facturasDisponibles);
router.get('/vouchers/:voucherId', requisicionesController.verVoucher);
router.delete('/abonos/:abonoId', requisicionesController.eliminarAbono);
router.post('/:id/vouchers', recibirArchivo(express), requisicionesController.subirVoucher);

router.get('/', requisicionesController.listar);
router.post('/', requisicionesController.crear);
router.put('/:id', requisicionesController.actualizar);
// El pago va en uno o varios abonos
router.post('/:id/abonos', requisicionesController.registrarAbono);
// Quitar todos los abonos (vuelve a pendiente) o anular
router.put('/:id/estado', requisicionesController.cambiarEstado);
router.delete('/:id', requisicionesController.eliminar);

// Voucher de más de 10 MB: mensaje en español en lugar del error genérico
router.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'El voucher puede pesar hasta 10 MB' });
  next(err);
});

module.exports = router;
