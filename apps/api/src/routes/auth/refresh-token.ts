import { prisma } from "@/lib/prisma";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { issueAuthTokenPair } from "./google-session-helpers";

export async function refreshTokenRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/sessions/refresh",
    {
      schema: {
        summary: "Refresh access token using a refresh token",
        tags: ["auth"],
        body: z.object({
          refreshToken: z.string().min(10)
        }),
        response: {
          200: z.object({
            accessToken: z.string(),
            refreshToken: z.string()
          }),
          401: z.object({ message: z.string() })
        }
      }
    },
    async (req, reply) => {
      const { refreshToken } = req.body

      const stored = await prisma.refreshToken.findUnique({
        where: { token: refreshToken }
      })

      if (!stored || stored.revoked) {
        return reply.status(401).send({ message: 'Invalid refresh token' })
      }

      let payload: { sub: string }
      try {
        payload = app.jwt.verify<{ sub: string }>(refreshToken)
      } catch {
        return reply.status(401).send({ message: 'Invalid refresh token' })
      }

      const userId = payload.sub
      const user = await prisma.user.findUnique({ where: { id: userId } })

      if (!user) {
        return reply.status(401).send({ message: 'User not found' })
      }

      // revoke old token
      await prisma.refreshToken.update({ where: { token: refreshToken }, data: { revoked: true } })

      const tokenPair = await issueAuthTokenPair(reply, user.id)

      return reply.send(tokenPair)
    }
  )
}
