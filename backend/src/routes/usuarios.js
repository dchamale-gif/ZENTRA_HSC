const express = require('express');
const usuariosController = require('../controllers/usuariosController');

// Montado en server.js con authMiddleware + requireRole('admin')
const router = express.Router();

router.get('/roles', usuariosController.getRoles);
router.post('/roles', usuariosController.createRol);
router.put('/roles/:id', usuariosController.updateRol);
router.delete('/roles/:id', usuariosController.deleteRol);
router.get('/', usuariosController.getUsuarios);
router.post('/', usuariosController.createUsuario);
router.put('/:id', usuariosController.updateUsuario);

module.exports = router;
