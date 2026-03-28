import { TRPCError } from "@trpc/server";
import ky, { HTTPError } from "ky";
import { redis } from "./redis.ts";

type FediseerResponse = {
	domains: string[];
};

class Cache {
	key: string;
	constructor(key: string) {
		this.key = key;
	}
	async get() {
		const cached = await redis.get(this.key);
		if (!cached) return null;
		const data = JSON.parse(cached) as FediseerResponse;
		if (data) return data;
		return null;
	}

	async set(data: FediseerResponse) {
		await redis.set(this.key, JSON.stringify(data), {
			expiration: { type: "EX", value: 24 * 60 * 60 },
		});
	}
}

export const getGuarantees = async (instance: string) => {
	const cache = new Cache(`fediseer_guarantees:${instance}`);
	try {
		const cached = await cache.get();
		if (cached) return cached;

		const guarantees = await ky<FediseerResponse>(
			`https://fediseer.com/api/v1/guarantees/${instance}`,
			{ searchParams: { domains: true } },
		).json();
		await cache.set(guarantees);
		return guarantees;
	} catch (e) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Failed to fetch guarantees from Fediseer",
			cause: e,
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
		if (e instanceof HTTPError && e.response.status === 403) {
			await cache.set({ domains: [] });
			return { domains: [] } satisfies FediseerResponse;
		}
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Failed to fetch censures from Fediseer",
			cause: e,
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
		if (e instanceof HTTPError && e.response.status === 403) {
			await cache.set({ domains: [] });
			return { domains: [] } satisfies FediseerResponse;
		}
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Failed to fetch endorsements from Fediseer",
			cause: e,
		});
	}
};
