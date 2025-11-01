import { Queue, Worker } from "bullmq";
import type { LemmyErrorType } from "lemmy-js-client";
import ms from "ms";
import {
	getClient,
	unfollowWithAllInstances,
} from "../lib/federation-utils.ts";
import { prisma } from "../lib/prisma.ts";
import { ioredis } from "../lib/redis.ts";

/**
 * Check all communities and remove those that are deleted or removed
 */

export const queue = new Queue("clear_deleted_communities", {
	connection: ioredis.duplicate(),
});

// Run every day
void queue.upsertJobScheduler(
	"clear_deleted_communities_scheduler",
	{ every: ms("1 day") },
	{ name: "cron-job" },
);

const _worker = new Worker(
	"clear_deleted_communities",
	async (_job) => {
		const communities = await prisma.community.findMany({
			include: {
				instance: { omit: { client_id: false, client_secret: false } },
			},
		});

		let count = 0;
		for (const community of communities) {
			let remove = false;
			try {
				const client = await getClient(community.instance);
				const c = await client.getCommunity(community.name);
				// if the community is deleted/removed by user/admin or is not public, delete it
				if (c.isRemoved || c.isDeleted || !c.public) {
					remove = true;
				}
			} catch (e) {
				// remove if we get "couldnt_find_community" error
				if (
					e instanceof Error &&
					e.message ===
						("couldnt_find_community" satisfies LemmyErrorType["error"])
				) {
					remove = true;
				}
			}
			if (remove) {
				await unfollowWithAllInstances(community);
				await prisma.community.delete({
					where: {
						id: community.id,
					},
				});
				count++;
			}
		}
		return count;
	},
	{ connection: ioredis.duplicate({ maxRetriesPerRequest: null }) },
);
