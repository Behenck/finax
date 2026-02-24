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

describe("invites routes smoke", () => {
  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it("POST /invites/:inviteId/accept should be registered", async () => {
    const url = fillPathParams("/invites/:inviteId/accept")
    const agent = request(app.server)
    const response = await agent.post(url).send({})

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

  it("POST /invites/:inviteId/reject should be registered", async () => {
    const url = fillPathParams("/invites/:inviteId/reject")
    const agent = request(app.server)
    const response = await agent.post(url).send({})

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

  it("GET /invites/:inviteId should be registered", async () => {
    const url = fillPathParams("/invites/:inviteId")
    const agent = request(app.server)
    const response = await agent.get(url)

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

  it("DELETE /organizations/:slug/invites/:inviteId should be registered", async () => {
    const url = fillPathParams("/organizations/:slug/invites/:inviteId")
    const agent = request(app.server)
    const response = await agent.delete(url)

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

  it("POST /organizations/:slug/invites/link should be registered", async () => {
    const url = fillPathParams("/organizations/:slug/invites/link")
    const agent = request(app.server)
    const response = await agent.post(url).send({})

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

  it("GET /organizations/:slug/invites should be registered", async () => {
    const url = fillPathParams("/organizations/:slug/invites")
    const agent = request(app.server)
    const response = await agent.get(url)

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

  it("POST /organizations/:slug/invites should be registered", async () => {
    const url = fillPathParams("/organizations/:slug/invites")
    const agent = request(app.server)
    const response = await agent.post(url).send({})

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

  it("GET /pending-invites should be registered", async () => {
    const url = fillPathParams("/pending-invites")
    const agent = request(app.server)
    const response = await agent.get(url)

    expect(response.statusCode).not.toBe(404)
    expect(response.statusCode).not.toBe(405)
  })

})
