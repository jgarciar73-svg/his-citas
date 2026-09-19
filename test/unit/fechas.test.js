const test = require('node:test');
const assert = require('node:assert/strict');
const fechas = require('../../src/utils/fechas');

test('acepta fecha y hora con T, con espacio y con segundos', () => {
  assert.equal(fechas.analizar('2026-10-05T09:00').sql, '2026-10-05 09:00:00');
  assert.equal(fechas.analizar('2026-10-05 09:00:30').sql, '2026-10-05 09:00:30');
  assert.equal(fechas.analizar('2026-10-05T09:00:00').tieneHora, true);
});

test('una fecha sin hora se reconoce como solo fecha', () => {
  const f = fechas.analizar('2026-10-05');
  assert.equal(f.tieneHora, false);
  assert.equal(f.fecha, '2026-10-05');
});

test('ignora el sufijo de zona y conserva la hora escrita', () => {
  assert.equal(fechas.analizar('2026-10-05T09:00:00-06:00').sql, '2026-10-05 09:00:00');
  assert.equal(fechas.analizar('2026-10-05T09:00:00Z').sql, '2026-10-05 09:00:00');
});

test('rechaza fechas y horas imposibles o mal escritas', () => {
  for (const malo of ['2026-02-30', '2026-13-01', '2026-10-05T25:00', '2026-10-05T09:61', 'hoy', '', '05/10/2026', null, 42, undefined]) {
    assert.equal(fechas.analizar(malo), null, `debería rechazar ${String(malo)}`);
  }
});

test('acepta el 29 de febrero solo en año bisiesto', () => {
  assert.notEqual(fechas.analizar('2028-02-29'), null);
  assert.equal(fechas.analizar('2027-02-29'), null);
});

test('diaSiguiente cruza fin de mes y de año', () => {
  assert.equal(fechas.diaSiguiente('2026-09-30'), '2026-10-01');
  assert.equal(fechas.diaSiguiente('2026-12-31'), '2027-01-01');
});

test('aIso cambia el espacio por T', () => {
  assert.equal(fechas.aIso('2026-10-05 09:00:00'), '2026-10-05T09:00:00');
});
