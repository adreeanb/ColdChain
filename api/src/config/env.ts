import 'dotenv/config';

// Valores dos arquivos de exemplo: nunca valem em produção
const EXAMPLE_VALUES = new Set([
  'troque-por-um-segredo-longo',
  'troque-esta-senha',
  'troque-esta-senha-das-placas'
]);

const MIN_JWT_SECRET_LENGTH = 32;

export const isProduction = process.env.NODE_ENV === 'production';

// Confere o .env antes de a API subir. Em produção, qualquer problema impede o início;
// em desenvolvimento, só faltas que quebram a API impedem, o resto vira aviso.
export function validateEnv() {
  const errors: string[] = [];
  const warnings: string[] = [];
  // Em produção um aviso também é erro
  const problem = (message: string) => (isProduction ? errors : warnings).push(message);

  for (const name of ['DATABASE_URL', 'JWT_SECRET']) {
    if (!process.env[name]) {
      errors.push(`${name} não definido.`);
    }
  }

  const jwtSecret = process.env.JWT_SECRET ?? '';
  if (jwtSecret && jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    problem(`JWT_SECRET deve ter pelo menos ${MIN_JWT_SECRET_LENGTH} caracteres (gere com: openssl rand -base64 48).`);
  }

  if (!process.env.CORS_ORIGINS) {
    problem('CORS_ORIGINS não definido: só http://localhost:5173 será aceito.');
  }

  for (const name of ['MQTT_BROKER_URL', 'MQTT_USERNAME', 'MQTT_PASSWORD']) {
    if (!process.env[name]) {
      problem(`${name} não definido.`);
    }
  }

  // Fora da máquina local, usuário, senha e chave das placas só podem trafegar com TLS
  const brokerUrl = process.env.MQTT_BROKER_URL;
  if (isProduction && brokerUrl && !brokerUrl.startsWith('mqtts://')) {
    errors.push('MQTT_BROKER_URL deve usar TLS em produção (mqtts://host:8883).');
  }

  for (const name of ['JWT_SECRET', 'MQTT_PASSWORD', 'MQTT_DEVICE_PASSWORD']) {
    const value = process.env[name];
    if (value && EXAMPLE_VALUES.has(value)) {
      problem(`${name} ainda está com o valor do .env.example.`);
    }
  }

  for (const warning of warnings) {
    console.warn(`⚠️  ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`❌ ${error}`);
    }
    throw new Error('Configuração do ambiente inválida. Corrija o .env e reinicie.');
  }
}

// Origens separadas por vírgula em CORS_ORIGINS. Sem ela, só o Vite local.
export function corsOrigins() {
  const origins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins?.length ? origins : ['http://localhost:5173'];
}
