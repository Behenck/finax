import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";

type ResolveEmployeeUserIdByEmailParams = {
	organizationId: string;
	email: string;
	excludeEmployeeId?: string;
};

export async function resolveEmployeeUserIdByEmail({
	organizationId,
	email,
	excludeEmployeeId,
}: ResolveEmployeeUserIdByEmailParams) {
	const normalizedEmail = email.trim().toLowerCase();

	const user = await prisma.user.findFirst({
		where: {
			email: {
				equals: normalizedEmail,
				mode: "insensitive",
			},
		},
		select: {
			id: true,
		},
	});

	if (!user) {
		return {
			normalizedEmail,
			userId: null,
		};
	}

	const employeeWithSameUser = await prisma.employee.findFirst({
		where: {
			organizationId,
			userId: user.id,
			...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
		},
		select: {
			id: true,
		},
	});

	if (employeeWithSameUser) {
		throw new BadRequestError(
			"Another employee in this organization is already linked to this user",
		);
	}

	return {
		normalizedEmail,
		userId: user.id,
	};
}
