import { TRPCError } from "@trpc/server";
import ky from "ky";
import ms from "ms";
import typia from "typia";
import { redis } from "./redis";

type FediseerResponse = {
	domains: string[];
};
type CachedData = FediseerResponse & {
	updatedAt: string;
};

class Cache {
	key: string;
	constructor(key: string) {
		this.key = key;
	}
	async get() {
		const cached = await redis.get(this.key);
		if (!cached) return null;
		const data = typia.json.assertParse<CachedData>(cached);
		if (data && new Date(data.updatedAt).getTime() > Date.now() - ms("24h")) {
			return data;
		}
		return null;
	}

	async set(data: FediseerResponse) {
		await redis.set(
			this.key,
			typia.json.assertStringify<CachedData>({
				...data,
				updatedAt: new Date().toISOString(),
			}),
		);
	}
}

export const getGuarantees = async (instance: string) => {
	const cache = new Cache(`fediseer_guarantees:${instance}`);
	try {
		const cached = await cache.get();
		if (cached) return cached;

		const guarantees = await ky<FediseerResponse>(
			`https://fediseer.com/api/v1/guarantees/${instance}`,
			{
				searchParams: { domains: true },
			},
		).json();
		await cache.set(guarantees);
		return guarantees;
	} catch (e) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to fetch guarantees from Fediseer",
		});
	}
};

export const getCensuresGiven = async (instance: string) => {
	const cache = new Cache(`fediseer_censures_given:${instance}`);
	try {
		const cached = await cache.get();
		if (cached) return cached;
		const censures = await ky<FediseerResponse>(
			`https://fediseer.com/api/v1/censures_given/${instance}`,
			{
				searchParams: { domains: true },
			},
		).json();
		await cache.set(censures);
		return censures;
	} catch (e) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to fetch censures from Fediseer",
		});
	}
};

export const getEndorsements = async (instance: string) => {
	const cache = new Cache(`fediseer_endorsements:${instance}`);
	try {
		const cached = await cache.get();
		if (cached) return cached;
		const endorsements = await ky<FediseerResponse>(
			`https://fediseer.com/api/v1/endorsements/${instance}`,
			{ searchParams: { domains: true } },
		).json();
		await cache.set(endorsements);
		return endorsements;
	} catch (e) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to fetch endorsements from Fediseer",
		});
	}
};
