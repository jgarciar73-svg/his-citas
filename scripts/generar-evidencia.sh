#!/usr/bin/env bash
# Genera EVIDENCIA.md con la salida real de los comandos: docker, API y git.
#
# Uso, con la base de datos y la API ya levantadas (docker compose up -d y npm start):
#   bash scripts/generar-evidencia.sh
#
# Variables opcionales:
#   API_URL     dirección de la API (por defecto http://localhost:3000)
#   SIN_DOCKER  si vale 1, omite las secciones de Docker (para máquinas sin Docker)

BASE="${API_URL:-http://localhost:3000}"
SALIDA="EVIDENCIA.md"
SIN_DOCKER="${SIN_DOCKER:-0}"
J='Content-Type: application/json'

abrir()  { echo '```'; }
cerrar() { echo '```'; echo; }

# Ejecuta un comando, lo muestra con "$" y luego su salida.
ejecutar() {
  echo "\$ $*"
  "$@" 2>&1
  echo
}

# Llama a la API y muestra el comando, el cuerpo de la respuesta y el código HTTP.
llamar() {
  local metodo="$1" ruta="$2" cuerpo="${3:-}"
  if [ -n "$cuerpo" ]; then
    echo "\$ curl -X $metodo $BASE$ruta -H '$J' -d '$cuerpo'"
    RESP=$(curl -s -w '\nHTTP %{http_code}' -X "$metodo" "$BASE$ruta" -H "$J" -d "$cuerpo")
  else
    echo "\$ curl -X $metodo $BASE$ruta"
    RESP=$(curl -s -w '\nHTTP %{http_code}' -X "$metodo" "$BASE$ruta")
  fi
  echo "$RESP"
  echo
}

esperar_mysql() {
  for _ in $(seq 1 40); do
    estado=$(docker inspect --format '{{.State.Health.Status}}' his-citas-mysql 2>/dev/null)
    [ "$estado" = "healthy" ] && return 0
    sleep 3
  done
  return 1
}

contar_citas() {
  curl -s "$BASE/api/citas" | grep -o '"id":[0-9]*' | wc -l | tr -d ' '
}

FECHA=$(date -d "+60 days" +%F 2>/dev/null || date -v+60d +%F)

{
echo "# Evidencia del módulo de control de citas"
echo
echo "Generado el $(date '+%Y-%m-%d %H:%M') con \`scripts/generar-evidencia.sh\`."
echo

# ---------------- 1. Docker ----------------
echo "## 1. MySQL en Docker"
echo
if [ "$SIN_DOCKER" = "1" ]; then
  echo "Sección pendiente: esta versión se generó en una máquina sin Docker. Ejecuta el script en un equipo con Docker para completarla."
  echo
  echo "## 2. Persistencia de los datos"
  echo
  echo "Sección pendiente, por la misma razón."
  echo
else
  abrir
  ejecutar docker compose up -d
  ejecutar docker ps
  ejecutar docker inspect --format 'Estado de salud: {{.State.Health.Status}}' his-citas-mysql
  ejecutar docker volume ls --filter name=his_citas_mysql_data
  cerrar

  echo "## 2. Persistencia de los datos"
  echo
  echo "Se cuentan las citas, se baja el contenedor (sin borrar el volumen), se vuelve a subir y se cuentan de nuevo."
  echo
  abrir
  echo "Citas antes de bajar el contenedor: $(contar_citas)"
  ejecutar docker compose down
  ejecutar docker compose up -d
  esperar_mysql
  sleep 5
  echo "Citas después de volver a subirlo: $(contar_citas)"
  echo
  cerrar
fi

# ---------------- 2. API ----------------
echo "## 3. Respuestas de la API"
echo
echo "Se crea una cita el $FECHA para el doctor 1, se prueba cada código de respuesta y al final se cancela para dejar libre el horario."
echo
abrir
llamar GET /api/doctores
llamar GET /api/pacientes
llamar POST /api/citas "{\"paciente_id\":1,\"doctor_id\":1,\"inicio\":\"${FECHA}T10:00\",\"fin\":\"${FECHA}T10:30\",\"motivo\":\"Cita de evidencia\"}"
ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
llamar GET "/api/citas/$ID"
llamar GET "/api/citas?doctor_id=1&desde=$FECHA&hasta=$FECHA"
echo "# 409: choque de horario con el mismo doctor"
llamar POST /api/citas "{\"paciente_id\":2,\"doctor_id\":1,\"inicio\":\"${FECHA}T10:15\",\"fin\":\"${FECHA}T10:45\",\"motivo\":\"Debe chocar\"}"
echo "# Mismo horario con otro doctor: se permite"
llamar POST /api/citas "{\"paciente_id\":2,\"doctor_id\":2,\"inicio\":\"${FECHA}T10:00\",\"fin\":\"${FECHA}T10:30\",\"motivo\":\"Otro doctor\"}"
ID2=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "# 400: datos inválidos"
llamar POST /api/citas "{\"paciente_id\":1,\"doctor_id\":1,\"inicio\":\"${FECHA}T11:00\",\"fin\":\"${FECHA}T10:00\"}"
echo "# 400: paciente que no existe"
llamar POST /api/citas "{\"paciente_id\":9999,\"doctor_id\":1,\"inicio\":\"${FECHA}T12:00\",\"fin\":\"${FECHA}T12:30\",\"motivo\":\"Paciente inexistente\"}"
echo "# 404: cita que no existe"
llamar GET /api/citas/999999
echo "# Reprogramar (PUT)"
llamar PUT "/api/citas/$ID" "{\"inicio\":\"${FECHA}T14:00\",\"fin\":\"${FECHA}T14:30\"}"
echo "# 400: pendiente no puede pasar directo a atendida"
llamar PATCH "/api/citas/$ID/estado" '{"estado":"atendida"}'
echo "# Cambios de estado (PATCH)"
llamar PATCH "/api/citas/$ID/estado" '{"estado":"confirmada"}'
llamar PATCH "/api/citas/$ID/estado" '{"estado":"cancelada"}'
echo "# 400: una cita cancelada ya no cambia"
llamar PATCH "/api/citas/$ID/estado" '{"estado":"confirmada"}'
echo "# El registro cancelado sigue existiendo (no se borra)"
llamar GET "/api/citas/$ID"
llamar PATCH "/api/citas/$ID2/estado" '{"estado":"cancelada"}'
cerrar

# ---------------- 3. Git ----------------
echo "## 4. Historial de Git"
echo
abrir
ejecutar git branch -a
ejecutar git log --graph --all --oneline
ejecutar git log main --merges --oneline
cerrar

# ---------------- 4. Capturas ----------------
echo "## 5. Capturas de la interfaz"
echo
for imagen in docs/capturas/*.png; do
  nombre=$(basename "$imagen" .png)
  echo "![${nombre#*-}]($imagen)"
  echo
done
} > "$SALIDA"

echo "Listo: se generó $SALIDA"
