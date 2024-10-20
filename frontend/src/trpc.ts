import { type TRPCLink, createTRPCClient, httpBatchLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "../../src/index.ts";
import { useAuthStore } from "./stores/auth.ts";

// Link to handle errors globally
export const errorHandler: TRPCLink<AppRouter> = () => {
	return ({ next, op }) => {
		return observable((observer) => {
			const unsubscribe = next(op).subscribe({
				next(value) {
					observer.next(value);
				},
				error(err) {
					observer.error(err);
					if (err?.data?.code === "UNAUTHORIZED") {
						const authStore = useAuthStore();
						authStore.logout();
					}
				},
				complete() {
					observer.complete();
				},
			});
			return unsubscribe;
		});
	};
};
export const trpc = createTRPCClient<AppRouter>({
	links: [
		errorHandler,
		httpBatchLink({
			url: import.meta.env.VITE_API_URL,
			fetch(url, init) {
				return fetch(url, { ...init, credentials: "include" });
			},
		}),
	],
});

/**
 * Serialize a type to a JSON-compatible type.
 * e.g. Date will be converted to string.
 */
export type Serialize<T> = T extends Date // Date --> string
	? string
	: T extends Array<infer U> // Array<T> --> Array<Serialize<T>> (recursion)
		? Array<Serialize<U>>
		: T extends object // Object --> Serialize<T> (recursion)
			? { [P in keyof T]: Serialize<T[P]> }
			: T; // T --> T (no change)
