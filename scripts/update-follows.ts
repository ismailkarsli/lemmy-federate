#!/usr/bin/env bun
import { CommunityFollowStatus } from "@prisma/client";
import { HTTPError, TimeoutError } from "ky";
import PQueue from "p-queue";
import { conditionalFollow } from "../src/lib/federation-utils";
import { prisma } from "../src/lib/prisma";
import { isMain } from "../src/lib/utils";

if (isMain(import.meta.url)) {
	await updateFollows();
	process.exit(0);
}

export async function updateFollows() {
	const queue = new PQueue({ concurrency: 1000 });
	const communityFollows = await prisma.communityFollow.findMany({
		take: 10000,
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
	// TODO: temporary debug purposes
	console.info(`Oldest CF: ${communityFollows.at(0)?.updatedAt}`);
	await queue.addAll(
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
							e.response.status === 404 ||
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
	await queue.onIdle();
}
