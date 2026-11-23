# ColdChainMonitor

O ColdChainMonitor monitora a temperatura de câmaras frias, depósitos refrigerados e caminhões baú. Em cada lugar fica uma placa ESP32 com um sensor de temperatura, que manda as leituras para uma API. A API guarda o histórico e avisa quando a temperatura passa dos limites definidos para aquela unidade. Pelo navegador (ou pelo celular) dá para acompanhar tudo num painel com gráficos e alertas.

É um SaaS: várias empresas usam o mesmo sistema, mas cada usuário só vê os dados da empresa dele.

## Como as partes se conectam

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

O repositório tem três pastas, uma para cada parte:

| Parte | Pasta | Tecnologias |
|---|---|---|
| Firmware | `firmware/` | ESP32, PlatformIO, DallasTemperature, PubSubClient, ArduinoJson, SPIFFS, NTP |
| API | `api/` | Node.js, Express 5, Prisma 7, PostgreSQL 16, MQTT (Mosquitto), JWT |
| Web | `web/` | React 19, Vite, Tailwind, shadcn/ui, TanStack Query, Recharts, PWA |

## Firmware (ESP32)

A placa lê o sensor de tempos em tempos e joga fora as leituras de erro do DS18B20 (-127 °C e 85 °C, que são os valores que ele devolve quando algo dá errado).

Cada placa é identificada pelo endereço MAC e manda junto com cada leitura a sua chave, gerada quando ela é cadastrada no sistema. A mensagem fica assim: `{ key, temperatura, timestamp }`. O horário vem do NTP, em UTC.

Com conexão, as leituras vão para o tópico `coldchain/devices/<MAC>/realtime`. O broker é privado e exige usuário e senha. Em produção uso a EMQX Cloud Serverless, com TLS, e no desenvolvimento o Mosquitto que sobe pelo `docker-compose`.

Quando a rede cai, a placa não perde nada: as leituras ficam salvas na flash (SPIFFS). Assim que a conexão volta, ela manda esse histórico em lotes de 20 pelo tópico `coldchain/devices/<MAC>/historical`, mantendo o horário em que cada leitura foi feita. Isso roda sem atrapalhar as leituras ao vivo. Se alguma leitura chegar duplicada, a API ignora.

O mesmo firmware vai para todas as placas. O que é comum a todas (broker e conta das placas) fica em `include/secrets.h`. O Wi-Fi e a chave de cada placa são configurados na hora da instalação: a placa abre uma rede chamada `ColdChain-XXXXXX`, você conecta pelo celular, preenche os dados no portal e eles ficam gravados na NVS do ESP32.

## API

### Organização do código

```
rota (src/routes/index.ts) → middlewares → controller → service → Prisma → PostgreSQL
```

Os controllers só cuidam da requisição e de transformar erros em respostas HTTP. A regra de negócio fica nos services, com uma classe para cada ação (`CreateColdUnitService`, `BindDeviceService` e assim por diante). O controle de acesso é feito por três middlewares: `isAuthenticated` (valida o JWT), `isAdmin` e `isMaster`.

### Perfis de usuário

| Perfil | O que pode fazer |
|---|---|
| OPERATOR | Ver o painel, as unidades e os gráficos, resolver alertas e vincular placas às unidades |
| ADMIN | O mesmo que o operador, e também gerenciar as unidades e os usuários da própria empresa |
| MASTER | Tudo, em qualquer empresa. É o único que cadastra empresas e placas |

### Banco de dados

| Tabela | Para que serve |
|---|---|
| `Enterprise` | Empresas clientes |
| `User` | Usuários, com o perfil e a empresa de cada um |
| `ColdUnit` | Unidades refrigeradas (câmara, depósito ou caminhão), com temperatura mínima e máxima |
| `ColdUnitDevice` | Placas ESP32, identificadas pelo MAC e ligadas a uma empresa |
| `AssociationHistory` | Qual placa esteve em qual unidade, e em que período |
| `TemperatureReading` | Leituras oficiais, marcadas como tempo real ou histórico |
| `UnboundTelemetry` | Quarentena das leituras de placas que ainda não têm unidade |
| `Alert` | Cada vez que a temperatura saiu da faixa, com pico, duração e quantidade de leituras |

Empresas, usuários e unidades nunca são apagados de verdade. Ao excluir, o registro só é marcado como excluído, para não perder o histórico.

### O que acontece com uma leitura

