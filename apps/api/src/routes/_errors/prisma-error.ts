import { Prisma } from 'generated/prisma/client'
import { BadRequestError } from './bad-request-error'

export function handlePrismaError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError
  ) {
    switch (error.code) {
      case 'P2002':
        throw new BadRequestError('Registro já existe.')
    }
  }

  throw error
}
