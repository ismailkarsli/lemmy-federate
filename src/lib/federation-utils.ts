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
import { HTTPError, TimeoutError } from "ky";
import type { LemmyErrorType } from "lemmy-js-client";
import ms from "ms";
import { getCensuresGiven, getEndorsements } from "./fediseer";
import { LemmyClient, LemmyHttpExtended } from "./lemmy";
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
export const getClient = ({
	host,
	software,
	client_id,
	client_secret,
}: Pick<Instance, "host" | "client_id" | "client_secret" | "software">) => {
	const key = client_id ? `${host}-${client_id}` : host;
	const cached = clientCacheMap.get(key);
	if (cached && cached.expiration > new Date()) {
		return cached.client;
	}

	let client: LemmyClient | MbinClient;
	const id = client_id ?? undefined;
	const secret = client_secret ?? undefined;
	if (software === "LEMMY") {
		client = new LemmyClient(host, id, secret);
	} else if (software === "MBIN") {
		client = new MbinClient(host, id, secret);
	} else throw new Error("Invalid software");

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
	const sameInstance = instance.id === community.instance.id;
	/**
	 * If the home or target instances have at least one allowed instance, check if they allow each other.
	 */
	if (instance.allowed.length) {
		const isAllowed = instance.allowed.some(
			(i) => i.id === community.instanceId,
		);
		if (!isAllowed) return CommunityFollowStatus.NOT_ALLOWED;
	}

	/**
	 * If the instance is disabled or doesn't have bot credentials, return not available.
	 */
	if (!instance.enabled || !(instance.client_id && instance.client_secret)) {
		return CommunityFollowStatus.NOT_AVAILABLE;
	}

	/**
	 * Check if federation modes of instances are compatible
	 */
	if (
		!sameInstance &&
		(instance.mode === "SEED" || community.instance.mode === "LEECH")
	) {
		return CommunityFollowStatus.NOT_ALLOWED;
	}

	/**
	 * If at least one instance is not allowing cross software federation then check them
	 */
	if (
		!sameInstance &&
		!(instance.cross_software && community.instance.cross_software) &&
		instance.software !== community.instance.software
	) {
		return CommunityFollowStatus.NOT_ALLOWED;
	}

	// client of the instance that will subscribe to the community
	const localClient = getClient(instance);
	// instance where the community is hosted
	const remoteClient = getClient(community.instance);
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
	 * Disabled for Mbin.
	 */
	if (
		instance.fediseer === FediseerUsage.BLACKLIST_ONLY &&
		!(localClient instanceof MbinClient)
	) {
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

	// We can't retrieve local subscriber count. Just follow until we can.
	if (localSubscribers === null) {
		if (localCommunity.subscribed === "NotSubscribed") {
			await localClient.followCommunity(localCommunity.id, true);
		}
		return CommunityFollowStatus.IN_PROGRESS;
	}

	// Community has other subscribers than the bot
	if (
		localSubscribers > (localCommunity.subscribed !== "NotSubscribed" ? 1 : 0)
	) {
		if (localCommunity.subscribed !== "NotSubscribed") {
			await localClient.followCommunity(localCommunity.id, false);
		}
		return CommunityFollowStatus.FEDERATED_BY_USER;
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
	return CommunityFollowStatus.FEDERATED_BY_BOT;
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

	await Promise.all(
		communityFollows.map(async (cf) => {
			let status: CommunityFollowStatus = CommunityFollowStatus.WAITING;
			try {
				status = await conditionalFollow(cf);
			} catch (e) {
				status = CommunityFollowStatus.ERROR;
				if (
					!(
						e instanceof HTTPError &&
						((e.response.status >= 500 && e.response.status < 600) ||
							e.response.status === 429)
					) &&
					!(e instanceof TimeoutError)
				) {
					console.error(
						`Error while following community ${cf.community.name}@${cf.community.instance.host} from ${cf.instance.host}`,
						e,
					);
				}
			} finally {
				await prisma.communityFollow.update({
					where: { id: cf.id },
					data: { status },
				});
			}
		}),
	);
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
		try {
			const client = getClient(cf.instance);

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
	try {
		if (!(instance.client_id && instance.client_secret)) {
			throw new Error("Bot name and password are required");
		}
		const client = await getClient(instance);
		let page = 0;
		while (true) {
			const subscriptions = await client.listCommunities({
				type_: "Subscribed",
				limit: 50,
				page: ++page,
			});
			if (subscriptions.length === 0) {
				break;
			}
			for (const subscription of subscriptions) {
				try {
					await client.followCommunity(subscription.id, false);
				} catch (e) {
					if ((e as LemmyErrorType)?.error === "rate_limit_error") {
						await new Promise((resolve) => setTimeout(resolve, ms("1 minute")));
						continue;
					}
					throw e;
				}
			}
		}
		// make all follows "WAITING"
		await prisma.communityFollow.updateMany({
			where: {
				instanceId: instance.id,
			},
			data: {
				status: CommunityFollowStatus.WAITING,
			},
		});
	} catch (e) {
		console.error("error", e);
	}
}

const BOT_INSTANCE = process.env.BOT_INSTANCE;
const BOT_USERNAME = process.env.BOT_USERNAME;
const BOT_PASSWORD = process.env.BOT_PASSWORD;
if (!BOT_INSTANCE || !BOT_USERNAME || !BOT_PASSWORD) {
	throw new Error("BOT_INSTANCE, BOT_USERNAME, and BOT_PASSWORD are required");
}
let BOT_HTTP_CLIENT: LemmyHttpExtended | undefined; // using standard LemmyHttp for bot

export const sendAuthCode = async (
	username: string,
	instance: string,
	code: string,
) => {
	if (!BOT_HTTP_CLIENT) {
		BOT_HTTP_CLIENT = new LemmyHttpExtended(`https://${BOT_INSTANCE}`);
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
