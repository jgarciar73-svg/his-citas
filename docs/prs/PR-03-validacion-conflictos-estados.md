# PR #3: feature/validacion-conflictos-estados hacia main

## Descripción

Este PR agrega dos reglas de negocio que viven en la capa de servicio, ambas comprobadas en el servidor.

Doble reserva. Antes de crear o reprogramar una cita se busca otra cita activa (pendiente o confirmada) del mismo doctor que se solape. Dos horarios se solapan cuando cada uno empieza antes de que termine el otro (`inicio_nuevo < fin_existente AND fin_nuevo > inicio_existente`), así que una cita que empieza justo cuando termina otra no choca. Si hay choque la API responde 409 y dice en el mensaje cuál es la cita en conflicto. Al reprogramar se excluye a la propia cita, y las canceladas y atendidas no ocupan horario.

Para que dos peticiones simultáneas no se cuelen las dos, la comprobación y el guardado ocurren en una transacción que bloquea la fila del doctor (`SELECT ... FOR UPDATE`). La segunda petición espera, ve la cita que creó la primera y recibe 409. La prueba con ocho peticiones al mismo tiempo está más abajo.

Estados. Las transiciones válidas son pendiente a confirmada o cancelada, y confirmada a atendida o cancelada. Cancelada y atendida son finales: no cambian más ni se reprograman, y la API responde 400. Cancelar solo cambia el estado, el registro se conserva. Cada cita devuelve `transiciones_permitidas`, para que la interfaz ofrezca solo los botones que corresponden sin duplicar las reglas en el navegador.

## Requisitos cubiertos

- RQF-03: impedir la doble reserva del mismo doctor.
- RQF-05: cancelar cambiando el estado, sin eliminar el registro.
- RQNF-03: código 409 por conflicto de horario.
- RQNF-07: la disponibilidad se valida en el servidor.

## Evidencia

Doble reserva al crear:

```
# Cita existente del doctor 1: 2026-09-20 de 14:00 a 14:30 (pendiente)
$ curl -X POST localhost:3000/api/citas -H Content-Type: application/json -d {"paciente_id":1,"doctor_id":1,"inicio":"2026-09-20T14:15","fin":"2026-09-20T14:45","motivo":"Choca por el final"}
{"codigo":"CONFLICTO_HORARIO","mensaje":"El doctor ya tiene una cita activa el 2026-09-20 de 14:00 a 14:30. Elige otro horario.","detalles":[{"cita_id":5,"inicio":"2026-09-20T14:00:00","fin":"2026-09-20T14:30:00"}]}
HTTP 409

$ curl -X POST localhost:3000/api/citas -H Content-Type: application/json -d {"paciente_id":1,"doctor_id":1,"inicio":"2026-09-20T13:30","fin":"2026-09-20T14:15","motivo":"Choca por el inicio"}
{"codigo":"CONFLICTO_HORARIO","mensaje":"El doctor ya tiene una cita activa el 2026-09-20 de 14:00 a 14:30. Elige otro horario.","detalles":[{"cita_id":5,"inicio":"2026-09-20T14:00:00","fin":"2026-09-20T14:30:00"}]}
HTTP 409

# Pegada al final de otra cita: no es solape (14:30 a 15:00)
$ curl -X POST localhost:3000/api/citas -H Content-Type: application/json -d {"paciente_id":1,"doctor_id":1,"inicio":"2026-09-20T14:30","fin":"2026-09-20T15:00","motivo":"Justo después"}
{"id":8,"paciente_id":1,"paciente_nombre":"Ana López","doctor_id":1,"doctor_nombre":"Lucía Morales","doctor_especialidad":"Medicina Interna","inicio":"2026-09-20T14:30:00","fin":"2026-09-20T15:00:00","motivo":"Justo después","estado":"pendiente"}
HTTP 201

# Mismo horario con otro doctor: permitido
$ curl -X POST localhost:3000/api/citas -H Content-Type: application/json -d {"paciente_id":1,"doctor_id":2,"inicio":"2026-09-20T14:00","fin":"2026-09-20T14:30","motivo":"Otro doctor"}
{"id":9,"paciente_id":1,"paciente_nombre":"Ana López","doctor_id":2,"doctor_nombre":"Andrés Castillo","doctor_especialidad":"Pediatría","inicio":"2026-09-20T14:00:00","fin":"2026-09-20T14:30:00","motivo":"Otro doctor","estado":"pendiente"}
HTTP 201

# Cita cancelada (id 6, doctor 1, 21 sep 11:00 a 11:30) no bloquea el horario
$ curl -X POST localhost:3000/api/citas -H Content-Type: application/json -d {"paciente_id":3,"doctor_id":1,"inicio":"2026-09-21T11:00","fin":"2026-09-21T11:30","motivo":"Sobre una cancelada"}
{"id":10,"paciente_id":3,"paciente_nombre":"Rosa Méndez","doctor_id":1,"doctor_nombre":"Lucía Morales","doctor_especialidad":"Medicina Interna","inicio":"2026-09-21T11:00:00","fin":"2026-09-21T11:30:00","motivo":"Sobre una cancelada","estado":"pendiente"}
HTTP 201

# Paciente inexistente
$ curl -X POST localhost:3000/api/citas -H Content-Type: application/json -d {"paciente_id":99,"doctor_id":1,"inicio":"2026-10-01T08:00","fin":"2026-10-01T08:30","motivo":"Paciente 99"}
{"codigo":"DATOS_INVALIDOS","mensaje":"Los datos enviados no son válidos.","detalles":["El paciente 99 no existe."]}
HTTP 400

```

