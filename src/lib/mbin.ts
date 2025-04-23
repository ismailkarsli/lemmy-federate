import ky from "ky";
import type { ListCommunities } from "lemmy-js-client";
import ms from "ms";
import typia from "typia";
import { type Community, LemmyClient, type User } from "./lemmy";

const CONTACT_EMAIL = typia.assert<string>(process.env.CONTACT_EMAIL);
const APP_URL = typia.assert<string>(process.env.APP_URL);
const BOT_SCOPES = ["read", "magazine", "user:profile"];

type MbinUser = {
	userId: number;
	username: string;
	createdAt: string;
	isBot: boolean;
	isAdmin: boolean;
};

type MbinFederatedInstances = {
	instances: { domain: string; software: string; version: string }[];
};

type MbinMagazine = {
	magazineId: number;
	name: string;
	title: string;
	description: string;
	subscriptionsCount: number;
	isAdult: boolean;
	isUserSubscribed: boolean;
	localSubscribers?: number | null;
};

type MbinOauthClient = {
	identifier: string;
	secret: string;
};

interface SearchActor {
	type: "user" | "magazine";
	object: {
		apId: string;
		magazineId?: number | null;
	};
}

const api = ky.create({
	timeout: ms("10 seconds"),
	retry: {
		limit: 3,
	},
});

const mbinMagazineToCommunity = (magazine: MbinMagazine): Community => ({
	id: magazine.magazineId,
	name: magazine.name,
	nsfw: magazine.isAdult,
	localSubscribers: magazine.localSubscribers ?? null,
	subscribed: magazine.isUserSubscribed ? "Subscribed" : "NotSubscribed",
	public: true,
	isDeleted: false,
	isRemoved: false,
});

export class MbinClient extends LemmyClient {
	public type = "MBIN";
	private oauthClientId?: string;
	private oauthClientSecret?: string;
	private token?: string;
	private tokenExpires?: number;
	constructor(
		host: string,
		oauthClientId?: string,
		oauthClientSecret?: string,
	) {
		super(host);
		this.oauthClientId = oauthClientId;
		this.oauthClientSecret = oauthClientSecret;
	}

	async getUser(username: string): Promise<User> {
		const user = await api<MbinUser>(
			`https://${this.host}/api/users/name/${username}`,
		).json();
		return {
			username: user.username,
			isAdmin: user.isAdmin,
			isBanned: false,
			isBot: user.isBot,
		};
	}

	async getCommunity(name: string): Promise<Community> {
		const sName = name.includes("@") ? name : `${name}@${this.host}`;
		const actors = (
			await api<{
				apActors?: { type: "magazine"; object: MbinMagazine }[];
			}>(`https://${this.host}/api/search`, {
				searchParams: { q: sName, p: 1, perPage: 1 },
				headers: { authorization: `Bearer ${await this.getBearerToken()}` },
			}).json()
		).apActors;
		const magazine = actors?.find((a) => a.type === "magazine")?.object;
		if (!magazine) throw new Error("Couldn't find magazine");
		return mbinMagazineToCommunity(magazine);
	}

	async followCommunity(community_id: number | string, follow: boolean) {
		let resolvedCommunityId = community_id;

		if (typeof resolvedCommunityId === "string") {
			// assume it's an activity pub id
			resolvedCommunityId =
				await this.getCommunityIdFromApIdMbin(resolvedCommunityId);
		}

		const endpoint = follow ? "subscribe" : "unsubscribe";
		await api.put(
			`https://${this.host}/api/magazine/${resolvedCommunityId}/${endpoint}`,
			{ headers: { Authorization: `Bearer ${await this.getBearerToken()}` } },
		);
	}

	async listCommunities(query: ListCommunities): Promise<Community[]> {
		const endpoint =
			query.type_ === "Subscribed" ? "magazine/subscribed" : "magazines";
		let sort: "active" | "hot" | "newest" = "active";
		if (query.sort?.startsWith("New")) {
			sort = "newest";
		} else if (query.sort === "Hot" || query.sort === "Scaled") {
			sort = "hot";
		} else {
			sort = "active";
		}
		const magazines = await api
			.get<{ items: MbinMagazine[] }>(`https://${this.host}/api/${endpoint}`, {
				searchParams: {
					p: query.page || 1,
					perPage: query.limit || 50,
					hide_adult: query.show_nsfw ? "show" : "hide",
					federation: query.type_ === "All" ? "all" : "local",
					sort,
				},
			})
			.json();

		return magazines.items.map(mbinMagazineToCommunity);
	}

	private async getCommunityIdFromApIdMbin(
		activityPubId: string,
	): Promise<number> {
		const result = await api
			.get<{ apActors: SearchActor[] }>(
				`https://${this.host}/api/search?q=${activityPubId}`,
				{ headers: { Authorization: `Bearer ${await this.getBearerToken()}` } },
			)
			.json();

		for (const item of result.apActors) {
			if (item.type !== "magazine" || item.object.apId !== activityPubId) {
				continue;
			}

			return item.object.magazineId as number;
		}

		throw new Error("Could not resolve magazine by its ActivityPub id.");
	}

	private async getBearerToken(): Promise<string> {
		if (!this.oauthClientId || !this.oauthClientSecret) {
			throw new Error("oauth client id and secret are required");
		}
		const body = new FormData();
		body.append("grant_type", "client_credentials");
		body.append("client_id", this.oauthClientId);
		body.append("client_secret", this.oauthClientSecret);
		body.append("scope", BOT_SCOPES.join(" "));
		if (!this.token || !this.tokenExpires || this.tokenExpires < Date.now()) {
			const res = await api
				.post<{ expires_in: number; access_token: string }>(
					`https://${this.host}/token`,
					{ body },
				)
				.json();
			this.token = res.access_token;
			this.tokenExpires = Date.now() + res.expires_in * 1000;
		}
		return this.token;
	}

	static async getMbinOauthClient(host: string): Promise<MbinOauthClient> {
		const oauthClient = await api
			.post<MbinOauthClient>(`https://${host}/api/client`, {
				json: {
					name: "Lemmy Federate",
					contactEmail: CONTACT_EMAIL,
					description: APP_URL,
					public: false,
					username: "mbin_federate_bot",
					grants: ["client_credentials"],
					scopes: BOT_SCOPES,
				},
			})
			.json()
			.then(typia.createAssert<MbinOauthClient>());

		return oauthClient;
	}
}
