import { prisma } from '../../lib/prisma.js';
import { ReadingSourceType } from '@prisma/client';
import { normalizeMacAddress } from '../../lib/macAddress.js';
import { verifyDeviceKey } from '../../lib/deviceKey.js';
import { lockDevice } from '../../lib/temperatureAlerts.js';
import { publishEvent } from '../../lib/eventBus.js';
import { CreateTemperatureReadingService } from './CreateTemperatureReadingService.js';

const QUARANTINE_TTL_HOURS = Number(process.env.QUARANTINE_TTL_HOURS) || 2;

// Um lote do store-and-forward cabe com folga; acima disso o envio deve ser dividido
export const MAX_READINGS_PER_MESSAGE = 500;

export interface TelemetryPoint {
  temperature: number;
  timestamp?: string | Date | undefined;
}

interface IngestTelemetryRequest {
  macAddress: unknown;
  deviceKey: unknown;
  sourceType?: ReadingSourceType;
  readings: TelemetryPoint[];
}

// ESP32 sem NTP pode enviar uma data inválida ou no futuro: nesses casos vale a hora de chegada
function resolveTimestamp(timestamp: string | Date | undefined, now: Date) {
  if (!timestamp) {
    return now;
  }

  const parsed = new Date(timestamp);

  return isNaN(parsed.getTime()) || parsed > now ? now : parsed;
}

class IngestTelemetryService {
  async execute({ macAddress, deviceKey, sourceType = 'REALTIME', readings }: IngestTelemetryRequest) {
    const normalizedMac = normalizeMacAddress(macAddress);

    if (!normalizedMac) {
      throw new Error("Endereço MAC inválido.");
    }

    if (!Array.isArray(readings) || readings.length === 0) {
      throw new Error("Nenhuma leitura enviada.");
    }

    if (readings.length > MAX_READINGS_PER_MESSAGE) {
      throw new Error(`Envie no máximo ${MAX_READINGS_PER_MESSAGE} leituras por mensagem.`);
    }

    if (readings.some((reading) => typeof reading?.temperature !== 'number' || !Number.isFinite(reading.temperature))) {
      throw new Error("Temperatura inválida.");
    }

    // 1. Placas não cadastradas ou desativadas têm os dados descartados
    const device = await prisma.coldUnitDevice.findUnique({
      where: { macAddress: normalizedMac },
      omit: { apiKeyHash: false }
    });

    if (!device || !device.isActive) {
      console.warn(`[TELEMETRIA DESCARTADA] Placa desconhecida ou inativa: ${normalizedMac}`);
      return { status: 'DISCARDED' as const };
    }

    // 2. O MAC está impresso no QR Code: só a chave prova que a mensagem veio da placa
    if (!verifyDeviceKey(deviceKey, device.apiKeyHash)) {
      console.warn(`[TELEMETRIA RECUSADA] Chave inválida para a placa ${normalizedMac}`);
      return { status: 'UNAUTHORIZED' as const };
    }

    const now = new Date();
    const points = readings.map((reading) => ({
      temperature: reading.temperature,
      timestamp: resolveTimestamp(reading.timestamp, now)
    }));

    const times = points.map((point) => point.timestamp.getTime());
    const first = new Date(Math.min(...times));
    const last = new Date(Math.max(...times));

    // Sob o lock da placa, um vínculo feito ao mesmo tempo (BindDeviceService) não deixa
    // estas leituras presas na quarentena
    const result = await prisma.$transaction(async (tx) => {
      await lockDevice(tx, device.id);

      // 3. Vínculos vigentes no período das leituras, não na hora de chegada: um dado Store &
      // Forward enviado depois de uma troca continua na unidade correta
      const associations = await tx.associationHistory.findMany({
        where: {
          deviceId: device.id,
          startDate: { lte: last },
          OR: [{ endDate: null }, { endDate: { gt: first } }],
          coldUnit: { isDeleted: false }
        },
        include: { coldUnit: true }
      });

      type Association = (typeof associations)[number];
      const byAssociation = new Map<string, { coldUnit: Association['coldUnit']; points: typeof points }>();
      const unbound: typeof points = [];

      for (const point of points) {
        const association = associations.find((item) =>
          item.startDate <= point.timestamp && (!item.endDate || item.endDate > point.timestamp)
        );

        if (!association) {
          unbound.push(point);
          continue;
        }

        const group = byAssociation.get(association.id) ?? { coldUnit: association.coldUnit, points: [] };
        group.points.push(point);
        byAssociation.set(association.id, group);
      }

      // 4. Com vínculo: leituras oficiais e alertas
      const createTemperatureReadingService = new CreateTemperatureReadingService();
      const coldUnitIds: string[] = [];
      let stored = 0;

      for (const group of byAssociation.values()) {
        const inserted = await createTemperatureReadingService.execute({
          tx,
          coldUnit: group.coldUnit,
          deviceId: device.id,
          sourceType,
          readings: group.points
        });

        stored += inserted.length;

        if (inserted.length > 0) {
          coldUnitIds.push(group.coldUnit.id);
        }
      }

      // 5. Sem vínculo: quarentena. Reenvios do mesmo horário são ignorados pelo índice único.
      let quarantined = 0;

      if (unbound.length > 0) {
        const expiresAt = new Date(now.getTime() + QUARANTINE_TTL_HOURS * 60 * 60 * 1000);

        const inserted = await tx.unboundTelemetry.createManyAndReturn({
          data: unbound.map((point) => ({ deviceId: device.id, ...point, expiresAt })),
          skipDuplicates: true
        });

        quarantined = inserted.length;
      }

      // Qualquer mensagem aceita prova que a placa está viva, mesmo repetida ou antiga
      await tx.coldUnitDevice.update({ where: { id: device.id }, data: { lastSeenAt: now } });

      return { stored, quarantined, coldUnitIds };
    });

    // Depois do commit: quem recebe o aviso e busca os dados já encontra as leituras.
    // Mesmo um reenvio muda o "visto por último" da placa.
    publishEvent({ type: 'telemetry', enterpriseId: device.enterpriseId, coldUnitIds: result.coldUnitIds });

    return {
      status: 'ACCEPTED' as const,
      stored: result.stored,
      quarantined: result.quarantined,
      duplicates: points.length - result.stored - result.quarantined
    };
  }
}

export { IngestTelemetryService };
