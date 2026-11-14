import type { Request, Response } from 'express';
import { IngestTelemetryService } from '../../services/telemetry/IngestTelemetryService.js';
import { sendError } from '../../lib/httpError.js';

class CreateTemperatureReadingController {
  async handle(req: Request, res: Response) {
    // Uma leitura ({ macAddress, temperature, timestamp }) ou um lote ({ macAddress, readings: [...] }).
    // A chave da placa vem no header X-Device-Key.
    const { macAddress, temperature, timestamp, readings, sourceType } = req.body ?? {};

    const ingestTelemetryService = new IngestTelemetryService();

    try {
      const result = await ingestTelemetryService.execute({
        macAddress,
        deviceKey: req.get('x-device-key'),
        sourceType: sourceType === 'HISTORICAL' ? 'HISTORICAL' : 'REALTIME',
        readings: readings ?? [{ temperature, timestamp }]
      });

      if (result.status === 'DISCARDED') {
        return res.status(404).json({ error: "Placa não cadastrada ou desativada." });
      }

      if (result.status === 'UNAUTHORIZED') {
        return res.status(401).json({ error: "Chave da placa inválida." });
      }

      const { status, ...counts } = result;

      // 201: algo virou leitura oficial. 202: tudo ficou retido na quarentena até o vínculo.
      // 200: só reenvios, e o hardware pode apagar a cópia local.
      const httpStatus = counts.stored > 0 ? 201 : counts.quarantined > 0 ? 202 : 200;

      return res.status(httpStatus).json(counts);
    } catch (error: any) {
      return sendError(res, 400, error);
    }
  }
}

export { CreateTemperatureReadingController };
