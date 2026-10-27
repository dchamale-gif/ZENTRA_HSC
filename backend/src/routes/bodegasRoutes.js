const express = require('express');
const bodegasController = require('../controllers/bodegasController');

const router = express.Router();

router.get('/', bodegasController.listar);
router.post('/', bodegasController.crear);
router.put('/:id', bodegasController.actualizar);

module.exports = router;
