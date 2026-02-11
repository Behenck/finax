import { prisma } from "@/lib/prisma";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { hash } from "bcryptjs";
import { Resend } from "resend";
import { generateOTP } from "@/utils/generate-otp";

export async function sendEmailOTP(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post("/auth/send-email-otp", {
    schema: {
      tags: ["auth"],
      summary: "Send code OTP email",
      body: z.object({
        email: z.email()
      }),
      response: {
        204: z.null()
      }
    },
  },
    async (req, reply) => {
      const { email } = req.body

      const user = await prisma.user.findUnique({
        where: {
          email
        }
      })

      if (!user) {
        throw new BadRequestError("Usuário não encontrado!")
      }

      // OTP
      const otp = generateOTP()
      const otpHash = await hash(otp, 6)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000) //5min

      await prisma.$transaction([
        prisma.token.updateMany({
          where: {
            userId: user.id,
            type: "EMAIL_VERIFICATION",
            usedAt: null,
          },
          data: { usedAt: new Date() },
        }),

        prisma.token.create({
          data: {
            type: "EMAIL_VERIFICATION",
            token: otpHash,
            expiresAt,
            userId: user.id,
          },
        })
      ])

      const resend = new Resend(process.env.RESEND_API_KEY);

      const { error } =
        await resend.emails.send({
          to: [email],
          template: {
            id: "verification-code",
            variables: {
              otpCode: otp,
            }
          }
        });

      if (error) {
        req.log.error({ error }, "Resend failed to send email")
        throw new BadRequestError(error.message)
      }

      return reply.status(204).send()
    })
}