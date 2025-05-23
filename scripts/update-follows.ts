#!/usr/bin/env node
import { CommunityFollowStatus } from "@prisma/client";
import ms from "ms";
import {
	conditionalFollow,
	getFederationErrorReason,
} from "../src/lib/federation-utils.ts";
import { prisma } from "../src/lib/prisma.ts";
import { isMain } from "../src/lib/utils.ts";

if (isMain(import.meta.url)) {
	await updateFollows();
	process.exit(0);
}

export async function updateFollows() {
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
		console.log(nextEligibleTime >= new Date(), backoffDays, nextEligibleTime);
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
}
