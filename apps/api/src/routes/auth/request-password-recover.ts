import { prisma } from "@/lib/prisma";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { randomBytes } from "node:crypto";
import { Resend } from "resend";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";

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

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) //1h
      const token = randomBytes(32).toString('hex')

      const { id: code } = await prisma.token.create({
        data: {
          type: "PASSWORD_RECOVER",
          userId: userFromEmail.id,
          token,
          expiresAt
        }
      })

      const resend = new Resend(process.env.RESEND_API_KEY);

      const link = `${process.env.APP_WEB_URL}/password/reset?token=${code}`

      const { error } =
        await resend.emails.send({
          to: [email],
          template: {
            id: "password-reset",
            variables: {
              link
            }
          }
        });

      if (error) {
        req.log.error({ error }, "Resend failed to send email")
        throw new BadRequestError(error.message)
      }

      return reply.status(201).send()
    });
}