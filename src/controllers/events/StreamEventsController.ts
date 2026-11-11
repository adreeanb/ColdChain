import type { Request, Response } from 'express';
import { subscribeEvents } from '../../lib/eventBus.js';

// Mantém a conexão viva em proxies que fecham conexões ociosas
const HEARTBEAT_MS = 25 * 1000;

class StreamEventsController {
  // Server-Sent Events: o navegador abre uma conexão e recebe um aviso a cada mudança.
  // O web lê o stream com fetch para enviar o Bearer, que o EventSource não aceita.
  async handle(req: Request, res: Response) {
    const { role, enterpriseId } = req.user;

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();

    // Avisa o cliente de que o stream está pronto; ele usa isso para reduzir o polling
    res.write('event: ready\ndata: {}\n\n');

    // Tenancy: só eventos da própria empresa. O MASTER enxerga todas.
    const unsubscribe = subscribeEvents((event) => {
      if (role !== 'MASTER' && event.enterpriseId !== enterpriseId) {
        return;
      }

      res.write(`data: ${JSON.stringify({ type: event.type, coldUnitIds: event.coldUnitIds ?? [] })}\n\n`);
    });

    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }
}

export { StreamEventsController };
