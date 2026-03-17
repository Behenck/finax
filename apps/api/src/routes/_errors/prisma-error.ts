import { Prisma } from 'generated/prisma/client'
import { BadRequestError } from './bad-request-error'

export function handlePrismaError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError
  ) {
    switch (error.code) {
      case 'P2002':
        throw new BadRequestError('Registro já existe.')
      case 'P2011':
        throw new BadRequestError(
          'Estrutura do banco desatualizada (restrição de coluna). Execute as migrações pendentes e tente novamente.',
        )
      case 'P2021': {
        const tableName =
          typeof error.meta?.table === 'string'
            ? error.meta.table
            : 'uma tabela necessária'

        throw new BadRequestError(
          `Estrutura do banco desatualizada (${tableName}). Execute as migrações pendentes e tente novamente.`,
        )
      }
      case 'P2022': {
        const columnName =
          typeof error.meta?.column === 'string'
            ? error.meta.column
            : 'uma coluna necessária'

        throw new BadRequestError(
          `Estrutura do banco desatualizada (${columnName}). Execute as migrações pendentes e tente novamente.`,
        )
      }
    }
  }

  throw error
}
