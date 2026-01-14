import { prisma } from "@/lib/prisma";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export async function requestPasswordRecover(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post("/password/recover", {
    schema: {
      tags: ["auth"],
      summary: "Request password recovery",
      body: z.object({
        email: z.email()
      }),
      response: {
        201: z.null()
      }
    }
  },
    async (req, reply) => {
      const { email } = req.body;

      const userFromEmail = await prisma.user.findUnique({
        where: {
          email
        }
      })

      if (!userFromEmail) {
        return reply.status(201).send()
      }

      const { id: code } = await prisma.token.create({
        data: {
          type: "PASSWORD_RECOVERY",
          userId: userFromEmail.id
        }
      })

      console.log("Recover password token ", code)

      return reply.status(201).send()
    });
}