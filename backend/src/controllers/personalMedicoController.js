const pool = require('../db/connection');
const { crearControladorPersonal } = require('./personalController');

// Personal médico: especialidad y número de colegiado; lo demás lo comparte con Personal
const personalMedicoController = crearControladorPersonal({
  tabla: 'personal_medico',
  tablaDocumentos: 'personal_medico_documentos',
  columnaDocumento: 'personal_medico_id',
  requiereMigracion: false,
  etiqueta: 'Personal médico',
  profesional: {
    select: 'pm.especialidad_id, pm.numero_colegiado, em.nombre AS especialidad',
    join: 'INNER JOIN especialidades_medicas em ON em.id = pm.especialidad_id',
    leer: (body) => {
      if (!body.especialidad_id) return { error: 'Selecciona una especialidad' };
      if (!String(body.numero_colegiado || '').trim()) return { error: 'El número de colegiado es obligatorio' };
      return { valores: { especialidad_id: body.especialidad_id, numero_colegiado: String(body.numero_colegiado).trim() } };
    },
    duplicado: 'El número de colegiado, el email o el DPI ya están registrados'
  }
});

personalMedicoController.getEspecialidades = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre FROM especialidades_medicas WHERE activo = true ORDER BY nombre'
    );
    res.json({ especialidades: result.rows });
  } catch (error) {
    console.error('Error obteniendo especialidades:', error.message);
    res.status(500).json({ error: 'Error obteniendo especialidades' });
  }
};

module.exports = personalMedicoController;
