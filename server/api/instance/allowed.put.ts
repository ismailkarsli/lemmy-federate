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

	const body = await readBody(event);
	const instanceId = Number.parseInt(body.instanceId);
	if (!instanceId) {
		throw createError({
			status: 400,
			message: "No instanceId provided",
		});
	}

	await prisma.instance.update({
		where: {
			host: user.instance,
		},
		data: {
			allowed: {
				connect: {
					id: instanceId,
				},
			},
		},
	});

	return {
		message: "Instance added to allowed list",
	};
});
