import type { User } from "@prisma/client";
import { defineStore } from "pinia";

interface UserPayloadInterface {
  token: string;
  user: Omit<User, "code" | "codeExp">;
}

export const useAuthStore = defineStore("auth", {
  state: (): {
    authenticated: boolean;
    user: Omit<User, "code" | "codeExp"> | null;
  } => ({
    authenticated: false,
    user: null,
  }),
  actions: {
    authenticate({ token, user }: UserPayloadInterface) {
      const tokenCookie = useCookie("token");
      tokenCookie.value = token;
      this.authenticated = true;
      this.user = user;
    },
    logout() {
      const tokenCookie = useCookie("token");
      this.authenticated = false;
      tokenCookie.value = null;
    },
  },
});
