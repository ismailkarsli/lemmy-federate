import {
	type Community,
	type CommunityFollow,
	CommunityFollowStatus,
	FediseerUsage,
	type Instance,
	NSFW,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { HTTPError, TimeoutError } from "ky";
import ms from "ms";
import { ActivityPubClient } from "./activity-pub-client.ts";
import { getCensuresGiven, getEndorsements } from "./fediseer";
import { LemmyClient, LemmyHttpExtended } from "./lemmy";
import { MbinClient } from "./mbin";
import { prisma } from "./prisma";
import {isGenericAP, readFileAsync} from "./utils.ts";
import {createMessage} from "./messaging.ts";
import {LocalUser} from "../activitypub-server/vocabulary/local-user.ts";
import {ActivityPubSender} from "../activitypub-server/activity-pub-server.ts";

/**
 * Caches LemmyClient and MbinClient instances to avoid creating new instances and authenticating them
 */
const clientCacheMap = new Map<
	string,
	{
		client: LemmyClient | MbinClient | ActivityPubClient;
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

	let client: LemmyClient | MbinClient | ActivityPubClient;
	const id = client_id ?? undefined;
	const secret = client_secret ?? undefined;
	if (software === "LEMMY") {
		client = new LemmyClient(host, id, secret);
	} else if (software === "MBIN") {
		client = new MbinClient(host, id, secret);
	} else {
		client = new ActivityPubClient(host);
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
			blocked: Instance[];
		};
		community: Community & {
			instance: Instance & {
				allowed: { id: number }[];
				blocked: { id: number }[];
			};
		};
	},
): Promise<CommunityFollowStatus> => {
	const { instance, community } = communityFollow;
	/**
	 * Both instances must be enabled
	 */
	if (!instance.enabled || !community.instance.enabled) {
		return CommunityFollowStatus.NOT_AVAILABLE;
	}
	/**
	 * Both instances must be approved
	 */
	if (!(instance.approved && community.instance.approved)) {
		return CommunityFollowStatus.NOT_AVAILABLE;
	}
	/**
	 * ignore if same instance
	 */
	const sameInstance = instance.id === community.instance.id;
	if (sameInstance) return CommunityFollowStatus.NOT_AVAILABLE;
	/**
	 * If the home instance have at least one allowed instance, check if it allows target community instance.
	 */
	if (instance.allowed.length) {
		const isAllowed = instance.allowed.some(
			(a) => a.id === community.instanceId,
		);
		if (!isAllowed) return CommunityFollowStatus.NOT_ALLOWED;
	}
	/**
	 * If the home or target instances have at least one blocked instance, check if they block each other.
	 */
	if (instance.blocked.length || community.instance.blocked.length) {
		const isHomeBlocks = instance.blocked.some(
			(b) => b.id === community.instanceId,
		);
		const isTargetBlocks = community.instance.blocked.some(
			(b) => b.id === instance.id,
		);
		if (isHomeBlocks || isTargetBlocks) {
			return CommunityFollowStatus.NOT_ALLOWED;
		}
	}

	/**
	 * If the instance is disabled or doesn't have bot credentials, return not available.
	 */
	if (!(instance.client_id && instance.client_secret)) {
		return CommunityFollowStatus.NOT_AVAILABLE;
	}

	/**
	 * Check if federation modes of instances are compatible
	 */
	if (instance.mode === "SEED" || community.instance.mode === "LEECH") {
		return CommunityFollowStatus.NOT_ALLOWED;
	}

	/**
	 * ActivityPub client can't follow other instances
	 */
	if (isGenericAP(instance.software)) {
		console.warn(
			`Seed-only software should only be able to use "SEED" option, the instance: ${instance.host}`,
		);
		return CommunityFollowStatus.NOT_AVAILABLE;
	}

	/**
	 * If at least one instance is not allowing cross software federation then check them
	 */
	if (
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
	 * Check instance's Fediseer policy.
	 * Enabled only for Lemmy to Lemmy.
	 * TODO: change this logic here later.
	 */
	if (localClient.type === "LEMMY" && remoteClient.type === "LEMMY") {
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
	}

	// check NSFW with remote client to avoid unwanted discoveries
	const communityRemote = await remoteClient.getCommunity(
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

	// Community has another subscriber. We can unsubscribe.
	if (
		localSubscribers > (localCommunity.subscribed !== "NotSubscribed" ? 1 : 0)
	) {
		if (localCommunity.subscribed !== "NotSubscribed") {
			await localClient.followCommunity(localCommunity.id, false);
		}
		return CommunityFollowStatus.FEDERATED_BY_USER;
	}

	// if stuck in "Pending" state, unfollow and return WAITING. This way we can retry in next run.
	if (localCommunity.subscribed === "Pending") {
		await localClient.followCommunity(localCommunity.id, false);
		return CommunityFollowStatus.WAITING;
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
					blocked: true,
				},
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
			instance: { omit: { client_id: false, client_secret: false } },
			community: {
				include: {
					instance: { omit: { client_id: false, client_secret: false } },
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

export async function resetSubscriptions(
	instance: Instance,
	opts: { soft?: boolean } = {},
) {
	// make all follows "WAITING"
	await prisma.communityFollow.updateMany({
		where: {
			instanceId: instance.id,
		},
		data: {
			status: CommunityFollowStatus.WAITING,
		},
	});
	// if soft reset, then don't unsubscribe from instance itself.
	if (opts.soft) return;
	// Seed-only instances can't list or unsubscribe
	if (isGenericAP(instance.software)) return;
	if (!(instance.client_id && instance.client_secret)) {
		throw new Error("Bot name and password are required");
	}
	const client = await getClient(instance);
	while (true) {
		const subscriptions = await client.listCommunities({
			type_: "Subscribed",
			limit: 50,
			page: 1,
		});
		if (subscriptions.length === 0) {
			break;
		}
		for (const subscription of subscriptions) {
			await client.followCommunity(subscription.id, false);
		}
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
	software: string,
) => {
	const publicKey = await readFileAsync(__dirname + "/../../keys/public.pem");
	const privateKey = await readFileAsync(__dirname + "/../../keys/private.pem");

	const apSender = new ActivityPubSender();
	const apClient = new ActivityPubClient(instance);

	const user = await apClient.getApUser(username);
	const localUser = new LocalUser(publicKey);
	const message = `Your authentication code to login Lemmy Federate is: ${code}`;

	const messages = createMessage(software, localUser, user, message);
	const promises: Promise<boolean>[] = [];
	for (const message of messages) {
		promises.push(apSender.sendActivity(message, privateKey));
	}

	const results = await Promise.all(promises);
	if (results.find((result) => result === false)) {
		throw new Error("Auth code sending failed");
	}
};
