import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// A chave é aleatória e longa: SHA-256 basta, sem o custo do bcrypt a cada leitura
export function generateDeviceKey() {
  return `ck_${randomBytes(24).toString('base64url')}`;
}

export function hashDeviceKey(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

export function verifyDeviceKey(key: unknown, hash: string | null) {
  if (typeof key !== 'string' || !hash) {
    return false;
  }

  const received = Buffer.from(hashDeviceKey(key), 'hex');
  const expected = Buffer.from(hash, 'hex');

  return received.length === expected.length && timingSafeEqual(received, expected);
}
