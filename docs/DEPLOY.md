# Publicação em produção

Guia para colocar o ColdChain no ar com **Supabase** (PostgreSQL), **EMQX Cloud Serverless** (broker MQTT) e **Render** (API e painel web). Não é preciso domínio próprio: cada serviço já entrega um endereço com HTTPS/TLS válido.

## Arquitetura

```
ESP32 ──TLS 8883 (conta das placas, só publica)──► EMQX Serverless ◄──mqtts (conta da API, só assina)── API (Render Web Service)
                                                                                                            │   │
Navegador ──HTTPS──► Painel (Render Static Site) ──VITE_API_URL (HTTPS + CORS)──────────────────────────────┘   └──► Supabase (Session pooler)
```

| Peça | Onde | Por quê |
|---|---|---|
| Banco | Supabase, região **East US (N. Virginia)** | Postgres gerenciado; perto da API no Render |
| Broker MQTT | EMQX Cloud Serverless | O Render só expõe HTTP(S). O ESP32 (PubSubClient) precisa de MQTT em TCP, então o broker fica fora do Render. É um deployment **privado**, com senha, TLS e regras por usuário, diferente do `broker.hivemq.com` público usado no protótipo |
| API | Render Web Service, plano **free**, região **Virginia** | Gratuito, mas dorme após 15 min sem tráfego HTTP: um monitor de uptime em `/health` o mantém acordado (seção 3). Para produção de verdade, use o **Starter**, sempre ligado |
| Painel | Render Static Site (gratuito) | Arquivos estáticos do Vite com fallback do SPA |

O Mosquitto do `api/docker-compose.yml` continua sendo o broker do desenvolvimento local.

**Restrições:**
- **Uma instância da API.** O barramento de eventos do SSE é em memória (`render.yaml` fixa `numInstances: 1`).
- **Os dados ficam nos EUA** (Supabase e Render). Se algum cliente exigir os dados no Brasil, o Supabase tem a região São Paulo, mas a API no Render continuaria nos EUA, com mais latência entre os dois.

## 1. Supabase (banco)

1. Crie o projeto na região **East US (North Virginia)** e guarde a senha do banco num gerenciador de senhas.
2. **Desligue a Data API**: *Project Settings → Data API → Disable*. Esse passo é **obrigatório**. O Supabase publica o schema `public` por uma API REST acessível com a chave `anon`, que é pública. As tabelas do Prisma não têm RLS, então qualquer pessoa leria `User` (com os hashes de senha), as leituras e os alertas. A API do ColdChain não usa a Data API.
   - Se preferir mantê-la ligada, ative RLS sem policies em todas as tabelas (`ALTER TABLE "<tabela>" ENABLE ROW LEVEL SECURITY;`). Isso bloqueia o acesso pela chave `anon` sem afetar a API, que conecta como `postgres`.
3. Baixe a CA do Supabase em *Project Settings → Database → SSL Configuration → Download certificate* (`prod-ca-2021.crt`) e salve como `api/certs/supabase-ca.crt`. O arquivo é público e vai para o git. O certificado do banco é assinado por essa CA própria, que o Node.js não conhece: sem ela, o driver `pg` recusa a conexão (`self-signed certificate in certificate chain`).
4. Em *Connect*, copie a URL do **Session pooler** (porta **5432**, usuário `postgres.<ref>`) e acrescente `?sslmode=verify-full&sslrootcert=certs/supabase-ca.crt`:
   ```
   postgresql://postgres.<ref>:<senha>@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full&sslrootcert=certs/supabase-ca.crt
   ```
   - O caminho do certificado é relativo à pasta `api/`, de onde saem os comandos do Prisma e de onde o Render inicia a API.
   - `verify-full` criptografa **e** confere que o servidor é o Supabase. Não use `sslmode=require`: no driver `pg` ele também verifica e falharia sem a CA, e o `uselibpqcompat=true` que o aviso do `pg` sugere só criptografa, sem verificar.
   - Senha com `@`, `#`, `/` ou `%` precisa ser codificada na URL (`@` vira `%40`).
   - Use o modo **sessão** (porta 5432), nunca o de transação (porta 6543): o `prisma migrate` trava pelo pooler de transação, porque depende de um lock de sessão. A conexão direta do free tier só funciona por IPv6, e o Render só sai por IPv4, por isso o pooler.

## 2. EMQX Cloud Serverless (broker MQTT)

O HiveMQ Cloud Serverless, cogitado antes, não aceita novos cadastros e será desligado em 31/12/2026. A EMQX tem um plano Serverless com cota gratuita permanente.

**Cota gratuita por mês:** 1 milhão de minutos de sessão e 1 GB de tráfego (entrada + saída).

