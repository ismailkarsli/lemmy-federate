#!/usr/bin/env bun
import { CommunityFollowStatus, type Prisma } from "@prisma/client";
import { HTTPError, TimeoutError } from "ky";
import PQueue from "p-queue";
import { conditionalFollow } from "../src/lib/federation-utils";
import { prisma } from "../src/lib/prisma";
import { isMain } from "../src/lib/utils";

const CONCURRENCY = 100;

if (isMain(import.meta.url)) {
	updateFollows();
}

export async function updateFollows(opts: { limit?: number } = {}) {
	const queue = new PQueue({ concurrency: CONCURRENCY });
	const communityFollows = await prisma.communityFollow.findMany({
		take: opts.limit,
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
			instance: { include: { allowed: true, blocked: true } },
			community: {
				include: {
					instance: {
						include: {
							allowed: { select: { id: true } },
							blocked: { select: { id: true } },
						},
					},
				},
			},
		},
	});
	if (!communityFollows.length) return;
	queue.addAll(
		communityFollows.map((cf) => async () => {
			try {
				const status = await conditionalFollow(cf);
				await prisma.communityFollow.update({
					where: { id: cf.id },
					data: { status },
				});
			} catch (e) {
				if (
					!(
						e instanceof HTTPError &&
						((e.response.status >= 500 && e.response.status < 600) ||
							e.response.status === 429)
					) &&
					!(e instanceof TimeoutError)
				) {
					console.error(
						`Error while following community periodically ${cf.community.name}@${cf.community.instance.host} from ${cf.instance.host}`,
						e,
					);
				}
				await prisma.communityFollow.update({
					where: { id: cf.id },
					data: { status: CommunityFollowStatus.ERROR },
				});
			}
		}),
	);
}
