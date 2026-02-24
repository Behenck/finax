import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import { createTestApp } from "../utils/test-app"

let app: any

describe("Health check", () => {
  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it("should return ok", async () => {
    const response = await request(app.server)
      .get("/health")

    expect(response.body).toMatchObject({
      status: "ok",
    })

    expect(response.body).toHaveProperty("uptime")
    expect(response.body).toHaveProperty("timestamp")
  })
})