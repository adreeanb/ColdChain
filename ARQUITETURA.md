# ColdChain — Resumo do sistema e da arquitetura

## O que é

Sistema de monitoramento da cadeia fria. Placas ESP32 com sensor de temperatura ficam instaladas em câmaras frias, depósitos refrigerados e caminhões baú. Elas enviam as leituras para uma API, que guarda o histórico e gera alertas quando a temperatura sai dos limites da unidade. Uma aplicação web mostra o painel, os gráficos e os alertas.

O sistema atende várias empresas ao mesmo tempo, e cada usuário só enxerga os dados da própria empresa.

## Visão geral

```
 ┌──────────────┐  MQTT (tempo real e histórico)  ┌──────────────┐
 │ ESP32 +      │ ──────────────────────────────▶ │ Broker MQTT  │
 │ DS18B20      │                                 └──────┬───────┘
 └──────────────┘                                        │ assinatura
                                                         ▼
 ┌──────────────┐        HTTP + JWT (REST)        ┌──────────────┐    ┌──────────────┐
 │ ColdChain    │ ◀─────────────────────────────▶ │ ColdChain    │ ─▶ │ PostgreSQL   │
 │ Web (PWA)    │                                 │ API          │    │ 16           │
 └──────────────┘                                 └──────────────┘    └──────────────┘
```

São três partes:

| Parte | Repositório | Tecnologias |
|---|---|---|
| Firmware | `ColdChain_API/firmware/main.txt` | ESP32, DallasTemperature, PubSubClient, ArduinoJson, SPIFFS, NTP |
| API | `ColdChain_API` | Node.js, Express 5, Prisma 7, PostgreSQL 16, MQTT, JWT |
| Web | `ColdChain_Web` | React 19, Vite, Tailwind, shadcn/ui, TanStack Query, Recharts, PWA |

## Firmware (ESP32)

- Lê o sensor periodicamente e descarta leituras de erro do sensor (-127 °C e 85 °C).
- Identifica-se pelo **endereço MAC** da placa e assina cada mensagem com a **chave da placa**, gerada no cadastro: `{ key, temperatura, timestamp }`, com o horário em UTC obtido por NTP.
- Publica no tópico `coldchain/devices/<MAC>/realtime` quando está conectada, num broker Mosquitto próprio com usuário e senha.
- **Store-and-forward:** sem rede, grava as leituras na memória flash (SPIFFS). Quando a conexão volta, envia o histórico em lotes de 20 leituras por `coldchain/devices/<MAC>/historical`, sem travar as leituras ao vivo e preservando o horário original. Reenvios são ignorados pela API.
- Credenciais de Wi-Fi, broker e chave ficam em `secrets.h`, fora do código.

## API (backend)

### Camadas

```
rota (src/routes/index.ts) → middlewares → controller → service → Prisma → PostgreSQL
```

- **Controllers** leem a requisição e transformam erros em respostas HTTP.
- **Services** guardam a regra de negócio, uma classe por ação (`CreateColdUnitService`, `BindDeviceService`...).
- **Middlewares** de acesso: `isAuthenticated` (token JWT), `isAdmin` e `isMaster`.

### Perfis de acesso

| Perfil | Pode fazer |
|---|---|
| **OPERATOR** | Ver painel, unidades e gráficos; resolver alertas; vincular placas às unidades |
| **ADMIN** | Tudo do operador, mais gerenciar unidades e usuários da própria empresa |
| **MASTER** | Tudo, em qualquer empresa; único que cadastra empresas e placas |

### Modelo de dados

| Tabela | O que guarda |
|---|---|
| `Enterprise` | Empresa cliente |
| `User` | Usuário, com perfil e empresa |
| `ColdUnit` | Unidade refrigerada (câmara, depósito ou caminhão), com temperatura mínima e máxima |
| `ColdUnitDevice` | Placa ESP32, identificada pelo MAC e ligada a uma empresa |
| `AssociationHistory` | Histórico de qual placa esteve em qual unidade, e quando |
| `TemperatureReading` | Leituras oficiais, marcadas como tempo real ou histórico |
| `UnboundTelemetry` | Quarentena: leituras de placas sem unidade vinculada |
| `Alert` | Episódios de temperatura fora dos limites: um alerta por excursão, com pico, duração e número de leituras |

Empresas, usuários e unidades usam exclusão lógica: ao excluir, o registro é marcado como excluído e o histórico fica preservado.

### Caminho de uma leitura