Reprogramación y peticiones simultáneas:

```
# Reprogramar la cita 8 (doctor 1) encima de la cita 5: 409
$ curl -X PUT localhost:3000/api/citas/8 -H Content-Type: application/json -d {"inicio":"2026-09-20T14:10","fin":"2026-09-20T14:40"}
{"codigo":"CONFLICTO_HORARIO","mensaje":"El doctor ya tiene una cita activa el 2026-09-20 de 14:00 a 14:30. Elige otro horario.","detalles":[{"cita_id":5,"inicio":"2026-09-20T14:00:00","fin":"2026-09-20T14:30:00"}]}
HTTP 409

# Alargar la cita 8 dentro de su propio espacio (se excluye a sí misma): 200
$ curl -X PUT localhost:3000/api/citas/8 -H Content-Type: application/json -d {"inicio":"2026-09-20T14:30","fin":"2026-09-20T15:15"}
{"id":8,"paciente_id":1,"paciente_nombre":"Ana López","doctor_id":1,"doctor_nombre":"Lucía Morales","doctor_especialidad":"Medicina Interna","inicio":"2026-09-20T14:30:00","fin":"2026-09-20T15:15:00","motivo":"Justo después","estado":"pendiente"}
HTTP 200

# Ocho peticiones simultáneas por el mismo horario del doctor 3, códigos HTTP recibidos:
      1 201
      7 409
# Citas activas del doctor 3 ese día:
1
```

Estados y persistencia:

```
# Cita 8 está pendiente. De pendiente a atendida no se permite:
$ curl -X PATCH localhost:3000/api/citas/8/estado -H Content-Type: application/json -d {"estado":"atendida"}
{"codigo":"DATOS_INVALIDOS","mensaje":"Los datos enviados no son válidos.","detalles":["No se puede cambiar la cita de pendiente a atendida. Desde pendiente solo se puede pasar a: confirmada, cancelada."]}
HTTP 400

# Pendiente a confirmada:
$ curl -X PATCH localhost:3000/api/citas/8/estado -H Content-Type: application/json -d {"estado":"confirmada"}
{"id":8,"paciente_id":1,"paciente_nombre":"Ana López","doctor_id":1,"doctor_nombre":"Lucía Morales","doctor_especialidad":"Medicina Interna","inicio":"2026-09-20T14:30:00","fin":"2026-09-20T15:15:00","motivo":"Justo después","estado":"confirmada","transiciones_permitidas":["atendida","cancelada"]}
HTTP 200

# Confirmada a atendida:
$ curl -X PATCH localhost:3000/api/citas/8/estado -H Content-Type: application/json -d {"estado":"atendida"}
{"id":8,"paciente_id":1,"paciente_nombre":"Ana López","doctor_id":1,"doctor_nombre":"Lucía Morales","doctor_especialidad":"Medicina Interna","inicio":"2026-09-20T14:30:00","fin":"2026-09-20T15:15:00","motivo":"Justo después","estado":"atendida","transiciones_permitidas":[]}
HTTP 200

# Una cita atendida ya no cambia:
$ curl -X PATCH localhost:3000/api/citas/8/estado -H Content-Type: application/json -d {"estado":"cancelada"}
{"codigo":"DATOS_INVALIDOS","mensaje":"Los datos enviados no son válidos.","detalles":["No se puede cambiar la cita de atendida a cancelada. Una cita atendida ya no cambia de estado."]}
HTTP 400

# Ni se reprograma:
$ curl -X PUT localhost:3000/api/citas/8 -H Content-Type: application/json -d {"inicio":"2026-09-22T10:00","fin":"2026-09-22T10:30"}
{"codigo":"DATOS_INVALIDOS","mensaje":"Los datos enviados no son válidos.","detalles":["No se puede reprogramar una cita atendida."]}
HTTP 400

# Cancelar la cita 9 (doctor 2, 20 sep 14:00 a 14:30):
$ curl -X PATCH localhost:3000/api/citas/9/estado -H Content-Type: application/json -d {"estado":"cancelada"}
{"id":9,"paciente_id":1,"paciente_nombre":"Ana López","doctor_id":2,"doctor_nombre":"Andrés Castillo","doctor_especialidad":"Pediatría","inicio":"2026-09-20T14:00:00","fin":"2026-09-20T14:30:00","motivo":"Otro doctor","estado":"cancelada","transiciones_permitidas":[]}
HTTP 200

# El registro sigue existiendo, como cancelada:
$ curl localhost:3000/api/citas/9
{"id":9,"paciente_id":1,"paciente_nombre":"Ana López","doctor_id":2,"doctor_nombre":"Andrés Castillo","doctor_especialidad":"Pediatría","inicio":"2026-09-20T14:00:00","fin":"2026-09-20T14:30:00","motivo":"Otro doctor","estado":"cancelada","transiciones_permitidas":[]}
HTTP 200

# Y su horario queda libre para otra cita del mismo doctor:
$ curl -X POST localhost:3000/api/citas -H Content-Type: application/json -d {"paciente_id":4,"doctor_id":2,"inicio":"2026-09-20T14:00","fin":"2026-09-20T14:30","motivo":"Horario liberado"}
{"id":12,"paciente_id":4,"paciente_nombre":"Jorge Pineda","doctor_id":2,"doctor_nombre":"Andrés Castillo","doctor_especialidad":"Pediatría","inicio":"2026-09-20T14:00:00","fin":"2026-09-20T14:30:00","motivo":"Horario liberado","estado":"pendiente","transiciones_permitidas":["confirmada","cancelada"]}
HTTP 201

```
