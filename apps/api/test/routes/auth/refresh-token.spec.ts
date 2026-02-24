import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import { prisma } from "../../lib/prisma"
import { createTestApp } from "../../utils/test-app"
import { makeUser } from "../../factories/make-user"

let app: any

describe("Refresh token", () => {
  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it("should refresh access token and rotate refresh token", async () => {
    const { user } = await makeUser()

    const authResponse = await request(app.server)
      .post("/sessions/password")
      .send({
        email: user.email,
        password: user.password,
      })

    expect(authResponse.statusCode).toBe(200)

    const oldRefreshToken = authResponse.body.refreshToken

    const response = await request(app.server)
      .post("/sessions/refresh")
      .send({ refreshToken: oldRefreshToken })

    expect(response.statusCode).toBe(200)
    expect(response.body).toHaveProperty("accessToken")
    expect(response.body).toHaveProperty("refreshToken")
    expect(response.body.refreshToken).not.toBe(oldRefreshToken)

    const oldToken = await prisma.refreshToken.findUnique({ where: { token: oldRefreshToken } })
    const newToken = await prisma.refreshToken.findUnique({ where: { token: response.body.refreshToken } })

    expect(oldToken?.revoked).toBe(true)
    expect(newToken?.userId).toBe(user.id)
  })

  it("should return 401 when refresh token is invalid", async () => {
    const response = await request(app.server)
      .post("/sessions/refresh")
      .send({ refreshToken: "invalid-refresh-token-value" })

    expect(response.statusCode).toBe(401)
    expect(response.body.message).toBe("Invalid refresh token")
  })
})