| Recurso | Consumo do ColdChain | Cabe na cota |
|---|---|---|
| Minutos de sessão | Cada conexão permanente gasta cerca de 43.200 por mês | API + até ~22 placas |
| Tráfego | Cerca de 150 MB por placa por mês (a leitura entra pela placa e sai para a API) | **~6 placas** |

**Ao esgotar a cota, a EMQX para o deployment** se não houver limite de gasto, e o monitoramento cai sem aviso. Cadastre um cartão e defina um **limite de gasto** (ex.: US$ 5/mês) em *Billing*. Acima da cota, o tráfego custa US$ 0,15/GB. A EMQX também para deployments sem uso por 30 dias, o que não acontece com placas enviando.

1. Em **cloud-intl.emqx.com**, crie um deployment **Serverless**, de preferência numa região dos EUA. Na visão geral, anote o **endereço** (`<id>.<região>.emqxsl.com`) e a porta **MQTT over TLS (8883)**.
2. Em *Access Control → Authentication*, crie dois usuários com senhas longas e aleatórias:
   - `coldchain-api`: usado pela API (`MQTT_USERNAME` / `MQTT_PASSWORD` no Render);
   - `coldchain-device`: usado pelo firmware de todas as placas.
3. Em *Access Control → Authorization*, crie as regras que reproduzem a ACL do Mosquitto local (`api/mosquitto/entrypoint.sh`):

   | Usuário | Tópico | Ação | Permissão |
   |---|---|---|---|
   | `coldchain-device` | `coldchain/devices/#` | Publish | Allow |
   | `coldchain-device` | `#` | Subscribe | Deny |
   | `coldchain-api` | `coldchain/devices/#` | Subscribe | Allow |
   | `coldchain-api` | `#` | Publish | Deny |

   As regras de *Deny* garantem o bloqueio mesmo que o padrão do deployment seja permitir quando nenhuma regra casa.
4. Confira a cadeia do certificado, que o firmware vai validar (`firmware/include/config.h`):
   ```bash
   openssl s_client -connect <endereço>:8883 -servername <endereço> -showcerts </dev/null | grep -E "s:|i:"
   ```
   A raiz da cadeia precisa estar em `CA_RAIZES` no `config.h`. Se não estiver, o firmware não conecta (`[Falha] Erro: -2`). Em `us-east-1` a cadeia é `*.ala.us-east-1.emqxsl.com` → *Encryption Everywhere DV TLS CA - G2* → **DigiCert Global Root G2**, que já está no `config.h` (com a *DigiCert Global Root CA*, do caminho alternativo). Para conferir o certificado oferecido para download no console da EMQX, compare a impressão digital (`openssl x509 -in <arquivo> -noout -fingerprint -sha256`) com a da G2: `CB:3C:CB:B7:60:31:E5:E0:13:8F:8D:D3:9A:23:F9:DE:47:FF:C3:5E:43:C1:14:4C:EA:27:D4:6A:5A:B1:CB:5F`.
