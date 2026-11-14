import type { Request, Response } from 'express';
import { ListDevicesService } from '../../services/device/ListDevicesService.js';
import { resolveEnterpriseId } from '../../lib/tenant.js';
import { sendError } from '../../lib/httpError.js';

class ListDevicesController {
  async handle(req: Request, res: Response) {
    const enterpriseId = resolveEnterpriseId(req.user, req.query.enterpriseId);
    const includeInactive = req.query.includeInactive === 'true';

    const listDevicesService = new ListDevicesService();

    try {
      const devices = await listDevicesService.execute({ enterpriseId, includeInactive });
      return res.json(devices);
    } catch (error: any) {
      return sendError(res, 400, error);
    }
  }
}

export { ListDevicesController };
