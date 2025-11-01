import { CommunityFollowStatus } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import ms from "ms";
import {
	conditionalFollow,
	getFederationErrorReason,
} from "../lib/federation-utils.ts";
import { prisma } from "../lib/prisma.ts";
import { ioredis } from "../lib/redis.ts";

/**
 * Fetch all communities from Lemmyverse.net and add them to the database if they don't exist
 */

export const queue = new Queue("update_follows", {
	connection: ioredis.duplicate(),
});

void queue.upsertJobScheduler(
	"update_follows_scheduler",
	{ every: ms("1 minute") },
	{ name: "cron-job" },
);

const _worker = new Worker(
	"update_follows",
	async (_job) => {
		const communityFollows = await prisma.communityFollow.findMany({
			take: 100,
			where: {
				status: {
					in: [
						"NOT_AVAILABLE",
						"FEDERATED_BY_BOT",
						"WAITING",
						"IN_PROGRESS",
						"ERROR",
					],
				},
			},
			orderBy: { updatedAt: "asc" },
			include: {
				instance: {
					include: { allowed: true, blocked: true },
					omit: { client_id: false, client_secret: false },
				},
				community: {
					include: {
						instance: {
							include: {
								allowed: { select: { id: true } },
								blocked: { select: { id: true } },
							},
							omit: { client_id: false, client_secret: false },
						},
					},
				},
			},
		});
		const jobs = communityFollows.map(async (cf) => {
			const power = (cf.attemptCount + 1) ** 1.8;
			const backoffDays = power >= 60 ? 60 : power;
			const nextEligibleTime = new Date(
				cf.createdAt.getTime() + backoffDays * ms("1d"),
			);
			if (nextEligibleTime >= new Date()) {
				await prisma.communityFollow.update({
					where: { id: cf.id },
					data: { updatedAt: new Date() },
				});
				return;
			}
			try {
				const status = await conditionalFollow(cf);
				await prisma.communityFollow.update({
					where: {
						id: cf.id,
					},
					data: {
						status,
						attemptCount: cf.attemptCount + 1,
					},
				});
			} catch (e) {
				const status = CommunityFollowStatus.ERROR;
				const errorReason = getFederationErrorReason(e);
				await prisma.communityFollow.update({
					where: { id: cf.id },
					data: { status, errorReason, attemptCount: cf.attemptCount + 1 },
				});
			}
		});
		await Promise.all(jobs);
		if (communityFollows.length) {
			console.info(
				`Updated community follows from ${communityFollows[0].updatedAt.toISOString()} to ${communityFollows[communityFollows.length - 1].updatedAt.toISOString()}`,
			);
		}
	},
	{ connection: ioredis.duplicate({ maxRetriesPerRequest: null }) },
);
