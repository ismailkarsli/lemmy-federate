import { PrismaClient } from "@prisma/client";
import type { LemmyErrorType } from "lemmy-js-client";
import {
	getClient,
	unfollowWithAllInstances,
} from "../src/lib/federation-utils";

const prisma = new PrismaClient();

/**
 * Check all communities and remove those that are deleted or removed
 */
export async function clearDeletedCommunities() {
	console.info("Clearing deleted communities");
	const communities = await prisma.community.findMany({
		include: {
			instance: true,
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
	console.info(`Cleared ${count} communities`);
}
