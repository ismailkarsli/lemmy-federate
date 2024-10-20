import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { createContext, router } from "./trpc";

import { authRouter } from "./routes/auth";
import { communityRouter } from "./routes/community";
import { instanceRouter } from "./routes/instance";

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
		origin: ["http://localhost:3000", "http://localhost:5173"],
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

app.all("/assets/*", serveStatic({ root: "/frontend/dist" }));
app.get("/favicon.ico", serveStatic({ path: "/frontend/dist/favicon.ico" }));
app.all("*", serveStatic({ path: "/frontend/dist/index.html" }));

export default app;
