import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { issueAuthTokenPair } from "./google-session-helpers";

export async function authenticateWithPassword(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post("/sessions/password", {
    schema: {
      summary: "Authenticate user with email and password",
      tags: ["auth"],
      body: z.object({
        email: z.email(),
        password: z.string().min(6)
      }),
      response: {
        200: z.object({
          accessToken: z.string(),
          refreshToken: z.string()
        }),
        401: z.object({
          message: z.string()
        }),
        403: z.object({
          message: z.string()
        })
      }
    },
  },
    async (req, reply) => {
      const { email, password } = req.body

      const userFromEmail = await prisma.user.findUnique({
        where: { email }
      })

      if (!userFromEmail) {
        return reply.status(401).send({ message: "Usuário não encontrado" })
      }

      if (userFromEmail.passwordHash == null) {
        return reply.status(401).send({
          message: "O usuário não possui senha, utilize o login social."
        })
      }

      const passwordValid = await compare(password, userFromEmail.passwordHash)

      if (!passwordValid) {
        return reply.status(401).send({ message: "Credenciais inválidas." })
      }

      if (!userFromEmail.emailVerifiedAt) {
        return reply.status(403).send({
          message: "Para acessar o sistema, primeiro conclua a verificação."
        })
      }

      const payload = await issueAuthTokenPair(reply, userFromEmail.id)

      return reply.status(200).send(payload)
    }
  );
}
