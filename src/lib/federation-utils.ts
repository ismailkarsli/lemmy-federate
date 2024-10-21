import {
	type Community,
	type CommunityFollow,
	CommunityFollowStatus,
	FediseerUsage,
	type Instance,
	NSFW,
	PrismaClient,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { LemmyHttp } from "lemmy-js-client";
import ms from "ms";
import { getCensuresGiven, getEndorsements } from "./fediseer";
import { LemmyClient } from "./lemmy";
import { MbinClient } from "./mbin";
import { getInstanceSoftware } from "./utils";

const prisma = new PrismaClient();

/**
 * Caches LemmyClient and MbinClient instances to avoid creating new instances and authenticating them
 */
const clientCacheMap = new Map<
	string,
	{
		client: LemmyClient | MbinClient;
		expiration: Date;
	}
>();
export const getClient = async (
	instance: string,
	username?: string,
	password?: string,
) => {
	const key = username ? `${instance}-${username}` : instance;
	const cached = clientCacheMap.get(key);
	if (cached && cached.expiration > new Date()) {
		return cached.client;
	}

	const software = await getInstanceSoftware(instance);
	let client: LemmyClient | MbinClient;
	if (software.name === "lemmy") {
		client = new LemmyClient(instance, username, password);
	} else if (software.name === "mbin") {
		client = new MbinClient(instance, username, password);
	} else {
		throw new Error("Invalid software");
	}

	clientCacheMap.set(key, {
		client,
		expiration: new Date(Date.now() + ms("1 hour")),
	});
	return client;
};

/**
 * Follows the community if it's applicable and returns the status.
 * @param communityFollow
 * @returns The status of the follow operation.
 */
export const conditionalFollow = async (
	communityFollow: CommunityFollow & {
		instance: Instance & {
			allowed: Instance[];
		};
		community: Community & {
			instance: Instance & { allowed: { id: number }[] };
		};
	},
): Promise<CommunityFollowStatus> => {
	const { instance, community } = communityFollow;
	/**
	 * If the home or target instances have at least one allowed instance, check if they allow each other.
	 */
	if (instance.allowed.length) {
		const isAllowed = instance.allowed.some(
			(i) => i.id === community.instanceId,
		);
		if (!isAllowed) return CommunityFollowStatus.NOT_ALLOWED;
	}

	if (!(instance.bot_name && instance.bot_pass) || !instance.enabled) {
		return CommunityFollowStatus.NOT_AVAILABLE;
	}

	// client of the instance that will subscribe to the community
	const localClient = await getClient(
		instance.host,
		instance.bot_name,
		instance.bot_pass,
	);
	// instance where the community is hosted
	const remoteClient = await getClient(community.instance.host);

	/**
	 * Check if both instances are federated with each other
	 */
	const localIsFederated = await localClient.checkFederationWith(
		remoteClient.host,
	);
	const remoteIsFederated = await remoteClient.checkFederationWith(
		localClient.host,
	);
	if (!localIsFederated || !remoteIsFederated) {
		return CommunityFollowStatus.NOT_ALLOWED;
	}

	/**
	 * Check instance's Fediseer policy.
	 */
	if (instance.fediseer === FediseerUsage.BLACKLIST_ONLY) {
		const censures = await getCensuresGiven(instance.host);
		if (censures.domains.includes(community.instance.host)) {
			return CommunityFollowStatus.NOT_ALLOWED;
		}
	} else if (instance.fediseer === FediseerUsage.WHITELIST_ONLY) {
		const endorsements = await getEndorsements(community.instance.host);
		if (!endorsements.domains.includes(instance.host)) {
			return CommunityFollowStatus.NOT_ALLOWED;
		}
	}

	// check NSFW with remote client to avoid unwanted discoveries
	const communityRemote = await localClient.getCommunity(
		`${community.name}@${community.instance.host}`,
	);

	/**
	 * Check if the community is deleted or removed.
	 */
	if (communityRemote.isDeleted || communityRemote.isRemoved) {
		return CommunityFollowStatus.NOT_ALLOWED;
	}

	/**
	 * Check if the community is
	 * - NSFW and the instance is not allowing NSFW content.
	 * - not NSFW and the instance is only allowing NSFW content.
	 */
	if (
		communityRemote.nsfw
			? instance.nsfw === NSFW.BLOCK
			: instance.nsfw === NSFW.ONLY
	) {
		return CommunityFollowStatus.NOT_ALLOWED;
	}

	/**
	 * We passed all the checks, now we can fetch the community
	 */

	const localCommunity = await localClient.getCommunity(
		`${community.name}@${community.instance.host}`,
	);
	const localSubscribers = localCommunity.localSubscribers;

	// Community has other subscribers than the bot
	if (localSubscribers > (localCommunity.subscribed === "Subscribed" ? 1 : 0)) {
		await localClient.followCommunity(localCommunity.id, false);
		return CommunityFollowStatus.DONE;
	}

	// if stuck in "Pending" state, unfollow and return error. This way we can retry in next run.
	if (localCommunity.subscribed === "Pending") {
		await localClient.followCommunity(localCommunity.id, false);
		return CommunityFollowStatus.ERROR;
	}

	// follow if not following already. return in progress state.
	if (localCommunity.subscribed !== "Subscribed") {
		await localClient.followCommunity(localCommunity.id, true);
	}
	return CommunityFollowStatus.IN_PROGRESS;
};

export const conditionalFollowWithAllInstances = async (
	community: Community & {
		instance: Instance;
	},
) => {
	const communityFollows = await prisma.communityFollow.findMany({
		where: {
			communityId: community.id,
		},
		include: {
			instance: {
				include: {
					allowed: true,
				},
			},
			community: {
				include: {
					instance: {
						include: {
							allowed: {
								select: {
									id: true,
								},
							},
						},
					},
				},
			},
		},
	});

	for (const cf of communityFollows) {
		let status: CommunityFollowStatus = CommunityFollowStatus.IN_PROGRESS;
		try {
			status = await conditionalFollow(cf);
		} catch (e) {
			status = CommunityFollowStatus.ERROR;
			console.error(
				`Error while following community ${cf.community.name}@${cf.community.instance.host} from ${cf.instance.host}`,
				e,
			);
		} finally {
			await prisma.communityFollow.update({
				where: { id: cf.id },
				data: { status },
			});
		}
	}
};

export const unfollowWithAllInstances = async (community: Community) => {
	const communityFollows = await prisma.communityFollow.findMany({
		where: {
			communityId: community.id,
		},
		include: {
			instance: true,
			community: {
				include: {
					instance: true,
				},
			},
		},
	});

	for (const cf of communityFollows) {
		if (!(cf.instance.bot_name && cf.instance.bot_pass)) continue;

		try {
			const client = await getClient(
				cf.instance.host,
				cf.instance.bot_name,
				cf.instance.bot_pass,
			);

			const { id } = await client.getCommunity(
				`${cf.community.name}@${cf.community.instance.host}`,
			);
			await client.followCommunity(id, false);
		} catch (e) {
			console.error(
				`Error while unfollowing community ${cf.community.name}@${cf.community.instance.host} from ${cf.instance.host}`,
				e,
			);
		}
	}
};

export async function resetSubscriptions(instance: Instance) {
	// try {
	// 	if (!(instance.bot_name && instance.bot_pass)) {
	// 		throw new Error("Bot name and password are required");
	// 	}
	// 	const client = await getClient(instance.host);
	// 	let page = 0;
	// 	while (true) {
	// 		const subscriptions = await client.listCommunities({
	// 			type_: "Subscribed",
	// 			limit: 50,
	// 			page: ++page,
	// 		});
	// 		if (subscriptions.communities.length === 0) {
	// 			break;
	// 		}
	// 		for (const subscription of subscriptions.communities) {
	// 			try {
	// 				await client.followCommunity({
	// 					community_id: subscription.community.id,
	// 					follow: false,
	// 				});
	// 			} catch (e) {
	// 				if ((e as LemmyErrorType)?.error === "rate_limit_error") {
	// 					await new Promise((resolve) => setTimeout(resolve, ms("1 minute")));
	// 					continue;
	// 				}
	// 				throw e;
	// 			}
	// 		}
	// 	}
	// 	// make all follows "in progress"
	// 	await prisma.communityFollow.updateMany({
	// 		where: {
	// 			instanceId: instance.id,
	// 		},
	// 		data: {
	// 			status: CommunityFollowStatus.IN_PROGRESS,
	// 		},
	// 	});
	// } catch (e) {
	// 	console.error("error", e);
	// }
}

const BOT_INSTANCE = process.env.BOT_INSTANCE;
const BOT_USERNAME = process.env.BOT_USERNAME;
const BOT_PASSWORD = process.env.BOT_PASSWORD;
if (!BOT_INSTANCE || !BOT_USERNAME || !BOT_PASSWORD) {
	throw new Error("BOT_INSTANCE, BOT_USERNAME, and BOT_PASSWORD are required");
}
let BOT_HTTP_CLIENT: LemmyHttp | undefined; // using standard LemmyHttp for bot

export const sendAuthCode = async (
	username: string,
	instance: string,
	code: string,
) => {
	if (!BOT_HTTP_CLIENT) {
		BOT_HTTP_CLIENT = new LemmyHttp(`https://${BOT_INSTANCE}`);
		await BOT_HTTP_CLIENT.login({
			username_or_email: BOT_USERNAME,
			password: BOT_PASSWORD,
		});
	}
	const personQuery = await BOT_HTTP_CLIENT.resolveObject({
		q: `https://${instance}/u/${username}`,
	});
	const person = personQuery.person?.person;
	if (!person) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Person not found",
		});
	}

	const message = `Your authentication code to login Lemmy Federate is: ${code}`;
	await BOT_HTTP_CLIENT.createPrivateMessage({
		content: message,
		recipient_id: person.id,
	});
};
