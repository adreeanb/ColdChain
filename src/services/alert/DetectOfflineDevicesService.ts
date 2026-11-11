import { prisma } from '../../lib/prisma.js';
import { getOfflineThresholdMinutes } from '../../lib/deviceStatus.js';
import { publishEvent } from '../../lib/eventBus.js';

function formatTime(date: Date) {
  return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

// REGRA DE NEGÓCIO: em cadeia fria, sensor mudo é tão grave quanto temperatura alta.
// Placa vinculada sem enviar nada por mais de SENSOR_OFFLINE_MINUTES abre um alerta
// SENSOR_OFFLINE, que se encerra sozinho quando ela volta a se comunicar.
class DetectOfflineDevicesService {
  async execute(now = new Date()) {
    const thresholdMs = getOfflineThresholdMinutes() * 60 * 1000;
    const changedEnterprises = new Set<string>();

    const activeAssociations = await prisma.associationHistory.findMany({
      where: { endDate: null, coldUnit: { isDeleted: false }, device: { isActive: true } },
      include: {
        device: { select: { id: true, macAddress: true, lastSeenAt: true } },
        coldUnit: { select: { id: true, name: true, enterpriseId: true } }
      }
    });

    const openAlerts = await prisma.alert.findMany({
      where: { type: 'SENSOR_OFFLINE', endedAt: null }
    });

    for (const { device, coldUnit, startDate } of activeAssociations) {
      // Uma placa vinculada há pouco, ou que nunca falou, conta o silêncio a partir do vínculo
      const lastContact = device.lastSeenAt && device.lastSeenAt > startDate ? device.lastSeenAt : startDate;
      const isOffline = now.getTime() - lastContact.getTime() > thresholdMs;
      const open = openAlerts.find((alert) => alert.coldUnitId === coldUnit.id && alert.deviceId === device.id);

      if (isOffline && !open) {
        // Resolvido pelo operador com a placa ainda muda: não reabre para a mesma queda
        const alreadyAlerted = await prisma.alert.findFirst({
          where: { type: 'SENSOR_OFFLINE', coldUnitId: coldUnit.id, deviceId: device.id, startedAt: { gte: lastContact } }
        });

        if (alreadyAlerted) continue;

        await prisma.alert.create({
          data: {
            type: 'SENSOR_OFFLINE',
            message: `PLACA SEM SINAL: ${device.macAddress} não envia dados desde ${formatTime(lastContact)}.`,
            readingsCount: 0,
            startedAt: lastContact,
            lastReadingAt: lastContact,
            coldUnitId: coldUnit.id,
            deviceId: device.id
          }
        });

        console.log(`[ALERTA GERADO] Unidade: ${coldUnit.name} | Placa sem sinal: ${device.macAddress}`);
        changedEnterprises.add(coldUnit.enterpriseId);
      } else if (!isOffline && open) {
        // A placa voltou: o episódio termina no contato mais recente, no máximo 1 min (o intervalo
        // do job) depois da volta
        await prisma.alert.update({ where: { id: open.id }, data: { endedAt: lastContact, lastReadingAt: lastContact } });
        changedEnterprises.add(coldUnit.enterpriseId);
      }
    }

    // Placa desvinculada, desativada ou unidade excluída: o alerta de sinal perde o sentido
    const stale = openAlerts.filter((alert) =>
      !activeAssociations.some(({ device, coldUnit }) => alert.coldUnitId === coldUnit.id && alert.deviceId === device.id)
    );

    if (stale.length > 0) {
      await prisma.alert.updateMany({ where: { id: { in: stale.map((alert) => alert.id) } }, data: { endedAt: now } });

      const units = await prisma.coldUnit.findMany({
        where: { id: { in: stale.map((alert) => alert.coldUnitId) } },
        select: { enterpriseId: true }
      });
      units.forEach((unit) => changedEnterprises.add(unit.enterpriseId));
    }

    changedEnterprises.forEach((enterpriseId) => publishEvent({ type: 'alerts', enterpriseId }));

    return changedEnterprises.size;
  }
}

export { DetectOfflineDevicesService };
