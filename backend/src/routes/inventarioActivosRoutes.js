const express = require('express');
const controller = require('../controllers/inventarioActivosController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);
router.get('/', controller.listar);
router.post('/', controller.crear);
router.put('/:id', controller.actualizar);
router.post('/:id/estado', controller.cambiarEstado);
router.post('/:id/baja', controller.darDeBaja);
router.get('/:id/movimientos', controller.movimientos);
router.delete('/:id', controller.eliminar);

module.exports = router;
