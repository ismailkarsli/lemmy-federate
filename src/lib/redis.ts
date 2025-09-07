import { Redis as IORedis } from "ioredis";
import { createClient } from "redis";
import * as z from "zod/v4";

const url = z.url().parse(process.env.REDIS_URL);
const client = createClient({ url });

client.on("error", (err) => {
	console.error("Redis error", err);
});

await client.connect();
export const redis = client;
export const ioredis = new IORedis(url); // used in bullmq
