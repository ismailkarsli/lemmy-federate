import { Queue, Worker } from "bullmq";
import ms from "ms";
import { prisma } from "../lib/prisma.ts";
import { ioredis } from "../lib/redis.ts";

/**
 * Fetch all communities from Lemmyverse.net and add them to the database if they don't exist
 */

export const queue = new Queue("add_all_communities", {
	connection: ioredis.duplicate(),
});

void queue.upsertJobScheduler(
	"add_all_communities_scheduler",
	{ every: ms("1 day") },
	{ name: "cron-job" },
);

const _worker = new Worker(
	"add_all_communities",
	async (_job) => {
		const instances = await prisma.instance.findMany({
			where: {
				enabled: true,
				auto_add: true,
			},
			omit: { client_id: false, client_secret: false },
		});
		const instanceIdMap = Object.fromEntries(
			instances.map((i) => [i.host, i.id]),
		);

		const pageCount = await fetch(
			"https://data.lemmyverse.net/data/community.json",
		)
			.then((r) => r.json())
			.then((r) => r.count);

		if (!pageCount) {
			throw new Error("No page count found");
		}

		for (let i = 0; i < pageCount; i++) {
			const communities = (await fetch(
				`https://lemmyverse.net/data/community/${i}.json`,
			).then((r) => r.json())) as {
				baseurl: string;
				name: string;
				isSuspicious: boolean;
			}[];

			await Promise.all(
				communities.map(async (c) => {
					if (c.isSuspicious) return;
					const instanceId = instanceIdMap[c.baseurl];
					if (!instanceId) return;
					await prisma.community.upsert({
						where: {
							name_instanceId: {
								name: c.name.toLowerCase(),
								instanceId,
							},
						},
						update: {},
						create: {
							name: c.name.toLowerCase(),
							instanceId,
						},
					});
				}),
			);
		}
	},
	{ connection: ioredis.duplicate({ maxRetriesPerRequest: null }) },
);
