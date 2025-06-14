import ky from "ky";
import type { ListCommunities } from "lemmy-js-client";
import ms from "ms";
import * as z from "zod/v4";
import { type Community, LemmyClient, type User } from "./lemmy.ts";

const BOT_SCOPES = ["read", "magazine", "user:profile"];

type MbinUser = {
	userId: number;
	username: string;
	createdAt: string;
	isBot: boolean;
	isAdmin: boolean;
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

export const MbinOathClientSchema = z.object({
	identifier: z.string(),
	secret: z.string(),
});

interface SearchActor {
	type: "user" | "magazine";
	object: {
		apId: string;
		magazineId?: number | null;
	};
}

const api = ky.create({
	timeout: ms("60 seconds"),
	retry: { limit: 0 },
	headers: {
		"User-Agent": "LemmyFederate/1.0 (+https://lemmy-federate.com)",
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
	public type = "mbin";
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
	async init() {
		this.getBearerToken();
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
				headers: { Authorization: `Bearer ${await this.getBearerToken()}` },
			})
			.json();

		return magazines.items.map(mbinMagazineToCommunity);
	}

	private async getCommunityIdFromApIdMbin(
		activityPubId: string,
	): Promise<number> {
		const result = await api
			.get<{
				apActors: SearchActor[];
			}>(`https://${this.host}/api/search?q=${activityPubId}`, {
				headers: { Authorization: `Bearer ${await this.getBearerToken()}` },
			})
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
		if (!this.token || !this.tokenExpires || this.tokenExpires < Date.now()) {
			const body = new FormData();
			body.append("grant_type", "client_credentials");
			body.append("client_id", this.oauthClientId);
			body.append("client_secret", this.oauthClientSecret);
			body.append("scope", BOT_SCOPES.join(" "));
			const res = await api
				.post<{
					expires_in: number;
					access_token: string;
				}>(`https://${this.host}/token`, { body })
				.json();
			this.token = res.access_token;
			this.tokenExpires = Date.now() + res.expires_in * 1000;
		}
		return this.token;
	}
}
