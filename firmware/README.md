# Firmware ESP32

Firmware da placa de monitoramento: um ESP32 (DOIT DevKit V1) com sensor de temperatura DS18B20 que publica as leituras por MQTT. Em produção o broker é a EMQX Cloud Serverless, com TLS. No desenvolvimento, o Mosquitto do `docker-compose` da API (`../api`).

**Um único binário serve para todas as placas.** O que é igual para todas é compilado. O que muda por local ou por placa é informado em campo, pelo celular:

| Onde fica | O quê | Muda |
|---|---|---|
| `include/config.h` (versionado) | Certificados raiz da autoridade que assina o broker, nome e tempo do portal, formato da chave | Só se o broker trocar de autoridade certificadora |
| `include/secrets.h` (fora do git) | Host, porta e TLS do broker, conta das placas no broker, senha do portal | Por ambiente (produção ou local) |
| NVS, pelo portal de configuração | Wi-Fi e chave da placa | Por local (Wi-Fi) e por placa (chave) |

## Funcionamento

- Lê o DS18B20 (pino 4) a cada 5 segundos e ignora leituras inválidas (`-127` sensor desconectado, `85` falha de conversão).
- **Online**: publica cada leitura em `coldchain/devices/<MAC>/realtime`:
  ```json
  { "key": "ck_...", "temperatura": 4.2, "timestamp": "2026-11-11T12:00:00Z" }
  ```
  Sem relógio sincronizado (NTP), o `timestamp` é omitido e a API usa a hora de chegada.
- **TLS**: com `MQTT_USE_TLS 1`, a conexão com o broker é criptografada e a placa só aceita um certificado emitido pelas raízes de `CA_RAIZES` (`config.h`). Como o TLS confere a validade do certificado, a placa só conecta depois que o NTP acerta o relógio. Até lá, as leituras vão para a flash.
- **Offline (store)**: sem Wi-Fi, broker ou relógio, grava a leitura em `/offline_v2.jsonl` na flash (SPIFFS), até cerca de 1 MB (~20 h de leituras).
- **Reconexão (forward)**: reenvia o arquivo em lotes de 20 leituras para `coldchain/devices/<MAC>/historical`, um lote a cada 200 ms, intercalado com as leituras ao vivo:
  ```json
  { "key": "ck_...", "leituras": [{ "temperatura": 4.2, "timestamp": "..." }] }
  ```
  Leituras repetidas (ex.: reenvio após um reboot) são ignoradas pela API.

A placa é identificada pelo MAC, que vai no tópico e no QR Code, e se autentica com a chave da placa, gerada no cadastro no painel.

## Gravação (uma vez, igual para todas as placas)

1. Copie `include/secrets.example.h` para `include/secrets.h` (ignorado pelo git) e preencha:
   - `MQTT_HOST` / `MQTT_PORT` / `MQTT_USE_TLS`: em produção, o endereço do deployment da EMQX, porta `8883` e TLS `1`. No desenvolvimento, o IP do computador que roda o `docker compose`, porta `1883` e TLS `0`;
   - `MQTT_USER` / `MQTT_PASSWORD`: a credencial das placas no broker (na EMQX, o usuário `coldchain-device`, só com permissão de publicar; localmente, `MQTT_DEVICE_USERNAME` / `MQTT_DEVICE_PASSWORD` do `.env` da API);
   - `PORTAL_PASSWORD`: senha da rede de configuração aberta pela placa, com pelo menos 8 caracteres.
2. Abra a pasta `firmware/` no VS Code com a extensão PlatformIO e grave (`pio run -t upload`).

## Instalação em campo (por placa)

1. **No painel**, o MASTER cadastra a placa pelo MAC. A chave `ck_...` aparece uma única vez: copie-a no celular.
2. **Ligue a placa.** Sem configuração, ela abre a rede Wi-Fi **`ColdChain-XXXXXX`** (os 6 últimos dígitos do MAC).
3. **Conecte o celular** nessa rede com a `PORTAL_PASSWORD`. A página de configuração abre sozinha; se não abrir, acesse `http://192.168.4.1`.
4. Em **Configure WiFi**, escolha a rede do local, digite a senha e cole a chave no campo **Chave da placa**. Confira o MAC mostrado na página com o do cadastro.
5. Salve. A placa reinicia, conecta no Wi-Fi e no broker, e passa a aparecer no painel.
6. **Escaneie o QR Code** da placa no painel para vinculá-la à unidade fria.

## Reconfigurar (trocar Wi-Fi ou chave)

Com a placa ligada, **segure o botão BOOT por 5 segundos**. A rede `ColdChain-XXXXXX` abre de novo por até 5 minutos, enquanto as leituras continuam. No portal:
- **Configure WiFi** troca a rede (o campo da chave pode ficar em branco para manter a atual);
- **Setup** troca só a chave, por exemplo depois de "Gerar nova chave" no painel.

A chave atual nunca é mostrada no portal. Se ninguém salvar nada, o portal fecha sozinho e a placa segue com a configuração que tinha.

Não segure o BOOT enquanto liga a placa: isso coloca o ESP32 em modo de gravação de firmware.

## Comandos

```bash
pio run                      # compila
pio run -t upload            # grava na placa
pio run -t erase             # apaga a flash inteira (Wi-Fi, chave e leituras offline)
pio device monitor           # monitor serial (115200)
```

## Mensagens do monitor serial

| Mensagem | Significado |
|---|---|
| `[CONFIG] Placa sem configuracao...` | Portal aberto esperando Wi-Fi e chave |
| `[CONFIG] Chave invalida ignorada` | A chave colada não tem o formato `ck_` + 32 caracteres |
| `[Falha] Erro: 4` | Usuário ou senha do broker errados (`MQTT_USER` / `MQTT_PASSWORD`) |
| `[Falha] Erro: -2` | Sem conexão com o broker: host, porta ou TLS (com TLS, relógio ou certificado) |
| `[STORE] Dado salvo no chip` | Sem conexão: leitura guardada para envio posterior |
