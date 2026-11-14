import type { NextFunction, Request, Response } from 'express';
import { INTERNAL_ERROR_MESSAGE } from '../lib/httpError.js';

interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

// Último middleware: pega o que os controllers não trataram (erros do express.json e exceções
// fora do try/catch). Nunca devolve stack nem mensagem interna.
export function errorHandler(error: BodyParserError, req: Request, res: Response, _next: NextFunction) {
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Requisição grande demais.' });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido.' });
  }

  console.error(`❌ Erro não tratado em ${req.method} ${req.path}:`, error);

  if (res.headersSent) {
    return res.end();
  }

  return res.status(500).json({ error: INTERNAL_ERROR_MESSAGE });
}
