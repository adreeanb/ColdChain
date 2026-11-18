import type { Request, Response } from 'express';
import { ActivateDeviceService } from '../../services/device/ActivateDeviceService.js';
import { sendError } from '../../lib/httpError.js';

class ActivateDeviceController {
  async handle(req: Request, res: Response) {
    const id = req.params.id as string;

    const activateDeviceService = new ActivateDeviceService();

    try {
      const result = await activateDeviceService.execute(id);
      return res.json(result);
    } catch (error: any) {
      return sendError(res, 400, error);
    }
  }
}

export { ActivateDeviceController };
