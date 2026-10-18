const express = require('express');
const usuariosController = require('../controllers/usuariosController');

// Montado en server.js con authMiddleware + requireModule('usuarios')
const router = express.Router();

router.get('/roles', usuariosController.getRoles);
router.get('/', usuariosController.getUsuarios);
router.post('/', usuariosController.createUsuario);
router.put('/:id', usuariosController.updateUsuario);

module.exports = router;
