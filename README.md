# ColdChain

Sistema de monitoramento da cadeia fria desenvolvido como Trabalho de Conclusão de Curso. Placas ESP32 com sensor de temperatura instaladas em câmaras frias, depósitos refrigerados e caminhões baú enviam leituras por MQTT para uma API, que guarda o histórico e gera alertas quando a temperatura sai dos limites. Uma aplicação web (PWA) mostra o painel, os gráficos e os alertas, e vincula as placas às unidades por QR Code.

```
 ESP32 + DS18B20 ──MQTT──▶ Mosquitto ──▶ API (Express + Prisma) ──▶ PostgreSQL
                                              ▲
                                  HTTP + JWT  │  Server-Sent Events
                                              ▼
                                       Web (React PWA)
```

## Estrutura

| Pasta | Conteúdo |
|---|---|
| [`api/`](api/) | API REST: Node.js, Express 5, Prisma 7, PostgreSQL 16, Mosquitto, JWT |
| [`web/`](web/) | Aplicação web: React 19, Vite, Tailwind, TanStack Query, Recharts, PWA |
| [`firmware/`](firmware/) | Firmware do ESP32 (PlatformIO): leitura do DS18B20, MQTT e store-and-forward |
| [`docs/`](docs/) | Arquitetura e documentação detalhada da API |

## Como executar

Pré-requisitos: Node.js, Docker e, para o firmware, a extensão PlatformIO do VS Code.

```bash
# 1. API
cd api
cp .env.example .env          # ajuste senhas e segredos
docker compose up -d          # PostgreSQL (5433) e Mosquitto (1883)
npm install
npx prisma migrate dev
npx prisma db seed            # empresa base e usuário MASTER
npm run dev

# 2. Web
cd web
cp .env.example .env          # API_PROXY_TARGET com a porta da API
npm install
npm run dev                   # http://localhost:5173

# 3. Firmware
cd firmware
cp include/secrets.example.h include/secrets.h   # broker e conta das placas (Wi-Fi e chave: pelo portal)
pio run -t upload
```

Detalhes de cada parte no README da pasta e em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Publicação

Produção roda no Render (API e painel, configurados por [`render.yaml`](render.yaml)), no Supabase (PostgreSQL) e na EMQX Cloud Serverless (broker MQTT com TLS). Passo a passo em [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Segredos

Nenhuma credencial vai para o git: `api/.env`, `web/.env` e `firmware/include/secrets.h` são ignorados. Use os arquivos `.example` como modelo.
