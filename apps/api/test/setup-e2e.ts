import { prisma } from "@/lib/prisma"
import { beforeEach } from "vitest"

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "Customer" CASCADE;
  `)
})
