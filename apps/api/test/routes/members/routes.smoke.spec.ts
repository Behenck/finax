import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import { createTestApp } from "../../utils/test-app"

const UUID_SAMPLE = "11111111-1111-4111-8111-111111111111"

function fillPathParams(path: string) {
  return path
    .replace(/:slug\b/g, "test-org")
    .replace(/:role\b/g, "ADMIN")
    .replace(/:[a-zA-Z]+Id\b/g, UUID_SAMPLE)
    .replace(/:id\b/g, UUID_SAMPLE)
}

let app: any

describe("members routes smoke", () => {
  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it("DELETE /organizations/:slug/members/:memberId should be registered", async () => {
    const url = fillPathParams("/organizations/:slug/members/:memberId")
    const agent = request(app.server)
    const response = await agent.delete(url)

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

  it("PUT /organizations/:slug/members/:memberId should be registered", async () => {
    const url = fillPathParams("/organizations/:slug/members/:memberId")
    const agent = request(app.server)
    const response = await agent.put(url).send({})

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

  it("GET /organizations/:slug/members/:role should be registered", async () => {
    const url = fillPathParams("/organizations/:slug/members/:role")
    const agent = request(app.server)
    const response = await agent.get(url)

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

  it("GET /organizations/:slug/members should be registered", async () => {
    const url = fillPathParams("/organizations/:slug/members")
    const agent = request(app.server)
    const response = await agent.get(url)

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

})
