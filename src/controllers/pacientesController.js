const pacientesService = require('../services/pacientesService');

async function listar(req, res) {
  res.status(200).json(await pacientesService.listar());
}

module.exports = { listar };
