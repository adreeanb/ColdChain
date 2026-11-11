import { prisma } from '../../lib/prisma.js';
import { normalizeMacAddress } from '../../lib/macAddress.js';
import { applyReadingsToAlerts, lockDevice } from '../../lib/temperatureAlerts.js';
import { publishEvent } from '../../lib/eventBus.js';

type QuarantineAction = 'recover' | 'discard';

interface BindDeviceRequest {
  macAddress: string;
  coldUnitId: string;
  enterpriseId: string;
  // O que fazer com as leituras retidas: a placa pode ter medido antes de ser instalada
  quarantine?: QuarantineAction | undefined;
  // Com 'recover', recupera só as leituras a partir deste horário
  recoverFrom?: string | undefined;
}

class BindDeviceService {
  async execute({ macAddress, coldUnitId, enterpriseId, quarantine = 'recover', recoverFrom }: BindDeviceRequest) {
    const normalizedMac = normalizeMacAddress(macAddress);

    if (!normalizedMac) {
      throw new Error("Endereço MAC inválido.");
    }

    if (quarantine !== 'recover' && quarantine !== 'discard') {
      throw new Error("Escolha recuperar ou descartar as leituras da quarentena.");
    }

    const recoverFromDate = recoverFrom ? new Date(recoverFrom) : null;

    if (recoverFromDate && Number.isNaN(recoverFromDate.getTime())) {
      throw new Error("Horário inválido para recuperar a quarentena.");
    }

    // 1. Validação de Segurança: placa e unidade precisam ser da empresa do usuário
    const device = await prisma.coldUnitDevice.findFirst({
      where: { macAddress: normalizedMac, enterpriseId, isActive: true }
    });

    if (!device) {
      throw new Error("Placa não encontrada, desativada ou não pertence à sua empresa.");
    }

    const coldUnit = await prisma.coldUnit.findFirst({
      where: { id: coldUnitId, enterpriseId, isDeleted: false }
    });

    if (!coldUnit) {
      throw new Error("Unidade fria não encontrada, desativada ou não pertence à sua empresa.");
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Uma leitura da placa chegando agora espera o vínculo terminar (IngestTelemetryService)
        await lockDevice(tx, device.id);

        const now = new Date();

        const activeAssociation = await tx.associationHistory.findFirst({
          where: { deviceId: device.id, endDate: null }
        });

        // 2. Reescanear a placa na mesma unidade não cria histórico
        if (activeAssociation?.coldUnitId === coldUnitId) {
          return { association: activeAssociation, recoveredReadings: 0, discardedReadings: 0 };
        }

        // 3. Encerra o vínculo antigo
        await tx.associationHistory.updateMany({
          where: { deviceId: device.id, endDate: null },
          data: { endDate: now }
        });

        // 4. Escolhe o que sai da quarentena. Nada anterior ao fim do último vínculo da placa
        // pode entrar, para dois vínculos nunca cobrirem o mesmo horário.
        const pending = await tx.unboundTelemetry.findMany({
          where: { deviceId: device.id, expiresAt: { gt: now } },
          orderBy: { timestamp: 'asc' }
        });

        const lastAssociation = await tx.associationHistory.findFirst({
          where: { deviceId: device.id, endDate: { not: null } },
          orderBy: { endDate: 'desc' }
        });

        const bounds = [lastAssociation?.endDate, recoverFromDate].filter((date) => date != null);
        const lowerBound = bounds.length > 0 ? Math.max(...bounds.map((date) => date.getTime())) : -Infinity;

        const recovered = quarantine === 'recover'
          ? pending.filter((item) => item.timestamp.getTime() >= lowerBound)
          : [];

        // O vínculo começa na primeira leitura recuperada: um dado atrasado do mesmo período
        // chega depois e cai nesta unidade, não de volta na quarentena
        const association = await tx.associationHistory.create({
          data: { deviceId: device.id, coldUnitId, startDate: recovered[0]?.timestamp ?? now }
        });

        // 5. Leituras recuperadas viram oficiais, com o horário original, e passam pelos alertas
        const readings = await tx.temperatureReading.createManyAndReturn({
          data: recovered.map((item) => ({
            coldUnitId,
            deviceId: device.id,
            temperature: item.temperature,
            sourceType: 'HISTORICAL' as const,
            timestamp: item.timestamp
          })),
          skipDuplicates: true
        });

        await applyReadingsToAlerts(tx, coldUnit, device.id, readings);

        // Apaga só o que foi lido: o que chegar depois do lock já encontra o vínculo
        await tx.unboundTelemetry.deleteMany({
          where: { id: { in: pending.map((item) => item.id) } }
        });

        return {
          association,
          recoveredReadings: recovered.length,
          discardedReadings: pending.length - recovered.length
        };
      });

      publishEvent({ type: 'devices', enterpriseId, coldUnitIds: [coldUnitId] });

      return result;
    } catch (error: any) {
      // Índice único parcial: dois vínculos simultâneos para a mesma placa
      if (error.code === 'P2002') {
        throw new Error("Esta placa acabou de ser vinculada por outra requisição. Tente novamente.");
      }

      throw error;
    }
  }
}

export { BindDeviceService };
