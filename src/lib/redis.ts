import { createClient } from "redis";
import typia from "typia";

const url = typia.assert<string>(process.env.REDIS_URL);
const client = createClient({ url });

client.on("error", (err) => {
	console.error("Redis error", err);
});

await client.connect();
export const redis = client;
