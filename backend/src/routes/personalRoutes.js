const express = require('express');
const { authMiddleware, requireModule } = require('../middleware/auth');

// Rutas comunes de Personal médico y Personal. `modulo`: permiso que exigen los documentos
// (títulos, antecedentes, contratos), que solo ve quien maneja ese módulo y no las
// pantallas que únicamente leen el listado.
const crearRutasPersonal = (controller, { modulo, extra } = {}) => {
  const router = express.Router();
  const soloModulo = requireModule(modulo);

  router.use(authMiddleware);
  if (extra) extra(router);
  router.get('/', controller.getAll);
  router.get('/:id/documentos', controller.getDocumentos);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.put('/:id/emergencias', controller.setEmergencias);
  router.delete('/:id', controller.delete);

  router.get('/archivos/:archivoId', soloModulo, controller.verArchivo);
  router.delete('/archivos/:archivoId', soloModulo, controller.eliminarArchivo);
  router.get('/:id/archivos', soloModulo, controller.getArchivos);
  router.post('/:id/archivos', soloModulo,
    express.raw({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], limit: '10mb' }),
    controller.subirArchivo);

  // Documento de más de 10 MB: mensaje en español en lugar del error genérico
  router.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'El documento puede pesar hasta 10 MB' });
    }
    next(err);
  });

  return router;
};

module.exports = crearRutasPersonal;
