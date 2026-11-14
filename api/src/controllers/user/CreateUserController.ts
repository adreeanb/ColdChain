import type { Request, Response } from 'express';
import { CreateUserService } from '../../services/user/CreateUserService.js';
import { resolveEnterpriseId } from '../../lib/tenant.js';
import { sendError } from '../../lib/httpError.js';

class CreateUserController {
  async handle(req: Request, res: Response) {
    const { name, email, password, role } = req.body;
    const enterpriseId = resolveEnterpriseId(req.user, req.body.enterpriseId);

    const createUserService = new CreateUserService();

    try {
      const user = await createUserService.execute({ name, email, password, role, enterpriseId });
      return res.status(201).json(user);
    } catch (error: any) {
      return sendError(res, 400, error);
    }
  }
}

export { CreateUserController };
