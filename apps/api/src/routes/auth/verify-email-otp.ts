import { prisma } from "@/lib/prisma";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { compare } from "bcryptjs";

type TokenPair = {
  accessToken: string
  refreshToken: string
}

export async function verifyEmailOTP(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post("/auth/verify-otp", {
    schema: {
      tags: ["auth"],
      summary: "Get code verify email",
      body: z.object({
        email: z.email(),
        code: z.string().regex(/^\d{6}$/, {
          message: "O código deve conter exatamente 6 dígitos numéricos",
        }),
      }),
      response: {
        200: z.object({
          accessToken: z.string(),
          refreshToken: z.string()
        }),
      }
    },
  },
    async (req, reply) => {
      const { email, code } = req.body

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new BadRequestError("Usuário não encontrado.");
      }

      const token = await prisma.token.findFirst({
        where: {
          userId: user.id,
          type: "EMAIL_VERIFICATION",
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!token) {
        throw new BadRequestError("Código inválido ou expirado.")
      }

      const isValid = await compare(code, token.token)

      if (!isValid) {
        throw new BadRequestError("Código inválido.")
      }

      const now = new Date();

      await prisma.$transaction([
        prisma.token.update({
          where: { id: token.id },
          data: { usedAt: now },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: now },
        }),
      ]);

      const accessToken = await reply.jwtSign({
        sub: user.id,
      })
      // create a refresh token string (random long value) and persist
      const refreshTokenValue = await reply.jwtSign({
        sub: user.id,
      }, { expiresIn: '30d' })

      // prisma client might need regeneration after schema change; use any to avoid type errors until generated client is updated
      await prisma.refreshToken.create({
        data: {
          token: refreshTokenValue,
          userId: user.id
        }
      })

      const payload: TokenPair = {
        accessToken,
        refreshToken: refreshTokenValue
      }

      return reply.status(200).send(payload)
    }
  );
}