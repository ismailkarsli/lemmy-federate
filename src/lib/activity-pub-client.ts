import type { JsonLdDocument, NodeObject, ValueObject } from "jsonld";
import jsonld from "jsonld";
import ky, { type KyInstance } from "ky";
import type { ListCommunities } from "lemmy-js-client";
import ms from "ms";
import type { Community, User } from "./lemmy.ts";

const { expand } = jsonld;

interface WebFingerLink {
	rel: string;
	href: string;
	type?: string;
	titles?: Record<string, string>;
	properties?: Record<string, string>;
}

interface WebfingerResponse {
	subject: string;
	links: WebFingerLink[];
}

interface Collection<T> {
	totalItems?: number;
	items?: T[];
	orderedItems?: T[];
	first?: CollectionPage<T> | string;
}

interface CollectionPage<T> extends Collection<T> {
	next: CollectionPage<T> | string;
	prev: CollectionPage<T> | string;
}

export class ActivityPubClient {
	public type = "activity_pub";

	public host: string;

	private httpClient: KyInstance | null = null;

	constructor(host: string) {
		this.host = host;
	}

	async init() {}

	async getUser(username: string): Promise<User> {
		const userResponse = await this.fetchWebfinger(username);

		const expanded = await expand(userResponse);
		const expandedItem = expanded[0];

		return {
			username: this.getValue(
				expandedItem[
					"https://www.w3.org/ns/activitystreams#preferredUsername"
				] as ValueObject[],
			) as string,
			isAdmin:
				this.getValue<string>(
					(expandedItem["https://schema.org/roleName"] ?? null) as
						| ValueObject[]
						| null,
				)?.toLowerCase() === "administrator",
			isBot:
				(expandedItem["@type"] as string[])[0] !==
				"https://www.w3.org/ns/activitystreams#Person",
			isBanned: false,
		};
	}

	async getCommunity(communityName: string): Promise<Community> {
		const [name, host] = communityName.split("@");
		if (host && host !== this.host) {
			throw new Error(
				`ActivityPubClient can't pull remote communities like: ${communityName}`,
			);
		}
		const communityResponse = (await this.fetchWebfinger(
			name,
		)) as JsonLdDocument & {
			followers: Collection<string> | string;
		};

		const expanded = await expand(communityResponse);
		const expandedItem = expanded[0];

		if (
			(expandedItem["@type"] as string[])[0] !==
			"https://www.w3.org/ns/activitystreams#Group"
		) {
			throw new Error("The fetched community is not of the Group type.");
		}

		const followers = (expandedItem[
			"https://www.w3.org/ns/activitystreams#followers"
		] ?? null) as NodeObject[] | null;
		let followersCollection: string[] | null;
		if (typeof followers?.[0]?.["@id"] !== "undefined") {
			followersCollection = await this.resolveCollection(
				(followers as NodeObject[])?.[0]?.["@id"] as string,
			);
		} else if (
			followers?.[0]?.["@type"]?.[0] ===
				"https://www.w3.org/ns/activitystreams#Collection" ||
			followers?.[0]?.["@type"]?.[0] ===
				"https://www.w3.org/ns/activitystreams#OrderedCollection"
		) {
			followersCollection = await this.resolveCollection(
				communityResponse.followers as Collection<string>,
			);
		} else {
			followersCollection = null;
		}

		return {
			id: expandedItem["@id"] as string,
			name: this.getValue(
				expandedItem[
					"https://www.w3.org/ns/activitystreams#preferredUsername"
				] as ValueObject[],
			) as string,
			isDeleted: false,
			isRemoved: false,
			nsfw:
				this.getValue(
					(expandedItem["https://www.w3.org/ns/activitystreams#sensitive"] ??
						null) as ValueObject[] | null,
				) ?? false,
			public: true,
			subscribed: "NotSubscribed", // not possible to determine, there's no current user
			localSubscribers:
				followersCollection?.filter((item) => {
					const url = new URL(item);
					return url.host === this.host;
				})?.length ?? null,
		};
	}

	async followCommunity(
		_community_id: number | string,
		_follow: boolean,
	): Promise<void> {
		// not possible, maybe at a later date with a private key?
		throw new Error(
			"Following communities with ActivityPubClient is not possible.",
		);
	}

	async listCommunities(_query: ListCommunities): Promise<Community[]> {
		throw new Error(
			"Listing communities with ActivityPubClient is not possible.",
		);
	}

	private async getHttpClient(): Promise<KyInstance> {
		this.httpClient ??= ky.create({
			timeout: ms("60 seconds"),
			retry: 1,
			headers: {
				"User-Agent": "LemmyFederate/1.0 (+https://lemmy-federate.com)",
			},
		});

		return this.httpClient;
	}

	private async fetchWebfinger(name: string): Promise<JsonLdDocument> {
		const acct = `acct:${name}@${this.host}`;
		const webfingerUrl = `https://${this.host}/.well-known/webfinger?resource=${acct}`;
		const httpClient = await this.getHttpClient();

		const response = httpClient.get<WebfingerResponse>(webfingerUrl, {
			headers: {
				Accept: "application/jrd+json",
			},
		});
		const webfingerResponse = await response.json();
		if (webfingerResponse.subject !== acct) {
			throw new Error(
				"Invalid data has been returned, the returned subject does not match the requested one",
			);
		}

		let url: string | undefined;
		for (const link of webfingerResponse.links) {
			if (link.type !== "application/activity+json" || link.rel !== "self") {
				continue;
			}
			url = link.href;
			break;
		}

		if (!url) {
			throw new Error("No ActivityPub URL has been found using WebFinger");
		}

		const resourceResponse = await httpClient.get<JsonLdDocument>(url, {
			headers: { Accept: "application/activity+json" },
		});
		return await resourceResponse.json();
	}

	private async resolveCollection<T>(
		collectionOrLink: Collection<T> | string,
	): Promise<T[] | null> {
		const httpClient = await this.getHttpClient();

		let collection: Collection<T>;

		if (typeof collectionOrLink === "string") {
			const response = await httpClient.get<Collection<T>>(collectionOrLink, {
				headers: { Accept: "application/activity+json" },
			});
			collection = await response.json();
		} else {
			collection = collectionOrLink;
		}

		const result: T[] = [];
		const directItems = collection.items ?? collection.orderedItems ?? null;
		if (directItems) {
			return directItems as T[];
		}

		if (!collection.first) {
			return null;
		}

		let pageRef: CollectionPage<T> | string = collection.first;
		do {
			const page = await this.fetchCollectionPage(pageRef);
			const items = page.orderedItems ?? page.items ?? [];

			for (const item of items) {
				result.push(item);
			}

			pageRef = page.next;
		} while (pageRef);

		return result;
	}

	private async fetchCollectionPage<T>(
		page: CollectionPage<T> | string,
	): Promise<CollectionPage<T>> {
		if (typeof page !== "string") {
			return page;
		}

		const httpClient = await this.getHttpClient();
		const response = await httpClient.get<CollectionPage<T>>(page, {
			headers: { Accept: "application/activity+json" },
		});

		return await response.json();
	}

	private getValue<T>(value: ValueObject | ValueObject[] | null): T | null {
		if (value === null) {
			return null;
		}

		const singleItem = Array.isArray(value) ? value[0] : value;

		return singleItem["@value"] as T | null;
	}
}
