import { PrismaClient } from "@prisma/client";
import { resetSubscriptions } from "~/server/utils";

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
	});

	if (!instance) {
		throw createError({
			status: 404,
			message: "Instance not found",
		});
	}

	resetSubscriptions(instance);

	return {
		message: "Started resetting subscriptions. This may take a while.",
	};
});
