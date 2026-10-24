const { crearControladorPersonal } = require('./personalController');

// Personal administrativo y de apoyo: puesto y área en lugar de especialidad y colegiado
module.exports = crearControladorPersonal({
  tabla: 'personal_general',
  tablaDocumentos: 'personal_general_documentos',
  columnaDocumento: 'personal_general_id',
  requiereMigracion: true,
  etiqueta: 'Personal',
  profesional: {
    select: 'pm.puesto, pm.area',
    leer: (body) => {
      const puesto = String(body.puesto || '').trim().slice(0, 120);
      if (!puesto) return { error: 'El puesto es obligatorio' };
      return { valores: { puesto, area: String(body.area || '').trim().slice(0, 60) || null } };
    },
    duplicado: 'El email o el DPI ya están registrados'
  }
});
