import ms from "ms";

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
		const storage = useStorage("redis");
		const cached = await storage.getItem<CachedData>(this.key);
		if (
			cached &&
			new Date(cached.updatedAt).getTime() > Date.now() - ms("24h")
		) {
			return cached;
		}
		return null;
	}

	async set(data: FediseerResponse) {
		const storage = useStorage("redis");
		await storage.setItem(this.key, {
			...data,
			updatedAt: new Date().toISOString(),
		});
	}
}

export const getGuarantees = async (instance: string) => {
	const cache = new Cache(`fediseer_guarantees:${instance}`);
	try {
		const cached = await cache.get();
		if (cached) return cached;

		const guarantees = await $fetch<FediseerResponse>(
			`https://fediseer.com/api/v1/guarantees/${instance}`,
			{
				query: {
					domains: true,
				},
			},
		);
		await cache.set(guarantees);
		return guarantees;
	} catch (e) {
		throw createError({
			statusCode: 500,
			message: "Failed to fetch guarantees from Fediseer",
			data: e,
		});
	}
};

export const getCensuresGiven = async (instance: string) => {
	const cache = new Cache(`fediseer_censures_given:${instance}`);
	try {
		const cached = await cache.get();
		if (cached) return cached;
		const censures = await $fetch<FediseerResponse>(
			`https://fediseer.com/api/v1/censures_given/${instance}`,
			{
				query: {
					domains: true,
				},
			},
		);
		await cache.set(censures);
		return censures;
	} catch (e) {
		throw createError({
			statusCode: 500,
			message: "Failed to fetch censures from Fediseer",
			data: e,
		});
	}
};

export const getEndorsements = async (instance: string) => {
	const cache = new Cache(`fediseer_endorsements:${instance}`);
	try {
		const cached = await cache.get();
		if (cached) return cached;
		const endorsements = await $fetch<FediseerResponse>(
			`https://fediseer.com/api/v1/endorsements/${instance}`,
			{
				query: {
					domains: true,
				},
			},
		);
		await cache.set(endorsements);
		return endorsements;
	} catch (e) {
		throw createError({
			statusCode: 500,
			message: "Failed to fetch endorsements from Fediseer",
			data: e,
		});
	}
};
