import ky, { HTTPError } from "ky";
import {
	type CommunityView,
	type LemmyErrorType,
	LemmyHttp,
	type ListCommunities,
	type Login,
	type LoginResponse,
	type SubscribedType,
} from "lemmy-js-client";
import ms from "ms";
import pThrottle from "p-throttle";

export type User = {
	username: string;
	isBanned: boolean;
	isBot: boolean;
	isAdmin: boolean;
};

export type Community = {
	id: number | string;
	name: string;
	isDeleted: boolean;
	isRemoved: boolean;
	nsfw: boolean;
	localSubscribers: number | null;
	subscribed: SubscribedType;
	public: boolean;
};

const lemmyCommunityToCommunity = (cv: CommunityView): Community => ({
	id: cv.community.id,
	name: cv.community.name,
	isDeleted: cv.community.deleted,
	isRemoved: cv.community.removed,
	nsfw: cv.community.nsfw,
	localSubscribers: cv.counts.subscribers_local ?? null,
	subscribed: cv.subscribed,
	public: cv.community.visibility ? cv.community.visibility === "Public" : true,
});

export class LemmyClient {
	public type = "LEMMY";
	public host: string;
	protected federatedInstances?: Set<string>;
	private username?: string;
	private password?: string;
	private httpClient?: LemmyHttpPatched;
	constructor(host: string, username?: string, password?: string) {
		this.host = host;
		this.username = username;
		this.password = password;
	}

	async init() {
		await this.getHttpClient();
	}

	/**
	 * @param username local username
	 * @returns Simplified user object
	 */
	async getUser(username: string): Promise<User> {
		const client = await this.getHttpClient();
		const user = await client.getPersonDetails({ username });
		return {
			username: user.person_view.person.name,
			isAdmin:
				user.person_view.is_admin ??
				// @ts-expect-error In 0.18.x instances it is `admin`.
				user.person_view.person.admin,
			isBanned: user.person_view.person.banned,
			isBot: user.person_view.person.bot_account,
		};
	}

	async getCommunity(name: string): Promise<Community> {
		const client = await this.getHttpClient();
		const community = await client.getCommunity({ name });
		return lemmyCommunityToCommunity(community.community_view);
	}

	async followCommunity(community_id: number | string, follow: boolean) {
		let resolvedCommunityId = community_id;

		if (typeof resolvedCommunityId === "string") {
			// assume it's an activity pub id
			resolvedCommunityId =
				await this.getCommunityIdFromApIdLemmy(resolvedCommunityId);
		}

		const client = await this.getHttpClient();
		await client.followCommunity({ community_id: resolvedCommunityId, follow });
	}

	async listCommunities(query: ListCommunities): Promise<Community[]> {
		const client = await this.getHttpClient();
		const communities = await client.listCommunities(query);
		return communities.communities.map(lemmyCommunityToCommunity);
	}

	private async getCommunityIdFromApIdLemmy(
		activityPubId: string,
	): Promise<number> {
		const httpClient = await this.getHttpClient();
		const result = await httpClient.resolveObject({
			q: activityPubId,
		});
		if (!result.community) {
			throw new Error("Could not resolve a community by its ActivityPub id");
		}

		return result.community.community.id;
	}

	/**
	 * @returns Authenticated LemmyHttpPatched client for the instance
	 */
	private async getHttpClient() {
		if (!this.httpClient) {
			const throttledFetch = pThrottle({
				limit: 1,
				interval: 1000,
			})(fetch);
			const api = ky.create({
				fetch: throttledFetch,
				timeout: ms("10 seconds"),
				retry: 0,
				headers: {
					"User-Agent": "LemmyFederate/1.0 (+https://lemmy-federate.com)",
				},
				hooks: {
					beforeError: [
						async (err) => {
							// return proper statuses
							if (err.response.status === 400) {
								const lemmyError = (await err.response
									.clone()
									.json()) as LemmyErrorType;
								if (lemmyError.error === "rate_limit_error") {
									return new HTTPError(
										new Response(err.response.body, {
											status: 429,
											statusText: "Too Many Requests",
										}),
										err.request,
										err.options,
									);
								}
								if (lemmyError.error === "couldnt_find_community") {
									return new HTTPError(
										new Response(err.response.body, {
											status: 404,
										}),
										err.request,
										err.options,
									);
								}
							}
							return err;
						},
					],
				},
			});
			const newClient = new LemmyHttpPatched(`https://${this.host}`, {
				fetchFunction: api,
			});
			if (this.username && this.password) {
				await newClient.login({
					username_or_email: this.username,
					password: this.password,
				});
			}
			this.httpClient = newClient;
		}
		return this.httpClient;
	}
}

// On some functions auth token is not included in the request like /community/follow or /private_message
export class LemmyHttpPatched extends LemmyHttp {
	public jwt?: string;
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
			return await fetchToUse(url, {
				...init,
				headers: {
					...init?.headers,
					Authorization: this.jwt ? `Bearer ${this.jwt}` : "",
				},
			});
		};
		super(baseUrl, { ...options, fetchFunction });
	}
	async login(form: Login): Promise<LoginResponse> {
		const res = await super.login(form);
		this.jwt = res.jwt;
		return res;
	}
}
