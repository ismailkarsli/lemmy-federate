import {type Community, type User} from "./lemmy.ts";
import type {ListCommunities} from "lemmy-js-client";
import ky, {type KyInstance} from "ky";
import ms from "ms";
import {expand, JsonLdDocument, type NodeObject, ValueObject} from "jsonld";

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
    public host: string;
    private username?: string;
    private password?: string;

    private httpClient: KyInstance | null = null;

    constructor(host: string, username?: string, password?: string) {
        this.host = host;
        this.username = username;
        this.password = password;
    }

    async getUser(username: string): Promise<User> {
        const userResponse = await this.fetchWebfinger(username);
        if (userResponse === null) {
            // todo there were some failures
            return undefined;
        }

        const expanded = await expand(userResponse);
        const expandedItem = expanded[0];

        return {
            username: this.getValue(expandedItem['https://www.w3.org/ns/activitystreams#preferredUsername'] as ValueObject[])!,
            isAdmin: this.getValue<string>((expandedItem['https://schema.org/roleName'] ?? null) as ValueObject[] | null)?.toLowerCase() === 'administrator',
            isBot: (expandedItem['@type'] as string[])[0] !== 'https://www.w3.org/ns/activitystreams#Person',
            isBanned: false,
        }
    }

    async checkFederationWith(host: string): Promise<boolean> {
        // not possible
        return true;
    }

    async getCommunity(name: string): Promise<Community> {
        const communityResponse = await this.fetchWebfinger(name);
        if (communityResponse === null) {
            // todo there were failures
            return undefined;
        }

        const expanded = await expand(communityResponse);
        const expandedItem = expanded[0];

        const followers = (expandedItem['https://www.w3.org/ns/activitystreams#followers'] ?? null) as NodeObject[] | null;
        let followersCollection: string[] | null;
        if (typeof followers?.[0]?.['@id'] !== 'undefined') {
            followersCollection = await this.resolveCollection((followers as NodeObject[])?.[0]?.['@id'] as string);
        } else if (followers?.[0]?.['@type']?.[0] === 'https://www.w3.org/ns/activitystreams#Collection' || followers?.[0]?.['@type']?.[0] === 'https://www.w3.org/ns/activitystreams#OrderedCollection') {
            followersCollection = await this.resolveCollection((communityResponse as any)['followers'] as Collection<string>);
        } else {
            followersCollection = null;
        }

        return {
            id: expandedItem['@id'] as string,
            name: this.getValue(expandedItem['https://www.w3.org/ns/activitystreams#preferredUsername'] as ValueObject[])!,
            isDeleted: false,
            isRemoved: false,
            nsfw: this.getValue((expandedItem['https://www.w3.org/ns/activitystreams#sensitive'] ?? null) as ValueObject[] | null) ?? false,
            public: true,
            subscribed: "NotSubscribed", // not possible to determine, there's no current user
            localSubscribers: followersCollection?.filter(
                item => {
                    const url = new URL(item);
                    return url.host === this.host;
                }
            )?.length ?? null,
        }
    }

    async followCommunity(community_id: number | string, follow: boolean): Promise<void> {
        // not possible, maybe at a later date with a private key?
    }

    async listCommunities(query: ListCommunities): Promise<Community[]> {
        // not possible
        return [];
    }

    private async getHttpClient(): Promise<KyInstance> {
        this.httpClient ??= ky.create({
            timeout: ms("1 minutes"),
            retry: 1,
            hooks: {
                beforeRequest: [
                    async (req) => {
                        let newReq = req;
                        newReq.headers.set('Accept', 'application/activity+json');

                        return newReq;
                    },
                ],
            },
        });

        return this.httpClient;
    }

    private async fetchWebfinger(name: string): Promise<JsonLdDocument | null> {
        const acct = `acct:${name}:${this.host}`;
        const webfingerUrl = `https://${this.host}/.well-known/webfinger?resource=${acct}`;
        const httpClient = await this.getHttpClient();

        const response = httpClient.get<WebfingerResponse>(`https://${webfingerUrl}`, {
            headers: {
                Accept: `application/jrd+json`,
            },
        });
        const webfingerResponse = await response.json();
        if (webfingerResponse.subject !== acct) {
            // todo if it's not the same, return not found
            return null;
        }

        let url: string | undefined = undefined;
        for (const link of webfingerResponse.links) {
            if (link.type !== 'application/activity+json' || link.rel !== 'self') {
                continue;
            }
            url = link.href;
            break;
        }

        if (!url) {
            // todo there's no activity pub relation link
            return null;
        }

        const userResponse = await httpClient.get<JsonLdDocument>(url);
        return await userResponse.json();
    }

    private async resolveCollection<T>(collectionOrLink: Collection<T> | string): Promise<T[] | null> {
        const httpClient = await this.getHttpClient();

        let collection: Collection<T>;

        if (typeof collectionOrLink === 'string') {
            const response = await httpClient.get<Collection<T>>(collectionOrLink);
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

    private async fetchCollectionPage<T>(page: CollectionPage<T> | string): Promise<CollectionPage<T>> {
        if (typeof page !== 'string') {
            return page;
        }

        const httpClient = await this.getHttpClient();
        const response = await httpClient.get<CollectionPage<T>>(page);

        return await response.json();
    }

    private getValue<T>(value: ValueObject | ValueObject[] | null): T | null {
        if (value === null) {
            return null;
        }

        if (Array.isArray(value)) {
            value = value[0];
        }

        return value["@value"] as T | null;
    }
}
