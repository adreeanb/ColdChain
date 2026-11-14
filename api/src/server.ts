// Primeiro import: carrega o .env e permite validar antes de qualquer outra coisa
import { corsOrigins, validateEnv } from './config/env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { routes } from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { prisma } from './lib/prisma.js';
import { encerrarMQTTSubscriber, iniciarMQTTSubscriber } from './services/mqtt/mqttSubscriber.js';
import { iniciarPurgeExpiredTelemetryJob } from './jobs/purgeExpiredTelemetry.js';
import { iniciarDetectOfflineDevicesJob } from './jobs/detectOfflineDevices.js';

validateEnv();

const app = express();

app.disable('x-powered-by');

// Número de proxies reversos à frente da API (ex.: 1 com Caddy, Nginx ou Render). Sem ele, o
// X-Forwarded-For é ignorado: o limite por IP veria o proxy, não o cliente.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

app.use(helmet());
app.use(cors({
  origin: corsOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));
// Um lote de 500 leituras ocupa cerca de 35 KB
app.use(express.json({ limit: '100kb' }));
app.use(routes);

// Por último: erros do express.json e exceções que escaparam dos controllers
app.use(errorHandler);

const PORT = process.env.PORT || 3334;
const server = app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

iniciarMQTTSubscriber();
const pararJobs = [iniciarPurgeExpiredTelemetryJob(), iniciarDetectOfflineDevicesJob()];

// O Render (e o docker stop) manda SIGTERM antes de trocar a versão. Para de aceitar
// requisições, fecha o MQTT (a sessão persistente guarda as mensagens no broker) e o banco.
let encerrando = false;

async function encerrar(signal: string) {
  if (encerrando) return;
  encerrando = true;
  console.log(`${signal} recebido: encerrando...`);

  // Se algo travar, não segura o deploy
  setTimeout(() => process.exit(1), 10_000).unref();

  pararJobs.forEach((parar) => parar());
  // Streams SSE abertos não terminam sozinhos
  server.closeAllConnections();
  server.close();

  try {
    await encerrarMQTTSubscriber();
    await prisma.$disconnect();
  } catch (error: any) {
    console.error('❌ Erro ao encerrar:', error.message);
  }

  process.exit(0);
}

process.on('SIGTERM', () => void encerrar('SIGTERM'));
process.on('SIGINT', () => void encerrar('SIGINT'));
