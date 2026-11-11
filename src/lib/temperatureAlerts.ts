import type { TransactionClient } from './prisma.js';
import { getOfflineThresholdMinutes } from './deviceStatus.js';

export interface ColdUnitLimits {
  id: string;
  minTemperature: number;
  maxTemperature: number;
}

export interface ReadingPoint {
  temperature: number;
  timestamp: Date;
}

export interface AlertEpisode {
  id?: string;
  temperature: number;
  peakTemperature: number;
  readingsCount: number;
  startedAt: Date;
  lastReadingAt: Date;
  endedAt: Date | null;
  resolvedAt: Date | null;
  changed?: boolean;
}

// Quanto a leitura passa dos limites; 0 quando está dentro da faixa
export function getDeviation(limits: ColdUnitLimits, temperature: number) {
  if (temperature < limits.minTemperature) return limits.minTemperature - temperature;
  if (temperature > limits.maxTemperature) return temperature - limits.maxTemperature;
  return 0;
}

export function buildAlertMessage(limits: ColdUnitLimits, peakTemperature: number) {
  const condition = peakTemperature < limits.minTemperature ? 'ABAIXO' : 'ACIMA';

  return `ALERTA CRÍTICO: Temperatura chegou a ${peakTemperature}°C. Limite era ${limits.minTemperature}°C a ${limits.maxTemperature}°C. (${condition} DO PERMITIDO)`;
}

function windowEnd(episode: AlertEpisode) {
  return episode.endedAt ?? episode.lastReadingAt;
}

/**
 * REGRA DE NEGÓCIO: leituras seguidas fora dos limites formam um único episódio (alerta).
 *
 * - Fora da faixa: entra no episódio cuja janela esteja a menos de `gapMs` da leitura,
 *   o que também junta oscilações curtas, como uma porta aberta duas vezes. Sem episódio
 *   próximo, abre um novo. Depois de resolvido pelo operador, o episódio só recebe leituras
 *   de dentro da própria janela: uma excursão nova gera um alerta novo.
 * - Dentro da faixa: encerra o episódio aberto que veio antes dela.
 * - Sem leituras por mais de `gapMs`, não dá para saber quando a excursão acabou: o
 *   episódio é encerrado na última leitura conhecida.
 *
 * As leituras podem chegar fora de ordem (store-and-forward), por isso as janelas e não a
 * ordem de chegada decidem o episódio. Altera `episodes` e devolve a lista com os novos.
 */
export function planAlertEpisodes(
  episodes: AlertEpisode[],
  readings: ReadingPoint[],
  limits: ColdUnitLimits,
  gapMs: number
) {
  const sorted = [...readings].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  for (const reading of sorted) {
    const time = reading.timestamp.getTime();
    const deviation = getDeviation(limits, reading.temperature);

    // Episódios abertos sem notícia há mais de gapMs antes desta leitura
    for (const episode of episodes) {
      if (!episode.endedAt && time - episode.lastReadingAt.getTime() > gapMs) {
        episode.endedAt = episode.lastReadingAt;
        episode.changed = true;
      }
    }

    if (deviation === 0) {
      for (const episode of episodes) {
        if (!episode.endedAt && episode.lastReadingAt.getTime() < time) {
          episode.endedAt = reading.timestamp;
          episode.changed = true;
        }
      }
      continue;
    }

    const target = episodes.find((episode) => {
      const start = episode.startedAt.getTime();
      const end = windowEnd(episode).getTime();

      if (episode.resolvedAt) {
        return time >= start && time <= end;
      }

      return time >= start - gapMs && time <= end + gapMs;
    });

    if (!target) {
      episodes.push({
        temperature: reading.temperature,
        peakTemperature: reading.temperature,
        readingsCount: 1,
        startedAt: reading.timestamp,
        lastReadingAt: reading.timestamp,
        endedAt: null,
        resolvedAt: null,
        changed: true
      });
      continue;
    }

    target.readingsCount += 1;
    target.changed = true;

    if (getDeviation(limits, reading.temperature) > getDeviation(limits, target.peakTemperature)) {
      target.peakTemperature = reading.temperature;
    }

    if (time < target.startedAt.getTime()) {
      target.startedAt = reading.timestamp;
    }

    if (time >= target.lastReadingAt.getTime()) {
      target.lastReadingAt = reading.timestamp;
      target.temperature = reading.temperature;
    }

    // Voltou a sair da faixa logo depois de encerrado: é a mesma excursão
    if (target.endedAt && time > target.endedAt.getTime()) {
      target.endedAt = null;
    }
  }

  return episodes;
}

/**
 * Aplica as leituras novas de uma placa aos alertas da unidade. Deve rodar dentro da
 * transação que grava as leituras, depois de `lockDevice`, para que duas mensagens da mesma
 * placa não abram dois episódios ao mesmo tempo. Retorna quantos alertas foram abertos.
 */
export async function applyReadingsToAlerts(
  tx: TransactionClient,
  coldUnit: ColdUnitLimits,
  deviceId: string,
  readings: ReadingPoint[]
) {
  if (readings.length === 0) {
    return 0;
  }

  const gapMs = getOfflineThresholdMinutes() * 60 * 1000;
  const times = readings.map((reading) => reading.timestamp.getTime());
  const from = new Date(Math.min(...times) - gapMs);
  const to = new Date(Math.max(...times) + gapMs);

  // Abertos (podem ser encerrados por estas leituras) e encerrados perto do período
  const existing = await tx.alert.findMany({
    where: {
      type: 'OUT_OF_RANGE',
      coldUnitId: coldUnit.id,
      deviceId,
      OR: [
        { endedAt: null },
        { startedAt: { lte: to }, endedAt: { gte: from } }
      ]
    },
    orderBy: { startedAt: 'asc' }
  });

  // Alertas de temperatura sempre têm leitura; o ?? só satisfaz o tipo, que é nulo em SENSOR_OFFLINE
  const episodes = planAlertEpisodes(
    existing.map((alert) => ({
      ...alert,
      temperature: alert.temperature ?? 0,
      peakTemperature: alert.peakTemperature ?? alert.temperature ?? 0
    })),
    readings,
    coldUnit,
    gapMs
  );
  let created = 0;

  for (const episode of episodes) {
    if (!episode.changed) continue;

    const data = {
      message: buildAlertMessage(coldUnit, episode.peakTemperature),
      temperature: episode.temperature,
      peakTemperature: episode.peakTemperature,
      readingsCount: episode.readingsCount,
      startedAt: episode.startedAt,
      lastReadingAt: episode.lastReadingAt,
      endedAt: episode.endedAt
    };

    if (episode.id) {
      await tx.alert.update({ where: { id: episode.id }, data });
    } else {
      await tx.alert.create({ data: { ...data, coldUnitId: coldUnit.id, deviceId } });
      created += 1;
    }
  }

  return created;
}

// Serializa o processamento de uma placa até o fim da transação, mesmo com várias instâncias da API
export async function lockDevice(tx: TransactionClient, deviceId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${deviceId}))`;
}
