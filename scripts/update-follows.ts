#!/usr/bin/env bun
import { CommunityFollowStatus, type Prisma } from "@prisma/client";
import { HTTPError, TimeoutError } from "ky";
import { conditionalFollow } from "../src/lib/federation-utils";
import { prisma } from "../src/lib/prisma";
import { isMain } from "../src/lib/utils";

if (isMain(import.meta.url)) {
	updateFollows();
}

export async function updateFollows() {
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
	const recordCount = await prisma.communityFollow.count({
		where: filter,
	});
	console.info("Started updating", recordCount, "community follows");
	for (let i = 0; i < recordCount; i += 100) {
		const communityFollows = await prisma.communityFollow.findMany({
			skip: i,
			take: 100,
			where: filter,
			orderBy: { createdAt: "desc" },
			include: {
				instance: {
					include: { allowed: true, blocked: true },
				},
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
		await Promise.all(
			communityFollows.map(async (cf) => {
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
	}
	console.info("Finished updating community follows");
}
