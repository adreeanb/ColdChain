import type { ReadingSourceType } from '@prisma/client';
import type { TransactionClient } from '../../lib/prisma.js';
import { applyReadingsToAlerts } from '../../lib/temperatureAlerts.js';
import type { ColdUnitLimits, ReadingPoint } from '../../lib/temperatureAlerts.js';

interface TelemetryRequest {
  // Transação da ingestão, já com o lock da placa (lockDevice)
  tx: TransactionClient;
  coldUnit: ColdUnitLimits & { name: string };
  deviceId: string;
  sourceType?: ReadingSourceType; // REALTIME ou HISTORICAL (Store & Forward)
  readings: ReadingPoint[];
}

class CreateTemperatureReadingService {
  // Retorna só as leituras gravadas: as repetidas (mesma placa e horário) ficam de fora
  async execute({ tx, coldUnit, deviceId, sourceType = 'REALTIME', readings }: TelemetryRequest) {
    // 1. Salva a telemetria. Um reenvio do store-and-forward é ignorado pelo índice único.
    const inserted = await tx.temperatureReading.createManyAndReturn({
      data: readings.map(({ temperature, timestamp }) => ({
        coldUnitId: coldUnit.id,
        deviceId,
        temperature,
        sourceType,
        timestamp
      })),
      skipDuplicates: true
    });

    // 2. Abre ou atualiza os episódios de alerta, se houver leituras fora dos limites
    const createdAlerts = await applyReadingsToAlerts(tx, coldUnit, deviceId, inserted);

    if (createdAlerts > 0) {
      console.log(`[ALERTA GERADO] Unidade: ${coldUnit.name} | ${createdAlerts} novo(s) episódio(s)`);
    }

    return inserted;
  }
}

export { CreateTemperatureReadingService };
