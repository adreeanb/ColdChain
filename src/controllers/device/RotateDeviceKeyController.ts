import type { Request, Response } from 'express';
import { RotateDeviceKeyService } from '../../services/device/RotateDeviceKeyService.js';

class RotateDeviceKeyController {
  async handle(req: Request, res: Response) {
    const id = req.params.id as string;

    const rotateDeviceKeyService = new RotateDeviceKeyService();

    try {
      const result = await rotateDeviceKeyService.execute(id);
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
}

export { RotateDeviceKeyController };
