import type { ListCommunities, SubscribedType } from "lemmy-js-client";

export type LFCommunity = {
	id: number | string;
	name: string;
	isDeleted: boolean;
	isRemoved: boolean;
	nsfw: boolean;
	localSubscribers: number | null;
	subscribed: SubscribedType;
	public: boolean;
};

export interface LFClient {
	type: string;
	getCommunity(name: string): Promise<LFCommunity>;
	followCommunity(id: number | string, follow: boolean): Promise<void>;
	listCommunities(query: ListCommunities): Promise<LFCommunity[]>;
}
