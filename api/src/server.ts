// Primeiro import: carrega o .env e permite validar antes de qualquer outra coisa
import { corsOrigins, validateEnv } from './config/env.js';

import express from 'express';
//import { errorHandler } from './middlewares/errorHandler.js'
import cors from 'cors';
import helmet from 'helmet';

import { routes } from './routes/index.js';
import { iniciarMQTTSubscriber } from './services/mqtt/mqttSubscriber.js';
import { iniciarPurgeExpiredTelemetryJob } from './jobs/purgeExpiredTelemetry.js';
import { iniciarDetectOfflineDevicesJob } from './jobs/detectOfflineDevices.js';

validateEnv();

const app = express();

app.disable('x-powered-by');

// Número de proxies reversos à frente da API (ex.: 1 com Caddy ou Nginx). Sem ele, o
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

//app.use(errorHandler);

const PORT = process.env.PORT || 3334;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

iniciarMQTTSubscriber();
iniciarPurgeExpiredTelemetryJob();
iniciarDetectOfflineDevicesJob();
