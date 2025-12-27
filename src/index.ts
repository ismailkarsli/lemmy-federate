import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
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
	event: ScheduledEvent,
	env: CloudflareBindings,
	_ctx: ExecutionContext,
) {
	// Import job functions dynamically to avoid circular dependencies
	const { updateFollows } = await import("../scripts/update-follows.ts");
	const { addNewCommunities } = await import(
		"../scripts/add-new-communities.ts"
	);
	const { addAllCommunities } = await import(
		"../scripts/add-all-communities.ts"
	);
	const { clearDeletedCommunities } = await import(
		"../scripts/clear-deleted-communities.ts"
	);

	const hour = new Date(event.scheduledTime).getUTCHours();
	const day = new Date(event.scheduledTime).getUTCDate();

	// Every minute jobs
	await updateFollows(env);
	await addNewCommunities(env);

	// Daily at midnight (hour 0)
	if (hour === 0) {
		await addAllCommunities(env);

		// Every 2 days (odd days)
		if (day % 2 === 1) {
			await clearDeletedCommunities(env);
		}
	}
}

// Export for Cloudflare Workers
export default {
	fetch: app.fetch,
	scheduled,
};
