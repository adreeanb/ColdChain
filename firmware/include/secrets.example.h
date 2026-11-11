// Copie para secrets.h (fica fora do git) e preencha com os dados reais
#pragma once

#define WIFI_SSID "nome-da-rede"
#define WIFI_PASSWORD "senha-da-rede"

// Broker do docker-compose da API: IP do computador na rede local
#define MQTT_HOST "192.168.1.77"
#define MQTT_PORT 1883
// MQTT_DEVICE_USERNAME e MQTT_DEVICE_PASSWORD do .env da API
#define MQTT_USER "coldchain-device"
#define MQTT_PASSWORD "troque-esta-senha-das-placas"

// Mostrada uma única vez no cadastro da placa (ou em "Gerar nova chave" na página da placa)
#define DEVICE_KEY "ck_..."
