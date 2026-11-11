#include <Arduino.h>
#include <WiFi.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <PubSubClient.h>
#include <SPIFFS.h>
#include <ArduinoJson.h>
#include <time.h>

// Wi-Fi, broker e chave da placa ficam fora do código (copie secrets.example.h para secrets.h)
#include "secrets.h"

const int oneWireBus = 4;
OneWire oneWire(oneWireBus);
DallasTemperature sensors(&oneWire);

WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastMsg = 0;
unsigned long lastReconnectAttempt = 0;
unsigned long ultimoLote = 0;

const char* ARQUIVO_OFFLINE = "/offline_v2.jsonl";

// Cerca de 14 mil leituras (quase 20 h a cada 5 s). Acima disso a partição SPIFFS enche.
const size_t LIMITE_ARQUIVO = 1000000;

// Leituras por mensagem no forward: cerca de 1,2 KB, dentro do buffer configurado no setup
const int LEITURAS_POR_LOTE = 20;
const int TAMANHO_BUFFER_MQTT = 2048;
const unsigned long INTERVALO_LOTES_MS = 200;

// Qualquer data anterior a esta indica que o NTP ainda não sincronizou (nov/2023)
const time_t EPOCH_MINIMO = 1700000000;

String macAddress;       // Identifica a placa no backend: vai no cadastro, no QR Code e no tópico
String topicoTempoReal;  // coldchain/devices/<MAC>/realtime
String topicoHistorico;  // coldchain/devices/<MAC>/historical
uint32_t bootId;         // Muda a cada boot: o millis() de um boot não vale em outro

// Forward incremental: um lote por vez, sem travar o loop. O arquivo só cresce no fim,
// então a posição continua válida se a rede cair no meio. Depois de um reboot o envio
// recomeça do início, e o backend ignora as leituras repetidas.
size_t posicaoForward = 0;
bool temPendencias = false;

void setup_wifi() {
  Serial.print("\nConectando ao Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  macAddress = WiFi.macAddress();
  topicoTempoReal = "coldchain/devices/" + macAddress + "/realtime";
  topicoHistorico = "coldchain/devices/" + macAddress + "/historical";

  Serial.print("MAC da placa: ");
  Serial.println(macAddress);
}

bool relogioValido() {
  return time(nullptr) > EPOCH_MINIMO;
}

// O DS18B20 retorna -127 quando desconectado e 85 quando a conversão falha
bool leituraValida(float temperatura) {
  return temperatura != DEVICE_DISCONNECTED_C && temperatura != 85.0;
}

void formatarTimestamp(time_t epoch, char* destino, size_t tamanho) {
  struct tm utc;
  gmtime_r(&epoch, &utc);
  strftime(destino, tamanho, "%Y-%m-%dT%H:%M:%SZ", &utc);
}

// Formato lido pelo backend: { "key", "temperatura", "timestamp" }. Sem data, o timestamp
// não é enviado e o backend usa a hora de chegada.
bool publicarTempoReal(float temperatura, time_t epoch) {
  StaticJsonDocument<256> doc;
  doc["key"] = DEVICE_KEY;
  doc["temperatura"] = temperatura;

  char timestamp[25];
  if (epoch > 0) {
    formatarTimestamp(epoch, timestamp, sizeof(timestamp));
    doc["timestamp"] = timestamp;
  }

  char payload[256];
  serializeJson(doc, payload, sizeof(payload));

  return client.publish(topicoTempoReal.c_str(), payload);
}

void reconnect() {
  Serial.print("Tentando conexao MQTT... ");
  // clientId estável: o broker reconhece a mesma placa a cada reconexão
  String clientId = "coldchain-" + macAddress;

  if (client.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD)) {
    Serial.println("[Conectado ao Broker!]");
  } else {
    // 4 = usuário ou senha do broker errados (MQTT_USER / MQTT_PASSWORD)
    Serial.print("[Falha] Erro: ");
    Serial.println(client.state());
  }
}

// ---------------------------------------------------------
// 1: STORE
// ---------------------------------------------------------
void salvarDadoOffline(float temperatura) {
  File file = SPIFFS.open(ARQUIVO_OFFLINE, FILE_APPEND);
  if (!file) {
    Serial.println("Erro critico ao abrir SPIFFS");
    return;
  }

  if (file.size() >= LIMITE_ARQUIVO) {
    file.close();
    Serial.println("[STORE] Memoria cheia: leitura descartada");
    return;
  }

  // Sem relógio (epoch 0), o millis e o boot permitem calcular a data no envio
  StaticJsonDocument<200> doc;
  doc["temperatura"] = temperatura;
  doc["epoch"] = relogioValido() ? (long)time(nullptr) : 0L;
  doc["uptime"] = millis();
  doc["boot"] = bootId;

  String linhaJson;
  serializeJson(doc, linhaJson);

  file.println(linhaJson);
  file.close();
  temPendencias = true;

  Serial.print("[STORE] Dado salvo no chip: ");
  Serial.println(linhaJson);
}

// ---------------------------------------------------------
// 2: FORWARD
// ---------------------------------------------------------

// Retorna 0 quando a leitura foi gravada sem relógio em um boot anterior: não há como saber a data
time_t resolverEpoch(JsonDocument& doc) {
  time_t epoch = doc["epoch"] | 0L;
  if (epoch > 0) return epoch;

  if (doc["boot"].as<uint32_t>() != bootId) return 0;

  unsigned long decorridoMs = millis() - doc["uptime"].as<unsigned long>();
  return time(nullptr) - (time_t)(decorridoMs / 1000);
}

