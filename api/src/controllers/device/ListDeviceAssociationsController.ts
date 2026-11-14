import type { Request, Response } from 'express';
import { ListDeviceAssociationsService } from '../../services/device/ListDeviceAssociationsService.js';
import { sendError } from '../../lib/httpError.js';

class ListDeviceAssociationsController {
  async handle(req: Request, res: Response) {
    const { id } = req.params;

    if (typeof id !== 'string') {
      return res.status(400).json({ error: 'ID da placa inválido.' });
    }

    const listDeviceAssociationsService = new ListDeviceAssociationsService();

    try {
      const associations = await listDeviceAssociationsService.execute({ id, enterpriseId: req.user.enterpriseId });
      return res.json(associations);
    } catch (error: any) {
      return sendError(res, 404, error);
    }
  }
}

export { ListDeviceAssociationsController };
