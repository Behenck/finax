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

describe("partners routes smoke", () => {
  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it("PATCH /organizations/:slug/partners/:partnerId/assign-supervisor should be registered", async () => {
    const url = fillPathParams("/organizations/:slug/partners/:partnerId/assign-supervisor")
    const agent = request(app.server)
    const response = await agent.patch(url).send({})

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

  it("DELETE /organizations/:slug/partners/:partnerId should be registered", async () => {
    const url = fillPathParams("/organizations/:slug/partners/:partnerId")
    const agent = request(app.server)
    const response = await agent.delete(url)

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

  it("GET /organizations/:slug/partners/:partnerId should be registered", async () => {
    const url = fillPathParams("/organizations/:slug/partners/:partnerId")
    const agent = request(app.server)
    const response = await agent.get(url)

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

  it("PUT /organizations/:slug/partners/:partnerId should be registered", async () => {
    const url = fillPathParams("/organizations/:slug/partners/:partnerId")
    const agent = request(app.server)
    const response = await agent.put(url).send({})

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

  it("GET /organizations/:slug/partners should be registered", async () => {
    const url = fillPathParams("/organizations/:slug/partners")
    const agent = request(app.server)
    const response = await agent.get(url)

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

  it("POST /organizations/:slug/partners should be registered", async () => {
    const url = fillPathParams("/organizations/:slug/partners")
    const agent = request(app.server)
    const response = await agent.post(url).send({})

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

})
