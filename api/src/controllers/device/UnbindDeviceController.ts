import type { Request, Response } from 'express';
import { UnbindDeviceService } from '../../services/device/UnbindDeviceService.js';
import { sendError } from '../../lib/httpError.js';

class UnbindDeviceController {
  async handle(req: Request, res: Response) {
    const { id } = req.params;

    if (typeof id !== 'string') {
      return res.status(400).json({ error: 'ID da placa inválido.' });
    }

    const unbindDeviceService = new UnbindDeviceService();

    try {
      const result = await unbindDeviceService.execute({ id, enterpriseId: req.user.enterpriseId });
      return res.json(result);
    } catch (error: any) {
      return sendError(res, 400, error);
    }
  }
}

export { UnbindDeviceController };
