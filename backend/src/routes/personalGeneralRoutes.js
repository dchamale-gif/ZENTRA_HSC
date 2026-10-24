const personalGeneralController = require('../controllers/personalGeneralController');
const crearRutasPersonal = require('./personalRoutes');

module.exports = crearRutasPersonal(personalGeneralController, { modulo: 'personal_general' });
