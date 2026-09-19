const { pool } = require('../config/db');

// Único lugar de la aplicación con SQL sobre citas.
const COLUMNAS = `
  c.id, c.paciente_id, c.doctor_id, c.inicio, c.fin, c.motivo, c.estado,
  c.creado_en, c.actualizado_en,
  CONCAT(p.nombre, ' ', p.apellido) AS paciente_nombre,
  CONCAT(d.nombre, ' ', d.apellido) AS doctor_nombre,
  d.especialidad AS doctor_especialidad`;

const ORIGEN = `
  FROM citas c
  JOIN pacientes p ON p.id = c.paciente_id
  JOIN doctores d ON d.id = c.doctor_id`;

// Devuelve las citas que tocan el rango [desde, hasta). Todos los filtros son opcionales.
async function listar({ doctorId, pacienteId, desde, hasta } = {}) {
  const condiciones = [];
  const parametros = [];

  if (doctorId) {
    condiciones.push('c.doctor_id = ?');
    parametros.push(doctorId);
  }
  if (pacienteId) {
    condiciones.push('c.paciente_id = ?');
    parametros.push(pacienteId);
  }
  if (desde) {
    condiciones.push('c.fin > ?');
    parametros.push(desde);
  }
  if (hasta) {
    condiciones.push('c.inicio < ?');
    parametros.push(hasta);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS} ${ORIGEN} ${where} ORDER BY c.inicio, c.id`,
    parametros
  );
  return filas;
}

async function obtenerPorId(id) {
  const [filas] = await pool.query(`SELECT ${COLUMNAS} ${ORIGEN} WHERE c.id = ?`, [id]);
  return filas[0] || null;
}

async function crear({ pacienteId, doctorId, inicio, fin, motivo }) {
  const [resultado] = await pool.query(
    'INSERT INTO citas (paciente_id, doctor_id, inicio, fin, motivo) VALUES (?, ?, ?, ?, ?)',
    [pacienteId, doctorId, inicio, fin, motivo]
  );
  return resultado.insertId;
}

async function actualizarHorario(id, { doctorId, inicio, fin, motivo }) {
  await pool.query(
    'UPDATE citas SET doctor_id = ?, inicio = ?, fin = ?, motivo = ? WHERE id = ?',
    [doctorId, inicio, fin, motivo, id]
  );
}

async function actualizarEstado(id, estado) {
  await pool.query('UPDATE citas SET estado = ? WHERE id = ?', [estado, id]);
}

module.exports = { listar, obtenerPorId, crear, actualizarHorario, actualizarEstado };
