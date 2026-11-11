#!/bin/sh
# Gera a senha e as permissões a cada início, a partir das variáveis do docker-compose
set -e

: "${MQTT_USERNAME:?Defina MQTT_USERNAME no .env}"
: "${MQTT_PASSWORD:?Defina MQTT_PASSWORD no .env}"
: "${MQTT_DEVICE_USERNAME:?Defina MQTT_DEVICE_USERNAME no .env}"
: "${MQTT_DEVICE_PASSWORD:?Defina MQTT_DEVICE_PASSWORD no .env}"

DATA=/mosquitto/data
rm -f "$DATA/passwd"
mosquitto_passwd -c -b "$DATA/passwd" "$MQTT_USERNAME" "$MQTT_PASSWORD"
mosquitto_passwd -b "$DATA/passwd" "$MQTT_DEVICE_USERNAME" "$MQTT_DEVICE_PASSWORD"

# A API só lê; as placas só publicam. A chave no payload identifica cada placa.
cat > "$DATA/acl" <<ACL
user $MQTT_USERNAME
topic read coldchain/devices/#

user $MQTT_DEVICE_USERNAME
topic write coldchain/devices/#
ACL

chown mosquitto:mosquitto "$DATA/passwd" "$DATA/acl"
chmod 0700 "$DATA/passwd" "$DATA/acl"

exec mosquitto -c /mosquitto/config/mosquitto.conf
