require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Importar rutas
const authRoutes = require('./src/routes/auth');
const pacientesRoutes = require('./src/routes/pacientes');
const medicinasRoutes = require('./src/routes/medicinas');
const proveedoresRoutes = require('./src/routes/proveedores');

// Importar middleware
const { auditMiddleware } = require('./src/middleware/audit');

const app = express();
const PORT = process.env.PORT || 3012;

// ====================================
// MIDDLEWARE GLOBALES
// ====================================

// Seguridad - Helmet con CSP relajado para permitir CDNs
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginOpenerPolicy: false,
  hsts: false
}));

// CORS - Permitir solicitudes desde el frontend
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5500',
      'http://localhost:5501',
      'http://localhost:3000',
      'http://178.128.72.110:5500',
      'http://178.128.72.110:5501',
      'http://178.128.72.110:3000'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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
// SERVIR ARCHIVOS ESTÁTICOS (FRONTEND)
// ====================================

// Servir archivos públicos (CSS, JS, IMG)
app.use(express.static(path.join(__dirname, '../public')));

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

// Proveedores
app.use('/api/proveedores', proveedoresRoutes);

// ====================================
// SERVIR SPA (Single Page Application)
// ====================================

// Ruta raíz - servir index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Cualquier ruta desconocida que no sea API, servir index.html (SPA)
app.get('*', (req, res) => {
  // Si es una ruta de API que no existe, responder 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ 
      error: 'Ruta de API no encontrada',
      path: req.path,
      method: req.method
    });
  }
  // Si no es API, servir index.html para SPA
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

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
