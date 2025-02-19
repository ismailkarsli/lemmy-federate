import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import typia from "typia";
import { createContext, router } from "./trpc";
import * as fs from 'fs';

import { startJobs } from "../scripts/start-jobs";
import { authRouter } from "./routes/auth";
import { communityRouter } from "./routes/community";
import { instanceRouter } from "./routes/instance";
import {LocalUser} from "./activitypub-server/vocabulary/local-user.ts";
import {OrderedCollection, UnorderedCollection} from "./activitypub-server/vocabulary/collection.ts";

const APP_URL = typia.assert<string>(process.env.APP_URL);
const NODE_ENV = typia.assert<string>(process.env.NODE_ENV);

const app = new Hono();

const appRouter = router({
	auth: authRouter,
	community: communityRouter,
	instance: instanceRouter,
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;

app.use(
	"/api/*",
	cors({
		origin:
			NODE_ENV === "production"
				? APP_URL
				: [APP_URL, "http://localhost:3000", "http://localhost:5173"],
		credentials: true,
	}),
);
app.use(
	"/api/*",
	trpcServer({
		router: appRouter,
		createContext,
		onError: ({ error }) => {
			error.message = error.message.replace(
				"Error on typia.assert()",
				"Validation error",
			);
			if (error.code === "INTERNAL_SERVER_ERROR") {
				console.error(error);
			}
		},
	}),
);

if (NODE_ENV === "production") startJobs();

const publicKey = fs.readFileSync(__dirname + "/../keys/public.pem", 'utf8');

app.get("/ap/u/bot", context => {
	return context.json(new LocalUser(publicKey), 200, {
		"Content-Type": "application/activity+json",
	});
});
app.get("/ap/u/bot/inbox", context => {
	return context.json(new OrderedCollection(
		context.req.url,
		[],
	), 200, {
		"Content-Type": "application/activity+json",
	});
});
app.get("/ap/u/bot/outbox", context => {
	return context.json(new OrderedCollection(
		context.req.url,
		[],
	), 200, {
		"Content-Type": "application/activity+json",
	});
});
app.get("/ap/u/bot/followers", context => {
	return context.json(new UnorderedCollection(
		context.req.url,
		[],
	), 200, {
		"Content-Type": "application/activity+json",
	});
});
app.get("/ap/u/bot/following", context => {
	return context.json(new UnorderedCollection(
		context.req.url,
		[],
	), 200, {
		"Content-Type": "application/activity+json",
	});
});
app.get("/ap/activity/*", context => {
	return context.json({
		error: "Getting individual activities is not supported",
	}, 404, {
		"Content-Type": "application/activity+json",
	});
});

app.all("/assets/*", serveStatic({ root: "/dist/frontend" }));
app.get("/favicon.ico", serveStatic({ path: "/dist/frontend/favicon.ico" }));
app.all("*", serveStatic({ path: "/dist/frontend/index.html" }));

export default app;

process.on("uncaughtException", (error) => {
	console.error("Uncaught exception:", error, error.stack);
});
process.on("unhandledRejection", (reason) => {
	console.error("Unhandled rejection:", reason);
});
