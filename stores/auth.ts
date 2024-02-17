import type { User, Instance } from "@prisma/client";
import ms from "ms";
import { defineStore } from "pinia";

export type UserWithInstance = Omit<User, "code" | "codeExp"> & {
  instance: Instance;
};
interface UserPayloadInterface {
  token: string;
  user: UserWithInstance;
}

export const useAuthStore = defineStore("auth", {
  state: (): {
    authenticated: boolean;
    user: UserWithInstance | null;
  } => ({
    authenticated: false,
    user: null,
  }),
  actions: {
    authenticate({ token, user }: UserPayloadInterface) {
      const tokenCookie = useCookie("token", {
        expires: new Date(Date.now() + ms("8 weeks")),
      });
      tokenCookie.value = token;
      this.authenticated = true;
      this.user = user;
    },
    logout() {
      const tokenCookie = useCookie("token");
      this.authenticated = false;
      this.user = null;
      tokenCookie.value = null;
    },
  },
});
