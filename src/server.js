const app = require('./app');
const { port } = require('./config/env');

app.listen(port, () => {
  console.log(`API de citas escuchando en http://localhost:${port}`);
});
