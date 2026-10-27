const express = require('express');
const requerimientosController = require('../controllers/requerimientosController');

const router = express.Router();

router.get('/', requerimientosController.listar);
router.get('/:id', requerimientosController.obtener);
router.post('/', requerimientosController.crear);
router.put('/:id', requerimientosController.actualizar);
// Confirmar o rechazar (desde el listado): solo compras o el administrador
router.put('/:id/estado', requerimientosController.cambiarEstado);
router.delete('/:id', requerimientosController.eliminar);

module.exports = router;
