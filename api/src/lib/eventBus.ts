import { EventEmitter } from 'node:events';

// Avisos para as telas abertas (GET /events). Só dizem o que mudou: a tela busca os dados
// de novo pelas rotas de sempre, e o cálculo do painel continua em um lugar só.
export type LiveEventType = 'telemetry' | 'alerts' | 'devices';

export interface LiveEvent {
  type: LiveEventType;
  enterpriseId: string;
  coldUnitIds?: string[];
}

// Em memória: vale para uma instância da API. Com várias, trocar por Redis pub/sub ou LISTEN/NOTIFY.
const bus = new EventEmitter();
bus.setMaxListeners(0);

export function publishEvent(event: LiveEvent) {
  bus.emit('event', event);
}

export function subscribeEvents(listener: (event: LiveEvent) => void) {
  bus.on('event', listener);
  return () => {
    bus.off('event', listener);
  };
}
