/**
 * KV Cache helper - replaces Redis functionality
 */
export class KVCache {
	private kv: KVNamespace;

	constructor(kv: KVNamespace) {
		this.kv = kv;
	}

	/**
	 * Get a JSON value from KV
	 */
	async get<T>(key: string): Promise<T | null> {
		const value = await this.kv.get(key, "json");
		return value as T | null;
	}

	/**
	 * Set a JSON value in KV with optional TTL
	 * @param key - The key to set
	 * @param value - The value to store (will be JSON stringified)
	 * @param ttlSeconds - Time to live in seconds (optional)
	 */
	async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
		const options: KVNamespacePutOptions = {};
		if (ttlSeconds) {
			options.expirationTtl = ttlSeconds;
		}
		await this.kv.put(key, JSON.stringify(value), options);
	}

	/**
	 * Get a value and its metadata (for checking TTL)
	 */
	async getWithMetadata<T>(
		key: string,
	): Promise<{ value: T | null; metadata: unknown }> {
		const result = await this.kv.getWithMetadata(key, "json");
		return {
			value: result.value as T | null,
			metadata: result.metadata,
		};
	}

	/**
	 * Delete a key from KV
	 */
	async delete(key: string): Promise<void> {
		await this.kv.delete(key);
	}

	/**
	 * List keys with optional prefix (useful for cache invalidation)
	 */
	async list(
		prefix?: string,
	): Promise<{ keys: { name: string; expiration?: number }[] }> {
		const result = await this.kv.list({ prefix });
		return {
			keys: result.keys.map((k) => ({
				name: k.name,
				expiration: k.expiration,
			})),
		};
	}
}

interface KVNamespacePutOptions {
	expirationTtl?: number;
	expiration?: number;
	metadata?: unknown;
}
