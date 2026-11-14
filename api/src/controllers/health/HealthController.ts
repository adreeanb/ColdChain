import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { isMqttConnected } from '../../services/mqtt/mqttSubscriber.js';

// Rota pública para o health check do Render e o monitor de uptime. Não expõe detalhes:
// só diz se o banco responde e se o assinante MQTT está conectado.
class HealthController {
  async handle(_req: Request, res: Response) {
    let database = false;

    try {
      await prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch (error: any) {
      console.error('❌ Health check: banco indisponível:', error.message);
    }

    const mqtt = isMqttConnected();

    // Sem banco a API não funciona (503). Sem MQTT ela ainda atende o painel e a telemetria
    // por HTTP, então o status fica 200 e o campo mostra a falha para o monitor.
    return res.status(database ? 200 : 503).json({
      status: database && mqtt ? 'ok' : 'degraded',
      database,
      mqtt
    });
  }
}

export { HealthController };
