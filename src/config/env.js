require('dotenv').config({ quiet: true });

module.exports = {
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    database: process.env.MYSQL_DATABASE || 'his_citas',
    user: process.env.MYSQL_USER || 'his_user',
    password: process.env.MYSQL_PASSWORD || 'his_pass_2026',
  },
};
