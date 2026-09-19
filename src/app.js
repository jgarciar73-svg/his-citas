const path = require('path');
const express = require('express');
const routes = require('./routes');
const { rutaNoEncontrada, manejarErrores } = require('./middlewares/errorHandler');

const app = express();

const raiz = path.join(__dirname, '..');

app.use(express.json());

// Interfaz web. FullCalendar y la fuente se sirven desde node_modules, así el
// calendario funciona sin conexión a internet.
app.use('/vendor/fullcalendar', express.static(path.join(raiz, 'node_modules', 'fullcalendar')));
app.use('/vendor/fullcalendar-idiomas', express.static(path.join(raiz, 'node_modules', '@fullcalendar', 'core', 'locales')));
app.use('/vendor/fuente', express.static(path.join(raiz, 'node_modules', '@fontsource', 'atkinson-hyperlegible')));
app.use(express.static(path.join(raiz, 'public')));

app.use('/api', routes);
app.use('/api', rutaNoEncontrada);
app.use(manejarErrores);

module.exports = app;
