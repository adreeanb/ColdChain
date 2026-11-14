// Copie para secrets.h (fica fora do git). Os valores são os mesmos para todas as placas:
// Wi-Fi e chave da placa NÃO ficam aqui, são informados no portal de configuração.
#pragma once

// Produção: deployment da EMQX Cloud Serverless, com TLS
#define MQTT_HOST "seu-deployment.regiao.emqxsl.com"
#define MQTT_PORT 8883
#define MQTT_USE_TLS 1

// Desenvolvimento com o Mosquitto do docker-compose (sem TLS, só na rede local):
// #define MQTT_HOST "192.168.0.10"   // IP do computador que roda o docker compose
// #define MQTT_PORT 1883
// #define MQTT_USE_TLS 0

// Conta das placas no broker (só publica). Local: MQTT_DEVICE_USERNAME / MQTT_DEVICE_PASSWORD do .env da API
#define MQTT_USER "coldchain-device"
#define MQTT_PASSWORD "troque-esta-senha-das-placas"

// Senha da rede ColdChain-XXXXXX aberta pela placa para configuração (mínimo de 8 caracteres)
#define PORTAL_PASSWORD "troque-esta-senha-do-portal"
