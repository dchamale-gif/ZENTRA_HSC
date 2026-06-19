require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Importar rutas
const authRoutes = require('./src/routes/auth');
const pacientesRoutes = require('./src/routes/pacientes');
const medicinasRoutes = require('./src/routes/medicinas');
const proveedoresRoutes = require('./src/routes/proveedores');
const codigosArticulosRoutes = require('./src/routes/codigos-articulos');

// Importar middleware
const { auditMiddleware } = require('./src/middleware/audit');
const { runMigrations } = require('./src/db/migration');

const app = express();
const PORT = process.env.PORT || 3011;

// ====================================
// MIDDLEWARE GLOBALES
// ====================================

// Seguridad (sin Helmet en HTTP)
// app.use(helmet()); // Deshabilitado para HTTP

// CORS - Permitir solicitudes desde el frontend
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5500', 'http://localhost:3000', 'http://localhost:3011', 'http://178.128.72.110:3011', 'http://178.128.72.110:5501'],
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
    environment: process.env.NODE_ENV,
    protocol: req.protocol.toUpperCase()
  });
});

// Autenticación
app.use('/api/auth', authRoutes);

// Pacientes
app.use('/api/pacientes', pacientesRoutes);

// Medicinas
app.use('/api/medicinas', medicinasRoutes);

// Códigos/Artículos
app.use('/api/codigos-articulos', codigosArticulosRoutes);

// Proveedores
app.use('/api/proveedores', proveedoresRoutes);

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

// Ejecutar migraciones al iniciar
runMigrations().then(success => {
  if (!success) {
    console.warn('\n⚠️  Las migraciones completaron con advertencias');
  }
  
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║     🏥 ZENTRA MED API BACKEND 🏥      ║
╚════════════════════════════════════════╝

✅ Servidor ejecutándose en http://0.0.0.0:${PORT}
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
}).catch(err => {
  console.error('\n❌ Error fatal durante migración:', err);
  process.exit(1);
});

module.exports = app;
