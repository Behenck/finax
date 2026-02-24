import { prisma } from '../../lib/prisma';
import { afterAll, beforeAll, describe, expect, it, vi, beforeEach } from "vitest"
import request from "supertest"
import { createTestApp } from "../../utils/test-app"
import { makeUser } from "../../factories/make-user"

const sendEmailMock = vi.fn()

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: sendEmailMock,
    }
  },
}))

let app: any

describe("Request password recover", () => {
  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    sendEmailMock.mockReset()
    sendEmailMock.mockResolvedValue({ error: null })
  })

  it("should return 201 even when user does not exist", async () => {
    const email = `missing-${Date.now()}@example.com`
    const beforeCount = await prisma.token.count({
      where: { type: "PASSWORD_RECOVER" },
    })

    const response = await request(app.server)
      .post("/password/recover")
      .send({ email })

    expect(response.statusCode).toBe(201)

    const afterCount = await prisma.token.count({
      where: { type: "PASSWORD_RECOVER" },
    })

    const hasTokenForMissingEmail = await prisma.user.findUnique({ where: { email } })
    expect(hasTokenForMissingEmail).toBeNull()
    expect(afterCount).toBe(beforeCount)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("should create a password recovery token and send email", async () => {
    const { user } = await makeUser()

    const response = await request(app.server)
      .post("/password/recover")
      .send({ email: user.email })

    expect(response.statusCode).toBe(201)

    const token = await prisma.token.findFirst({
      where: {
        userId: user.id,
        type: "PASSWORD_RECOVER",
      },
      orderBy: { createdAt: "desc" },
    })

    expect(token).not.toBeNull()
    expect(token?.expiresAt.getTime()).toBeGreaterThan(Date.now())
    expect(sendEmailMock).toHaveBeenCalledTimes(1)

    const payload = sendEmailMock.mock.calls[0]?.[0]
    expect(payload.to).toEqual([user.email])
    expect(payload.template.id).toBe("password-reset")
    expect(payload.template.variables.link).toContain(`/password/reset?token=${token?.id}`)
  })
})
