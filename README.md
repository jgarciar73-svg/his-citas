# HIS: módulo de control de citas médicas

Módulo del Sistema Hospitalario Integrado (HIS) para agendar, reprogramar y cancelar citas médicas desde un calendario interactivo (FullCalendar). Lo respalda una API REST propia hecha con Node.js y Express, y una base de datos MySQL que corre en un contenedor Docker.

El trabajo se entrega por ramas de feature. Cada una se cierra con un Pull Request hacia `main` y su merge queda registrado en el historial.

## Base de datos

MySQL corre solo en Docker. Para levantarla:

```
cp .env.example .env
docker compose up -d
```

La primera vez se crean las tablas y los datos de ejemplo desde `db/init`. Esos scripts solo se ejecutan con el volumen vacío. Si cambias el esquema y quieres empezar de cero, borra el volumen con `docker compose down -v` y vuelve a levantar.

Si el puerto 3306 ya está ocupado en tu máquina, cambia `MYSQL_PORT` en `.env` (por ejemplo a 3307) y usa el mismo valor cuando arranques la API.

## API

Se arranca con Node.js 18 o superior, después de levantar la base de datos:

```
npm install
npm start
```

Endpoints (todos responden JSON):

- `GET /api/citas` con filtros opcionales `doctor_id`, `paciente_id`, `desde`, `hasta`
- `POST /api/citas`
- `GET /api/citas/:id`
- `PUT /api/citas/:id`
- `PATCH /api/citas/:id/estado`
- `GET /api/doctores`
- `GET /api/pacientes`

Códigos de respuesta: 200 y 201 cuando todo sale bien, 400 por datos inválidos y 404 cuando el recurso no existe. Un JSON o un cuerpo mal formado también da 400. Si un `paciente_id` o `doctor_id` del cuerpo no existe, la respuesta es 400 (es un dato inválido de la petición), mientras que 404 se reserva para cuando el recurso de la URL no existe.

Las fechas se envían como hora local sin zona, por ejemplo `2026-10-05T09:00`.

## Reglas de negocio

La validación vive en la capa de servicios de la API. El calendario no decide nada por su cuenta, solo muestra lo que responde el servidor.

Doble reserva: un doctor no puede tener dos citas activas (pendiente o confirmada) que se solapen. Si pasa, la API responde 409 con la cita en conflicto. Una cita que empieza justo cuando termina otra no choca. Las canceladas y atendidas no ocupan horario.

Estados de una cita:

- pendiente puede pasar a confirmada o cancelada
- confirmada puede pasar a atendida o cancelada
- cancelada y atendida son finales: no cambian de estado ni se reprograman (400)

Cancelar solo cambia el estado a `cancelada`. La API no borra citas, así se conserva el histórico.

Cada cita trae `transiciones_permitidas` con los estados a los que puede pasar ahora.

## Interfaz

Con la base de datos y la API en marcha, abre http://localhost:3000.

- Clic o arrastre sobre un espacio vacío: abre el panel para crear una cita.
- Clic sobre una cita: muestra su detalle y los botones para confirmar, marcar como atendida o cancelar.
- Arrastrar una cita, o estirarla desde el borde inferior: la reprograma. Si el doctor ya tiene otra cita en ese horario, la cita vuelve a su lugar y aparece el motivo.
- El panel izquierdo filtra por doctor y por rango de fechas.

Colores: amarillo pendiente, verde confirmada, rojo cancelada, azul atendida. Las citas canceladas y atendidas no se pueden arrastrar.

FullCalendar 6 y la fuente Atkinson Hyperlegible se sirven desde `node_modules`, por lo que la interfaz no necesita internet.
