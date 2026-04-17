import { prisma } from "@/lib/prisma";
import { db } from "@/lib/db";
import { Role } from "generated/prisma/enums";
import { BadRequestError } from "../_errors/bad-request-error";

export async function assertSupervisorUserIds(
	organizationId: string,
	supervisorIds: string[],
) {
	const uniqueSupervisorIds = Array.from(new Set(supervisorIds));

	if (uniqueSupervisorIds.length === 0) {
		return uniqueSupervisorIds;
	}

	const supervisors = await prisma.member.findMany({
		where: {
			organizationId,
			userId: {
				in: uniqueSupervisorIds,
			},
			role: Role.SUPERVISOR,
		},
		select: {
			userId: true,
		},
	});

	if (supervisors.length !== uniqueSupervisorIds.length) {
		throw new BadRequestError("One or more supervisors were not found");
	}

	return uniqueSupervisorIds;
}

export async function replacePartnerSupervisors(params: {
	organizationId: string;
	partnerId: string;
	supervisorIds: string[];
}) {
	await db(() =>
		prisma.$transaction(async (tx) => {
			await tx.partnerSupervisor.deleteMany({
				where: {
					organizationId: params.organizationId,
					partnerId: params.partnerId,
				},
			});

			if (params.supervisorIds.length === 0) {
				return;
			}

			await tx.partnerSupervisor.createMany({
				data: params.supervisorIds.map((supervisorId) => ({
					organizationId: params.organizationId,
					partnerId: params.partnerId,
					supervisorId,
				})),
				skipDuplicates: true,
			});
		}),
	);
}