1. A placa publica a leitura no MQTT (ou via `POST /telemetry/readings`).
2. A API descarta leituras de placas desconhecidas ou desativadas e recusa as que não trazem a chave correta da placa.
3. Procura em qual unidade a placa estava **no horário da leitura**, e não no horário de chegada. Isso mantém corretos os dados reenviados depois de uma queda de rede.
4. **Com unidade:** grava a leitura oficial e, se estiver fora dos limites, abre ou atualiza o episódio de alerta da unidade. Leituras seguidas fora da faixa formam um único alerta, e uma leitura repetida (mesma placa e horário) é ignorada.
5. **Sem unidade:** a leitura vai para a quarentena, que é apagada após algumas horas (2 por padrão).

### Vínculo de placas (QR Code)

O operador lê o QR Code da placa e escolhe a unidade. Se a placa tem leituras em quarentena, ele decide se elas são recuperadas para a unidade ou descartadas, por exemplo quando a placa mediu na bancada antes da instalação. Numa única transação, a API encerra o vínculo anterior, abre o novo e aplica a escolha. O vínculo começa na primeira leitura recuperada. Cada placa tem um vínculo ativo por vez, e uma unidade pode ter várias placas.

### Status no painel

Para cada unidade, o painel mostra:

- **Normal:** todas as placas estão dentro dos limites.
- **Fora da faixa:** alguma placa está fora dos limites. Tem prioridade sobre os demais status.
- **Sem sinal:** alguma placa não se comunica há mais de 10 minutos. Isso também abre um alerta de placa sem sinal, encerrado sozinho quando ela volta.
- **Sem placa:** a unidade não tem placa vinculada.

### Principais rotas

| Área | Rotas |
|---|---|
| Autenticação e perfil | `POST /login`, `GET/PUT /me`, `PUT /me/password` |
| Painel | `GET /dashboard/summary` |
| Empresas (MASTER) | `/enterprises` |
| Usuários (ADMIN) | `/users` |
| Unidades | `/cold-units`, `/cold-units/:id/readings`, `/cold-units/:id/readings/series` |
| Placas | `/devices`, `/devices/unbound`, `/devices/bind`, `/devices/:id/unbind`, `/devices/:id/deactivate` |
| Alertas | `GET /alerts`, `PATCH /alerts/:id/resolve` |
| Telemetria | `POST /telemetry/readings`, além do assinante MQTT |

## Web (frontend)

Aplicação React responsiva, instalável como PWA. Funciona no computador e no celular, onde a câmera lê o QR Code das placas.

### Organização

O código fica dividido por funcionalidade em `src/features/`: `auth`, `dashboard`, `cold-units`, `alerts`, `devices`, `users` e `enterprises`. Cada pasta tem as chamadas à API, os hooks, os componentes e as páginas. Os componentes visuais comuns ficam em `src/shared/`.

O TanStack Query busca os dados. Uma conexão de eventos (Server-Sent Events, `GET /events`) avisa a tela sempre que chegam leituras ou mudam alertas e vínculos, e a tela atualiza na hora. Enquanto essa conexão está aberta, a atualização periódica cai para 1 minuto e serve de reserva.

### Telas

| Tela | Rota | Quem vê |
|---|---|---|
| Painel | `/` | Todos |
| Unidades e detalhe com gráfico | `/unidades`, `/unidades/:id` | Todos |
| Alertas | `/alertas` | Todos |
| Vincular placa (QR Code) | `/vincular` | Todos |
| Placas, quarentena e detalhe | `/placas`, `/placas/quarentena`, `/placas/:id` | Todos |
| Perfil | `/perfil` | Todos |
| Usuários | `/usuarios` | ADMIN e MASTER |
| Empresas | `/empresas`, `/empresas/:id` | MASTER |
| Cadastro de placas | `/placas/cadastro` | MASTER |

## Fluxo de uso típico

1. O **MASTER** cadastra a empresa e registra as placas pelo MAC.
2. O **ADMIN** da empresa cria as unidades refrigeradas, com seus limites, e os usuários.
3. O **OPERATOR** instala a placa na unidade e a vincula lendo o QR Code.
4. A placa começa a enviar leituras, e o painel passa a mostrar o status da unidade.
5. Quando a temperatura sai da faixa, um alerta aparece e acompanha a excursão até a temperatura voltar. O operador o resolve depois de agir.

## Como executar

```bash
# API (ColdChain_API)
docker compose up -d          # PostgreSQL na porta 5433
npx prisma migrate dev        # cria as tabelas
npx prisma db seed            # empresa base e usuário MASTER
npm run dev                   # inicia a API

# Web (ColdChain_Web)
npm install
npm run dev                   # inicia o frontend; /api é encaminhado para a API
```

A API precisa de um `.env` com `DATABASE_URL`, `PORT`, `MQTT_BROKER_URL` e `JWT_SECRET`.
