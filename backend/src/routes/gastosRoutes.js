const express = require('express');
const gastosController = require('../controllers/gastosController');

const router = express.Router();

router.get('/', gastosController.listar);
router.post('/', gastosController.crear);
router.put('/:id', gastosController.actualizar);
// Cargar (espera pago del dueño), pagar, anular o volver a pendiente
router.put('/:id/estado', gastosController.cambiarEstado);
router.delete('/:id', gastosController.eliminar);

module.exports = router;
