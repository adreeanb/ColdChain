import { prisma } from '../../lib/prisma.js';
import { getOfflineThresholdMinutes, isRecent } from '../../lib/deviceStatus.js';

interface ListDevicesRequest {
  enterpriseId: string;
  includeInactive?: boolean;
}

class ListDevicesService {
  async execute({ enterpriseId, includeInactive = false }: ListDevicesRequest) {
    const devices = await prisma.coldUnitDevice.findMany({
      where: { enterpriseId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { macAddress: 'asc' },
      include: {
        // Vínculo atual: endDate nulo
        associations: {
          where: { endDate: null },
          include: {
            coldUnit: {
              select: {
                id: true,
                name: true,
                type: true
              }
            }
          }
        }
      }
    });

    return devices.map((device) => ({
      ...device,
      isOnline: device.isActive && isRecent(device.lastSeenAt),
      offlineThresholdMinutes: getOfflineThresholdMinutes()
    }));
  }
}

export { ListDevicesService };
