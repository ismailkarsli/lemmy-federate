import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
	const user = event.context.auth;
	if (!user) {
		throw createError({
			status: 401,
			message: "Unauthorized",
		});
	}

	const instance = await prisma.instance.findFirst({
		where: {
			host: user.instance,
		},
		include: {
			allowed: {
				select: {
					id: true,
					host: true,
				},
			},
		},
	});

	return instance;
});
