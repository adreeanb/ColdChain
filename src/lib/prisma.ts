import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import process from 'process';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

const adapter = new PrismaPg(pool);
// O hash da chave da placa nunca sai nas respostas. Quem precisa dele pede com omit: { apiKeyHash: false }.
const basePrisma = new PrismaClient({ adapter, omit: { coldUnitDevice: { apiKeyHash: true } } });

const SOFT_DELETE_MODELS = ['Enterprise', 'User', 'ColdUnit']

// findUnique fica de fora: as checagens de CNPJ/e-mail duplicado precisam enxergar registros excluídos
const FILTERED_OPERATIONS = ['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy']

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!SOFT_DELETE_MODELS.includes(model)) {
          return query(args)
        }

        const softArgs = args as any
        // O client expõe os modelos em camelCase (ColdUnit -> coldUnit)
        const delegate = (basePrisma as any)[model.charAt(0).toLowerCase() + model.slice(1)]

        // 1. Intercepta consultas de leitura
        if (FILTERED_OPERATIONS.includes(operation)) {
          softArgs.where = { isDeleted: false, ...softArgs.where }
        }

        // 2. Intercepta deleções. Usam o client base, então ficam fora de um $transaction:
        // dentro de transações, use update/updateMany com isDeleted: true
        if (operation === 'delete') {
          return delegate.update({ ...softArgs, data: { isDeleted: true } })
        }

        if (operation === 'deleteMany') {
          return delegate.updateMany({ ...softArgs, data: { isDeleted: true } })
        }

        return query(softArgs)
      },
    },
  },
})

// Cliente recebido dentro de prisma.$transaction(async (tx) => ...), com a extensão acima
export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
