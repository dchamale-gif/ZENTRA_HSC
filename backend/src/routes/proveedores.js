const express = require('express');
const proveedoresController = require('../controllers/proveedoresController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET - Listar proveedores
router.get('/', proveedoresController.getProveedores);

// GET - Obtener proveedor específico
router.get('/:id', proveedoresController.getProveedorById);

// POST - Crear proveedor
router.post('/', proveedoresController.createProveedor);

// PUT - Actualizar proveedor
router.put('/:id', proveedoresController.updateProveedor);

// DELETE - Eliminar proveedor
router.delete('/:id', proveedoresController.deleteProveedor);

module.exports = router;
