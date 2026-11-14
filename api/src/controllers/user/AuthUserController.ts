import type { Request, Response } from 'express';
import { AuthUserService } from '../../services/user/AuthUserService.js';
import { sendError } from '../../lib/httpError.js';

class AuthUserController {
  async handle(req: Request, res: Response) {
    const { email, password } = req.body;

    const authUserService = new AuthUserService();

    try {
      const auth = await authUserService.execute({ email, password });
      return res.json(auth);
    } catch (error: any) {
      return sendError(res, 401, error);
    }
  }
}

export { AuthUserController };