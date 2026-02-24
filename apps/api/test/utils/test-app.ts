import { buildApp } from "@/app"

export async function createTestApp() {
  const app = buildApp()
  await app.ready()
  return app
}
