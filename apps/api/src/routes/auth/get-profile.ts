import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { BadRequestError } from "../_errors/bad-request-error";

export async function getProfile(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).get("/profile", {
    schema: {
      tags: ["auth"],
      summary: "Get current user's profile",
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          user: z.object({
            id: z.uuid(),
            name: z.string().nullable(),
            email: z.email(),
            avatarUrl: z.url().nullable()
          })
        })
      }
    },
  },
    async (req, reply) => {
      const userId = await req.getCurrentUserId()

      const user = await prisma.user.findUnique({
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true
        },
        where: {
          id: userId
        }
      })

      if (!user) {
        throw new BadRequestError("User not found.")
      }

      return reply.send({ user })
    })
}