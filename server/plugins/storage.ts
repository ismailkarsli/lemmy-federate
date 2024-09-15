import ms from "ms";
import redis from "unstorage/drivers/redis";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
	throw new Error("REDIS_URL is required");
}

export default defineNitroPlugin(() => {
	const storage = useStorage();
	const driver = redis({
		url: REDIS_URL,
		ttl: ms("2 hours") / 1000, // in seconds
	});
	storage.mount("redis", driver);
});
