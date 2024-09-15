import { CommunityFollowStatus, PrismaClient } from "@prisma/client";
import {
	conditionalFollowWithAllInstances,
	getHttpClient,
} from "~/server/utils";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
	const body = await readBody(event);
	// remove ! prefix if present
	const symbol = body?.community?.replace(/^!/, "")?.trim();

	if (!symbol) {
		throw createError({
			status: 400,
			message: "Community is required",
		});
	}

	const [name, host] = symbol.toLowerCase().split("@");
	if (!name || !host) {
		throw createError({
			status: 400,
			message:
				"Invalid community name. It should be in 'community@instance' format.",
		});
	}

	const instance = await prisma.instance.findUnique({
		where: {
			host,
		},
	});
	if (!instance) {
		throw createError({
			status: 400,
			message: "Instance is not registered.",
		});
	}
	if (!instance.enabled) {
		throw createError({
			status: 400,
			message: "Instance is disabled. Please contact your admin.",
		});
	}

	try {
		const lemmyClient = await getHttpClient(host);
		const communityViewResponse = await lemmyClient.getCommunity({ name });
		const community = communityViewResponse?.community_view.community;
		if (!community) {
			throw "Community not found on the instance.";
		}
		if (community.deleted || community.removed) {
			throw "Community is deleted or removed on the instance.";
		}
		if (community.visibility === "LocalOnly") {
			throw "Community is local only on the instance.";
		}
	} catch (error) {
		throw createError({
			status: 400,
			message: `Community not found on the instance. ${error}`,
		});
	}

	const addedCommunity = await prisma.community.upsert({
		where: {
			name_instanceId: {
				name,
				instanceId: instance.id,
			},
		},
		create: {
			name,
			instance: {
				connect: {
					host,
				},
			},
		},
		update: {
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		include: {
			instance: true,
		},
	});

	await prisma.communityFollow.updateMany({
		where: {
			community: addedCommunity,
		},
		data: {
			status: CommunityFollowStatus.IN_PROGRESS,
		},
	});

	conditionalFollowWithAllInstances(addedCommunity);

	return {
		message: "Community added successfully",
	};
});
