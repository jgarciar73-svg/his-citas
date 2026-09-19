const citasRepository = require('../repositories/citasRepository');
const doctoresRepository = require('../repositories/doctoresRepository');
const pacientesRepository = require('../repositories/pacientesRepository');
const { DatosInvalidos, NoEncontrado, ConflictoHorario } = require('../errors');
const fechas = require('../utils/fechas');

const ESTADOS = ['pendiente', 'confirmada', 'cancelada', 'atendida'];

// ---------- Lectura y validación de datos de entrada (RQF-08) ----------

function esObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function leerId(valor, nombre, errores) {
  const numero = Number(valor);
  if (valor === undefined || valor === null || valor === '') {
    errores.push(`${nombre} es obligatorio.`);
    return null;
  }
  if (!Number.isInteger(numero) || numero <= 0) {
    errores.push(`${nombre} debe ser un número entero positivo.`);
    return null;
  }
  return numero;
}

function leerFecha(valor, nombre, errores) {
  if (valor === undefined || valor === null || valor === '') {
    errores.push(`${nombre} es obligatorio.`);
    return null;
  }
  const fecha = fechas.analizar(valor);
  if (!fecha || !fecha.tieneHora) {
    errores.push(`${nombre} debe tener formato AAAA-MM-DDTHH:MM (fecha y hora válidas).`);
    return null;
  }
  return fecha.sql;
}

function leerHorario(cuerpo, errores) {
  const inicio = leerFecha(cuerpo.inicio, 'inicio', errores);
  const fin = leerFecha(cuerpo.fin, 'fin', errores);
  // Las dos cadenas tienen el mismo formato, así que comparar texto equivale a comparar fechas.
  if (inicio && fin && fin <= inicio) {
    errores.push('fin debe ser posterior a inicio.');
  }
  return { inicio, fin };
}

function leerMotivo(valor, errores) {
  if (typeof valor !== 'string' || valor.trim() === '') {
    errores.push('motivo es obligatorio.');
    return null;
  }
  if (valor.trim().length > 255) {
    errores.push('motivo no puede pasar de 255 caracteres.');
    return null;
  }
  return valor.trim();
}

function exigirCuerpo(cuerpo) {
  if (!esObjeto(cuerpo)) {
    throw new DatosInvalidos(['El cuerpo de la petición debe ser un objeto JSON.']);
  }
  return cuerpo;
}

async function exigirPacienteYDoctor(pacienteId, doctorId) {
  const errores = [];
  if (pacienteId && !(await pacientesRepository.obtenerPorId(pacienteId))) {
    errores.push(`El paciente ${pacienteId} no existe.`);
  }
  if (doctorId && !(await doctoresRepository.obtenerPorId(doctorId))) {
    errores.push(`El doctor ${doctorId} no existe.`);
  }
  if (errores.length) throw new DatosInvalidos(errores);
}

// ---------- Presentación ----------

function formatear(fila) {
  return {
    id: fila.id,
    paciente_id: fila.paciente_id,
    paciente_nombre: fila.paciente_nombre,
    doctor_id: fila.doctor_id,
    doctor_nombre: fila.doctor_nombre,
    doctor_especialidad: fila.doctor_especialidad,
    inicio: fechas.aIso(fila.inicio),
    fin: fechas.aIso(fila.fin),
    motivo: fila.motivo,
    estado: fila.estado,
    creado_en: fila.creado_en,
    actualizado_en: fila.actualizado_en,
  };
}

// Lanza 409 si el doctor ya tiene una cita activa que se solapa con el horario pedido.
// Debe llamarse dentro de conBloqueoDeDoctor para que la comprobación y el guardado sean atómicos.
async function exigirDisponibilidad({ doctorId, inicio, fin, excluirId }, conexion) {
  const choque = await citasRepository.buscarSolape({ doctorId, inicio, fin, excluirId }, conexion);
  if (!choque) return;

  const dia = choque.inicio.slice(0, 10);
  const desde = choque.inicio.slice(11, 16);
  const hasta = choque.fin.slice(11, 16);
  throw new ConflictoHorario(
    `El doctor ya tiene una cita activa el ${dia} de ${desde} a ${hasta}. Elige otro horario.`,
    [{ cita_id: choque.id, inicio: fechas.aIso(choque.inicio), fin: fechas.aIso(choque.fin) }]
  );
}

async function obtenerExistente(id) {
  const cita = await citasRepository.obtenerPorId(id);
  if (!cita) throw new NoEncontrado(`La cita ${id} no existe.`);
  return cita;
}

// ---------- Casos de uso ----------

