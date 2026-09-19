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
