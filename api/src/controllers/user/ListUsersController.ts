import type { Request, Response } from 'express';
import { ListUsersService } from '../../services/user/ListUsersService.js';
import { resolveEnterpriseId } from '../../lib/tenant.js';
import { sendError } from '../../lib/httpError.js';

class ListUsersController {
  async handle(req: Request, res: Response) {
    const listUsersService = new ListUsersService();

    try {
      const users = await listUsersService.execute(resolveEnterpriseId(req.user, req.query.enterpriseId));
      return res.json(users);
    } catch (error: any) {
      return sendError(res, 400, error);
    }
  }
}

export { ListUsersController };
