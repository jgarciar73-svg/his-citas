// Pruebas de extremo a extremo de la API con MySQL real.
// Requisito: la base de datos encendida (npm run db:up) con los datos semilla.
// Cada ejecución usa un día lejano al azar y al terminar cancela las citas que creó,
// así se puede repetir sin ensuciar el calendario ni chocar con corridas anteriores.
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');

let servidor;
let base;
const creadas = [];

const dia = (() => {
  const d = new Date(Date.UTC(2032, 0, 1) + Math.floor(Math.random() * 3000) * 86400000);
  return d.toISOString().slice(0, 10);
})();
const en = (hora) => `${dia}T${hora}`;

async function llamar(metodo, ruta, cuerpo) {
  const respuesta = await fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  return { status: respuesta.status, cuerpo: await respuesta.json() };
}

async function crear(datos) {
  const r = await llamar('POST', '/api/citas', { paciente_id: 1, doctor_id: 1, motivo: 'Prueba automática', ...datos });
  if (r.status === 201) creadas.push(r.cuerpo.id);
  return r;
}

test.before(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    throw new Error(`No hay conexión con MySQL (${error.code || error.message}). Enciéndela con: npm run db:up`);
  }
  await new Promise((resolver) => {
    servidor = app.listen(0, resolver);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

test.after(async () => {
  for (const id of creadas) {
    await llamar('PATCH', `/api/citas/${id}/estado`, { estado: 'cancelada' });
  }
  await new Promise((resolver) => servidor.close(resolver));
  await pool.end();
});

test('GET /api/doctores y /api/pacientes leen la base de datos', async () => {
  const doctores = await llamar('GET', '/api/doctores');
  const pacientes = await llamar('GET', '/api/pacientes');
  assert.equal(doctores.status, 200);
  assert.equal(pacientes.status, 200);
  assert.ok(doctores.cuerpo.length >= 4);
  assert.ok(pacientes.cuerpo.length >= 5);
});

test('POST crea una cita pendiente (201) y GET la devuelve (200)', async () => {
  const r = await crear({ inicio: en('08:00'), fin: en('08:30') });
  assert.equal(r.status, 201);
  assert.equal(r.cuerpo.estado, 'pendiente');
  const leida = await llamar('GET', `/api/citas/${r.cuerpo.id}`);
  assert.equal(leida.status, 200);
  assert.equal(leida.cuerpo.inicio, en('08:00:00'));
});

test('el filtro por doctor y por rango de fechas devuelve solo lo que corresponde', async () => {
  const propia = await crear({ doctor_id: 2, inicio: en('09:00'), fin: en('09:30') });
  const r = await llamar('GET', `/api/citas?doctor_id=2&desde=${dia}&hasta=${dia}`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.cuerpo.map((c) => c.id), [propia.cuerpo.id]);
  const otroDoctor = await llamar('GET', `/api/citas?doctor_id=3&desde=${dia}&hasta=${dia}`);
  assert.equal(otroDoctor.cuerpo.length, 0);
});

test('409 cuando el mismo doctor tiene una cita activa que se solapa', async () => {
  await crear({ inicio: en('10:00'), fin: en('10:30') });
  const alFinal = await crear({ inicio: en('10:15'), fin: en('10:45') });
  const alInicio = await crear({ inicio: en('09:45'), fin: en('10:15') });
  const contenida = await crear({ inicio: en('10:05'), fin: en('10:10') });
  for (const r of [alFinal, alInicio, contenida]) {
    assert.equal(r.status, 409);
    assert.equal(r.cuerpo.codigo, 'CONFLICTO_HORARIO');
  }
});

test('citas pegadas o de otro doctor no chocan', async () => {
  const pegada = await crear({ inicio: en('10:30'), fin: en('11:00') });
  const otroDoctor = await crear({ doctor_id: 2, inicio: en('10:00'), fin: en('10:30') });
  assert.equal(pegada.status, 201);
  assert.equal(otroDoctor.status, 201);
});

test('400 con datos inválidos y con JSON mal formado', async () => {
  const sinMotivo = await llamar('POST', '/api/citas', { paciente_id: 1, doctor_id: 1, inicio: en('12:00'), fin: en('12:30') });
  const finAntes = await crear({ inicio: en('12:30'), fin: en('12:00') });
  const pacienteInexistente = await crear({ paciente_id: 99999, inicio: en('12:00'), fin: en('12:30') });
  assert.equal(sinMotivo.status, 400);
  assert.equal(finAntes.status, 400);
  assert.equal(pacienteInexistente.status, 400);
  const roto = await fetch(`${base}/api/citas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"paciente_id":' });
  assert.equal(roto.status, 400);
});

test('404 para una cita o una ruta que no existen', async () => {
  assert.equal((await llamar('GET', '/api/citas/99999999')).status, 404);
  assert.equal((await llamar('PATCH', '/api/citas/99999999/estado', { estado: 'confirmada' })).status, 404);
  assert.equal((await llamar('GET', '/api/nada')).status, 404);
});

test('PUT reprograma; mover la cita a un horario ocupado da 409 y no la cambia', async () => {
  const ocupada = await crear({ doctor_id: 3, inicio: en('14:00'), fin: en('14:30') });
  const movible = await crear({ doctor_id: 3, inicio: en('15:00'), fin: en('15:30') });

  const bien = await llamar('PUT', `/api/citas/${movible.cuerpo.id}`, { inicio: en('16:00'), fin: en('16:30') });
  assert.equal(bien.status, 200);
  assert.equal(bien.cuerpo.inicio, en('16:00:00'));

  const mal = await llamar('PUT', `/api/citas/${movible.cuerpo.id}`, { inicio: en('14:10'), fin: en('14:40') });
  assert.equal(mal.status, 409);
  const intacta = await llamar('GET', `/api/citas/${movible.cuerpo.id}`);
  assert.equal(intacta.cuerpo.inicio, en('16:00:00'));
  assert.ok(ocupada.cuerpo.id);
});

test('estados: transiciones válidas se guardan en la base y las inválidas dan 400', async () => {
  const r = await crear({ doctor_id: 4, inicio: en('08:00'), fin: en('08:30') });
  const id = r.cuerpo.id;
  const cambiar = (estado) => llamar('PATCH', `/api/citas/${id}/estado`, { estado });

  assert.equal((await cambiar('atendida')).status, 400);
  assert.equal((await cambiar('confirmada')).status, 200);
  const [[fila]] = await pool.query('SELECT estado FROM citas WHERE id = ?', [id]);
  assert.equal(fila.estado, 'confirmada');
  assert.equal((await cambiar('atendida')).status, 200);
  assert.equal((await cambiar('cancelada')).status, 400);
  assert.equal((await llamar('PUT', `/api/citas/${id}`, { inicio: en('09:00'), fin: en('09:30') })).status, 400);
});

test('cancelar conserva el registro y libera el horario del doctor', async () => {
  const r = await crear({ doctor_id: 4, inicio: en('11:00'), fin: en('11:30') });
  const id = r.cuerpo.id;
  assert.equal((await crear({ doctor_id: 4, inicio: en('11:00'), fin: en('11:30') })).status, 409);

  const cancelada = await llamar('PATCH', `/api/citas/${id}/estado`, { estado: 'cancelada' });
  assert.equal(cancelada.status, 200);
  const [[fila]] = await pool.query('SELECT estado FROM citas WHERE id = ?', [id]);
  assert.equal(fila.estado, 'cancelada');

  const nueva = await crear({ doctor_id: 4, inicio: en('11:00'), fin: en('11:30') });
  assert.equal(nueva.status, 201);
});

test('ocho peticiones simultáneas por el mismo horario: solo una se guarda', async () => {
  const respuestas = await Promise.all(
    Array.from({ length: 8 }, (_, i) => crear({ paciente_id: (i % 5) + 1, doctor_id: 2, inicio: en('13:00'), fin: en('13:30') }))
  );
  const estados = respuestas.map((r) => r.status).sort();
  assert.equal(estados.filter((s) => s === 201).length, 1);
  assert.equal(estados.filter((s) => s === 409).length, 7);
});
