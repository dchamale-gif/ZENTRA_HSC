const express = require('express');
const router = express.Router();
const laboratoriosController = require('../controllers/laboratoriosController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// PDF de resultados (antes de /:pacienteId para que no se confundan)
router.get('/archivos/:archivoId', laboratoriosController.verArchivo);
router.delete('/archivos/:archivoId', laboratoriosController.eliminarArchivo);
router.post('/:id/archivos',
  express.raw({ type: 'application/pdf', limit: '10mb' }),
  laboratoriosController.subirArchivo);

router.get('/:pacienteId', laboratoriosController.getByPaciente);
router.post('/', laboratoriosController.create);
router.delete('/:id', laboratoriosController.delete);

// PDF de más de 10 MB: mensaje en español en lugar del error genérico
router.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El PDF puede pesar hasta 10 MB' });
  }
  next(err);
});

module.exports = router;
