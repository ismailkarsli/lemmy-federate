import ky from "ky";
import ms from "ms";
import { type Community, LemmyClient, type User } from "./lemmy";

type DchBlogUser = {
	preferredUsername: string;
	roleName: "Administrator" | string;
};

type DchBlogGroup = {
	id: string;
	preferredUsername: string;
};

const dchBlogGroupToCommunity = (group: DchBlogGroup): Community => ({
	id: 1,
	name: group.preferredUsername,
	nsfw: false,
	localSubscribers: null,
	subscribed: "NotSubscribed",
	public: true,
	isDeleted: false,
	isRemoved: false,
});

const api = ky.create({
	timeout: ms("1 minutes"),
	retry: {
		limit: 3,
	},
});

export class DchBlog extends LemmyClient {
	public type: string = "DCH_BLOG";
	async getUser(username: string): Promise<User> {
		const user = await api<DchBlogUser>(`https://${this.host}/u/${username}`, {
			headers: {
				Accept: "application/activity+json",
			},
		}).json();
		return {
			username: user.preferredUsername,
			isAdmin: user.roleName === "Administrator",
			isBanned: false,
			isBot: false,
		};
	}

	async getCommunity(name: string): Promise<Community> {
		const group = await api<DchBlogGroup>(`https://${this.host}/c/${name}`, {
			headers: {
				Accept: "application/activity+json",
			},
		}).json();
		return dchBlogGroupToCommunity(group);
	}

	async followCommunity() {
		throw new Error(`${this.constructor.name} can't follow communities.`);
	}

	async listCommunities(): Promise<Community[]> {
		throw new Error(`${this.constructor.name} can't list communities.`);
	}

	async checkFederationWith(host: string): Promise<boolean> {
		if (host === this.host) return true;
		return true;
	}
}
