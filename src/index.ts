import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { addAllCommunities } from "../scripts/add-all-communities.ts";
import { addNewCommunities } from "../scripts/add-new-communities.ts";
import { clearDeletedCommunities } from "../scripts/clear-deleted-communities.ts";
import { updateFollows } from "../scripts/update-follows.ts";
import { authRouter } from "./routes/auth.ts";
import { communityRouter } from "./routes/community.ts";
import { instanceRouter } from "./routes/instance.ts";
import { createContext, router } from "./trpc.ts";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(
	"/api/*",
	cors({
		origin: (origin) => {
			// In production, allow requests from the same origin
			// Workers automatically handle same-origin requests
			return origin;
		},
		credentials: true,
	}),
);

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

// Scheduled handler for cron jobs
async function scheduled(
	controller: ScheduledController,
	env: CloudflareBindings,
	ctx: ExecutionContext,
) {
	switch (controller.cron) {
		case "* * * * *":
			ctx.waitUntil(Promise.all([updateFollows(env), addNewCommunities(env)]));
			break;
		case "0 0 * * *":
			ctx.waitUntil(addAllCommunities(env));
			break;
		case "0 0 */2 * *":
			ctx.waitUntil(clearDeletedCommunities(env));
			break;
	}
}

// Export for Cloudflare Workers
export default {
	fetch: app.fetch,
	scheduled,
};
