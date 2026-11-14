#include <Arduino.h>
#include <WiFi.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <PubSubClient.h>
#include <SPIFFS.h>
#include <ArduinoJson.h>
#include <time.h>
#include <Preferences.h>
#include <WiFiManager.h>
#include <WiFiClientSecure.h>
#include "config.h"
#include "secrets.h"

const int oneWireBus = 4;
OneWire oneWire(oneWireBus);
DallasTemperature sensors(&oneWire);

// Produção usa TLS (EMQX Cloud Serverless); o Mosquitto local do docker-compose, não
#if MQTT_USE_TLS
WiFiClientSecure netClient;
#else
WiFiClient netClient;
#endif
PubSubClient client(netClient);

// Wi-Fi e chave vêm do portal de configuração. O Wi-Fi fica na NVS do próprio ESP32
// (WiFiManager); a chave, no namespace "coldchain" das Preferences.
Preferences prefs;
WiFiManager wm;
String deviceKey;
String nomePortal;      // ColdChain-<3 últimos bytes do MAC>
String htmlMac;         // Mostrado no portal para conferir com o cadastro
bool portalAtivo = false;
unsigned long inicioPortal = 0;
unsigned long botaoPressionadoDesde = 0;
bool reiniciarAgendado = false;
unsigned long reiniciarEm = 0;

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

// ---------------------------------------------------------
// CONFIGURAÇÃO: chave da placa e portal
// ---------------------------------------------------------
bool chaveValida(const String& chave) {
  return chave.startsWith(DEVICE_KEY_PREFIXO) && chave.length() == DEVICE_KEY_TAMANHO;
}

void carregarChave() {
  prefs.begin("coldchain", true);
  deviceKey = prefs.getString("key", "");
  prefs.end();
}

void salvarChave(const String& chave) {
  prefs.begin("coldchain", false);
  prefs.putString("key", chave);
  prefs.end();
  deviceKey = chave;
}

// O campo fica vazio: a chave atual não é mostrada a quem abrir o portal.
// Com uma chave já gravada, deixar em branco mantém a atual.
WiFiManagerParameter* campoChave = nullptr;
WiFiManagerParameter* campoMac = nullptr;

void aoSalvarPortal() {
  String nova = String(campoChave->getValue());
  nova.trim();

  if (nova.length() == 0) {
    Serial.println("[CONFIG] Chave mantida.");
  } else if (chaveValida(nova)) {
    salvarChave(nova);
    Serial.println("[CONFIG] Chave da placa gravada.");
  } else {
    Serial.println("[CONFIG] Chave invalida ignorada: copie a chave completa do painel (ck_...).");
  }

  // Reinicia com a configuração nova. As leituras offline estão no SPIFFS e não se perdem.
  reiniciarAgendado = true;
  reiniciarEm = millis() + 3000;
}

void prepararPortal() {
  bool temChave = chaveValida(deviceKey);

  // Validação no navegador: formato da API (ck_ + 32 caracteres base64url)
  static const char* atributosObrigatorio = "pattern='ck_[A-Za-z0-9_\\-]{32}' required placeholder='ck_...'";
  static const char* atributosOpcional = "pattern='ck_[A-Za-z0-9_\\-]{32}' placeholder='em branco: manter a atual'";

  htmlMac = "<p>MAC da placa: <b>" + macAddress + "</b><br>Confira com o cadastro no painel.</p>";
  campoMac = new WiFiManagerParameter(htmlMac.c_str());
  campoChave = new WiFiManagerParameter(
    "device_key",
    temChave ? "Nova chave da placa" : "Chave da placa (copie do painel)",
    "",
    DEVICE_KEY_TAMANHO + 1,
    temChave ? atributosOpcional : atributosObrigatorio
  );

  wm.addParameter(campoMac);
  wm.addParameter(campoChave);
  wm.setTitle("ColdChain");
  // Sem a página "update" (envio de firmware pelo portal) nem "info"
  std::vector<const char*> menu = {"wifi", "param", "exit"};
  wm.setMenu(menu);
  wm.setSaveParamsCallback(aoSalvarPortal);
  wm.setSaveConfigCallback(aoSalvarPortal);
  wm.setBreakAfterConfig(true);
}

