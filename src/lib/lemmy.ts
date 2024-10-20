import { randomInt } from "node:crypto";
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
import {
	type GetFederatedInstancesResponse,
	LemmyHttp,
	type Login,
	type LoginResponse,
} from "lemmy-js-client";
import type { LemmyErrorType } from "lemmy-js-client";
import ms from "ms";
import typia from "typia";
import { getCensuresGiven, getEndorsements } from "./fediseer";
import { redis } from "./redis";

const BOT_INSTANCE = process.env.BOT_INSTANCE;
const BOT_USERNAME = process.env.BOT_USERNAME;
const BOT_PASSWORD = process.env.BOT_PASSWORD;
if (!BOT_INSTANCE || !BOT_USERNAME || !BOT_PASSWORD) {
	throw new Error("BOT_INSTANCE, BOT_USERNAME, and BOT_PASSWORD are required");
}

const prisma = new PrismaClient();

export const randomNumber = (length: number) => {
	/// 100000 -> 999999
	return randomInt(10 ** (length - 1), 10 ** length - 1);
};

export const sendAuthCode = async (
	username: string,
	instance: string,
	code: string,
) => {
	const lemmyClient = await getHttpClient(BOT_INSTANCE, {
		username_or_email: BOT_USERNAME,
		password: BOT_PASSWORD,
	});
	const personQuery = await lemmyClient.resolveObject({
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
	await lemmyClient.createPrivateMessage({
		content: message,
		recipient_id: person.id,
	});
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

	if (!(await areInstancesFederated(instance.host, community.instance.host))) {
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

	const localClient = await getHttpClient(community.instance.host);
	const { community_view: localCommunity } = await localClient.getCommunity({
		name: `${community.name}@${community.instance.host}`,
	});

	/**
	 * Check if the community is deleted or removed.
	 */
	if (localCommunity.community.deleted || localCommunity.community.removed) {
		return CommunityFollowStatus.NOT_ALLOWED;
	}

	/**
	 * Check if the community is
	 * - NSFW and the instance is not allowing NSFW content.
	 * - not NSFW and the instance is only allowing NSFW content.
	 */
	if (
		localCommunity.community.nsfw
			? instance.nsfw === NSFW.BLOCK
			: instance.nsfw === NSFW.ONLY
	) {
		return CommunityFollowStatus.NOT_ALLOWED;
	}

	const remoteClient = await getHttpClient(instance.host, {
		username_or_email: instance.bot_name,
		password: instance.bot_pass,
	});
	const { community_view: remoteCommunity } = await remoteClient.getCommunity({
		name: `${community.name}@${community.instance.host}`,
	});
	const localSubscribers = remoteCommunity.counts.subscribers_local ?? 0;

	// Community has other subscribers than the bot
	if (
		localSubscribers > (remoteCommunity.subscribed === "Subscribed" ? 1 : 0)
	) {
		await remoteClient.followCommunity({
			community_id: remoteCommunity.community.id,
			follow: false,
		});
		return CommunityFollowStatus.DONE;
	}

	// if stuck in "Pending" state, unfollow and return error. This way we can retry in next run.
	if (remoteCommunity.subscribed === "Pending") {
		await remoteClient.followCommunity({
			community_id: remoteCommunity.community.id,
			follow: false,
		});
		return CommunityFollowStatus.ERROR;
	}

	// follow if not following already. return in progress state.
	if (remoteCommunity.subscribed !== "Subscribed") {
		await remoteClient.followCommunity({
			community_id: remoteCommunity.community.id,
			follow: true,
		});
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
			const client = await getHttpClient(cf.instance.host, {
				username_or_email: cf.instance.bot_name,
				password: cf.instance.bot_pass,
			});

			const { community_view } = await client.getCommunity({
				name: `${cf.community.name}@${cf.community.instance.host}`,
			});

			await client.followCommunity({
				community_id: community_view.community.id,
				follow: false,
			});
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
		if (!(instance.bot_name && instance.bot_pass)) {
			throw new Error("Bot name and password are required");
		}
		const client = await getHttpClient(instance.host, {
			username_or_email: instance.bot_name,
			password: instance.bot_pass,
		});
		let page = 0;
		while (true) {
			const subscriptions = await client.listCommunities({
				type_: "Subscribed",
				limit: 50,
				page: ++page,
			});
			if (subscriptions.communities.length === 0) {
				break;
			}

			for (const subscription of subscriptions.communities) {
				try {
					await client.followCommunity({
						community_id: subscription.community.id,
						follow: false,
					});
				} catch (e) {
					if ((e as LemmyErrorType)?.error === "rate_limit_error") {
						await new Promise((resolve) => setTimeout(resolve, ms("1 minute")));
						continue;
					}
					throw e;
				}
			}
		}
		// make all follows "in progress"
		await prisma.communityFollow.updateMany({
			where: {
				instanceId: instance.id,
			},
			data: {
				status: CommunityFollowStatus.IN_PROGRESS,
			},
		});
	} catch (e) {
		console.error("error", e);
	}
}

// On some functions auth token is not included in the request like /community/follow or /private_message
export class LemmyHttpExtended extends LemmyHttp {
	public jwt?: string;
	private rateLimitedAt: Date | null = null;
	constructor(
		baseUrl: string,
		options?: {
			fetchFunction?: typeof fetch;
			headers?: {
				[key: string]: string;
			};
		},
	) {
		const fetchToUse = options?.fetchFunction || fetch;
		const fetchFunction: typeof fetch = async (url, init) => {
			// if we get rate limited, ignore next requests for 5 minutes and throw error with "skipped_rate_limit_error" message
			if (
				this.rateLimitedAt &&
				this.rateLimitedAt.getTime() + ms("5 minute") > Date.now()
			) {
				throw new Error("skipped_rate_limit_error");
			}
			try {
				return await fetchToUse(url, {
					...init,
					headers: {
						...init?.headers,
						Authorization: this.jwt ? `Bearer ${this.jwt}` : "",
					},
				}).then((res) => {
					if (!res.ok) return Promise.reject(res);
					return res;
				});
			} catch (e) {
				if (e instanceof Response) {
					// why is Lemmy not sending 429 status code 🤨
					// if the instance is down, it will return 503 status code if using Cloudflare
					if (e.status === 503 || e.status === 429) {
						this.rateLimitedAt = new Date();
						throw new Error("rate_limit_error");
					}
					const body = (await e.json()) as LemmyErrorType;
					if (body?.error === "rate_limit_error") {
						this.rateLimitedAt = new Date();
					}
					throw new Error(
						("message" in body ? body.message : body.error) || e.statusText,
					);
				}
				throw e;
			}
		};

		super(baseUrl, { ...options, fetchFunction });
	}

	async login(form: Login): Promise<LoginResponse> {
		const res = await super.login(form);
		this.jwt = res.jwt;
		return res;
	}
}

const clientCacheMap = new Map<
	string,
	{
		client: LemmyHttpExtended;
		expiration: Date;
	}
>();
export const getHttpClient = async (instance: string, loginForm?: Login) => {
	const key = loginForm?.username_or_email
		? `${instance}-${loginForm.username_or_email}`
		: instance;
	const cached = clientCacheMap.get(key);
	if (cached && cached.expiration > new Date()) {
		if (!cached.client.jwt && loginForm) await cached.client.login(loginForm);
		return cached.client;
	}

	const client = new LemmyHttpExtended(`https://${instance}`, {
		fetchFunction: fetch,
	});
	clientCacheMap.set(key, {
		client,
		expiration: new Date(Date.now() + ms("6 hours")),
	});
	if (loginForm) await client.login(loginForm);
	return client;
};

const getFederatedInstances = async (instance: string) => {
	const key = `federated_instances:${instance}`;
	const cached = await redis.get(key);
	if (cached) {
		return typia.json.assertParse<GetFederatedInstancesResponse>(cached);
	}
	const client = await getHttpClient(instance);
	const res = await client.getFederatedInstances();
	await redis.set(
		key,
		typia.json.assertStringify<GetFederatedInstancesResponse>(res),
		{ EX: ms("1 day") / 1000 },
	);
	return res;
};

/**
 * Checks if two instances are federated with each other.
 * @param source source instance
 * @param target target instance
 * @returns boolean
 */
const areInstancesFederated = async (source: string, target: string) => {
	if (source === target) return true;
	const { federated_instances: src_list } = await getFederatedInstances(source);
	const { federated_instances: trg_list } = await getFederatedInstances(target);
	if (!(src_list && trg_list)) {
		throw new Error("Couldn't fetch federation list");
	}

	/**
	 * if instance is using allow list, then we should check from there
	 * else use block list
	 */
	if (
		src_list.allowed.length
			? !src_list.allowed.some((i) => i.domain === target)
			: src_list.blocked.some((i) => i.domain === target)
	) {
		return false;
	}

	if (
		trg_list.allowed.length
			? !trg_list.allowed.some((i) => i.domain === source)
			: trg_list.blocked.some((i) => i.domain === source)
	) {
		return false;
	}

	return true;
};
