import mqtt from 'mqtt';
import { IngestTelemetryService } from '../telemetry/IngestTelemetryService.js';
import type { TelemetryPoint } from '../telemetry/IngestTelemetryService.js';
import { ReadingSourceType } from '@prisma/client';

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

// Cada placa publica no próprio tópico: coldchain/devices/<MAC>/realtime ou /historical
const SUBSCRIPTION = 'coldchain/devices/+/+';

const SOURCE_BY_CHANNEL: Record<string, ReadingSourceType> = {
  realtime: ReadingSourceType.REALTIME,
  historical: ReadingSourceType.HISTORICAL
};

// Payload: { "key": "ck_...", "temperatura": 4.2, "timestamp": "2026-10-30T12:00:00Z" }
// ou, no store-and-forward, { "key": "ck_...", "leituras": [{ "temperatura": 4.2, "timestamp": "..." }] }.
// O timestamp é opcional; sem ele, vale a hora de chegada.
function parseReadings(payload: any): TelemetryPoint[] {
  const items: any[] = Array.isArray(payload?.leituras) ? payload.leituras : [payload];

  return items.map((item) => ({
    temperature: typeof item?.temperatura === 'number' ? item.temperatura : parseFloat(item?.temperatura),
    timestamp: item?.timestamp
  }));
}

let client: mqtt.MqttClient | undefined;

// Usado pelo GET /health
export function isMqttConnected() {
  return client?.connected ?? false;
}

// Desligamento limpo: a sessão persistente continua no broker e as mensagens esperam a próxima conexão
export async function encerrarMQTTSubscriber() {
  await client?.endAsync();
}

export function iniciarMQTTSubscriber() {
  client = mqtt.connect(BROKER_URL, {
    // Sessão persistente com clientId fixo: o broker guarda as mensagens enquanto a API estiver fora
    clientId: process.env.MQTT_CLIENT_ID || 'coldchain-api',
    clean: false,
    ...(process.env.MQTT_USERNAME ? { username: process.env.MQTT_USERNAME } : {}),
    ...(process.env.MQTT_PASSWORD ? { password: process.env.MQTT_PASSWORD } : {})
  });

  const ingestTelemetryService = new IngestTelemetryService();

  client.on('connect', () => {
    console.log('✅ Backend conectado ao Broker MQTT!');

    client?.subscribe(SUBSCRIPTION, { qos: 1 }, (err) => {
      if (!err) {
        console.log(`📡 Inscrito em ${SUBSCRIPTION} (realtime e historical)`);
      } else {
        console.error('❌ Erro ao se inscrever nos tópicos:', err);
      }
    });
  });

  client.on('message', async (topic, message) => {
    const [, , macAddress, channel] = topic.split('/');
    const sourceType = channel ? SOURCE_BY_CHANNEL[channel] : undefined;

    if (!sourceType) {
      return;
    }

    try {
      const payload = JSON.parse(message.toString());

      const result = await ingestTelemetryService.execute({
        macAddress,
        deviceKey: payload?.key,
        sourceType,
        readings: parseReadings(payload)
      });

      if (result.status === 'ACCEPTED') {
        console.log(`[MQTT] ${macAddress} ${channel}: ${result.stored} gravada(s), ${result.quarantined} em quarentena, ${result.duplicates} repetida(s)`);
      }
    } catch (error: any) {
      // Captura payloads inválidos e erros do Service
      console.error(`❌ Erro MQTT ao processar tópico ${topic}:`, error.message);
    }
  });

  client.on('error', (err) => {
    console.error('❌ Erro no cliente MQTT:', err.message);
  });
}
