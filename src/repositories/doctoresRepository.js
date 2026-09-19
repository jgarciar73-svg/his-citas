const { pool } = require('../config/db');

async function listar() {
  const [filas] = await pool.query(
    'SELECT id, nombre, apellido, especialidad FROM doctores ORDER BY apellido, nombre'
  );
  return filas;
}

async function obtenerPorId(id) {
  const [filas] = await pool.query(
    'SELECT id, nombre, apellido, especialidad FROM doctores WHERE id = ?',
    [id]
  );
  return filas[0] || null;
}

module.exports = { listar, obtenerPorId };