5. Teste com o [MQTTX](https://mqttx.app): conexão `mqtts://<endereço>`, porta 8883, SSL/TLS ligado (*CA signed server*), um Client ID de teste, **nunca** `coldchain-api`, que é o da API em produção:
   - `coldchain-device` publica em `coldchain/devices/AA:BB:CC:DD:EE:FF/realtime` e a mensagem chega a `coldchain-api` assinando `coldchain/devices/#`;
   - `coldchain-device` **não** consegue assinar, e `coldchain-api` **não** consegue publicar;
   - senha errada ou TLS desligado: conexão recusada.
6. **Sessão persistente:** com o *Clean Start* desligado na conexão da API, desconecte, publique algumas leituras pela placa e reconecte. Elas devem chegar: é o que segura as leituras durante um deploy da API.

## 3. Render (API e painel)

1. Em *New → Blueprint*, conecte o repositório do GitHub. O Render lê o `render.yaml` da raiz e propõe os dois serviços.
2. Preencha as variáveis marcadas como `sync: false`:

   | Serviço | Variável | Valor |
   |---|---|---|
   | `coldchain-api` | `DATABASE_URL` | URL do Session pooler com `verify-full` (passo 1.4) |
   | `coldchain-api` | `CORS_ORIGINS` | `https://coldchain-web.onrender.com` (URL do painel) |
   | `coldchain-api` | `MQTT_BROKER_URL` | `mqtts://<endereço EMQX>:8883` |
   | `coldchain-api` | `MQTT_USERNAME` / `MQTT_PASSWORD` | usuário `coldchain-api` da EMQX |
   | `coldchain-web` | `VITE_API_URL` | `https://coldchain-api.onrender.com` (URL da API) |

   `JWT_SECRET` é gerado pelo Render. `NODE_ENV=production`, `TRUST_PROXY=1` e `MQTT_CLIENT_ID` já vêm do `render.yaml`.
3. No deploy, a API:
   - instala as dependências (inclusive as de desenvolvimento, usadas no build) e compila (`npm run build`: `prisma generate && tsc`);
   - sobe com `npm start` e só recebe tráfego depois que `GET /health` responde.

   **As migrations não rodam no deploy.** No build, o Render não alcança o Supabase (`P1001: Can't reach database server`), mas a API em execução alcança. Por isso, sempre que houver migration nova, aplique-a **da sua máquina, antes do push** que leva o código novo:
   ```powershell
   cd api
   $env:DATABASE_URL = "<URL do Supabase, a mesma do Render>"
   npx prisma migrate deploy
   Remove-Item Env:DATABASE_URL
   ```
   Rode sempre de dentro de `api/`. Fora dela, o `npx` oferece instalar outra versão do Prisma: recuse.
4. Com `NODE_ENV=production`, a API **não sobe** se faltar variável, se `JWT_SECRET` for curto, se `MQTT_BROKER_URL` não usar `mqtts://` ou se algum valor for igual ao do `.env.example` (`api/src/config/env.ts`). O motivo aparece no log do deploy.
5. **Mantenha a API acordada.** No plano free, o Render desliga o serviço após 15 minutos sem tráfego HTTP. As leituras MQTT não contam como tráfego: com a API dormindo, nada é gravado e nenhum alerta é gerado, nem o de placa sem sinal. Crie um monitor no [UptimeRobot](https://uptimerobot.com) (gratuito) do tipo HTTP(s), com a URL `https://coldchain-api.onrender.com/health` e intervalo de 5 minutos. Ele também avisa por e-mail se a API cair.
   - As 750 horas mensais do free cobrem uma API ligada o mês inteiro, mas só uma: não crie outro Web Service free na mesma conta.
   - Se a API dormir mesmo assim, a sessão persistente da EMQX guarda as leituras e as entrega quando ela acordar.
   - Ao migrar para o **Starter**, troque `plan: free` por `plan: starter` no `render.yaml`. Nele dá para testar um `preDeployCommand: npm run migrate:deploy`, que roda no ambiente da API, e não no do build.
6. `VITE_API_URL` entra no build do painel. Se mudar a URL da API, faça um novo deploy do painel.

## 4. Primeiro acesso

1. Crie o usuário MASTER rodando o seed **da sua máquina**, apontando para o Supabase:
   ```bash
   cd api
   DATABASE_URL="<session pooler>" \
   SEED_MASTER_EMAIL="voce@empresa.com" \
   SEED_MASTER_PASSWORD="<senha forte>" \
   SEED_MASTER_NAME="Seu Nome" \
   npx prisma db seed
   ```
2. Entre no painel com esse usuário e troque a senha na tela de perfil.
3. Grave o firmware com o `secrets.h` de produção (endereço da EMQX, porta 8883, TLS 1, usuário `coldchain-device`). O binário é o mesmo para todas as placas.
4. Cadastre as placas no painel e configure cada uma pelo portal (rede `ColdChain-XXXXXX`, ver `firmware/README.md`). Como as chaves antigas trafegaram sem TLS num broker público, **gere uma chave nova** para cada placa já existente (página da placa → "Gerar nova chave") e cole-a no portal.

## 5. Verificação

```bash
curl https://coldchain-api.onrender.com/health
# {"status":"ok","database":true,"mqtt":true}
```

- `status: "degraded"` com `mqtt: false`: confira host, porta, usuário e senha do broker. A API continua atendendo o painel e a telemetria por HTTP.
- `503` com `database: false`: confira `DATABASE_URL` e se o projeto do Supabase está ativo.
- A Data API do Supabase precisa estar fechada. A chamada abaixo **não pode** devolver dados:
  ```bash
  curl "https://<ref>.supabase.co/rest/v1/User?select=email" -H "apikey: <anon key>"
  ```
- Login no painel, leitura de teste publicada pelo MQTTX com a credencial das placas e a chave de uma placa cadastrada: a leitura aparece no painel em tempo real.

## Operação

- **Monitor de uptime** (UptimeRobot, Better Stack) em `/health`, com alerta por e-mail.
- **Cota da EMQX:** acompanhe minutos de sessão e tráfego no console. Sem limite de gasto configurado, a EMQX para o broker quando a cota acaba.
- **Backups:** o free tier do Supabase não garante backups que dê para baixar. Planeje um `pg_dump` periódico.
- **Espaço:** o free tier do Supabase tem 500 MB. Uma placa a cada 5 s gera cerca de 17 mil leituras por dia. Acompanhe o uso em *Database → Usage* e defina a retenção das leituras antes de chegar ao limite.
- **Deploys** reiniciam a API: ela recebe `SIGTERM`, fecha as conexões, encerra o MQTT (a sessão persistente segura as mensagens no broker) e sai.
