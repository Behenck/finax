import fastify from "fastify"
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod"
import { fastifyCors } from "@fastify/cors"
import { fastifyJwt } from "@fastify/jwt"
import { fastifySwagger } from "@fastify/swagger"
import ScalarApiReference from '@scalar/fastify-api-reference'

import { authRoutes } from "./routes/auth"
import { inviteRoutes } from "./routes/invites"
import { memberRoutes } from "./routes/members"
import { organizationRoutes } from "./routes/orgs"
import { companyRoutes } from "./routes/companies"
import { unitRoutes } from "./routes/units"
import { categoryRoutes } from "./routes/categories"
import { costCenterRoutes } from "./routes/cost-centers"
import { employeeRoutes } from "./routes/employees"
import { transactionRoutes } from "./routes/transactions"
import { recurrencesRoutes } from "./routes/recurrences"
import { customerRoute } from "./routes/customers"

const app = fastify().withTypeProvider<ZodTypeProvider>()

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

app.register(fastifyCors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true, // envie automaticamente os cookies (auth via sessões)
})

app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Webhook Inspector API',
      description: 'API for capturing and inspecting webhook requests',
      version: '1.0.0'
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: "JWT"
        }
      }
    }
  },
  transform: jsonSchemaTransform,
})

app.register(ScalarApiReference, {
  routePrefix: '/docs',
  configuration: {
    authentication: {
      preferredSecurityScheme: "bearerAuth",
    },
  },
})

app.get("/docs/json", async () => {
  return app.swagger();
});

app.get('/health', async () => {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }
})

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
  throw new Error('🚨 variável de ambiente JWT_SECRET não definida!')
}

app.register(fastifyJwt, {
  secret: jwtSecret,
  sign: {
    expiresIn: '1d'
  }
})

app.register(authRoutes)
app.register(inviteRoutes)
app.register(memberRoutes)
app.register(organizationRoutes)

app.register(companyRoutes)
app.register(unitRoutes)
app.register(categoryRoutes)
app.register(costCenterRoutes)
app.register(employeeRoutes)

app.register(customerRoute)

app.register(transactionRoutes)
app.register(recurrencesRoutes)


app.listen({ port: 3333, host: '0.0.0.0' }).then(() => {
  console.log('🔥 HTTP server running on http://localhost:3333')
  console.log('📚 Docs available at http://localhost:3333/docs')
})