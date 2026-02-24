import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import { compare } from "bcryptjs"
import { randomUUID } from "node:crypto"
import { prisma } from "../../lib/prisma"
import { createTestApp } from "../../utils/test-app"
import { makeUser } from "../../factories/make-user"

let app: any

describe("Reset password", () => {
  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it("should reset password and delete recover token", async () => {
    const { user } = await makeUser()
    const newPassword = "654321"

    const token = await prisma.token.create({
      data: {
        type: "PASSWORD_RECOVER",
        userId: user.id,
        token: `recover-${Date.now()}-${Math.random()}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    const response = await request(app.server)
      .post("/password/reset")
      .send({
        code: token.id,
        password: newPassword,
      })

    expect(response.statusCode).toBe(200)

    const dbToken = await prisma.token.findUnique({ where: { id: token.id } })
    expect(dbToken).toBeNull()

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    expect(dbUser?.passwordHash).toBeTruthy()
    expect(await compare(newPassword, dbUser!.passwordHash!)).toBe(true)

    const loginWithNewPassword = await request(app.server)
      .post("/sessions/password")
      .send({ email: user.email, password: newPassword })

    expect(loginWithNewPassword.statusCode).toBe(200)
  })

  it("should not reset password with an invalid code", async () => {
    const { user } = await makeUser()
    const previousHash = user.passwordHash

    const response = await request(app.server)
      .post("/password/reset")
      .send({
        code: randomUUID(),
        password: "654321",
      })

    expect(response.statusCode).toBeGreaterThanOrEqual(400)

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    expect(dbUser?.passwordHash).toBe(previousHash)
  })
})
