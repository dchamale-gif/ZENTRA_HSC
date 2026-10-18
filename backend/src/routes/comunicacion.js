const express = require('express');
const comunicacionController = require('../controllers/comunicacionController');

// Montado en server.js con authMiddleware: disponible para todo usuario autenticado
const router = express.Router();

router.get('/resumen', comunicacionController.getResumen);

router.get('/notificaciones', comunicacionController.getNotificaciones);
router.put('/notificaciones/leidas', comunicacionController.marcarTodasLeidas);
router.put('/notificaciones/:id/leida', comunicacionController.marcarNotificacionLeida);

router.get('/usuarios', comunicacionController.getUsuariosChat);
router.get('/conversaciones', comunicacionController.getConversaciones);
router.get('/mensajes/:usuarioId', comunicacionController.getMensajes);
router.post('/mensajes', comunicacionController.enviarMensaje);

module.exports = router;
