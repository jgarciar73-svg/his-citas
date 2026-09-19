const mysql = require('mysql2/promise');
const { db } = require('./env');

// dateStrings evita que el driver convierta los DATETIME a Date con zona horaria.
// Las citas se guardan y se devuelven como hora local del hospital, sin conversiones.
const pool = mysql.createPool({
  ...db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  charset: 'utf8mb4',
});

// Ejecuta `trabajo` dentro de una transacción. Si lanza un error se hace rollback.
async function transaccion(trabajo) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

module.exports = { pool, transaccion };
