import { TRPCError } from "@trpc/server";
import ky, { HTTPError } from "ky";
import type { KVCache } from "./kv.ts";

type FediseerResponse = {
	domains: string[];
};

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export const getGuarantees = async (instance: string, kv: KVCache) => {
	const key = `fediseer_guarantees:${instance}`;
	try {
		const cached = await kv.get<FediseerResponse>(key);
		if (cached) return cached;

		const guarantees = await ky<FediseerResponse>(
			`https://fediseer.com/api/v1/guarantees/${instance}`,
			{ searchParams: { domains: true } },
		).json();
		await kv.set(key, guarantees, CACHE_TTL_SECONDS);
		return guarantees;
	} catch (e) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Failed to fetch guarantees from Fediseer",
			cause: e,
		});
	}
};

export const getCensuresGiven = async (instance: string, kv: KVCache) => {
	const key = `fediseer_censures_given:${instance}`;
	try {
		const cached = await kv.get<FediseerResponse>(key);
		if (cached) return cached;
		const censures = await ky<FediseerResponse>(
			`https://fediseer.com/api/v1/censures_given/${instance}`,
			{
				searchParams: { domains: true },
			},
		).json();
		await kv.set(key, censures, CACHE_TTL_SECONDS);
		return censures;
	} catch (e) {
		if (e instanceof HTTPError && e.response.status === 403) {
			await kv.set(key, { domains: [] }, CACHE_TTL_SECONDS);
			return { domains: [] } satisfies FediseerResponse;
		}
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Failed to fetch censures from Fediseer",
			cause: e,
		});
	}
};

export const getEndorsements = async (instance: string, kv: KVCache) => {
	const key = `fediseer_endorsements:${instance}`;
	try {
		const cached = await kv.get<FediseerResponse>(key);
		if (cached) return cached;
		const endorsements = await ky<FediseerResponse>(
			`https://fediseer.com/api/v1/endorsements/${instance}`,
			{ searchParams: { domains: true } },
		).json();
		await kv.set(key, endorsements, CACHE_TTL_SECONDS);
		return endorsements;
	} catch (e) {
		if (e instanceof HTTPError && e.response.status === 403) {
			await kv.set(key, { domains: [] }, CACHE_TTL_SECONDS);
			return { domains: [] } satisfies FediseerResponse;
		}
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Failed to fetch endorsements from Fediseer",
			cause: e,
		});
	}
};
