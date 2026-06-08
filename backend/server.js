require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Importar rutas
const authRoutes = require('./src/routes/auth');
const pacientesRoutes = require('./src/routes/pacientes');
const medicinasRoutes = require('./src/routes/medicinas');

// Importar middleware
const { auditMiddleware } = require('./src/middleware/audit');

const app = express();
const PORT = process.env.PORT || 3000;

// ====================================
// MIDDLEWARE GLOBALES
// ====================================

// Seguridad
app.use(helmet());

// CORS - Permitir solicitudes desde el frontend
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5500', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logging de solicitudes
app.use(morgan('combined'));

// Auditoría
app.use(auditMiddleware);

// ====================================
// RUTAS DE API
// ====================================

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Autenticación
app.use('/api/auth', authRoutes);

// Pacientes
app.use('/api/pacientes', pacientesRoutes);

// Medicinas
app.use('/api/medicinas', medicinasRoutes);

// ====================================
// MANEJO DE ERRORES
// ====================================

// 404 - No encontrado
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    path: req.path,
    method: req.method
  });
});

// Error global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ====================================
// INICIAR SERVIDOR
// ====================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║     🏥 ZENTRA MED API BACKEND 🏥      ║
╚════════════════════════════════════════╝

✅ Servidor ejecutándose en puerto ${PORT}
📱 Ambiente: ${process.env.NODE_ENV || 'development'}
🔒 CORS habilitado
📊 Auditoría activa

📍 Endpoints:
  - GET  /health
  - POST /api/auth/register
  - POST /api/auth/login
  - GET  /api/pacientes
  - POST /api/pacientes

  `);
});

module.exports = app;
