const personalMedicoController = require('../controllers/personalMedicoController');
const crearRutasPersonal = require('./personalRoutes');

module.exports = crearRutasPersonal(personalMedicoController, {
  modulo: 'personal',
  extra: router => router.get('/especialidades', personalMedicoController.getEspecialidades)
});
