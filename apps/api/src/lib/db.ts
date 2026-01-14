import { handlePrismaError } from "@/routes/_errors/prisma-error"

export async function db<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    return handlePrismaError(error)
  }
}