// Primeira instalação (sem Wi-Fi ou sem chave): bloqueia até o técnico configurar.
// As leituras ainda não têm para onde ir, e a placa reinicia ao salvar.
void portalObrigatorio() {
  Serial.print("[CONFIG] Placa sem configuracao. Conecte-se na rede ");
  Serial.println(nomePortal);

  wm.setConfigPortalBlocking(true);
  wm.setConfigPortalTimeout(0);
  wm.startConfigPortal(nomePortal.c_str(), PORTAL_PASSWORD);

  delay(1000);
  ESP.restart();
}

// Botão BOOT segurado com a placa ligada: portal sem bloquear, as leituras continuam
// (gravadas offline se o Wi-Fi cair) e o portal fecha sozinho depois de PORTAL_TIMEOUT_S.
void abrirPortalSobDemanda() {
  if (portalAtivo) return;

  Serial.print("[CONFIG] Portal aberto: conecte-se na rede ");
  Serial.println(nomePortal);

  wm.setConfigPortalBlocking(false);
  wm.setConfigPortalTimeout(PORTAL_TIMEOUT_S);
  wm.startConfigPortal(nomePortal.c_str(), PORTAL_PASSWORD);
  portalAtivo = true;
  inicioPortal = millis();
}

void atenderPortal() {
  if (!portalAtivo) return;

  wm.process();

  if (millis() - inicioPortal > (unsigned long)PORTAL_TIMEOUT_S * 1000UL) {
    wm.stopConfigPortal();
    portalAtivo = false;
    Serial.println("[CONFIG] Portal fechado por tempo. Configuracao mantida.");
    WiFi.mode(WIFI_STA);
    WiFi.begin();
  }
}

void verificarBotaoConfig() {
  if (digitalRead(BOTAO_CONFIG_PINO) == LOW) {
    if (botaoPressionadoDesde == 0) {
      botaoPressionadoDesde = millis();
    } else if (millis() - botaoPressionadoDesde > BOTAO_CONFIG_MS) {
      botaoPressionadoDesde = 0;
      abrirPortalSobDemanda();
    }
  } else {
    botaoPressionadoDesde = 0;
  }
}

void setup_wifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);

  macAddress = WiFi.macAddress();
  topicoTempoReal = "coldchain/devices/" + macAddress + "/realtime";
  topicoHistorico = "coldchain/devices/" + macAddress + "/historical";

  // Últimos 3 bytes do MAC, sem os dois-pontos: ColdChain-A1B2C3
  String sufixo = macAddress.substring(9);
  sufixo.replace(":", "");
  nomePortal = String(PORTAL_PREFIXO) + sufixo;

  Serial.print("MAC da placa: ");
  Serial.println(macAddress);

  carregarChave();
  prepararPortal();

  if (!wm.getWiFiIsSaved() || !chaveValida(deviceKey)) {
    portalObrigatorio();
  }

  // Rede gravada pelo portal; reconecta sozinho se cair
  Serial.println("Conectando ao Wi-Fi gravado...");
  WiFi.begin();
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
  doc["key"] = deviceKey;
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
  doc["key"] = deviceKey;
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
  pinMode(BOTAO_CONFIG_PINO, INPUT_PULLUP);

  setup_wifi();
  configTime(0, 0, "pool.ntp.org", "time.google.com"); // UTC

#if MQTT_USE_TLS
  // Só aceita o broker com certificado emitido pelas raízes de CA_RAIZES (config.h)
  netClient.setCACert(CA_RAIZES);
#endif
  client.setServer(MQTT_HOST, MQTT_PORT);
  client.setBufferSize(TAMANHO_BUFFER_MQTT); // O padrão (256 bytes) não comporta um lote
  sensors.begin();
}

// O TLS confere a validade do certificado: com o relógio em 1970, ele parece inválido.
// Até o NTP responder, as leituras vão para o store, como em qualquer queda.
bool podeConectarBroker() {
  if (WiFi.status() != WL_CONNECTED) return false;
#if MQTT_USE_TLS
  return relogioValido();
#else
  return true;
#endif
}

void loop() {
  verificarBotaoConfig();
  atenderPortal();

  if (reiniciarAgendado && (long)(millis() - reiniciarEm) >= 0) {
    ESP.restart();
  }

  if (!client.connected()) {
    unsigned long now = millis();
    if (now - lastReconnectAttempt > 5000) {
      lastReconnectAttempt = now;
      if (podeConectarBroker()) {
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
