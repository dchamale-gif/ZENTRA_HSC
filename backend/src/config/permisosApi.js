// ============================================
// PERMISOS POR RUTA DE API
// `ver`: módulos que permiten leer (GET). `editar`: módulos que permiten modificar.
// Basta con tener el permiso de uno de los módulos de la lista.
// Muchas pantallas leen datos de apoyo de otros módulos (p. ej. la historia
// clínica necesita la lista de pacientes y de medicinas), por eso `ver` es más amplio.
// ============================================

const DATOS_PACIENTE = {
  ver: ['caratula', 'historia_clinica', 'contrato_ingreso'],
  editar: ['caratula', 'contrato_ingreso']
};

// En /api/billing conviven la facturación y los cargos al estado de cuenta
// que se registran desde la historia clínica al recetar.
const RUTAS_CARGOS = /^\/(cargos|prescripciones|facturas-mejorada|estado-cuenta)/;

const TODOS_LOS_MODULOS = [
  'caratula', 'historia_clinica', 'historia_clinica_cierre', 'ordenes_medicas', 'ordenes_enfermeria', 'evolucion', 'control_medicamentos', 'extras',
  'control_signos', 'notas_enfermeria', 'laboratorios', 'recepcion_articulos', 'cotizacion_paciente',
  'contrato_ingreso', 'hospitalizaciones', 'saldo_paciente', 'medicinas', 'personal', 'codigos_articulos',
  'compras', 'ventas', 'cotizaciones', 'caja', 'cxc', 'gastos', 'dashboard_ejecutivo', 'inventario',
  'transacciones', 'reportes', 'agenda', 'alertas'
];

const PERMISOS_API = {
  pacientes: {
    ver: [
      'caratula', 'historia_clinica', 'ordenes_medicas', 'evolucion', 'control_medicamentos',
      'extras', 'control_signos', 'notas_enfermeria', 'laboratorios', 'recepcion_articulos',
      'cotizacion_paciente', 'contrato_ingreso', 'hospitalizaciones', 'saldo_paciente',
      'cotizaciones', 'ventas', 'agenda', 'cxc'
    ],
    editar: ['caratula']
  },
  datosPaciente: DATOS_PACIENTE,
  medicinas: {
    ver: [
      'medicinas', 'historia_clinica', 'control_medicamentos', 'compras', 'ventas', 'cotizaciones',
      'codigos_articulos', 'inventario', 'hospitalizaciones', 'recepcion_articulos', 'extras',
      'ordenes_enfermeria'
    ],
    editar: ['medicinas']
  },
  codigosArticulos: {
    ver: ['codigos_articulos', 'compras', 'ventas', 'cotizaciones', 'medicinas', 'inventario', 'ordenes_enfermeria'],
    editar: ['codigos_articulos']
  },
  proveedores: { ver: ['compras', 'gastos'], editar: ['compras'] },
  compras: 'compras',
  ventas: 'ventas',
  cotizaciones: { ver: ['cotizaciones', 'cotizacion_paciente'], editar: ['cotizaciones'] },
  billing: (req) => (RUTAS_CARGOS.test(req.path)
    ? {
        ver: ['saldo_paciente', 'historia_clinica', 'control_medicamentos', 'hospitalizaciones', 'extras'],
        editar: ['saldo_paciente', 'historia_clinica', 'control_medicamentos', 'extras']
      }
    : { ver: ['saldo_paciente', 'ventas', 'cxc', 'caja'], editar: ['saldo_paciente', 'ventas'] }),
  personal: {
    ver: ['personal', 'caratula', 'historia_clinica', 'ordenes_medicas', 'evolucion', 'agenda', 'hospitalizaciones'],
    editar: ['personal']
  },
  agenda: 'agenda',
  gastos: 'gastos',
  cxc: 'cxc',
  caja: 'caja',
  hospitalizaciones: { ver: ['hospitalizaciones', 'saldo_paciente'], editar: ['hospitalizaciones'] },
  laboratorios: 'laboratorios',
  historiasClinicas: 'historia_clinica',
  // Quien ve la historia clínica también ve sus notas de enfermería
  notasEnfermeria: { ver: ['notas_enfermeria', 'historia_clinica'], editar: ['notas_enfermeria'] },
  // Escribe el médico (abre/cierra historias); modificar y eliminar solo el admin
  evoluciones: { ver: ['historia_clinica'], editar: ['historia_clinica_cierre'] },
  // Los registra quien edita la historia (enfermería o médico)
  signosVitales: 'historia_clinica',
  ordenes: 'ordenes_medicas',
  // Quien ve las órdenes médicas también ve su traducción (pestaña Órdenes médicas de la ficha)
  ordenesEnfermeria: { ver: ['ordenes_enfermeria', 'ordenes_medicas'], editar: ['ordenes_enfermeria'] },
  alertas: 'alertas',
  // El resumen operativo de Inicio (conteos de pacientes, citas, órdenes, camas; sin montos)
  // lo ve cualquier usuario; el resto de reportes es financiero.
  reportes: (req) => (req.method === 'GET' && req.path === '/executive-summary'
    ? { ver: TODOS_LOS_MODULOS, editar: [] }
    : { ver: ['reportes', 'dashboard_ejecutivo', 'transacciones'], editar: ['reportes'] }),
  usuarios: 'usuarios'
};

module.exports = PERMISOS_API;
