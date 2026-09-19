# PR #5: feature/evidencia hacia main

## Descripción

Agrega `scripts/generar-evidencia.sh`, que arma `EVIDENCIA.md` con la salida real de los comandos: `docker compose up`, `docker ps`, la prueba de persistencia (bajar el contenedor, subirlo y contar las citas), las respuestas de la API con sus códigos 200, 201, 400, 404 y 409, y `git log --graph --all --oneline`. También enlaza las capturas de `docs/capturas/`.

Se hizo un script en lugar de pegar las salidas a mano para que cualquiera pueda repetir la evidencia con un solo comando y que las salidas sean siempre las reales.

El `EVIDENCIA.md` incluido en este PR se generó en una máquina sin Docker, así que las secciones 1 y 2 dicen que están pendientes. Se completan ejecutando el script donde haya Docker.

## Requisitos cubiertos

- RQNF-08: toda la evidencia queda documentada en un archivo y en los PR.

## Evidencia

Las secciones 3 a 5 de `EVIDENCIA.md` (API, historial de Git y capturas) tienen las salidas reales de la ejecución.
