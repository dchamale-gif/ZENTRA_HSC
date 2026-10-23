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
const billingRoutes = require('./src/routes/billing');
const billingMejoradaRoutes = require('./src/routes/billing-mejorada');
const cotizacionesRoutes = require('./src/routes/cotizaciones');
const reportsRoutes = require('./src/routes/reports');
const doctorsRoutes = require('./src/routes/doctors');
const appointmentsRoutes = require('./src/routes/appointments');
const expensesRoutes = require('./src/routes/expenses');
const receivablesRoutes = require('./src/routes/receivables');
const empresasRoutes = require('./src/routes/empresasRoutes');
const contactosEmergenciaRoutes = require('./src/routes/contactosEmergenciaRoutes');
const laboratoriosRoutes = require('./src/routes/laboratoriosRoutes');
const ordenesRoutes = require('./src/routes/ordenesRoutes');
const ordenesEnfermeriaRoutes = require('./src/routes/ordenesEnfermeriaRoutes');
const historiasClinicasRoutes = require('./src/routes/historiasClinicasRoutes');
const notasEnfermeriaRoutes = require('./src/routes/notasEnfermeriaRoutes');
const evolucionesRoutes = require('./src/routes/evolucionesRoutes');
const alertasRoutes = require('./src/routes/alertasRoutes');
const datosFamiliaRoutes = require('./src/routes/datosFamiliaRoutes');
const responsablesRoutes = require('./src/routes/responsablesRoutes');
const documentosPacienteRoutes = require('./src/routes/documentosPacienteRoutes');
const personalMedicoRoutes = require('./src/routes/personalMedicoRoutes');
const comprasRoutes = require('./src/routes/compras');
const ventasRoutes = require('./src/routes/ventas');
const cajaRoutes = require('./src/routes/caja');
const hospitalizacionesRoutes = require('./src/routes/hospitalizaciones');
const usuariosRoutes = require('./src/routes/usuarios');
const comunicacionRoutes = require('./src/routes/comunicacion');

// Importar middleware
const { auditMiddleware } = require('./src/middleware/audit');
const { authMiddleware, requireModule, requireRole } = require('./src/middleware/auth');
const PERMISOS = require('./src/config/permisosApi');
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
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5500', 'http://localhost:5501', 'http://127.0.0.1:5501', 'http://localhost:3000', 'http://localhost:3011', 'http://178.128.72.110:3011', 'http://178.128.72.110:5501'],
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

// Usuarios y roles (solo admin)
app.use('/api/usuarios', authMiddleware, requireRole('admin'), usuariosRoutes);

// Notificaciones y chat interno (cualquier usuario autenticado)
app.use('/api/comunicacion', authMiddleware, comunicacionRoutes);

// Pacientes
app.use('/api/pacientes', authMiddleware, requireModule(PERMISOS.pacientes), pacientesRoutes);

// Medicinas
app.use('/api/medicinas', authMiddleware, requireModule(PERMISOS.medicinas), medicinasRoutes);

// Códigos/Artículos
app.use('/api/codigos-articulos', authMiddleware, requireModule(PERMISOS.codigosArticulos), codigosArticulosRoutes);

// Proveedores
app.use('/api/proveedores', authMiddleware, requireModule(PERMISOS.proveedores), proveedoresRoutes);

// Compras y conceptos
app.use('/api/compras', authMiddleware, requireModule(PERMISOS.compras), comprasRoutes);

// Ventas e inventario
app.use('/api/ventas', authMiddleware, requireModule(PERMISOS.ventas), ventasRoutes);

// Facturación
app.use('/api/billing', authMiddleware, requireModule(PERMISOS.billing), billingRoutes);

// Facturación Mejorada
app.use('/api/billing', authMiddleware, requireModule(PERMISOS.billing), billingMejoradaRoutes);

// Cotizaciones
app.use('/api/cotizaciones', authMiddleware, requireModule(PERMISOS.cotizaciones), cotizacionesRoutes);

// Doctores y especialidades
app.use('/api/doctors', authMiddleware, requireModule(PERMISOS.personal), doctorsRoutes);

// Gestión de personal médico
app.use('/api/personal-medico', authMiddleware, requireModule(PERMISOS.personal), personalMedicoRoutes);

// Citas y agenda
app.use('/api/appointments', authMiddleware, requireModule(PERMISOS.agenda), appointmentsRoutes);

// Gastos y servicios
app.use('/api/expenses', authMiddleware, requireModule(PERMISOS.gastos), expensesRoutes);

// Cuentas por cobrar
app.use('/api/receivables', authMiddleware, requireModule(PERMISOS.cxc), receivablesRoutes);

// Movimientos de caja
app.use('/api/caja', authMiddleware, requireModule(PERMISOS.caja), cajaRoutes);

// Hospitalizaciones, habitaciones y camas
app.use('/api/hospitalizaciones', authMiddleware, requireModule(PERMISOS.hospitalizaciones), hospitalizacionesRoutes);

// Lugar de Trabajo
app.use('/api/empresas', authMiddleware, requireModule(PERMISOS.datosPaciente), empresasRoutes);

// Contactos de Emergencia
app.use('/api/contactos-emergencia', authMiddleware, requireModule(PERMISOS.datosPaciente), contactosEmergenciaRoutes);

// Historial Médico - Laboratorios
app.use('/api/laboratorios', authMiddleware, requireModule(PERMISOS.laboratorios), laboratoriosRoutes);

// Historial Médico - Órdenes
app.use('/api/ordenes', authMiddleware, requireModule(PERMISOS.ordenes), ordenesRoutes);

// Órdenes de enfermería (traducción de las órdenes médicas)
app.use('/api/ordenes-enfermeria', authMiddleware, requireModule(PERMISOS.ordenesEnfermeria), ordenesEnfermeriaRoutes);

// Historias clínicas (una por consulta o ingreso) y antecedentes del paciente
app.use('/api/historias-clinicas', authMiddleware, requireModule(PERMISOS.historiasClinicas), historiasClinicasRoutes);

// Notas de enfermería (dentro de cada historia clínica)
app.use('/api/notas-enfermeria', authMiddleware, requireModule(PERMISOS.notasEnfermeria), notasEnfermeriaRoutes);
app.use('/api/evoluciones', authMiddleware, requireModule(PERMISOS.evoluciones), evolucionesRoutes);

// Historial Médico - Alertas
app.use('/api/alertas', authMiddleware, requireModule(PERMISOS.alertas), alertasRoutes);

// Datos Familiares
app.use('/api/datos-familia', authMiddleware, requireModule(PERMISOS.datosPaciente), datosFamiliaRoutes);

// Responsables del Paciente
app.use('/api/responsables', authMiddleware, requireModule(PERMISOS.datosPaciente), responsablesRoutes);

// Documentos y Fotografías del Paciente
app.use('/api/documentos-paciente', authMiddleware, requireModule(PERMISOS.datosPaciente), documentosPacienteRoutes);

// Reportes y Dashboards
app.use('/api/reports', authMiddleware, requireModule(PERMISOS.reportes), reportsRoutes);

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
