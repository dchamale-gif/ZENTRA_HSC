const express = require('express');
const authController = require('../controllers/authController');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// Rutas públicas
router.post('/login', authController.login);

// Solo administradores pueden dar de alta usuarios
router.post('/register', authMiddleware, requireRole('admin'), authController.register);

// Rutas protegidas
router.post('/logout', authMiddleware, authController.logout);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/preferencias', authMiddleware, authController.updatePreferencias);

module.exports = router;
