# 1. Arquitetura

## Camadas

Toda requisição HTTP segue o mesmo caminho:

```mermaid
flowchart LR
    REQ[Requisição HTTP] --> R[src/routes/index.ts]
    R --> M{Middlewares<br/>isAuthenticated<br/>isAdmin / isMaster}
    M -- negado --> ERR[401 / 403]
    M -- ok --> C[Controller.handle]
    C --> S[Service.execute]
    S --> P[prisma<br/>src/lib/prisma.ts]
    P --> DB[(PostgreSQL)]
    S -- throw new Error --> C
    C -- try/catch --> RES[Resposta JSON + status]
    S -. após o commit .-> EV[publishEvent<br/>src/lib/eventBus.ts]
```

| Camada | Pasta | Responsabilidade |
|---|---|---|
| Rotas | `src/routes/index.ts` | Registra todas as rotas, instancia os controllers e encadeia os middlewares |
| Middlewares | `src/middlewares/` | Autenticação (JWT) e autorização por papel |
| Controllers | `src/controllers/<domínio>/` | Leem `req.params`, `req.query`, `req.body` e `req.user`, chamam o service e convertem erros em status HTTP |
| Services | `src/services/<domínio>/` | Regras de negócio; sinalizam falhas com `throw new Error(mensagem)` |
| Bibliotecas | `src/lib/` | Cliente Prisma, MAC, chave da placa, regra de alertas, barramento de eventos, status de placas, tenant |
| Jobs | `src/jobs/` | Tarefas periódicas: limpeza da quarentena e detecção de placas sem sinal |

### Padrão "uma classe por ação"

Cada operação tem um par controller/service com o mesmo nome, por exemplo `CreateColdUnitController.ts` e `CreateColdUnitService.ts`. Os controllers têm um método `handle(req, res)`; os services têm um único método `execute()`.

Não existe tratador global de erros (a linha `app.use(errorHandler)` está comentada em `server.ts`). Cada controller tem seu próprio `try/catch` e decide o status: em geral `400` para erros de validação/negócio, `404` para buscas, `401` no login e `500` em listagens.

### Convenções técnicas

- **ESM** (`"type": "module"`, resolução `nodenext`): imports relativos usam a extensão `.js`.
- **`verbatimModuleSyntax`**: importações apenas de tipo usam `import type`.
- Comentários e mensagens de erro em português.
- Não há etapa de build: o servidor roda direto com `tsx watch src/server.ts`; a checagem de tipos é feita com `npx tsc --noEmit`.
- Operações que escrevem em várias tabelas usam `prisma.$transaction`. A ingestão e o vínculo de placas também tomam um **lock por placa** (`lockDevice`, ver [Telemetria](08-telemetria.md)).

## Infraestrutura local (`docker-compose.yml`)

O compose tem nome fixo (`name: coldchain_api`), para que os volumes não mudem se a pasta for renomeada.

| Serviço | Imagem | Porta | Função |
|---|---|---|---|
| `postgres` (`meu-postgres`) | `postgres:16` | 127.0.0.1:5433 → 5432 (só a máquina local) | Banco de dados; usuário, senha e nome vêm de `POSTGRES_*` no `.env` |
| `mosquitto` (`coldchain-mosquitto`) | `eclipse-mosquitto:2.0.20` | 1883 | Broker MQTT |

O broker não aceita conexões anônimas. A cada início, `mosquitto/entrypoint.sh` gera o arquivo de senhas e a ACL a partir do `.env`:

| Conta | Variáveis | Permissão |
|---|---|---|
| API | `MQTT_USERNAME` / `MQTT_PASSWORD` | Só **lê** `coldchain/devices/#` |
| Placas (compartilhada) | `MQTT_DEVICE_USERNAME` / `MQTT_DEVICE_PASSWORD` | Só **publica** em `coldchain/devices/#` |

`mosquitto.conf` liga a persistência e enfileira mensagens QoS 0 (`queue_qos0_messages true`, até 100 000). Como a API se conecta com sessão persistente, o broker guarda as leituras enquanto ela estiver fora do ar e as entrega quando ela volta.

