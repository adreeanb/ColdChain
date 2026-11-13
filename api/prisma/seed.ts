import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const MIN_PASSWORD_LENGTH = 8
// Senhas de exemplo ou triviais que nunca podem criar o MASTER
const FORBIDDEN_PASSWORDS = new Set(['123456', '12345678', 'troque-esta-senha-do-master'])

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`A variável de ambiente ${name} não está definida.`)
  }
  return value
}

const databaseUrl = requiredEnv('DATABASE_URL')
// O MASTER vem do .env: nada de credenciais fixas no repositório
const masterName = process.env.SEED_MASTER_NAME || 'Administrador'
const masterEmail = requiredEnv('SEED_MASTER_EMAIL')
const masterPassword = requiredEnv('SEED_MASTER_PASSWORD')

if (masterPassword.length < MIN_PASSWORD_LENGTH || FORBIDDEN_PASSWORDS.has(masterPassword)) {
  throw new Error(`SEED_MASTER_PASSWORD fraca: use pelo menos ${MIN_PASSWORD_LENGTH} caracteres e não deixe o valor do .env.example.`)
}

const adapter = new PrismaPg({ connectionString: databaseUrl })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Iniciando o seed do banco de dados...');

  // 1. Cria a primeira Empresa (Utilizando upsert para não duplicar se rodar 2x)
  const enterprise = await prisma.enterprise.upsert({
    where: { cnpj: '00000000000191' },
    update: {},
    create: {
      name: 'CTech - Cold Chain Logistics',
      cnpj: '00000000000191',
    },
  });
  console.log(`✅ Empresa criada: ${enterprise.name}`);

  // 2. Cria o usuário MASTER associado à empresa. Se o e-mail já existir, nada muda
  // (nem a senha): para trocar, use a tela de perfil.
  const masterUser = await prisma.user.upsert({
    where: { email: masterEmail },
    update: {},
    create: {
      name: masterName,
      email: masterEmail,
      password: await bcrypt.hash(masterPassword, 10),
      role: 'MASTER',
      enterpriseId: enterprise.id,
    },
  });
  console.log(`✅ Usuário MASTER: ${masterUser.email}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
