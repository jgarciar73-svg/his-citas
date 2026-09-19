// Pruebas de las reglas de negocio con repositorios de prueba (sin base de datos).
// Las pruebas con MySQL real están en test/integracion.
const test = require('node:test');
const assert = require('node:assert/strict');

const citasRepository = require('../../src/repositories/citasRepository');
const doctoresRepository = require('../../src/repositories/doctoresRepository');
const pacientesRepository = require('../../src/repositories/pacientesRepository');
const service = require('../../src/services/citasService');
const { DatosInvalidos, NoEncontrado, ConflictoHorario } = require('../../src/errors');

const originales = {
  cita: { ...citasRepository },
  doctor: { ...doctoresRepository },
  paciente: { ...pacientesRepository },
};

let guardadas;
let choque;
let citaExistente;

function filaCita(extra = {}) {
  return {
    id: 1, paciente_id: 1, doctor_id: 1, paciente_nombre: 'Ana López', doctor_nombre: 'Lucía Morales',
    doctor_especialidad: 'Medicina Interna', inicio: '2026-10-05 09:00:00', fin: '2026-10-05 09:30:00',
    motivo: 'Control', estado: 'pendiente', creado_en: '2026-10-01 08:00:00', actualizado_en: '2026-10-01 08:00:00',
    ...extra,
  };
}

test.beforeEach(() => {
  guardadas = [];
  choque = null;
  citaExistente = filaCita();
  pacientesRepository.obtenerPorId = async (id) => (id === 1 ? { id: 1 } : null);
  doctoresRepository.obtenerPorId = async (id) => (id === 1 || id === 2 ? { id } : null);
  citasRepository.conBloqueoDeDoctor = async (_doctor, trabajo) => trabajo({});
  citasRepository.buscarSolape = async () => choque;
  citasRepository.crear = async (datos) => { guardadas.push(datos); return 1; };
  citasRepository.obtenerPorId = async () => citaExistente;
  citasRepository.actualizarHorario = async (id, datos) => { guardadas.push({ id, ...datos }); };
  citasRepository.actualizarEstado = async (id, estado) => { citaExistente = filaCita({ estado }); };
});

test.after(() => {
  Object.assign(citasRepository, originales.cita);
  Object.assign(doctoresRepository, originales.doctor);
  Object.assign(pacientesRepository, originales.paciente);
});

const valida = { paciente_id: 1, doctor_id: 1, inicio: '2026-10-05T09:00', fin: '2026-10-05T09:30', motivo: 'Control' };

test('crear guarda la cita y la devuelve con las acciones permitidas', async () => {
  const cita = await service.crear(valida);
  assert.equal(guardadas.length, 1);
  assert.equal(guardadas[0].inicio, '2026-10-05 09:00:00');
  assert.equal(cita.inicio, '2026-10-05T09:00:00');
  assert.deepEqual(cita.transiciones_permitidas, ['confirmada', 'cancelada']);
  assert.equal(cita.reprogramable, true);
});

test('crear rechaza campos obligatorios vacíos con todos los errores juntos', async () => {
  await assert.rejects(service.crear({}), (e) => {
    assert.ok(e instanceof DatosInvalidos);
    assert.ok(e.detalles.length >= 4);
    return true;
  });
  assert.equal(guardadas.length, 0);
});

test('crear rechaza fin igual o anterior a inicio', async () => {
  for (const fin of ['2026-10-05T09:00', '2026-10-05T08:00']) {
    await assert.rejects(service.crear({ ...valida, fin }), DatosInvalidos);
  }
});

test('crear rechaza formato de fecha inválido', async () => {
  await assert.rejects(service.crear({ ...valida, inicio: '05/10/2026 9:00' }), DatosInvalidos);
  await assert.rejects(service.crear({ ...valida, inicio: '2026-10-05' }), DatosInvalidos);
});

test('crear rechaza un cuerpo que no es un objeto', async () => {
  await assert.rejects(service.crear(undefined), DatosInvalidos);
  await assert.rejects(service.crear([]), DatosInvalidos);
});

