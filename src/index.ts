import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { serveStatic } from "@hono/node-server/serve-static";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { cors } from "hono/cors";
import { trimTrailingSlash } from "hono/trailing-slash";
import { rateLimiter } from "hono-rate-limiter";
import * as z from "zod";
import { queue as addAllCommunitiesQueue } from "./jobs/add-all-communities.ts";
import { queue as addNewCommunitiesQueue } from "./jobs/add-new-communities.ts";
import { queue as clearDeletedCommunitiesQueue } from "./jobs/clear-deleted-communities.ts";
import { queue as updateFollowsQueue } from "./jobs/update-follows.ts";
import { authRouter } from "./routes/auth.ts";
import { communityRouter } from "./routes/community.ts";
import { instanceRouter } from "./routes/instance.ts";
import { createContext, router } from "./trpc.ts";

const APP_URL = z.string().parse(process.env.APP_URL);
const NODE_ENV = z.string().parse(process.env.NODE_ENV);
const MASTER_KEY = process.env.MASTER_KEY;

const app = new Hono({ strict: true });
app.use(trimTrailingSlash());

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
	rateLimiter({
		windowMs: 60 * 1000,
		limit: NODE_ENV === "production" ? 100 : 1000,
		keyGenerator: (c) => Object.values(getConnInfo(c).remote).join(":"),
	}),
);

if (MASTER_KEY) {
	const bullBoardAdapter = new HonoAdapter(serveStatic);
	createBullBoard({
		serverAdapter: bullBoardAdapter,
		queues: [
			new BullMQAdapter(updateFollowsQueue),
			new BullMQAdapter(addNewCommunitiesQueue),
			new BullMQAdapter(addAllCommunitiesQueue),
			new BullMQAdapter(clearDeletedCommunitiesQueue),
		],
	});
	bullBoardAdapter.setBasePath("/api/bull-board");
	app.use(
		"/api/bull-board/*",
		basicAuth({ username: "lemy.lol", password: MASTER_KEY }),
	);
	app.route("/api/bull-board", bullBoardAdapter.registerPlugin());
}

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
	trpcServer({
		router: appRouter,
		createContext,
		onError: ({ error }) => {
			if (error.code === "INTERNAL_SERVER_ERROR") {
				console.error(error);
			}
		},
	}),
);

app.all("/assets/*", serveStatic({ root: "./frontend/dist" }));
app.get("/favicon.ico", serveStatic({ path: "./frontend/dist/favicon.ico" }));
app.all("*", serveStatic({ path: "./frontend/dist/index.html" }));

const server = serve(app);

server.on("listening", () => {
	console.info(`Serving on ${APP_URL}`);
});
process.on("SIGINT", () => {
	server.close();
	process.exit(0);
});
process.on("SIGTERM", () => {
	server.close((err) => {
		if (err) {
			console.error(err);
			process.exit(1);
		}
		process.exit(0);
	});
});