## Inicialização do servidor (`src/server.ts`)

```mermaid
flowchart TD
    A[tsx src/server.ts] --> V[validateEnv<br/>carrega e confere o .env]
    V --> B[Cria app Express<br/>sem X-Powered-By, trust proxy por TRUST_PROXY]
    B --> HM[helmet<br/>headers de segurança]
    HM --> C[CORS<br/>origens de CORS_ORIGINS ou<br/>localhost:5173]
    C --> D[express.json<br/>limite de 100 KB]
    D --> E[app.use routes]
    E --> F[app.listen PORT ou 3334]
    F --> G[iniciarMQTTSubscriber]
    G --> H[iniciarPurgeExpiredTelemetryJob]
    H --> I[iniciarDetectOfflineDevicesJob]
    G -.-> G1[Conecta ao broker com clientId fixo e sessão persistente<br/>assina coldchain/devices/+/+ em QoS 1]
    H -.-> H1[Limpa a quarentena agora e a cada 10 minutos]
    I -.-> I1[Verifica placas sem sinal agora e a cada 1 minuto]
```

1. Carrega o `.env` e o valida (`src/config/env.ts`). Faltar `DATABASE_URL` ou `JWT_SECRET` impede o início. Com `NODE_ENV=production`, também impedem: `JWT_SECRET` com menos de 32 caracteres, `CORS_ORIGINS` ausente, credenciais MQTT ausentes e senhas iguais às do `.env.example`. Em desenvolvimento esses casos só geram avisos.
2. Cria a aplicação Express, desliga o header `X-Powered-By` e, com `TRUST_PROXY` definido, confia nesse número de proxies reversos para obter o IP do cliente.
3. Aplica o `helmet` (headers de segurança, como `Strict-Transport-Security` e `X-Content-Type-Options`).
4. Configura o CORS com `credentials: true` e os métodos `GET, POST, PUT, DELETE, PATCH`. As origens vêm de `CORS_ORIGINS` (separadas por vírgula) ou, na ausência, apenas `http://localhost:5173`.
5. Habilita o parser JSON com limite de 100 KB (corpo maior recebe 413) e registra as rotas. O limite de requisições por IP (`src/middlewares/rateLimit.ts`) vale para `POST /login` (10 falhas a cada 15 minutos) e `POST /telemetry/readings` (600 por minuto); acima disso, 429.
6. Sobe o servidor HTTP na porta `PORT` (padrão 3334).
7. Inicia o assinante MQTT (ver [Telemetria](08-telemetria.md)).
8. Inicia os jobs de limpeza da quarentena e de placas sem sinal (ver [Jobs](11-jobs-e-soft-delete.md)).

O carregamento do `.env` acontece em `src/config/env.ts` (`import 'dotenv/config'`), o primeiro import de `src/server.ts`. `src/lib/prisma.ts` também o importa, para scripts que usam o cliente sem passar pelo servidor.

## Conexão com o banco (`src/lib/prisma.ts`)

- Cria um `pg.Pool` com `DATABASE_URL` e o adaptador `PrismaPg`.
- Configura `omit: { coldUnitDevice: { apiKeyHash: true } }`: o hash da chave da placa nunca sai nas respostas. O código que precisa dele pede explicitamente com `omit: { apiKeyHash: false }`.
- Exporta `prisma`, estendido com `$extends` para a exclusão lógica (ver [Jobs e soft delete](11-jobs-e-soft-delete.md)), e o tipo `TransactionClient`, usado pelas funções que rodam dentro de transações.

## Fontes de entrada de dados

```mermaid
flowchart LR
    subgraph HTTP
        W[Painel web] -->|JWT| RT[Rotas autenticadas]
        W -->|JWT| SSE[GET /events]
        HW[Hardware/teste] -->|X-Device-Key| TR[POST /telemetry/readings]
    end
    subgraph MQTT
        ESP[ESP32] -->|usuário das placas| BR[(Mosquitto)] -->|usuário da API| SUB[mqttSubscriber]
    end
    TR --> ING[IngestTelemetryService]
    SUB --> ING
    ING --> BUS((eventBus)) --> SSE
```
