import type { Response } from 'express';

// Os services sinalizam regras de negócio com `throw new Error(mensagem)`: essa mensagem foi
// escrita para o usuário e pode ser devolvida. Qualquer outro erro (Prisma, pg, TypeError...)
// é inesperado e pode conter detalhes internos, como SQL, nomes de tabelas ou caminhos.
export function isBusinessError(error: unknown): error is Error {
  return error instanceof Error && error.constructor === Error;
}

// Prisma recusou o formato de um dado vindo da requisição (ex.: id que não é UUID)
function isInvalidInput(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  return error.name === 'PrismaClientValidationError' || code === 'P2023';
}

export const INTERNAL_ERROR_MESSAGE = 'Erro interno. Tente novamente em instantes.';

// Responde com a mensagem do service quando ela é de negócio; nos demais casos registra o erro
// completo no log e devolve uma mensagem genérica, sem vazar detalhes internos.
export function sendError(res: Response, status: number, error: unknown) {
  if (isBusinessError(error)) {
    return res.status(status).json({ error: error.message });
  }

  if (isInvalidInput(error)) {
    return res.status(400).json({ error: 'Dados inválidos na requisição.' });
  }

  console.error(`❌ Erro inesperado em ${res.req.method} ${res.req.path}:`, error);
  return res.status(500).json({ error: INTERNAL_ERROR_MESSAGE });
}
