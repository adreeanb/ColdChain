# 13. Limitações conhecidas

Pontos observados no código que estão incompletos, inconsistentes ou que representam riscos.

## Estrutura do código

| Ponto | Detalhe |
|---|---|
| `src/app.ts` e `src/config/auth.ts` vazios | A aplicação é montada inteira em `src/server.ts` |
| `req.user` declarado duas vezes | `src/@types/express/index.d.ts` (completo e obrigatório) e `src/types/express.d.ts` (opcional, só `enterpriseId`). Por isso alguns controllers checam `if (!req.user)` e outros não |
| Sem testes automatizados na API | `npm test` apenas encerra com erro. A regra de episódios (`planAlertEpisodes`) é pura e seria a primeira candidata a testes. O web tem testes unitários e um teste de ponta a ponta que sobe a API |
| `prisma generate` manual | O `postinstall` não gera o cliente: depois de `npm install` é preciso rodar `npx prisma generate` |
| Mensagens de erro em inglês | Alguns controllers de unidade e empresa retornam `'Invalid cold unit ID'` / `'Invalid enterprise ID'`, fora do padrão em português |

## Segurança

| Ponto | Detalhe |
|---|---|
| Conta MQTT compartilhada | Todas as placas usam o mesmo usuário do broker, que pode publicar em qualquer `coldchain/devices/#`. A chave por placa impede dados falsos, mas uma placa comprometida poderia inundar o tópico de outra (as mensagens seriam recusadas pela API, com custo de processamento) |
| Broker local sem TLS | No desenvolvimento (Mosquitto, porta 1883), usuário, senha e chave da placa trafegam em texto na rede local. Em produção (EMQX Cloud Serverless) o TLS é obrigatório |
| Cota do broker gerenciado | A EMQX Serverless gratuita comporta cerca de 6 placas (1 GB de tráfego/mês) e para o broker ao esgotar a cota se não houver limite de gasto |
| Senha do portal compartilhada | A rede de configuração `ColdChain-XXXXXX` usa a mesma senha em todas as placas. Ela só abre na primeira ligação ou com o botão BOOT segurado, e nunca mostra a chave atual |
| Token não revalidado | O JWT não é conferido com o banco: usuário excluído ou com papel alterado continua com o acesso antigo por até 1 dia |
| Rotas de placa abertas a OPERATOR | `bind` e `unbind` não exigem `isAdmin` (decisão de negócio: o operador instala a placa) |

## Telemetria e regras de negócio

| Ponto | Detalhe |
|---|---|
| Placa desconhecida perde dados | Leituras anteriores ao cadastro, ou com a chave errada, são descartadas ([detalhes](12-placa-desconhecida.md)) |
| QoS 0 entre placa e broker | O PubSubClient só publica em QoS 0: se a rede cair entre a publicação e o broker, a leitura se perde sem ir para o store & forward |
| Leitura histórica anterior ao vínculo | Um dado store & forward com horário anterior ao início do vínculo atual (e sem vínculo antigo que o cubra) cai na quarentena mesmo com a placa vinculada; reescanear na mesma unidade não o recupera. O início do vínculo na primeira leitura recuperada reduz esse caso, mas não o elimina |
| Eventos só em uma instância | O barramento de eventos (`eventBus`) é em memória: com várias instâncias da API, uma tela só recebe os eventos da instância a que está conectada ([Tempo real](14-tempo-real.md)) |
| Jobs no mesmo processo | Limpeza da quarentena e detecção de placas sem sinal rodam com `setInterval` dentro do servidor |
| Resolução sem autor | `resolvedAt` registra quando, mas não quem resolveu |
| Mudança de limites não recalcula | Editar `minTemperature`/`maxTemperature` não altera episódios já gerados |

## Resolvido desde a primeira versão desta documentação

| Antes | Agora |
|---|---|
| Telemetria sem autenticação | Chave por placa (SHA-256) e broker com usuário, senha e ACL |
| Broker público (HiveMQ) | Mosquitto próprio no `docker-compose` |
| Um alerta por leitura fora da faixa | Episódios: uma excursão gera um alerta |
| Leituras repetidas duplicadas | Índice único `(placa, horário)` e `skipDuplicates` |
| Placa desativada não podia voltar (nem ser recadastrada, pois o MAC é único) | `PATCH /devices/:id/activate`, com chave nova |
| Último contato calculado de forma inconsistente | Coluna `lastSeenAt`, gravada na chegada de cada mensagem |
| Sensor mudo sem alerta | Alerta `SENSOR_OFFLINE` pelo job de 1 minuto |
| Mensagens perdidas com a API fora do ar | Sessão MQTT persistente: o broker guarda as mensagens |
| `sourceType` livre no HTTP | Só `HISTORICAL` é aceito; o resto vira `REALTIME` |
| Broker sem TLS e firmware com Wi-Fi e chave compilados | Produção com TLS (certificado raiz do broker no firmware). Um binário para todas as placas; Wi-Fi e chave informados no portal de configuração |
| Senha do banco e MASTER `123456` fixos no repositório | `POSTGRES_*` e `SEED_MASTER_*` vêm do `.env`; o Postgres só escuta em `127.0.0.1` |
| `.env` sem validação | `validateEnv` impede a API de subir sem segredo e, em produção, com segredo fraco ou de exemplo |
| Login sem limite de tentativas | 10 falhas por IP a cada 15 minutos; telemetria HTTP limitada a 600 por minuto |
| Sem headers de segurança | `helmet`, sem `X-Powered-By`, corpo JSON limitado a 100 KB |
| CORS com IP da rede local fixo | Padrão só `http://localhost:5173`; o resto vem de `CORS_ORIGINS` |
| `bcrypt` e `bcryptjs` | Só `bcryptjs`, também no seed |
| Sem tratador global de erros; `error.message` do Prisma devolvido ao cliente | `sendError` só repassa mensagens de negócio; o resto vira 500 genérico. `errorHandler` global para 413, JSON inválido e exceções |
| Sem build de produção | `npm run build` (dist/), `npm start`, `GET /health` e desligamento limpo no `SIGTERM` |
