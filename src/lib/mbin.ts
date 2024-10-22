import ky from "ky";
import { type Community, LemmyClient, type User } from "./lemmy";

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

export class MbinClient extends LemmyClient {
	async getUser(username: string): Promise<User> {
		const user = await ky<MbinUser>(
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
		throw new Error("MbinClient.getCommunity is not implemented");
	}

	async followCommunity(community_id: number, follow: boolean) {
		throw new Error("MbinClient.followCommunity is not implemented");
	}

	async checkFederationWith(host: string): Promise<boolean> {
		if (host === this.host) return true;
		if (!this.federatedInstances) {
			const federated = await ky<MbinFederatedInstances>(
				`https://${this.host}/api/federated`,
			).json();
			this.federatedInstances = new Set(
				federated.instances.map((i) => i.domain),
			);
		}
		return this.federatedInstances.has(host);
	}
}
