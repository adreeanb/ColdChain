# Firmware ESP32

Firmware da placa de monitoramento: um ESP32 (DOIT DevKit V1) com sensor de temperatura DS18B20 que publica as leituras via MQTT no broker da API (`../api`).

## Funcionamento

- Lê o DS18B20 (pino 4) a cada 5 segundos e ignora leituras inválidas (`-127` sensor desconectado, `85` falha de conversão).
- **Online**: publica cada leitura em `coldchain/devices/<MAC>/realtime`:
  ```json
  { "key": "ck_...", "temperatura": 4.2, "timestamp": "2026-11-11T12:00:00Z" }
  ```
  Sem relógio sincronizado (NTP), o `timestamp` é omitido e a API usa a hora de chegada.
- **Offline (store)**: grava a leitura em `/offline_v2.jsonl` na flash (SPIFFS), até cerca de 1 MB (~20 h de leituras).
- **Reconexão (forward)**: reenvia o arquivo em lotes de 20 leituras para `coldchain/devices/<MAC>/historical`, um lote a cada 200 ms, intercalado com as leituras ao vivo:
  ```json
  { "key": "ck_...", "leituras": [{ "temperatura": 4.2, "timestamp": "..." }] }
  ```
  Leituras repetidas (ex.: reenvio após um reboot) são ignoradas pela API.

A placa é identificada pelo MAC, que vai no tópico e no QR Code, e se autentica com a chave `DEVICE_KEY`, gerada no cadastro da placa no painel.

## Configuração

1. Copie `include/secrets.example.h` para `include/secrets.h` (ignorado pelo git) e preencha:
   - `WIFI_SSID` / `WIFI_PASSWORD`: rede Wi-Fi;
   - `MQTT_HOST` / `MQTT_PORT`: IP do computador que roda o `docker compose` da API e a porta do Mosquitto (1883);
   - `MQTT_USER` / `MQTT_PASSWORD`: os valores de `MQTT_DEVICE_USERNAME` / `MQTT_DEVICE_PASSWORD` do `.env` da API;
   - `DEVICE_KEY`: a chave mostrada uma única vez ao cadastrar a placa (ou em "Gerar nova chave" na página da placa).
2. Abra a pasta `firmware/` no VS Code com a extensão PlatformIO.

## Comandos

```bash
pio run                      # compila
pio run -t upload            # grava na placa
pio device monitor           # monitor serial (115200)
```
