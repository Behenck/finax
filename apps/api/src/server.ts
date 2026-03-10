import { buildApp } from "./app"

const app = buildApp()

const port = Number(process.env.PORT) || 3333

app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`🔥 HTTP server running on http://localhost:${port}`)
  console.log(`📚 Docs available at http://localhost:${port}/docs`)
})