import { prisma } from "@/lib/prisma";
import type { FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";

export type AuthTokenPair = {
	accessToken: string;
	refreshToken: string;
};

export async function issueAuthTokenPair(
	reply: FastifyReply,
	userId: string,
): Promise<AuthTokenPair> {
	const accessToken = await reply.jwtSign({
		sub: userId,
	});

	const refreshToken = await reply.jwtSign(
		{
			sub: userId,
			nonce: randomUUID(),
		},
		{ expiresIn: "30d" },
	);

	await prisma.refreshToken.create({
		data: {
			token: refreshToken,
			userId,
		},
	});

	return {
		accessToken,
		refreshToken,
	};
}
