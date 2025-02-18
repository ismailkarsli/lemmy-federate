#!/usr/bin/env bun
import { CommunityFollowStatus, type Prisma } from "@prisma/client";
import { HTTPError, TimeoutError } from "ky";
import PQueue from "p-queue";
import { conditionalFollow } from "../src/lib/federation-utils";
import { prisma } from "../src/lib/prisma";
import { isMain } from "../src/lib/utils";

if (isMain(import.meta.url)) {
	await updateFollows();
	process.exit(0);
}

const CONCURRENCY = 10;

export async function updateFollows() {
	const queue = new PQueue({ concurrency: CONCURRENCY });
	const filter = {
		status: {
			in: [
				"NOT_AVAILABLE",
				"FEDERATED_BY_BOT",
				"WAITING",
				"IN_PROGRESS",
				"ERROR",
			],
		},
	} satisfies Prisma.CommunityFollowWhereInput;
	let cursor = 0;
	console.info("Updating community follows");
	while (true) {
		// keep the queue size more than 2x of CONCURRENCY
		await queue.onSizeLessThan(CONCURRENCY * 2);
		const communityFollows = await prisma.communityFollow.findMany({
			skip: cursor,
			take: CONCURRENCY,
			where: filter,
			orderBy: { createdAt: "desc" },
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
		if (!communityFollows.length) break;
		queue.addAll(
			communityFollows.map((cf) => async () => {
				try {
					const status = await conditionalFollow(cf);
					await prisma.communityFollow.update({
						where: {
							id: cf.id,
						},
						data: {
							status,
						},
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
		cursor += CONCURRENCY;
	}
	console.info(`Updated ${cursor} community follows`);
}
