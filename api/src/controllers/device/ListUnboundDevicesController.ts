import type { Request, Response } from 'express';
import { ListUnboundDevicesService } from '../../services/device/ListUnboundDevicesService.js';
import { sendError } from '../../lib/httpError.js';

class ListUnboundDevicesController {
  async handle(req: Request, res: Response) {
    const listUnboundDevicesService = new ListUnboundDevicesService();

    try {
      const devices = await listUnboundDevicesService.execute(req.user.enterpriseId);
      return res.json(devices);
    } catch (error: any) {
      return sendError(res, 400, error);
    }
  }
}

export { ListUnboundDevicesController };
