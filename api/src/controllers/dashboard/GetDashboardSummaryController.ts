import type { Request, Response } from 'express';
import { GetDashboardSummaryService } from '../../services/dashboard/GetDashboardSummaryService.js';
import { sendError } from '../../lib/httpError.js';

class GetDashboardSummaryController {
  async handle(req: Request, res: Response) {
    const getDashboardSummaryService = new GetDashboardSummaryService();

    try {
      const summary = await getDashboardSummaryService.execute(req.user.enterpriseId);
      return res.json(summary);
    } catch (error: any) {
      return sendError(res, 400, error);
    }
  }
}

export { GetDashboardSummaryController };
