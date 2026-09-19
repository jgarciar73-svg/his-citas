const doctoresService = require('../services/doctoresService');

async function listar(req, res) {
  res.status(200).json(await doctoresService.listar());
}

module.exports = { listar };
