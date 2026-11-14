import type { Request, Response } from 'express';
import { ChangePasswordService } from '../../services/user/ChangePasswordService.js';
import { sendError } from '../../lib/httpError.js';

class ChangePasswordController {
  async handle(req: Request, res: Response) {
    const { currentPassword, newPassword } = req.body;

    const changePasswordService = new ChangePasswordService();

    try {
      const result = await changePasswordService.execute({ id: req.user.id, currentPassword, newPassword });
      return res.json(result);
    } catch (error: any) {
      return sendError(res, 400, error);
    }
  }
}

export { ChangePasswordController };
