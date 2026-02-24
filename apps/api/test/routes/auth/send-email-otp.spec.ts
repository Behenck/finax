import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import request from "supertest"
import { prisma } from "../../lib/prisma"
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

describe("Send email OTP", () => {
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

  it("should create an EMAIL_VERIFICATION token and send email", async () => {
    const { user } = await makeUser()

    const previousToken = await prisma.token.create({
      data: {
        type: "EMAIL_VERIFICATION",
        userId: user.id,
        token: `old-otp-${Date.now()}`,
        expiresAt: new Date(Date.now() + 60 * 1000),
      },
    })

    const response = await request(app.server)
      .post("/auth/send-email-otp")
      .send({ email: user.email })

    expect(response.statusCode).toBe(204)
    expect(sendEmailMock).toHaveBeenCalledTimes(1)

    const updatedPreviousToken = await prisma.token.findUnique({ where: { id: previousToken.id } })
    expect(updatedPreviousToken?.usedAt).not.toBeNull()

    const latestToken = await prisma.token.findFirst({
      where: {
        userId: user.id,
        type: "EMAIL_VERIFICATION",
      },
      orderBy: { createdAt: "desc" },
    })

    expect(latestToken).not.toBeNull()
    expect(latestToken?.id).not.toBe(previousToken.id)
    expect(latestToken?.usedAt).toBeNull()

    const payload = sendEmailMock.mock.calls[0]?.[0]
    expect(payload.to).toEqual([user.email])
    expect(payload.template.id).toBe("verification-code")
    expect(typeof payload.template.variables.otpCode).toBe("string")
    expect(payload.template.variables.otpCode).toMatch(/^\d{6}$/)
  })
})
