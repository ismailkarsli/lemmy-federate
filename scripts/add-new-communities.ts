#!/usr/bin/env bun
import {
	conditionalFollowWithAllInstances,
	getClient,
} from "../src/lib/federation-utils";
import { prisma } from "../src/lib/prisma";
import { isMain } from "../src/lib/utils";

if (isMain(import.meta.url)) {
	addNewCommunities();
}

/**
 * Fetch 50 newest communities from instances and add them to the database if they don't exist
 */
export async function addNewCommunities() {
	console.info("Adding communities");
	const instances = await prisma.instance.findMany({
		where: {
			enabled: true,
			auto_add: true,
			AND: [{ client_id: { not: null } }, { client_secret: { not: null } }],
		},
	});

	for (const instance of instances) {
		try {
			// ActivityPub instances can't list or follow communities
			if (instance.software === "ACTIVITY_PUB") continue;
			const client = await getClient(instance);

			const communities = await client.listCommunities({
				type_: "Local",
				sort: "New",
				page: 1,
				limit: 50,
			});

			for (const c of communities) {
				if (!c.public) continue;
				const exists = await prisma.community.count({
					where: {
						name: c.name.toLowerCase(),
						instanceId: instance.id,
					},
				});
				if (!exists) {
					const addedCommunity = await prisma.community.create({
						data: {
							name: c.name.toLowerCase(),
							instanceId: instance.id,
						},
						include: {
							instance: true,
						},
					});
					conditionalFollowWithAllInstances(addedCommunity);
				}
			}
		} catch (error) {
			console.error(
				`Error while adding communities from ${instance.host}`,
				error,
			);
		}
	}

	console.info("Finished adding communities");
}