1. A placa publica a leitura no MQTT (também dá para mandar por `POST /telemetry/readings`).
2. A API descarta leituras de placas que ela não conhece ou que estão desativadas, e recusa as que vêm com a chave errada.
3. Ela procura em qual unidade a placa estava no momento em que a leitura foi feita, e não no momento em que chegou. É isso que garante que o histórico enviado depois de uma queda de rede vá para o lugar certo.
4. Se a placa tem unidade, a leitura é gravada. Se estiver fora dos limites, abre um alerta para a unidade ou atualiza o que já está aberto. Várias leituras seguidas fora da faixa contam como um alerta só. Leitura repetida (mesma placa, mesmo horário) é ignorada.
5. Se a placa não tem unidade, a leitura vai para a quarentena, que é limpa depois de algumas horas (2, por padrão).

### Vinculando uma placa

O operador lê o QR Code da placa e escolhe a unidade. Se a placa já tiver leituras na quarentena, ele decide se elas entram para a unidade ou se são descartadas. Descartar faz sentido, por exemplo, quando a placa ficou ligada na bancada antes de ser instalada.

Tudo isso acontece numa transação só: a API fecha o vínculo anterior, abre o novo e aplica a escolha sobre a quarentena. Se as leituras forem recuperadas, o vínculo passa a valer a partir da primeira delas. Uma placa só fica vinculada a uma unidade por vez, mas uma unidade pode ter várias placas.

### Status das unidades no painel

- Normal: todas as placas estão dentro dos limites.
- Fora da faixa: pelo menos uma placa passou dos limites. Esse status aparece mesmo que outro também se aplique.
- Sem sinal: alguma placa está há mais de 10 minutos sem mandar nada. Nesse caso também é aberto um alerta, que fecha sozinho quando a placa volta a se comunicar.
- Sem placa: nenhuma placa vinculada à unidade.

### Rotas

| Área | Rotas |
|---|---|
| Login e perfil | `POST /login`, `GET/PUT /me`, `PUT /me/password` |
| Painel | `GET /dashboard/summary` |
| Empresas (MASTER) | `/enterprises` |
| Usuários (ADMIN) | `/users` |
| Unidades | `/cold-units`, `/cold-units/:id/readings`, `/cold-units/:id/readings/series` |
| Placas | `/devices`, `/devices/unbound`, `/devices/bind`, `/devices/:id/unbind`, `/devices/:id/deactivate`, `/devices/:id/activate`, `/devices/:id/key` |
| Alertas | `GET /alerts`, `PATCH /alerts/:id/resolve` |
| Telemetria | `POST /telemetry/readings` e o assinante MQTT |

## Web

O front é feito em React, é responsivo e pode ser instalado como PWA. No celular, a câmera é usada para ler o QR Code na hora de vincular uma placa.

O código está separado por funcionalidade dentro de `src/features/` (`auth`, `dashboard`, `cold-units`, `alerts`, `devices`, `users` e `enterprises`). Em cada pasta ficam as chamadas à API, os hooks, os componentes e as páginas daquela parte. O que é usado em vários lugares fica em `src/shared/`.

Os dados são buscados com TanStack Query. Para a tela não ficar desatualizada, o front mantém uma conexão de Server-Sent Events (`GET /events`) com a API, que avisa quando chega leitura nova ou quando muda algum alerta ou vínculo. Enquanto essa conexão está de pé, o polling cai para uma vez por minuto, só como garantia.

### Telas

| Tela | Rota | Acesso |
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

## Na prática

O MASTER cadastra a empresa e registra as placas pelo MAC. Depois, o ADMIN dessa empresa cria as unidades refrigeradas com seus limites de temperatura e cadastra os usuários. O operador instala a placa na unidade e faz o vínculo lendo o QR Code. A partir daí as leituras começam a chegar e o painel já mostra o status da unidade.

Se a temperatura sair da faixa, aparece um alerta que vai acompanhando a situação até a temperatura voltar ao normal. Depois de resolver o problema, o operador marca o alerta como resolvido.

## Rodando o projeto

```bash
# API (pasta api/)
cp .env.example .env          
docker compose up -d          # sobe o PostgreSQL (porta 5433) e o Mosquitto (1883)
npm install
npx prisma migrate dev        # cria as tabelas
npx prisma db seed            # cria a empresa base e o usuário MASTER
npm run dev

# Web (pasta web/)
cp .env.example .env          # em API_PROXY_TARGET, coloque a porta da API
npm install
npm run dev                   # as chamadas para /api são repassadas para a API

# Firmware (pasta firmware/)
cp include/secrets.example.h include/secrets.h   # broker e conta das placas (Wi-Fi e chave vão pelo portal)
pio run -t upload
```

As variáveis de ambiente de cada parte estão documentadas em `api/.env.example`, `web/.env.example` e `firmware/include/secrets.example.h`.
