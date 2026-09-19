const { ErrorApp, NoEncontrado } = require('../errors');

function rutaNoEncontrada(req, res, next) {
  next(new NoEncontrado(`La ruta ${req.method} ${req.originalUrl} no existe.`));
}

// eslint-disable-next-line no-unused-vars
function manejarErrores(err, req, res, next) {
  if (err instanceof ErrorApp) {
    const cuerpo = { codigo: err.codigo, mensaje: err.message };
    if (err.detalles) cuerpo.detalles = err.detalles;
    return res.status(err.status).json(cuerpo);
  }

  // JSON mal formado en el cuerpo de la petición.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      codigo: 'DATOS_INVALIDOS',
      mensaje: 'El cuerpo de la petición no es un JSON válido.',
    });
  }

  console.error(err);
  res.status(500).json({ codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado en el servidor.' });
}

module.exports = { rutaNoEncontrada, manejarErrores };
