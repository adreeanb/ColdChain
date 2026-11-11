import { prisma } from '../../lib/prisma.js';
import { generateDeviceKey, hashDeviceKey } from '../../lib/deviceKey.js';

class RotateDeviceKeyService {
  // A chave só aparece nesta resposta: o banco guarda apenas o hash. A anterior deixa de valer.
  async execute(id: string) {
    const device = await prisma.coldUnitDevice.findUnique({ where: { id } });

    if (!device) {
      throw new Error("Placa não encontrada.");
    }

    const deviceKey = generateDeviceKey();

    await prisma.coldUnitDevice.update({
      where: { id },
      data: { apiKeyHash: hashDeviceKey(deviceKey) }
    });

    return { deviceId: id, macAddress: device.macAddress, deviceKey };
  }
}

export { RotateDeviceKeyService };
