import { describe, it, expect } from "vitest"
import { makeUser } from "../../factories/make-user"
import { prisma } from "@/lib/prisma"

describe("Create account factory", () => {

  it("should create a user in database", async () => {

    const { user } = await makeUser()

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id }
    })

    expect(dbUser).not.toBeNull()
    expect(dbUser?.email).toBe(user.email)
  })

})
