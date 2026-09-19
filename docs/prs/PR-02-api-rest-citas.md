# PR #2: feature/api-rest-citas hacia main

## Descripción

Agrega la API REST de citas sobre la estructura por capas: las rutas solo declaran endpoints, los controladores traducen HTTP a llamadas del servicio, el servicio valida y decide, y los repositorios son el único lugar con SQL.

Endpoints incluidos:

- `GET /api/citas`, con filtros `doctor_id`, `paciente_id`, `desde` y `hasta`. Si `hasta` viene sin hora, incluye el día completo.
- `POST /api/citas`, que crea la cita en estado `pendiente` y responde 201.
- `GET /api/citas/:id`.
- `PUT /api/citas/:id`, para reprogramar fecha y hora. También acepta cambiar de doctor o de motivo.
- `PATCH /api/citas/:id/estado`.
- `GET /api/doctores` y `GET /api/pacientes`.

Toda entrada se valida antes de tocar la base: campos obligatorios, formato de fecha y hora, que `fin` sea posterior a `inicio`, y que existan el paciente y el doctor. Los errores devuelven JSON con un `codigo`, un `mensaje` y, cuando aplica, la lista de `detalles`.

Fechas: la API trabaja con hora local del hospital, sin zona horaria. Si el cliente manda un sufijo de zona (`Z` o `-06:00`) se ignora y se conserva la hora escrita.

Todavía no se impide la doble reserva ni se restringen las transiciones de estado. Eso llega en `feature/validacion-conflictos-estados`.

## Requisitos cubiertos

- RQF-01: crear una cita con paciente, doctor, inicio, fin y motivo.
- RQF-06: listar y filtrar por doctor y por rango de fechas.
- RQF-07: API REST con operaciones sobre citas y lectura de doctores y pacientes.
- RQF-08: validación de entrada antes de persistir.
- RQNF-03: respuestas JSON con 200, 201, 400 y 404.
- RQNF-04: código organizado por capas.

## Evidencia

Respuestas reales de la API contra la base con los datos semilla:

```
$ curl localhost:3000/api/citas?doctor_id=1&desde=2026-09-19&hasta=2026-09-30
[{"id":5,"paciente_id":5,"paciente_nombre":"Carmen Ordóñez","doctor_id":1,"doctor_nombre":"Lucía Morales","doctor_especialidad":"Medicina Interna","inicio":"2026-09-20T14:00:00","fin":"2026-09-20T14:30:00","motivo":"Dolor abdominal","estado":"pendiente","creado_en":"2026-09-19 13:38:56","actualizado_en":"2026-09-19 13:38:56"},{"id":6,"paciente_id":2,"paciente_nombre":"Luis Hernández","doctor_id":1,"doctor_nombre":"Lucía Morales","doctor_especialidad":"Medicina Interna","inicio":"2026-09-21T11:00:00","fin":"2026-09-21T11:30:00","motivo":"Consulta de seguimiento","estado":"cancelada","creado_en":"2026-09-19 13:38:56","actualizado_en":"2026-09-19 13:38:56"}]
HTTP 200

$ curl -X POST localhost:3000/api/citas -H Content-Type: application/json -d {"paciente_id":1,"doctor_id":2,"inicio":"2026-10-05T09:00","fin":"2026-10-05T09:30","motivo":"Vacunación"}
{"id":7,"paciente_id":1,"paciente_nombre":"Ana López","doctor_id":2,"doctor_nombre":"Andrés Castillo","doctor_especialidad":"Pediatría","inicio":"2026-10-05T09:00:00","fin":"2026-10-05T09:30:00","motivo":"Vacunación","estado":"pendiente","creado_en":"2026-09-19 13:38:58","actualizado_en":"2026-09-19 13:38:58"}
HTTP 201

$ curl -X POST localhost:3000/api/citas -H Content-Type: application/json -d {"paciente_id":99,"doctor_id":2,"inicio":"2026-10-05T10:00","fin":"2026-10-05T09:30"}
{"codigo":"DATOS_INVALIDOS","mensaje":"Los datos enviados no son válidos.","detalles":["fin debe ser posterior a inicio.","motivo es obligatorio."]}
HTTP 400

$ curl -X POST localhost:3000/api/citas -H Content-Type: application/json -d {"paciente_id":
{"codigo":"DATOS_INVALIDOS","mensaje":"El cuerpo de la petición no es un JSON válido."}
HTTP 400

$ curl localhost:3000/api/citas/7
{"id":7,"paciente_id":1,"paciente_nombre":"Ana López","doctor_id":2,"doctor_nombre":"Andrés Castillo","doctor_especialidad":"Pediatría","inicio":"2026-10-05T09:00:00","fin":"2026-10-05T09:30:00","motivo":"Vacunación","estado":"pendiente","creado_en":"2026-09-19 13:38:58","actualizado_en":"2026-09-19 13:38:58"}
HTTP 200

$ curl localhost:3000/api/citas/999
{"codigo":"NO_ENCONTRADO","mensaje":"La cita 999 no existe."}
HTTP 404

$ curl -X PUT localhost:3000/api/citas/7 -H Content-Type: application/json -d {"inicio":"2026-10-06T09:00","fin":"2026-10-06T09:30"}
{"id":7,"paciente_id":1,"paciente_nombre":"Ana López","doctor_id":2,"doctor_nombre":"Andrés Castillo","doctor_especialidad":"Pediatría","inicio":"2026-10-06T09:00:00","fin":"2026-10-06T09:30:00","motivo":"Vacunación","estado":"pendiente","creado_en":"2026-09-19 13:38:58","actualizado_en":"2026-09-19 13:38:58"}
HTTP 200

$ curl -X PATCH localhost:3000/api/citas/7/estado -H Content-Type: application/json -d {"estado":"confirmada"}
{"id":7,"paciente_id":1,"paciente_nombre":"Ana López","doctor_id":2,"doctor_nombre":"Andrés Castillo","doctor_especialidad":"Pediatría","inicio":"2026-10-06T09:00:00","fin":"2026-10-06T09:30:00","motivo":"Vacunación","estado":"confirmada","creado_en":"2026-09-19 13:38:58","actualizado_en":"2026-09-19 13:38:58"}
HTTP 200

$ curl -X PATCH localhost:3000/api/citas/7/estado -H Content-Type: application/json -d {"estado":"volando"}
{"codigo":"DATOS_INVALIDOS","mensaje":"Los datos enviados no son válidos.","detalles":["estado debe ser uno de: pendiente, confirmada, cancelada, atendida."]}
HTTP 400

```
