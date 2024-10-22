import {
	LemmyHttp,
	type Login,
	type LoginResponse,
	type SubscribedType,
} from "lemmy-js-client";

export type User = {
	username: string;
	isBanned: boolean;
	isBot: boolean;
	isAdmin: boolean;
};

export type Community = {
	id: number;
	name: string;
	isDeleted: boolean;
	isRemoved: boolean;
	nsfw: boolean;
	localSubscribers: number | null;
	subscribed: SubscribedType;
	public: boolean;
};

export class LemmyClient {
	public host: string;
	protected username?: string;
	protected password?: string;
	protected federatedInstances?: Set<string>;
	private httpClient?: LemmyHttpExtended;
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
			isAdmin: user.person_view.is_admin,
			isBanned: user.person_view.person.banned,
			isBot: user.person_view.person.bot_account,
		};
	}

	async getCommunity(name: string): Promise<Community> {
		const client = await this.getHttpClient();
		const community = await client.getCommunity({ name });
		return {
			id: community.community_view.community.id,
			name: community.community_view.community.name,
			isDeleted: community.community_view.community.deleted,
			isRemoved: community.community_view.community.removed,
			nsfw: community.community_view.community.nsfw,
			localSubscribers: community.community_view.counts.subscribers_local,
			subscribed: community.community_view.subscribed,
			public: community.community_view.community.visibility === "Public",
		};
	}

	async followCommunity(community_id: number, follow: boolean) {
		const client = await this.getHttpClient();
		await client.followCommunity({ community_id, follow });
	}

	/**
	 * @param host target instance host
	 * @returns Whetever the instance is federated with this instance
	 */
	async checkFederationWith(host: string) {
		if (!this.federatedInstances) {
			const client = await this.getHttpClient();
			const res = await client.getFederatedInstances();
			if (!res.federated_instances?.linked) {
				throw new Error("Couldn't fetch federation list");
			}
			this.federatedInstances = new Set(
				res.federated_instances.linked.map((i) => i.domain),
			);
		}
		return this.federatedInstances.has(host);
	}

	/**
	 * @returns Authenticated LemmyHttpExtended client for the instance
	 */
	private async getHttpClient() {
		if (!this.httpClient) {
			this.httpClient = new LemmyHttpExtended(`https://${this.host}`);
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
