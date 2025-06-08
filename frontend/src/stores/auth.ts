import type { Instance } from "@prisma/client";
import { defineStore } from "pinia";
import { type Serialize, trpc } from "../trpc.ts";

export const useAuthStore = defineStore("auth", {
	state: (): {
		authenticated: boolean;
		instance: Serialize<Instance> | null;
	} => ({
		authenticated: false,
		instance: null,
	}),
	actions: {
		authenticate(instance: Serialize<Instance>) {
			this.authenticated = true;
			this.instance = instance;
		},
		async logout() {
			await trpc.auth.logout.mutate();
			this.authenticated = false;
			this.instance = null;
		},
	},
});
