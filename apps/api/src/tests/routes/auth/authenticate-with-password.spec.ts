import { describe, beforeAll, afterAll, it, expect } from "vitest"
import request from "supertest"
import { createTestApp } from "../../utils/test-app"
import { makeUser } from "../../factories/make-user"

let app: any

describe("Authenticate user", () => {

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it("should authenticate a user", async () => {

    const { user } = await makeUser()

    const response = await request(app.server)
      .post("/sessions/password")
      .send({
        email: user.email,
        password: user.password,
      })

    expect(response.statusCode).toBe(200)

    expect(response.body).toHaveProperty("accessToken")
    expect(response.body).toHaveProperty("refreshToken")
  })

})
