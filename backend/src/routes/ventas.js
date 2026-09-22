const express = require('express');
const ventasController = require('../controllers/ventasController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);
router.get('/', ventasController.getVentas);
router.get('/receptores', ventasController.getReceptores);
router.post('/', ventasController.createVenta);
router.put('/:id', ventasController.updateVenta);
router.delete('/:id', ventasController.deleteVenta);

module.exports = router;