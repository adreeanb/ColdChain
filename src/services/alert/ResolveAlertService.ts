import { prisma } from '../../lib/prisma.js';
import { publishEvent } from '../../lib/eventBus.js';

interface ResolveAlertRequest {
  alertId: string;
  enterpriseId: string;
}

class ResolveAlertService {
  async execute({ alertId, enterpriseId }: ResolveAlertRequest) {
    // 1. Validação de Segurança (IDOR): O alerta pertence a uma máquina dessa empresa?
    const alertExists = await prisma.alert.findFirst({
      where: { 
        id: alertId, 
        resolvedAt: null, // Garante que ainda não foi resolvido
        coldUnit: {
          enterpriseId: enterpriseId,
          isDeleted: false
        }
      }
    });

    if (!alertExists) {
      // Mensagem genérica por segurança (não confirma se o ID existe em outra empresa)
      throw new Error("Alerta não encontrado, já resolvido ou acesso negado.");
    }

    // 2. Resolve o alerta se a validação passar. Resolver também encerra o episódio:
    // se a temperatura continuar fora da faixa, a próxima leitura abre um alerta novo.
    const resolvedAlert = await prisma.alert.update({
      where: {
        id: alertId
      },
      data: {
        resolvedAt: new Date(),
        endedAt: alertExists.endedAt ?? alertExists.lastReadingAt
      }
    });

    publishEvent({ type: 'alerts', enterpriseId, coldUnitIds: [resolvedAlert.coldUnitId] });

    return resolvedAlert;
  }
}

export { ResolveAlertService };