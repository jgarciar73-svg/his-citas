const citasService = require('../services/citasService');

// El controlador solo traduce HTTP a llamadas del servicio y devuelve el código de estado.

async function listar(req, res) {
  res.status(200).json(await citasService.listar(req.query));
}

async function obtener(req, res) {
  res.status(200).json(await citasService.obtener(req.params.id));
}

async function crear(req, res) {
  const cita = await citasService.crear(req.body);
  res.status(201).location(`/api/citas/${cita.id}`).json(cita);
}

async function reprogramar(req, res) {
  res.status(200).json(await citasService.reprogramar(req.params.id, req.body));
}

async function cambiarEstado(req, res) {
  res.status(200).json(await citasService.cambiarEstado(req.params.id, req.body));
}

module.exports = { listar, obtener, crear, reprogramar, cambiarEstado };
