import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import { hash } from "bcryptjs"
import { prisma } from "../../lib/prisma"
import { createTestApp } from "../../utils/test-app"
import { makeUser } from "../../factories/make-user"

let app: any

describe("Verify email OTP", () => {
  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it("should verify email, mark token as used and return tokens", async () => {
    const { user } = await makeUser()
    const code = "123456"

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: null },
    })

    const token = await prisma.token.create({
      data: {
        type: "EMAIL_VERIFICATION",
        userId: user.id,
        token: await hash(code, 6),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })

    const response = await request(app.server)
      .post("/auth/verify-otp")
      .send({
        email: user.email,
        code,
      })

    expect(response.statusCode).toBe(200)
    expect(response.body).toHaveProperty("accessToken")
    expect(response.body).toHaveProperty("refreshToken")

    const dbToken = await prisma.token.findUnique({ where: { id: token.id } })
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    const refreshToken = await prisma.refreshToken.findUnique({ where: { token: response.body.refreshToken } })

    expect(dbToken?.usedAt).not.toBeNull()
    expect(dbUser?.emailVerifiedAt).not.toBeNull()
    expect(refreshToken?.userId).toBe(user.id)
  })

  it("should reject invalid OTP code", async () => {
    const { user } = await makeUser()

    await prisma.token.create({
      data: {
        type: "EMAIL_VERIFICATION",
        userId: user.id,
        token: await hash("123456", 6),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })

    const response = await request(app.server)
      .post("/auth/verify-otp")
      .send({
        email: user.email,
        code: "654321",
      })

    expect(response.statusCode).toBeGreaterThanOrEqual(400)
  })
})
