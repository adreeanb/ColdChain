import { rateLimit } from 'express-rate-limit';

// Por IP. Atrás de um proxy reverso, TRUST_PROXY precisa estar definido para o IP ser o do cliente.

// Login: dificulta a força bruta de senhas. Logins bem-sucedidos não contam.
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' }
});

// Telemetria por HTTP: generoso, porque várias placas podem sair pelo mesmo IP (NAT)
export const telemetryRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas leituras enviadas. Aguarde um minuto.' }
});
