// Errores de negocio. El middleware de errores los traduce a códigos HTTP.

class ErrorApp extends Error {
  constructor(status, codigo, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

class DatosInvalidos extends ErrorApp {
  constructor(detalles) {
    super(400, 'DATOS_INVALIDOS', 'Los datos enviados no son válidos.', detalles);
  }
}

class NoEncontrado extends ErrorApp {
  constructor(mensaje) {
    super(404, 'NO_ENCONTRADO', mensaje);
  }
}

class ConflictoHorario extends ErrorApp {
  constructor(mensaje, detalles) {
    super(409, 'CONFLICTO_HORARIO', mensaje, detalles);
  }
}

module.exports = { ErrorApp, DatosInvalidos, NoEncontrado, ConflictoHorario };
