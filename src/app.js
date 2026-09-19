const express = require('express');
const routes = require('./routes');
const { rutaNoEncontrada, manejarErrores } = require('./middlewares/errorHandler');

const app = express();

app.use(express.json());
app.use('/api', routes);
app.use('/api', rutaNoEncontrada);
app.use(manejarErrores);

module.exports = app;
