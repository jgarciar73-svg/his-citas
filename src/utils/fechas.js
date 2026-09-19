// Las citas trabajan con hora local del hospital, sin zona horaria.
// Se acepta "2026-09-21", "2026-09-21T10:30", "2026-09-21 10:30:00" y variantes con
// segundos. Si llega un sufijo de zona (Z o +hh:mm) se ignora y se conserva la hora escrita.
const PATRON = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

const dos = (n) => String(n).padStart(2, '0');

// Devuelve { fecha: 'YYYY-MM-DD', tieneHora, sql: 'YYYY-MM-DD HH:MM:SS' } o null si no es válida.
function analizar(valor) {
  if (typeof valor !== 'string') return null;
  const m = PATRON.exec(valor.trim());
  if (!m) return null;

  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const control = new Date(Date.UTC(anio, mes - 1, dia));
  if (control.getUTCFullYear() !== anio || control.getUTCMonth() !== mes - 1 || control.getUTCDate() !== dia) {
    return null;
  }

  const tieneHora = m[4] !== undefined;
  const hora = tieneHora ? Number(m[4]) : 0;
  const minuto = tieneHora ? Number(m[5]) : 0;
  const segundo = m[6] !== undefined ? Number(m[6]) : 0;
  if (hora > 23 || minuto > 59 || segundo > 59) return null;

  const fecha = `${m[1]}-${m[2]}-${m[3]}`;
  return { fecha, tieneHora, sql: `${fecha} ${dos(hora)}:${dos(minuto)}:${dos(segundo)}` };
}

// 'YYYY-MM-DD' -> 'YYYY-MM-DD' del día siguiente.
function diaSiguiente(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  const siguiente = new Date(Date.UTC(a, m - 1, d + 1));
  return `${siguiente.getUTCFullYear()}-${dos(siguiente.getUTCMonth() + 1)}-${dos(siguiente.getUTCDate())}`;
}

// 'YYYY-MM-DD HH:MM:SS' (formato de MySQL) -> 'YYYY-MM-DDTHH:MM:SS' (formato que lee FullCalendar).
function aIso(sql) {
  return sql.replace(' ', 'T');
}

module.exports = { analizar, diaSiguiente, aIso };
