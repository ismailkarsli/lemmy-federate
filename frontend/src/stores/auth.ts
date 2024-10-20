import type { Instance, User } from "@prisma/client";
import { defineStore } from "pinia";
import type { Serialize } from "../trpc";

export type UserWithInstance = Serialize<
	Omit<User, "code" | "codeExp"> & {
		instance: Instance;
	}
>;

export const useAuthStore = defineStore("auth", {
	state: (): {
		authenticated: boolean;
		user: UserWithInstance | null;
	} => ({
		authenticated: false,
		user: null,
	}),
	actions: {
		authenticate(user: UserWithInstance) {
			this.authenticated = true;
			this.user = user;
		},
		logout() {
			this.authenticated = false;
			this.user = null;
		},
	},
});
