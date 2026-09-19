const { pool, transaccion } = require('../config/db');

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

async function obtenerPorId(id, conexion = pool) {
  const [filas] = await conexion.query(`SELECT ${COLUMNAS} ${ORIGEN} WHERE c.id = ?`, [id]);
  return filas[0] || null;
}

async function crear({ pacienteId, doctorId, inicio, fin, motivo }, conexion = pool) {
  const [resultado] = await conexion.query(
    'INSERT INTO citas (paciente_id, doctor_id, inicio, fin, motivo) VALUES (?, ?, ?, ?, ?)',
    [pacienteId, doctorId, inicio, fin, motivo]
  );
  return resultado.insertId;
}

async function actualizarHorario(id, { doctorId, inicio, fin, motivo }, conexion = pool) {
  await conexion.query(
    'UPDATE citas SET doctor_id = ?, inicio = ?, fin = ?, motivo = ? WHERE id = ?',
    [doctorId, inicio, fin, motivo, id]
  );
}

async function actualizarEstado(id, estado) {
  await pool.query('UPDATE citas SET estado = ? WHERE id = ?', [estado, id]);
}

// ---------- Disponibilidad del doctor (RQF-03) ----------

// Ejecuta `trabajo` en una transacción y bloquea la fila del doctor hasta que termine.
// Así, dos peticiones que quieran el mismo horario del mismo doctor se atienden una
// después de la otra, y la segunda ya ve la cita que creó la primera.
function conBloqueoDeDoctor(doctorId, trabajo) {
  return transaccion(async (conexion) => {
    await conexion.query('SELECT id FROM doctores WHERE id = ? FOR UPDATE', [doctorId]);
    return trabajo(conexion);
  });
}

// Busca una cita ACTIVA (pendiente o confirmada) del doctor que se solape con [inicio, fin).
// Dos intervalos se solapan cuando cada uno empieza antes de que termine el otro.
// Las citas canceladas y las atendidas no ocupan horario.
async function buscarSolape({ doctorId, inicio, fin, excluirId }, conexion = pool) {
  const parametros = [doctorId, fin, inicio];
  let exclusion = '';
  if (excluirId) {
    exclusion = 'AND id <> ?';
    parametros.push(excluirId);
  }
  const [filas] = await conexion.query(
    `SELECT id, inicio, fin FROM citas
     WHERE doctor_id = ? AND estado IN ('pendiente', 'confirmada')
       AND inicio < ? AND fin > ? ${exclusion}
     ORDER BY inicio LIMIT 1`,
    parametros
  );
  return filas[0] || null;
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizarHorario,
  actualizarEstado,
  conBloqueoDeDoctor,
  buscarSolape,
};
