const pacientesRepository = require('../repositories/pacientesRepository');

const listar = () => pacientesRepository.listar();

module.exports = { listar };