void encerrarForward() {
  SPIFFS.remove(ARQUIVO_OFFLINE);
  posicaoForward = 0;
  temPendencias = false;
  Serial.println("[FORWARD] Todos os dados sincronizados. Memoria local limpa.");
}

// Envia o próximo lote do arquivo em uma única mensagem:
// { "key", "leituras": [{ "temperatura", "timestamp" }, ...] }
void enviarProximoLote() {
  File file = SPIFFS.open(ARQUIVO_OFFLINE, FILE_READ);
  if (!file) {
    temPendencias = false;
    return;
  }

  if (posicaoForward >= file.size()) {
    file.close();
    encerrarForward();
    return;
  }

  file.seek(posicaoForward);

  DynamicJsonDocument doc(3072);
  doc["key"] = DEVICE_KEY;
  JsonArray leituras = doc.createNestedArray("leituras");
  size_t proximaPosicao = posicaoForward;

  while (file.available() && leituras.size() < LEITURAS_POR_LOTE) {
    String linha = file.readStringUntil('\n');
    proximaPosicao = file.position();
    linha.trim();

    if (linha.length() == 0) continue;

    StaticJsonDocument<200> item;
    if (deserializeJson(item, linha)) {
      Serial.print(" -> Linha invalida descartada: ");
      Serial.println(linha);
      continue;
    }

    // Sem data confiável, a hora de chegada colocaria a leitura no momento errado
    time_t epoch = resolverEpoch(item);
    if (epoch == 0) {
      Serial.print(" -> Leitura sem data descartada: ");
      Serial.println(linha);
      continue;
    }

    char timestamp[25];
    formatarTimestamp(epoch, timestamp, sizeof(timestamp));

    JsonObject leitura = leituras.createNestedObject();
    leitura["temperatura"] = item["temperatura"].as<float>();
    leitura["timestamp"] = timestamp;  // char[] é copiado pelo ArduinoJson
  }
  file.close();

  if (leituras.size() > 0) {
    char payload[TAMANHO_BUFFER_MQTT - 128];
    size_t tamanho = serializeJson(doc, payload, sizeof(payload));

    if (tamanho == 0 || tamanho >= sizeof(payload) - 1) {
      Serial.println("[FORWARD] Lote maior que o buffer: reduza LEITURAS_POR_LOTE");
      return;
    }

    // Falhou: a posição não avança e o mesmo lote é tentado de novo depois
    if (!client.publish(topicoHistorico.c_str(), payload)) {
      Serial.println("[FORWARD] Erro ao publicar lote. Tentara novamente.");
      return;
    }

    Serial.print("[FORWARD] Lote enviado: ");
    Serial.print(leituras.size());
    Serial.println(" leitura(s)");
  }

  posicaoForward = proximaPosicao;
}

void setup() {
  Serial.begin(115200);

  if(!SPIFFS.begin(true)){
    Serial.println("Erro ao montar SPIFFS");
    return;
  }
  Serial.println("Memoria Flash (SPIFFS) Pronta!");

  // O formato antigo usava millis() como data e não tem como ser aproveitado
  if (SPIFFS.exists("/dados_offline.json")) {
    SPIFFS.remove("/dados_offline.json");
    Serial.println("Arquivo offline antigo removido.");
  }

  // Leituras de antes do reboot continuam pendentes
  temPendencias = SPIFFS.exists(ARQUIVO_OFFLINE);

  bootId = esp_random();

  setup_wifi();
  configTime(0, 0, "pool.ntp.org", "time.google.com"); // UTC
  client.setServer(MQTT_HOST, MQTT_PORT);
  client.setBufferSize(TAMANHO_BUFFER_MQTT); // O padrão (256 bytes) não comporta um lote
  sensors.begin();
}

void loop() {

  if (!client.connected()) {
    unsigned long now = millis();
    if (now - lastReconnectAttempt > 5000) {
      lastReconnectAttempt = now;
      if (WiFi.status() == WL_CONNECTED) {
        reconnect();
      }
    }
  } else {
    client.loop();

    // Um lote por vez, intercalado com as leituras ao vivo. Espera o NTP para não
    // descartar leituras que ainda podem receber data.
    unsigned long now = millis();
    if (temPendencias && relogioValido() && now - ultimoLote > INTERVALO_LOTES_MS) {
      ultimoLote = now;
      enviarProximoLote();
    }
  }

  // Leitura do Sensor a cada 5 segundos
  unsigned long now = millis();
  if (now - lastMsg > 5000) {
    lastMsg = now;

    sensors.requestTemperatures();
    float temperatureC = sensors.getTempCByIndex(0);

    if (!leituraValida(temperatureC)) {
      Serial.print("[SENSOR] Leitura invalida ignorada: ");
      Serial.println(temperatureC);
    } else if (WiFi.status() == WL_CONNECTED && client.connected()) {
      Serial.print("Online: Publicando ao vivo... ");
      if(publicarTempoReal(temperatureC, relogioValido() ? time(nullptr) : 0)) {
          Serial.println("[Sucesso]");
      } else {
          Serial.println("[Falha]");
      }
    } else {
      salvarDadoOffline(temperatureC);
    }
  }
}
