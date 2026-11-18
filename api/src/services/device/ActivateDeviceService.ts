import { prisma } from '../../lib/prisma.js';
import { publishEvent } from '../../lib/eventBus.js';
import { generateDeviceKey, hashDeviceKey } from '../../lib/deviceKey.js';

class ActivateDeviceService {
  // Reativa uma placa desativada, na mesma empresa. Gera uma chave nova: a antiga pode ter se perdido
  // ou vazado junto com a placa. Ela volta sem vínculo, e as leituras vão para a quarentena até o QR Code.
  async execute(id: string) {
    const device = await prisma.coldUnitDevice.findFirst({
      where: { id, isActive: false },
      include: { enterprise: { select: { isDeleted: true } } }
    });

    if (!device) {
      throw new Error("Placa não encontrada ou já ativa.");
    }

    if (device.enterprise.isDeleted) {
      throw new Error("A empresa desta placa foi excluída. Não é possível reativá-la.");
    }

    const deviceKey = generateDeviceKey();

    await prisma.coldUnitDevice.update({
      where: { id },
      data: { isActive: true, apiKeyHash: hashDeviceKey(deviceKey) }
    });

    publishEvent({ type: 'devices', enterpriseId: device.enterpriseId });

    return { deviceId: id, macAddress: device.macAddress, deviceKey };
  }
}

export { ActivateDeviceService };
