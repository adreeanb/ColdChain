import type { Request, Response } from 'express';
import { UpdateUserService } from '../../services/user/UpdateUserService.js';
import { resolveEnterpriseId } from '../../lib/tenant.js';
import { sendError } from '../../lib/httpError.js';

class UpdateUserController {
  async handle(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, email, role } = req.body;
      const enterpriseId = resolveEnterpriseId(req.user, req.query.enterpriseId);

      if (typeof id !== 'string') {
        return res.status(400).json({ error: 'ID do usuário inválido.' });
      }

      const updateUserService = new UpdateUserService();
      const user = await updateUserService.execute({
        id,
        enterpriseId,
        actorId: req.user.id,
        actorRole: req.user.role,
        name,
        email,
        role
      });

      return res.json(user);
    } catch (error: any) {
      return sendError(res, 400, error);
    }
  }
}
export { UpdateUserController };
