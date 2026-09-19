# PR #1: feature/docker-mysql-schema hacia main

## Descripción

Deja lista la base de datos del módulo. Un `docker-compose.yml` levanta MySQL 8 con un volumen con nombre, así que los datos siguen ahí después de `docker compose down`. Al crear el contenedor por primera vez se ejecutan los scripts de `db/init`: primero el esquema (pacientes, doctores, citas) y luego los datos semilla.

La tabla `citas` tiene llaves foráneas hacia pacientes y doctores, un CHECK que obliga a que `fin` sea mayor que `inicio`, y un índice por `(doctor_id, inicio, fin)` que más adelante se usa para detectar solapes. El estado es un ENUM con los cuatro valores del backlog y `pendiente` por defecto.

Las citas de ejemplo usan fechas relativas a `CURDATE()`, así el calendario muestra algo apenas se crea el contenedor.

## Requisitos cubiertos

- RQNF-01: MySQL en contenedor Docker con persistencia mediante volumen.
- RQNF-02: entorno reproducible con un solo comando, `docker compose up -d`.

## Evidencia

La evidencia de este PR se genera con `scripts/generar-evidencia.sh` y queda en `EVIDENCIA.md`, secciones 1 y 2: salida de `docker compose up -d`, `docker ps`, estado de salud del contenedor, el volumen creado y la prueba de persistencia (contar las citas, bajar el contenedor, subirlo y volver a contar).
