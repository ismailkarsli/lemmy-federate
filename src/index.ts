import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import * as z from "zod/v4";
import { startJobs } from "../scripts/start-jobs.ts";
import { authRouter } from "./routes/auth.ts";
import { communityRouter } from "./routes/community.ts";
import { instanceRouter } from "./routes/instance.ts";
import { createContext, router } from "./trpc.ts";

const APP_URL = z.parse(z.string(), process.env.APP_URL);
const NODE_ENV = z.parse(z.string(), process.env.NODE_ENV);

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
			if (error.code === "INTERNAL_SERVER_ERROR") {
				console.error(error);
			}
		},
	}),
);

if (NODE_ENV === "production") startJobs();

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
