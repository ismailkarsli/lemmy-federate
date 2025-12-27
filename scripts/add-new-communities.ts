import {
	conditionalFollowWithAllInstances,
	getClient,
} from "../src/lib/federation-utils.ts";
import { KVCache } from "../src/lib/kv.ts";
import { getPrisma } from "../src/lib/prisma.ts";
import { isGenericAP } from "../src/lib/utils.ts";

/**
 * Fetch 50 newest communities from instances and add them to the database if they don't exist
 */
export async function addNewCommunities(env: CloudflareBindings) {
	const prisma = getPrisma(env);
	const kv = new KVCache(env.CACHE);

	console.info("Adding communities");
	const instances = await prisma.instance.findMany({
		where: {
			enabled: true,
			auto_add: true,
			AND: [{ client_id: { not: null } }, { client_secret: { not: null } }],
		},
		omit: { client_id: false, client_secret: false },
	});

	for (const instance of instances) {
		try {
			// Seed-only instances can't list or follow communities
			if (isGenericAP(instance.software)) continue;
			const client = await getClient(instance, kv);

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
							instance: { omit: { client_id: false, client_secret: false } },
						},
					});
					conditionalFollowWithAllInstances(addedCommunity, prisma, kv);
				}
			}
		} catch (error) {
			console.error(error);
		}
	}

	console.info("Finished adding communities");
}
