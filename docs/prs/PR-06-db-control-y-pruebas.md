# PR #6: feature/db-control-y-pruebas hacia main

## Descripción

MySQL ya no queda encendida todo el tiempo. Se quitó la política de reinicio del contenedor, así que solo corre cuando se enciende y no vuelve a arrancar sola con la máquina. Se agregaron atajos: `npm run db:up` (enciende y espera a que esté lista), `db:stop` (apaga y conserva los datos), `db:down` (borra el contenedor y conserva los datos) y `db:reset` (borra también los datos y empieza de cero). Los datos siguen viviendo en un volumen con nombre.

También se agregaron pruebas automáticas con el ejecutor que trae Node:

- `npm test`: 23 pruebas unitarias de fechas y de las reglas de negocio (validación, doble reserva, reprogramación, transiciones de estado), con repositorios de prueba y sin base de datos.
- `npm run test:integracion`: 11 pruebas de extremo a extremo con la API y MySQL reales. Cubren los códigos 200, 201, 400, 404 y 409, los cambios de estado guardados en la base, la cancelación que libera el horario y ocho peticiones simultáneas por el mismo horario.

`scripts/generar-evidencia.sh` ahora incluye la salida de las pruebas en `EVIDENCIA.md`.

## Requisitos cubiertos

- RQNF-01 y RQNF-02: MySQL en Docker que se enciende y se apaga con un comando.
- RQNF-03 y RQNF-07: códigos HTTP y validación de disponibilidad en el servidor, ahora comprobados por pruebas.
- RQNF-08: evidencia reproducible con un script.

## Evidencia

La salida de `npm test`, `npm run test:integracion`, `docker ps` y la prueba de persistencia queda en `EVIDENCIA.md`, generada con `scripts/generar-evidencia.sh`.
