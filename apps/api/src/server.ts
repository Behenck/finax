import { buildApp } from "./app"

const app = buildApp()

app.listen({ port: 3333, host: '0.0.0.0' }).then(() => {
  console.log('🔥 HTTP server running on http://localhost:3333')
  console.log('📚 Docs available at http://localhost:3333/docs')
})