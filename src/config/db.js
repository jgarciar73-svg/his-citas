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

module.exports = { pool };
