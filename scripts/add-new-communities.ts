import { PrismaClient } from "@prisma/client";
import {
	conditionalFollowWithAllInstances,
	getClient,
} from "../src/lib/federation-utils";

const prisma = new PrismaClient();

/**
 * Fetch 50 newest communities from instances and add them to the database if they don't exist
 */
export async function addNewCommunities() {
	console.info("Adding communities");
	const instances = await prisma.instance.findMany({
		where: {
			enabled: true,
			auto_add: true,
			bot_name: { not: null },
			bot_pass: { not: null },
		},
	});

	for (const instance of instances) {
		try {
			const client = await getClient(
				instance.host,
				// biome-ignore lint/style/noNonNullAssertion: we're querying non null instances
				instance.bot_name!,
				// biome-ignore lint/style/noNonNullAssertion: we're querying non null instances
				instance.bot_pass!,
			);

			const { communities } = await client.listCommunities({
				type_: "Local",
				sort: "New",
				page: 1,
				limit: 50,
			});

			for (const c of communities) {
				if (c.community.visibility === "LocalOnly") continue;
				const exists = await prisma.community.count({
					where: {
						name: c.community.name.toLowerCase(),
						instanceId: instance.id,
					},
				});
				if (!exists) {
					const addedCommunity = await prisma.community.create({
						data: {
							name: c.community.name.toLowerCase(),
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
