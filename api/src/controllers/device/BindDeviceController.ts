import type { Request, Response } from 'express';
import { BindDeviceService } from '../../services/device/BindDeviceService.js';
import { sendError } from '../../lib/httpError.js';

class BindDeviceController {
  async handle(req: Request, res: Response) {
    // O macAddress vem do QR Code impresso na placa
    const { macAddress, coldUnitId, quarantine, recoverFrom } = req.body;
    const enterpriseId = req.user.enterpriseId;

    const bindDeviceService = new BindDeviceService();

    try {
      const result = await bindDeviceService.execute({ macAddress, coldUnitId, enterpriseId, quarantine, recoverFrom });
      return res.status(201).json(result);
    } catch (error: any) {
      return sendError(res, 400, error);
    }
  }
}

export { BindDeviceController };