test('crear rechaza paciente o doctor que no existen', async () => {
  await assert.rejects(service.crear({ ...valida, paciente_id: 99 }), (e) => e instanceof DatosInvalidos && /paciente 99/.test(e.detalles[0]));
  await assert.rejects(service.crear({ ...valida, doctor_id: 99 }), (e) => e instanceof DatosInvalidos && /doctor 99/.test(e.detalles[0]));
  assert.equal(guardadas.length, 0);
});

test('crear responde conflicto si el doctor tiene una cita activa que se solapa', async () => {
  choque = { id: 7, inicio: '2026-10-05 09:00:00', fin: '2026-10-05 09:30:00' };
  await assert.rejects(service.crear(valida), (e) => {
    assert.ok(e instanceof ConflictoHorario);
    assert.equal(e.status, 409);
    assert.equal(e.detalles[0].cita_id, 7);
    return true;
  });
  assert.equal(guardadas.length, 0);
});

test('reprogramar excluye a la propia cita al buscar solapes', async () => {
  let recibido;
  citasRepository.buscarSolape = async (datos) => { recibido = datos; return null; };
  await service.reprogramar(1, { inicio: '2026-10-06T10:00', fin: '2026-10-06T10:30' });
  assert.equal(recibido.excluirId, 1);
  assert.equal(guardadas[0].inicio, '2026-10-06 10:00:00');
});

test('reprogramar responde conflicto y no guarda', async () => {
  choque = { id: 9, inicio: '2026-10-06 10:00:00', fin: '2026-10-06 10:30:00' };
  await assert.rejects(service.reprogramar(1, { inicio: '2026-10-06T10:00', fin: '2026-10-06T10:30' }), ConflictoHorario);
  assert.equal(guardadas.length, 0);
});

test('reprogramar una cita que no existe da 404', async () => {
  citasRepository.obtenerPorId = async () => null;
  await assert.rejects(service.reprogramar(5, { inicio: '2026-10-06T10:00', fin: '2026-10-06T10:30' }), NoEncontrado);
});

test('no se reprograma una cita cancelada ni atendida', async () => {
  for (const estado of ['cancelada', 'atendida']) {
    citaExistente = filaCita({ estado });
    await assert.rejects(service.reprogramar(1, { inicio: '2026-10-06T10:00', fin: '2026-10-06T10:30' }), DatosInvalidos);
  }
});

test('transiciones de estado válidas', async () => {
  const casos = [['pendiente', 'confirmada'], ['pendiente', 'cancelada'], ['confirmada', 'atendida'], ['confirmada', 'cancelada']];
  for (const [desde, hacia] of casos) {
    citaExistente = filaCita({ estado: desde });
    const cita = await service.cambiarEstado(1, { estado: hacia });
    assert.equal(cita.estado, hacia, `${desde} a ${hacia}`);
  }
});

test('transiciones de estado inválidas dan 400', async () => {
  const casos = [['pendiente', 'atendida'], ['pendiente', 'pendiente'], ['confirmada', 'pendiente'], ['cancelada', 'confirmada'], ['atendida', 'cancelada']];
  for (const [desde, hacia] of casos) {
    citaExistente = filaCita({ estado: desde });
    await assert.rejects(service.cambiarEstado(1, { estado: hacia }), DatosInvalidos, `${desde} a ${hacia}`);
  }
});

test('un estado que no existe da 400', async () => {
  await assert.rejects(service.cambiarEstado(1, { estado: 'volando' }), DatosInvalidos);
});

test('listar valida filtros y trata "hasta" sin hora como el día completo', async () => {
  let filtros;
  citasRepository.listar = async (f) => { filtros = f; return []; };
  await service.listar({ doctor_id: '2', desde: '2026-10-01', hasta: '2026-10-31' });
  assert.equal(filtros.doctorId, 2);
  assert.equal(filtros.desde, '2026-10-01 00:00:00');
  assert.equal(filtros.hasta, '2026-11-01 00:00:00');
  await assert.rejects(service.listar({ doctor_id: 'abc' }), DatosInvalidos);
  await assert.rejects(service.listar({ desde: '2026-10-10', hasta: '2026-10-01' }), DatosInvalidos);
});

test('obtener con un id que no es número da 400', async () => {
  await assert.rejects(service.obtener('abc'), DatosInvalidos);
});
