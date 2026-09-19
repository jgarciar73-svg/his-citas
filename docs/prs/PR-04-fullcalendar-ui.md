# PR #4: feature/fullcalendar-ui hacia main

## Descripción

Agrega la interfaz con FullCalendar 6, servida por el mismo Express. FullCalendar y la fuente salen de `node_modules`, así que el calendario funciona sin internet.

El calendario tiene vistas de semana y mes en español. Se llena con `GET /api/citas` y respeta el filtro por doctor y por rango de fechas del panel izquierdo. Con un clic o arrastrando sobre un espacio vacío se abre el panel de nueva cita con la fecha y la hora del espacio. Con un clic sobre una cita se abre su detalle, con los botones Confirmar cita, Marcar como atendida y Cancelar cita. Cancelar pide una confirmación antes de enviarse. Al arrastrar una cita o cambiar su duración se llama a `PUT /api/citas/:id`, y si la API responde 409 o 400 la cita vuelve a su lugar y se muestra el mensaje del servidor.

Colores por estado: pendiente amarillo, confirmada verde, cancelada rojo (con el nombre tachado) y atendida azul. Se definen una sola vez en la hoja de estilos y la leyenda usa las mismas variables. El resto de la pantalla es gris azulado a propósito, para que el color signifique solo estado.

Por capas: `api.js` es el único archivo del navegador que conoce las rutas. `calendar.js` arma la interfaz y llama a `api.js`, sin reglas de negocio. Para no duplicar reglas en el navegador, la API ahora devuelve `reprogramable` junto con `transiciones_permitidas`, y la interfaz solo ofrece los botones y los arrastres que el servidor permite. Ese campo nuevo es el único cambio en la API de este PR.

Para tablet, el panel de filtros pasa a una franja superior, los paneles ocupan todo el ancho en pantallas angostas y el arrastre táctil se activa con una pulsación corta.

## Requisitos cubiertos

- RQF-02: calendario interactivo con vistas de mes y semana.
- RQF-04: reprogramar arrastrando (y cambiando la duración), sincronizado con la base de datos vía API.
- RQF-09: detalle de la cita al hacer clic sobre el evento.
- RQF-10: color por estado.
- RQF-06: filtros por doctor y por rango de fechas en la interfaz.
- RQNF-06: usable en escritorio y tablet.

## Evidencia

Prueba automatizada en Chromium con la API real y los datos semilla. Resultado:

```
1. detalle: Paciente | Rosa Méndez | Doctor | Sofía Ramírez | Ginecología y Obstetricia | Fecha | sábado, 19 de septiembre de 2026 | Horario | 10:00 a 11:00 | Motivo | Control prenatal | Estado |
   botones visibles: [ 'Cerrar', 'Cancelar cita', 'Confirmar cita' ]
2. estado en API tras confirmar: confirmada
   clase del evento: [ 'estado-confirmada' ]
3. panel sigue abierto: true | error: El doctor ya tiene una cita activa el 2026-09-19 de 10:00 a 11:00. Elige otro horario.
4. citas de Sofía el 19: [ '10:00-11:00 confirmada', '11:00-11:30 pendiente' ]
   aviso: Cita confirmada  Cerrar  Cita creada  Cerrar
5. espacio vacío -> fecha 2026-09-17 inicio 12:00 fin 12:30
6. tras arrastrar, API dice: 2026-09-20T12:00:00 a 2026-09-20T13:00:00
7. tras arrastrar a un choque, API dice: 2026-09-20T14:00:00 (debe seguir 14:00)
   aviso: Cita reprogramada  Cerrar  El doctor ya tiene una cita activa el 2026-09-20 de 13:00 a 13:30. Elige otro horario.  Cerrar
8. estado de la cita 5: cancelada | botones de una cancelada:
    [ 'Cerrar' ]
9. filtro Lucía: 3 citas en esta vista.
   vista mes: septiembre de 2026 | 8 citas en esta vista.
```

Los dos avisos 409 que muestra la consola del navegador son las respuestas esperadas de los dos choques de horario de la prueba.

Capturas en `docs/capturas/`: vista de semana, detalle de una cita, error 409 al crear, arrastre rechazado por conflicto, confirmación de cancelación, vista de mes y vista en tablet (820 px de ancho, sin desborde horizontal).
