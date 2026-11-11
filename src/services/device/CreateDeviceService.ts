import { prisma } from '../../lib/prisma.js';
import { normalizeMacAddress } from '../../lib/macAddress.js';
import { generateDeviceKey, hashDeviceKey } from '../../lib/deviceKey.js';

interface CreateDeviceRequest {
  macAddress: string;
  enterpriseId: string;
}

class CreateDeviceService {
  async execute({ macAddress, enterpriseId }: CreateDeviceRequest) {
    const normalizedMac = normalizeMacAddress(macAddress);

    if (!normalizedMac) {
      throw new Error("Endereço MAC inválido.");
    }

    const enterprise = await prisma.enterprise.findFirst({
      where: { id: enterpriseId, isDeleted: false }
    });

    if (!enterprise) {
      throw new Error("Empresa não encontrada ou desativada.");
    }

    const deviceAlreadyExists = await prisma.coldUnitDevice.findUnique({
      where: { macAddress: normalizedMac }
    });

    if (deviceAlreadyExists) {
      throw new Error("Já existe uma placa cadastrada com este MAC.");
    }

    // A chave vai para o firmware e só aparece nesta resposta: o banco guarda apenas o hash
    const deviceKey = generateDeviceKey();

    const device = await prisma.coldUnitDevice.create({
      data: {
        macAddress: normalizedMac,
        enterpriseId,
        apiKeyHash: hashDeviceKey(deviceKey)
      }
    });

    return { ...device, deviceKey };
  }
}

export { CreateDeviceService };
