import { Queue, Worker } from "bullmq";
import ms from "ms";
import {
	conditionalFollowWithAllInstances,
	getClient,
} from "../lib/federation-utils.ts";
import { prisma } from "../lib/prisma.ts";
import { ioredis } from "../lib/redis.ts";
import { isGenericAP } from "../lib/utils.ts";

/**
 * Fetch 50 newest communities from instances and add them to the database if they don't exist
 */

export const queue = new Queue("add_new_communities", {
	connection: ioredis.duplicate(),
});

void queue.upsertJobScheduler(
	"add_new_communities_scheduler",
	{ every: ms("1 minute") },
	{ name: "cron-job" },
);

const _worker = new Worker(
	"add_new_communities",
	async (_job) => {
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
								instance: { omit: { client_id: false, client_secret: false } },
							},
						});
						conditionalFollowWithAllInstances(addedCommunity);
					}
				}
			} catch (error) {
				console.error(error);
			}
		}
	},
	{ connection: ioredis.duplicate({ maxRetriesPerRequest: null }) },
);