async function listar(consulta) {
  const errores = [];
  const filtros = {};

  if (consulta.doctor_id !== undefined) filtros.doctorId = leerId(consulta.doctor_id, 'doctor_id', errores);
  if (consulta.paciente_id !== undefined) filtros.pacienteId = leerId(consulta.paciente_id, 'paciente_id', errores);

  if (consulta.desde !== undefined) {
    const desde = fechas.analizar(consulta.desde);
    if (desde) filtros.desde = desde.sql;
    else errores.push('desde debe tener formato AAAA-MM-DD o AAAA-MM-DDTHH:MM.');
  }
  if (consulta.hasta !== undefined) {
    const hasta = fechas.analizar(consulta.hasta);
    if (!hasta) {
      errores.push('hasta debe tener formato AAAA-MM-DD o AAAA-MM-DDTHH:MM.');
    } else if (hasta.tieneHora) {
      filtros.hasta = hasta.sql;
    } else {
      // Un "hasta" sin hora incluye el día completo.
      filtros.hasta = `${fechas.diaSiguiente(hasta.fecha)} 00:00:00`;
    }
  }
  if (filtros.desde && filtros.hasta && filtros.hasta <= filtros.desde) {
    errores.push('hasta debe ser posterior a desde.');
  }
  if (errores.length) throw new DatosInvalidos(errores);

  const filas = await citasRepository.listar(filtros);
  return filas.map(formatear);
}

async function obtener(id) {
  const errores = [];
  const idValido = leerId(id, 'id', errores);
  if (errores.length) throw new DatosInvalidos(errores);
  return formatear(await obtenerExistente(idValido));
}

async function crear(cuerpo) {
  exigirCuerpo(cuerpo);
  const errores = [];
  const pacienteId = leerId(cuerpo.paciente_id, 'paciente_id', errores);
  const doctorId = leerId(cuerpo.doctor_id, 'doctor_id', errores);
  const { inicio, fin } = leerHorario(cuerpo, errores);
  const motivo = leerMotivo(cuerpo.motivo, errores);
  if (errores.length) throw new DatosInvalidos(errores);

  await exigirPacienteYDoctor(pacienteId, doctorId);

  return citasRepository.conBloqueoDeDoctor(doctorId, async (conexion) => {
    await exigirDisponibilidad({ doctorId, inicio, fin }, conexion);
    const id = await citasRepository.crear({ pacienteId, doctorId, inicio, fin, motivo }, conexion);
    return formatear(await citasRepository.obtenerPorId(id, conexion));
  });
}

// Reprograma una cita: cambia fecha y hora, y opcionalmente el doctor o el motivo.
async function reprogramar(id, cuerpo) {
  exigirCuerpo(cuerpo);
  const errores = [];
  const idValido = leerId(id, 'id', errores);
  const { inicio, fin } = leerHorario(cuerpo, errores);
  const doctorId = cuerpo.doctor_id !== undefined ? leerId(cuerpo.doctor_id, 'doctor_id', errores) : null;
  const motivo = cuerpo.motivo !== undefined ? leerMotivo(cuerpo.motivo, errores) : null;
  if (errores.length) throw new DatosInvalidos(errores);

  const actual = await obtenerExistente(idValido);
  const doctorFinal = doctorId || actual.doctor_id;
  if (doctorId) await exigirPacienteYDoctor(null, doctorId);

  return citasRepository.conBloqueoDeDoctor(doctorFinal, async (conexion) => {
    // Se excluye la propia cita: moverla un poco dentro de su mismo horario no es un choque.
    await exigirDisponibilidad({ doctorId: doctorFinal, inicio, fin, excluirId: idValido }, conexion);
    await citasRepository.actualizarHorario(
      idValido,
      { doctorId: doctorFinal, inicio, fin, motivo: motivo || actual.motivo },
      conexion
    );
    return formatear(await citasRepository.obtenerPorId(idValido, conexion));
  });
}

async function cambiarEstado(id, cuerpo) {
  exigirCuerpo(cuerpo);
  const errores = [];
  const idValido = leerId(id, 'id', errores);
  if (!ESTADOS.includes(cuerpo.estado)) {
    errores.push(`estado debe ser uno de: ${ESTADOS.join(', ')}.`);
  }
  if (errores.length) throw new DatosInvalidos(errores);

  await obtenerExistente(idValido);
  await citasRepository.actualizarEstado(idValido, cuerpo.estado);
  return formatear(await citasRepository.obtenerPorId(idValido));
}

module.exports = { listar, obtener, crear, reprogramar, cambiarEstado, ESTADOS };
