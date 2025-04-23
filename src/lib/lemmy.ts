import ky, { HTTPError } from "ky";
import {
	type CommunityView,
	type LemmyErrorType,
	LemmyHttp,
	type ListCommunities,
	type LocalSiteRateLimit,
	type Login,
	type LoginResponse,
	type SubscribedType,
} from "lemmy-js-client";
import ms from "ms";
import type { FilterNotEndingWith } from "../types/FilterNotEndingWith";

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

type RateLimitKeys = Exclude<
	FilterNotEndingWith<keyof LocalSiteRateLimit, "per_second">,
	"local_site_id" | "published" | "updated"
>;

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
	private httpClient?: LemmyHttpExtended;
	private baseRateLimits?: LocalSiteRateLimit;
	private rateLimits?: { [key in RateLimitKeys]: number };
	constructor(host: string, username?: string, password?: string) {
		this.host = host;
		this.username = username;
		this.password = password;
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
	 * @returns Authenticated LemmyHttpExtended client for the instance
	 */
	private async getHttpClient() {
		if (!this.httpClient) {
			const api = ky.create({
				timeout: ms("10 seconds"),
				retry: 0,
				hooks: {
					beforeRequest: [
						async (req) => {
							// add `auth` field to query (GET/DELETE) or body (POST/PUT) for 0.18.x compatibility
							const auth = req.headers.get("authorization")?.split(" ")?.at(1);
							let newReq = req;
							if (auth) {
								if (req.method === "GET" || req.method === "DELETE") {
									const url = new URL(req.url);
									url.searchParams.append("auth", auth);
									const newRequest = new Request(url, req);
									newReq = newRequest;
								}
								if (req.method === "POST" || req.method === "PUT") {
									const body: unknown = await req.clone().json();
									if (body && typeof body === "object" && body !== null) {
										// @ts-expect-error body is not typed
										body.auth = auth || null;
									}
									newReq = new Request(req, { body: JSON.stringify(body) });
								}
							}
							if (!(this.baseRateLimits && this.rateLimits)) return newReq;
							const key = getRateLimitKey(req.url, req.method);
							if (!key) return newReq;
							if (this.rateLimits[key] > 0) {
								this.rateLimits[key] -= 1;
								return newReq;
							}
							// wait till new rate limit period start
							const date = new Date();
							const secs =
								date.getSeconds() +
								60 * (date.getMinutes() + 60 * date.getHours());
							const wait = Math.ceil(
								this.baseRateLimits[`${key}_per_second`] -
									(secs % this.baseRateLimits[`${key}_per_second`]),
							);
							await new Promise((r) => setTimeout(r, wait * 1000));
							return newReq;
						},
					],
					beforeError: [
						async (err) => {
							if (err.response.status === 400) {
								const lemmyError = (await err.response
									.clone()
									.json()) as LemmyErrorType;
								if (lemmyError.error === "rate_limit_error") {
									// reset local limit
									if (this.rateLimits) {
										const key = getRateLimitKey(
											err.request.url,
											err.request.method,
										);
										if (key) this.rateLimits[key] = 0;
									}
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
							if (err.response.status === 429) {
								if (this.rateLimits) {
									const key = getRateLimitKey(
										err.request.url,
										err.request.method,
									);
									if (key) this.rateLimits[key] = 0;
								}
							}
							return err;
						},
					],
				},
			});
			this.httpClient = new LemmyHttpExtended(`https://${this.host}`, {
				fetchFunction: api,
			});
			if (!this.rateLimits) {
				const rateLimits = await this.httpClient.getSite();
				this.baseRateLimits = rateLimits.site_view.local_site_rate_limit;
				this.rateLimits = structuredClone(this.baseRateLimits);
				this.rateLimits.message -= 1; // we used one already :)
			}
			if (this.username && this.password) {
				await this.httpClient.login({
					username_or_email: this.username,
					password: this.password,
				});
			}
		}
		return this.httpClient;
	}
}

// On some functions auth token is not included in the request like /community/follow or /private_message
export class LemmyHttpExtended extends LemmyHttp {
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

function getRateLimitKey(url: string, method: string): RateLimitKeys | null {
	const { pathname } = new URL(url);
	const p = pathname.replace("/api/v3", "");
	const m = method;

	// put these explicit ones on top
	if (
		(p === "/community" ||
			p === "/user/register" ||
			p === "/user/login" ||
			p === "/user/password_reset") &&
		m === "POST"
	) {
		return "register";
	}
	if ((p === "/post" || p === "/user/get_captcha") && m === "POST") {
		return "post";
	}
	if (p === "/comment" && m === "POST") return "comment";
	if (p === "/search") return "search";
	if (p === "/user/export_settings" || p === "/user/import_settings") {
		return "import_user_settings";
	}

	// put these on bottom
	if (
		p.startsWith("/site") ||
		p === "/modlog" ||
		p === "/resolve_object" ||
		p.startsWith("/community") ||
		p === "/federated_instances" ||
		p === "/post" ||
		p.startsWith("/comment") ||
		p.startsWith("/private_message") ||
		p.startsWith("/account") ||
		p.startsWith("/user") ||
		p.startsWith("/admin") ||
		p.startsWith("/custom_emoji") ||
		p.startsWith("/oauth_provider")
	) {
		return "message";
	}

	if (p.startsWith("/oauth/authenticate")) {
		return "register";
	}

	return null;
}
