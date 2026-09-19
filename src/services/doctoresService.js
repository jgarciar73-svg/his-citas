const doctoresRepository = require('../repositories/doctoresRepository');

const listar = () => doctoresRepository.listar();

module.exports = { listar };
